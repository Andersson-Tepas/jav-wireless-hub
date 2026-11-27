import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildVariantPriceTemplateZip,
  parseVariantPriceZip,
  VARIANT_PRICE_MANIFEST_FILENAME,
  VARIANT_PRICE_UPDATE_MANIFEST_KIND,
  type ExistingProductForPriceUpdate,
  type ExistingVariantForPriceUpdate,
} from "@/lib/zip-variant-price-import";

const PID_1 = "11111111-1111-4111-8111-111111111111";
const VID_1 = "22222222-2222-4222-8222-222222222221";
const VID_2 = "22222222-2222-4222-8222-222222222222";
const VID_INACTIVE = "22222222-2222-4222-8222-222222222223";

const products: ExistingProductForPriceUpdate[] = [
  { id: PID_1, name: "iPhone 15", category_id: "telefonos", price: 699.99, active: true, color_variants_enabled: true, storage_variants_enabled: true },
];

const variants: ExistingVariantForPriceUpdate[] = [
  { id: VID_1, product_id: PID_1, color_name: "Black", color_hex: "#171717", storage: "128 GB", stock: 3, active: true, price_override: null },
  { id: VID_2, product_id: PID_1, color_name: "Blue", color_hex: "#2563EB", storage: "256 GB", stock: 2, active: true, price_override: 799.99 },
  { id: VID_INACTIVE, product_id: PID_1, color_name: "Pink", color_hex: "#EC4899", storage: "512 GB", stock: 0, active: false, price_override: null },
];

const makeZip = (manifest: unknown) =>
  zipSync({ [VARIANT_PRICE_MANIFEST_FILENAME]: strToU8(JSON.stringify(manifest)) });

describe("ZIP variant price update parser", () => {
  it("parses valid updates, marks unchanged rows, and never pre-selects rows", () => {
    const bytes = makeZip({
      version: 1,
      kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND,
      entries: [
        { product_id: PID_1, variant_id: VID_1, expected_base_price: 699.99, expected_price_override: null, price_override: 729.99, note: "New tier" },
        { product_id: PID_1, variant_id: VID_2, expected_base_price: 699.99, expected_price_override: 799.99, price_override: null, note: "Reset to base" },
      ],
    });
    const res = parseVariantPriceZip(bytes, products, variants);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]?.status).toBe("ready");
    expect(res.rows[0]?.selected).toBe(false);
    expect(res.rows[0]?.currentEffectivePrice).toBe(699.99);
    expect(res.rows[0]?.proposedEffectivePrice).toBe(729.99);
    expect(res.rows[1]?.status).toBe("ready");
    expect(res.rows[1]?.currentEffectivePrice).toBe(799.99);
    expect(res.rows[1]?.proposedEffectivePrice).toBe(699.99);
  });

  it("rejects wrong manifest kind/version, unsafe paths, duplicate variant IDs, and precision > 2 decimals", () => {
    expect("error" in parseVariantPriceZip(makeZip({ version: 2, kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND, entries: [] }), products, variants)).toBe(true);
    expect("error" in parseVariantPriceZip(makeZip({ version: 1, kind: "wrong", entries: [] }), products, variants)).toBe(true);
    const unsafe = zipSync({ "../evil.json": strToU8("{}") });
    expect("error" in parseVariantPriceZip(unsafe, products, variants)).toBe(true);

    const badEntries = makeZip({
      version: 1,
      kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND,
      entries: [
        { product_id: PID_1, variant_id: VID_1, expected_base_price: 699.99, expected_price_override: null, price_override: 700.125 },
        { product_id: PID_1, variant_id: VID_1, expected_base_price: 699.99, expected_price_override: null, price_override: 710 },
      ],
    });
    const res = parseVariantPriceZip(badEntries, products, variants);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows[0]?.status).toBe("invalid");
    expect(res.rows[1]?.status).toBe("invalid");
    expect(res.rows[1]?.errors.join(" ")).toContain("Duplicate variant_id");
  });

  it("flags stale base prices, stale overrides, and inactive variants as conflicts", () => {
    const bytes = makeZip({
      version: 1,
      kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND,
      entries: [
        { product_id: PID_1, variant_id: VID_1, expected_base_price: 650.0, expected_price_override: null, price_override: 720 },
        { product_id: PID_1, variant_id: VID_2, expected_base_price: 699.99, expected_price_override: 750.0, price_override: 820 },
        { product_id: PID_1, variant_id: VID_INACTIVE, expected_base_price: 699.99, expected_price_override: null, price_override: 899 },
      ],
    });
    const res = parseVariantPriceZip(bytes, products, variants);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.map((r) => r.status)).toEqual(["conflict", "conflict", "conflict"]);
  });

  it("exports a round-trip template ZIP with existing active variants unchanged", () => {
    const tpl = buildVariantPriceTemplateZip(products, variants);
    const res = parseVariantPriceZip(tpl, products, variants);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows).toHaveLength(2);
    expect(res.rows.every((r) => r.status === "unchanged")).toBe(true);
  });
});