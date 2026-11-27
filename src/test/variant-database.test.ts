// @vitest-environment node
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const url = process.env["VARIANT_TEST_DATABASE_URL"];
// Never point this suite at the managed app database. Its fixture creates a fresh local schema.
if (url && !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Variant tests require an isolated localhost database");
const db = postgres(url ?? "postgres://postgres@127.0.0.1:55432/postgres", { max: 6 });
const adminId = "00000000-0000-4000-8000-000000000001";
type Line = { id: string; quantity: number; variant_id?: string };
const input = (items: Line[], key = crypto.randomUUID()) => ({ checkout_key: key, customer_name: "Fixture", email: "fixture@example.invalid", phone: "5551234567", delivery_method: "pickup", payment_method: "card", items });
async function product(stock = 3) {
  const [p] = await db`insert into public.products(name,stock,price) values('Local fixture',${stock},25) returning id`;
  if (!p) throw new Error("Missing fixture");
  return String(p["id"]);
}
const combination = (color: string | null, storage: string | null, stock: number) => ({ color_name: color, color_hex: null, storage, stock, image: null, active: true });
async function configure(id: string, color: boolean, storage: boolean, rows: ReturnType<typeof combination>[], expected: number) {
  return db.begin(async sql => {
    await sql`select set_config('request.jwt.claim.sub',${adminId},true)`;
    await sql`select configure_product_variants(${id}::uuid,${color},${storage},${sql.json(rows)},${expected})`;
  });
}
async function order(data: ReturnType<typeof input>) {
  const [row] = await db`select create_order_atomic(${db.json(data)}) as result`;
  return row?.["result"] as { order: { id: string; total: number }; items: { color_snapshot: string | null; storage_snapshot: string | null; quantity: number; price: number }[]; reused: boolean };
}
async function stock(id: string) {
  const [p] = await db`select stock from products where id=${id}::uuid`;
  return Number(p?.["stock"]);
}
describe.skipIf(!url)("actual PostgreSQL variant transactions (isolated fixtures)", () => {
  beforeAll(async () => {
    await db.unsafe(await readFile("src/test/fixtures/variant-database.sql", "utf8"));
    await db.unsafe(await readFile("drizzle/migrations/0006_opt_in_product_variants.sql", "utf8"));
    await db.unsafe(await readFile("drizzle/migrations/0007_variant_inventory_write_guards.sql", "utf8"));
    await db.unsafe(await readFile("drizzle/migrations/0008_variant_configuration_and_notification_guards.sql", "utf8"));
    await db`insert into user_roles(user_id,role) values(${adminId}::uuid,'admin')`;
    await db.unsafe("GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT SELECT ON products TO anon,authenticated; ALTER TABLE products ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_products ON products FOR SELECT TO anon,authenticated USING(active OR public.has_role((select auth.uid()),'admin'));");
  });
  afterAll(async () => { await db.end(); });
  it("creates legacy orders with authoritative price, sums duplicate lines, and retains null variant snapshots", async () => {
    const id = await product(4);
    const r = await order(input([{ id, quantity: 1 }, { id, quantity: 2 }]));
    expect(await stock(id)).toBe(1); expect(Number(r.order.total)).toBe(75);
    expect(r.items).toHaveLength(1); expect(r.items[0]?.quantity).toBe(3); expect(r.items[0]?.color_snapshot).toBeNull();
  });
  it("enables color-only with exact reconciliation and stores selection snapshot", async () => {
    const id = await product(3); await configure(id, true, false, [combination("Black", null, 2), combination("White", null, 1)], 3);
    expect(await stock(id)).toBe(3);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid and color_name='Black'`;
    const r = await order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]));
    expect(r.items[0]?.color_snapshot).toBe("Black"); expect(r.items[0]?.storage_snapshot).toBeNull(); expect(await stock(id)).toBe(2);
  });
  it("enables storage-only without inferring color", async () => {
    const id = await product(2); await configure(id, false, true, [combination(null, "128 GB", 2)], 2);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    const r = await order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]));
    expect(r.items[0]?.storage_snapshot).toBe("128 GB"); expect(r.items[0]?.color_snapshot).toBeNull();
  });
  it("rejects wrong stock reconciliation and rolls back configuration", async () => {
    const id = await product(3);
    await expect(configure(id, true, false, [combination("Black", null, 2)], 3)).rejects.toThrow("Allocate exactly");
    expect(await stock(id)).toBe(3);
    const [p] = await db`select color_variants_enabled from products where id=${id}::uuid`; expect(p?.["color_variants_enabled"]).toBe(false);
  });
  it("rejects missing, foreign, inactive and zero-stock variants", async () => {
    const id = await product(2); await configure(id, true, true, [combination("Black", "128 GB", 2), combination("White", "256 GB", 0)], 2);
    await expect(order(input([{ id, quantity: 1 }]))).rejects.toThrow("valid variant");
    await expect(order(input([{ id, variant_id: crypto.randomUUID(), quantity: 1 }]))).rejects.toThrow("valid variant");
    const [zero] = await db`select id from product_variants where product_id=${id}::uuid and stock=0`;
    await expect(order(input([{ id, variant_id: String(zero?.["id"]), quantity: 1 }]))).rejects.toThrow("Insufficient stock");
    const foreign = await product(1); await configure(foreign, true, false, [combination("Red", null, 1), combination("Blue", null, 0)], 1);
    const [v] = await db`select id from product_variants where product_id=${foreign}::uuid and color_name='Red'`;
    await expect(order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]))).rejects.toThrow("valid variant");
    await configure(foreign, true, false, [{ ...combination("Red", null, 1), active: false }, combination("Blue", null, 1)], 1);
    await expect(order(input([{ id: foreign, variant_id: String(v?.["id"]), quantity: 1 }]))).rejects.toThrow("valid variant");
  });
  it("prevents concurrent variant oversell with real row locks", async () => {
    const id = await product(1); await configure(id, true, false, [combination("Black", null, 1)], 1);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    const requests = await Promise.allSettled([order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }])), order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]))]);
    expect(requests.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(requests.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(await stock(id)).toBe(0);
    const [audit] = await db`select count(*) as n from inventory_movements where product_id=${id}::uuid and variant_id=${v?.["id"]}::uuid and kind='out'`; expect(Number(audit?.["n"])).toBe(1);
  });
  it("prevents concurrent legacy oversell", async () => {
    const id = await product(1);
    const r = await Promise.allSettled([order(input([{ id, quantity: 1 }])), order(input([{ id, quantity: 1 }]))]);
    expect(r.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(await stock(id)).toBe(0);
  });
  it("reuses concurrent/retried checkout key without a second deduction", async () => {
    const id = await product(3); const data = input([{ id, quantity: 1 }]);
    const [a, b] = await Promise.all([order(data), order(data)]);
    expect(a.order.id).toBe(b.order.id); expect(await stock(id)).toBe(2);
    await expect(order({ ...data, items: [{ id, quantity: 2 }] })).rejects.toThrow("different details");
  });
  it("rolls back all deductions when a later item is out of stock", async () => {
    const a = await product(2); const b = await product(0);
    await expect(order(input([{ id: a, quantity: 1 }, { id: b, quantity: 1 }]))).rejects.toThrow("Insufficient stock");
    expect(await stock(a)).toBe(2); expect(await stock(b)).toBe(0);
  });
  it("disabling preserves aggregate stock, variant rows and historical snapshots", async () => {
    const id = await product(2); await configure(id, true, false, [combination("Gold", null, 2)], 2);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    const r = await order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]));
    await configure(id, false, false, [], 1); expect(await stock(id)).toBe(1);
    const [retained] = await db`select active from product_variants where id=${v?.["id"]}::uuid`; expect(retained?.["active"]).toBe(false);
    const [snapshot] = await db`select color_snapshot from order_items where order_id=${r.order.id}::uuid`; expect(snapshot?.["color_snapshot"]).toBe("Gold");
  });
  it("guards direct aggregate/enable writes, negative variant stock and stale adjustments", async () => {
    const id = await product(2); await configure(id, true, false, [combination("Black", null, 2)], 2);
    await expect(db`update products set stock=1 where id=${id}::uuid`).rejects.toThrow("Adjust stock by variant");
    await expect(db`update products set color_variants_enabled=false where id=${id}::uuid`).rejects.toThrow("reconciled variant");
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    await expect(db`update product_variants set stock=-1 where id=${v?.["id"]}::uuid`).rejects.toThrow();
    await expect(db.begin(async sql => { await sql`select set_config('request.jwt.claim.sub',${adminId},true)`; await sql`select adjust_product_inventory(${id}::uuid,${v?.["id"]}::uuid,1,1)`; })).rejects.toThrow("Stock changed");
    expect(await stock(id)).toBe(2);
  });
  it("enforces null-aware case-insensitive uniqueness", async () => {
    const id = await product(2);
    await expect(db.begin(async sql => {
      await sql`select set_config('jav.variant_config',${id},true)`;
      await sql`insert into product_variants(product_id,color_name,stock) values(${id}::uuid,'Black',1)`;
      await sql`insert into product_variants(product_id,color_name,stock) values(${id}::uuid,'black',1)`;
    })).rejects.toThrow("variants_normalized_combination");
    expect(await stock(id)).toBe(2);
  });
  it("rejects direct combination creation/activation and protects snapshots", async () => {
    const id = await product(2);
    await expect(db`insert into product_variants(product_id,color_name,stock) values(${id}::uuid,'Black',1)`).rejects.toThrow("reconciled variant configuration");
    await configure(id, true, false, [combination("Black", null, 2)], 2);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    await expect(db`update product_variants set active=false where id=${v?.["id"]}::uuid`).rejects.toThrow("reconciled variant configuration");
    const r = await order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]));
    await expect(db`update order_items set color_snapshot='White' where order_id=${r.order.id}::uuid`).rejects.toThrow("immutable");
  });
  it("includes immutable selections in status notification messages", async () => {
    const id = await product(2); await configure(id, true, true, [combination("Black", "128 GB", 2)], 2);
    const [v] = await db`select id from product_variants where product_id=${id}::uuid`;
    const r = await order(input([{ id, variant_id: String(v?.["id"]), quantity: 1 }]));
    const [notice] = await db`insert into notifications(order_id,message) values(${r.order.id}::uuid,'Order preparing.') returning message`;
    expect(notice?.["message"]).toContain("Black / 128 GB");
  });
  it("restricts public reads and denies public/admin-unauthorized writes", async () => {
    const id = await product(1); await configure(id, true, false, [combination("Blue", null, 1)], 1);
    const publicRows = await db.begin(async sql => { await sql.unsafe("set local role anon"); return sql`select id from product_variants where product_id=${id}::uuid`; });
    expect(publicRows).toHaveLength(1);
    await db`update products set active=false where id=${id}::uuid`;
    const hidden = await db.begin(async sql => { await sql.unsafe("set local role anon"); return sql`select id from product_variants where product_id=${id}::uuid`; }); expect(hidden).toHaveLength(0);
    await expect(db.begin(async sql => { await sql.unsafe("set local role anon"); await sql`select create_order_atomic(${sql.json(input([{ id, quantity: 1 }]))})`; })).rejects.toThrow("permission denied");
    await expect(db.begin(async sql => { await sql.unsafe("set local role authenticated"); await sql`select configure_product_variants(${id}::uuid,false,false,'[]'::jsonb,1)`; })).rejects.toThrow("Forbidden");
  });
});