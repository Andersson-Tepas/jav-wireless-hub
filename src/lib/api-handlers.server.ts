import { ApiError, handle, ok, publicClient, readJson, requireAdmin } from "./api.server";
import { lookupSchema, orderSchema, serviceSchema } from "./commerce.schemas";
import { createOrderCore, createServiceRequestCore, lookupOrderCore } from "./commerce.server";
import { categoryInput, orderStatusInput, productInput, serviceInput } from "./admin.schemas";

type Ctx = { request: Request; params: Record<string, string> };
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const must = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new ApiError(400, r.error.message); return r.data; };

// ---------- Public ----------
export const listProducts = handle(async ({ request }: Ctx) => {
  const u = new URL(request.url);
  let q = publicClient().from("products").select("*").eq("active", true).order("created_at", { ascending: false });
  const cat = u.searchParams.get("category"); if (cat) q = q.eq("category_id", cat);
  const search = u.searchParams.get("q"); if (search) q = q.ilike("name", `%${search.replace(/[%_,()]/g, "")}%`);
  return ok(must(await q));
});
export const getProduct = handle(async ({ params }: Ctx) => {
  const p = must(await publicClient().from("products").select("*").eq("id", params["id"]!).eq("active", true).maybeSingle());
  if (!p) throw new ApiError(404, "Product not found");
  return ok(p);
});
export const listCategories = handle(async (_c: Ctx) => ok(must(await publicClient().from("categories").select("id,name,sort").eq("active", true).order("sort"))));
export const listServices = handle(async (_c: Ctx) => ok(must(await publicClient().from("services").select("*").eq("active", true).order("sort"))));
export const postOrder = handle(async ({ request }: Ctx) => ok(await createOrderCore(orderSchema.parse(await readJson(request))), 201));
export const trackOrder = handle(async ({ request, params }: Ctx) => {
  const contact = new URL(request.url).searchParams.get("contact") ?? "";
  const { order_number, contact: c } = lookupSchema.parse({ order_number: params["code"], contact });
  const r = await lookupOrderCore(order_number, c);
  if (!r.found) throw new ApiError(404, "Order not found. Check the number and your phone or email.");
  return ok(r);
});
export const postServiceRequest = handle(async ({ request }: Ctx) => ok(await createServiceRequestCore(serviceSchema.parse(await readJson(request))), 201));

// ---------- Admin (every handler verifies token + admin role) ----------
export const adminListProducts = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  return ok(must(await supabase.from("products").select("*").order("created_at", { ascending: false })));
});
export const adminCreateProduct = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const body = productInput.parse(await readJson(request));
  return ok(must(await supabase.from("products").insert(body as never).select().single()), 201);
});
export const adminUpdateProduct = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const body = productInput.partial().parse(await readJson(request));
  const row = must(await supabase.from("products").update(body as never).eq("id", params["id"]!).select().maybeSingle());
  if (!row) throw new ApiError(404, "Product not found");
  return ok(row);
});
export const adminDeleteProduct = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const id = params["id"]!;
  // Products referenced by orders are deactivated instead of deleted to keep order history intact.
  const used = must(await supabase.from("order_items").select("id", { count: "exact", head: false }).eq("product_id", id).limit(1));
  if (used?.length) { must(await supabase.from("products").update({ active: false }).eq("id", id)); return ok({ id, deactivated: true }); }
  must(await supabase.from("products").delete().eq("id", id));
  return ok({ id, deleted: true });
});
export const adminListCategories = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  return ok(must(await supabase.from("categories").select("*").order("sort")));
});
export const adminCreateCategory = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const b = categoryInput.parse(await readJson(request));
  return ok(must(await supabase.from("categories").insert({ id: b.id ?? slugify(b.name), name: b.name, sort: b.sort ?? 99, active: b.active ?? true }).select().single()), 201);
});
export const adminUpdateCategory = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const b = categoryInput.partial().omit({ id: true }).parse(await readJson(request));
  return ok(must(await supabase.from("categories").update(b as never).eq("id", params["id"]!).select().maybeSingle()));
});
export const adminDeleteCategory = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const used = must(await supabase.from("products").select("id").eq("category_id", params["id"]!).limit(1));
  if (used?.length) throw new ApiError(409, "La categoría tiene productos; desactívala en lugar de eliminarla");
  must(await supabase.from("categories").delete().eq("id", params["id"]!));
  return ok({ id: params["id"], deleted: true });
});
export const adminListOrders = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  return ok(must(await supabase.from("orders").select("*, order_items(*), order_status_history(*)").order("created_at", { ascending: false })));
});
export const adminUpdateOrderStatus = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const b = orderStatusInput.parse(await readJson(request));
  const row = must(await supabase.from("orders").update(b as never).eq("id", params["id"]!).select().maybeSingle());
  if (!row) throw new ApiError(404, "Order no encontrado");
  return ok(row);
});
export const adminListPayments = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const [orders, reqs] = await Promise.all([
    supabase.from("orders").select("id,order_number,customer_name,payment_method,payment_reference,payment_status,total,created_at"),
    supabase.from("service_requests").select("id,reference,customer_name,payment_method,payment_reference,payment_status,amount,created_at"),
  ]);
  const list = [
    ...(must(orders) ?? []).map((o) => ({ kind: "order", id: o.id, code: o.order_number, customer: o.customer_name, method: o.payment_method, reference: o.payment_reference, status: o.payment_status, total: Number(o.total), created_at: o.created_at })),
    ...(must(reqs) ?? []).map((r) => ({ kind: "service", id: r.id, code: r.reference, customer: r.customer_name, method: r.payment_method, reference: r.payment_reference, status: r.payment_status, total: r.amount === null ? null : Number(r.amount), created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok(list);
});
export const adminListServices = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  return ok(must(await supabase.from("services").select("*").order("sort")));
});
export const adminUpdateService = handle(async ({ request, params }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const b = serviceInput.partial().parse(await readJson(request));
  const row = must(await supabase.from("services").update({ ...b, updated_at: new Date().toISOString() } as never).eq("slug", params["id"]!).select().maybeSingle());
  if (!row) throw new ApiError(404, "Service not found");
  return ok(row);
});
export const adminCreateService = handle(async ({ request }: Ctx) => {
  const { supabase } = await requireAdmin(request);
  const b = serviceInput.parse(await readJson(request));
  return ok(must(await supabase.from("services").insert({ ...b, slug: slugify(b.name) } as never).select().single()), 201);
});
