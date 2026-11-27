import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildInitialVariantRpcArgs,
  canConfirmReviewRow,
  countVariantsByProduct,
  evaluateVariantUpdateMatch,
  isVariantRowSelectable,
  parseVariantUpdateZip,
  VARIANT_UPDATE_MANIFEST_KIND,
  type ExistingProductForVariantUpdate,
  type ExistingVariantRef,
} from "@/lib/zip-variant-import";
import { ZIP_IMPORT_LIMITS } from "@/lib/zip-product-import";

const CATEGORIES = new Set(["telefonos", "tablets", "accesorios", "joyeria", "computadoras", "regalos"]);

const IPHONE_ID = "04a9b6de-c22f-46dd-8031-b6d9d872c338";
const REVIEW_ID = "11111111-2222-4333-8444-555555555555";
const SKIP_ID = "22222222-3333-4444-8555-666666666666";
const PREEXISTING_ID = "33333333-4444-4555-8666-777777777777";

const CATALOG: ExistingProductForVariantUpdate[] = [
  {
    id: IPHONE_ID,
    name: "Apple iPhone 16 (Pink)",
    category_id: "telefonos",
    stock: 1,
    active: true,
    color_variants_enabled: false,
    storage_variants_enabled: false,
    colors: ["Pink"],
    capacity: "128 GB",
  },
  {
    id: REVIEW_ID,
    name: "Samsung Galaxy A15",
    category_id: "telefonos",
    stock: 3,
    active: true,
    color_variants_enabled: false,
    storage_variants_enabled: false,
    colors: [],
    capacity: "",
  },
  {
    id: SKIP_ID,
    name: "USB-C Wall Charger",
    category_id: "accesorios",
    stock: 5,
    active: true,
    color_variants_enabled: false,
    storage_variants_enabled: false,
  },
  {
    id: PREEXISTING_ID,
    name: "Apple iPad 10th Gen",
    category_id: "tablets",
    stock: 2,
    active: true,
    color_variants_enabled: false,
    storage_variants_enabled: false,
  },
];

function makeReadyEntry(overrides: Record<string, unknown> = {}) {
  return {
    product_id: IPHONE_ID,
    name: "Apple iPhone 16 (Pink)",
    category_id: "telefonos",
    expected_stock: 1,
    existing_colors: ["Pink"],
    existing_capacity: "128 GB",
    status: "ready_for_admin_confirmation",
    color_variants_enabled: true,
    storage_variants_enabled: true,
    variants: [
      { color_name: "Pink", color_hex: "#E6A5BF", storage: "128 GB", stock: 1, image: null, active: true },
    ],
    suggested_colors: [
      { name: "Black", hex: "#171717" },
      { name: "Pink", hex: "#E6A5BF" },
    ],
    suggested_storage: ["128 GB", "256 GB", "512 GB"],
    market_source: "https://www.apple.com/iphone-16/specs/",
    note: "Verified single unit in stock; market suggestions are reference only.",
    ...overrides,
  };
}

function makeReviewEntry(overrides: Record<string, unknown> = {}) {
  return {
    product_id: REVIEW_ID,
    name: "Samsung Galaxy A15",
    category_id: "telefonos",
    expected_stock: 3,
    existing_colors: [],
    existing_capacity: "",
    status: "review",
    color_variants_enabled: false,
    storage_variants_enabled: false,
    variants: [],
    suggested_colors: [
      { name: "Blue Black", hex: "#1B2430" },
      { name: "Blue", hex: "#3B82F6" },
    ],
    suggested_storage: ["128 GB", "256 GB"],
    market_source: "https://www.samsung.com/galaxy-a15/",
    note: "Confirm physical colors and storage before activating.",
    ...overrides,
  };
}

function makeSkipEntry(overrides: Record<string, unknown> = {}) {
  return {
    product_id: SKIP_ID,
    name: "USB-C Wall Charger",
    category_id: "accesorios",
    expected_stock: 5,
    existing_colors: [],
    existing_capacity: "",
    status: "skip",
    color_variants_enabled: false,
    storage_variants_enabled: false,
    variants: [],
    suggested_colors: [],
    suggested_storage: [],
    market_source: null,
    note: "Single SKU accessory, skip variants.",
    ...overrides,
  };
}

function makeManifest(products: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    kind: VARIANT_UPDATE_MANIFEST_KIND,
    catalog_snapshot: "2026-11-27",
    catalog_total: 139,
    excluded_categories: { herramientas: 38, perfumes: 31 },
    update_images: false,
    update_prices: false,
    create_products: false,
    requires_admin_confirmation: true,
    products,
    ...overrides,
  };
}

function makeZip(manifest: unknown, extraFiles: Record<string, Uint8Array> = {}) {
  return zipSync({
    ...(manifest !== undefined ? { "variants.json": strToU8(JSON.stringify(manifest)) } : {}),
    ...extraFiles,
  });
}

describe("parseVariantUpdateZip", () => {
  it("parses exact manifest shape with ready, review, and skip rows, safely ignores revision.csv and LEEME.txt, and selects nothing by default", () => {
    const zip = makeZip(
      makeManifest([makeReadyEntry(), makeReviewEntry(), makeSkipEntry()]),
      {
        "revision.csv": strToU8("product_id,status\n1,ready\n"),
        "LEEME.txt": strToU8("Instrucciones de revisión"),
      },
    );
    const res = parseVariantUpdateZip(zip, CATEGORIES, CATALOG, []);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;

    expect(res.meta).toEqual({
      catalog_snapshot: "2026-11-27",
      catalog_total: 139,
      excluded_categories: { herramientas: 38, perfumes: 31 },
    });
    expect(res.rows.map((r) => [r.status, r.selected, r.reviewConfirmed, isVariantRowSelectable(r)])).toEqual([
      ["ready", false, false, true],
      ["review", false, false, false],
      ["skip", false, false, false],
    ]);

    // Suggestions are never auto-activated or turned into fabricated stock
    expect(res.rows[1]?.draftVariants).toEqual([]);
    expect(res.rows[1]?.draftColorEnabled).toBe(false);
    expect(res.rows[1]?.draftStorageEnabled).toBe(false);
    expect(res.rows[1]?.entry.suggested_colors).toHaveLength(2);
    expect(res.rows[1]?.entry.suggested_storage).toEqual(["128 GB", "256 GB"]);

    // RPC args for ready row preserve exact stock and null image
    const args = buildInitialVariantRpcArgs(res.rows[0]!);
    expect(args).toEqual({
      _product_id: IPHONE_ID,
      _color: true,
      _storage: true,
      _variants: [
        { color_name: "Pink", color_hex: "#E6A5BF", storage: "128 GB", stock: 1, image: null, active: true },
      ],
      _expected_stock: 1,
    });
  });

  it("rejects invalid manifest flags, wrong kind/version, missing variants.json, and unsafe ZIP paths", () => {
    expect("error" in parseVariantUpdateZip(makeZip(undefined, { "LEEME.txt": strToU8("hi") }), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { version: 2 })), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { kind: "other" })), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { update_images: true })), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { update_prices: true })), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { create_products: true })), CATEGORIES, CATALOG, [])).toBe(true);
    expect("error" in parseVariantUpdateZip(makeZip(makeManifest([makeReadyEntry()], { requires_admin_confirmation: false })), CATEGORIES, CATALOG, [])).toBe(true);

    const unsafeZip = makeZip(makeManifest([makeReadyEntry()]), { "../escape.txt": strToU8("bad") });
    const unsafeRes = parseVariantUpdateZip(unsafeZip, CATEGORIES, CATALOG, []);
    expect("error" in unsafeRes && unsafeRes.error).toMatch(/unsafe path/i);
  });

  it("enforces ZIP entry count limit", () => {
    const files: Record<string, Uint8Array> = { "variants.json": strToU8(JSON.stringify(makeManifest([makeReadyEntry()]))) };
    for (let i = 0; i < ZIP_IMPORT_LIMITS.maxEntries + 1; i++) files[`extra/${i}.txt`] = strToU8("x");
    const res = parseVariantUpdateZip(zipSync(files, { level: 0 }), CATEGORIES, CATALOG, []);
    expect("error" in res && res.error).toMatch(/500-file limit/i);
  });

  it("rejects non-null variant images, duplicate product_ids, invalid UUIDs, duplicate combinations, and bad ready allocation", () => {
    const zip = makeZip(
      makeManifest([
        makeReadyEntry({
          variants: [{ color_name: "Pink", color_hex: "#E6A5BF", storage: "128 GB", stock: 1, image: "https://example.com/a.jpg", active: true }],
        }),
        makeReadyEntry(), // duplicate product_id of row 0
        makeReadyEntry({ product_id: "not-a-uuid" }),
        makeReadyEntry({
          product_id: REVIEW_ID,
          name: "Samsung Galaxy A15",
          expected_stock: 3,
          variants: [
            { color_name: "Blue", color_hex: "#3B82F6", storage: "128 GB", stock: 2, image: null, active: true },
            { color_name: " blue ", color_hex: "#3B82F6", storage: "128 gb", stock: 1, image: null, active: true },
          ],
        }),
        makeReadyEntry({
          product_id: SKIP_ID,
          name: "USB-C Wall Charger",
          category_id: "accesorios",
          expected_stock: 5,
          variants: [{ color_name: "White", color_hex: "#FFFFFF", storage: "128 GB", stock: 2, image: null, active: true }],
        }),
      ]),
    );

    const res = parseVariantUpdateZip(zip, CATEGORIES, CATALOG, []);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.every((r) => r.status === "invalid" && !r.selected && !isVariantRowSelectable(r))).toBe(true);
    expect(res.rows[0]?.errors.join(" ")).toMatch(/image must be null/i);
    expect(res.rows[1]?.errors.join(" ")).toMatch(/Duplicate product_id/i);
    expect(res.rows[2]?.errors.join(" ")).toMatch(/valid UUID/i);
    expect(res.rows[3]?.errors.join(" ")).toMatch(/Duplicate variant combination/i);
    expect(res.rows[4]?.errors.join(" ")).toMatch(/Allocate exactly the current stock/i);
  });

  it("flags stock mismatch, name/category mismatch, inactive products, preexisting flags, and preexisting inactive variants as conflict", () => {
    const catalogWithIssues: ExistingProductForVariantUpdate[] = [
      { ...CATALOG[0]!, stock: 4 }, // stock mismatch (expected 1)
      { ...CATALOG[1]!, active: false }, // inactive
      { ...CATALOG[3]!, color_variants_enabled: false, storage_variants_enabled: false }, // has inactive variant row below
    ];
    const existingVariants: ExistingVariantRef[] = [
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", product_id: PREEXISTING_ID },
    ];
    const zip = makeZip(
      makeManifest([
        makeReadyEntry(),
        makeReviewEntry(),
        makeReadyEntry({
          product_id: PREEXISTING_ID,
          name: "Apple iPad 10th Gen",
          category_id: "tablets",
          expected_stock: 2,
          color_variants_enabled: true,
          storage_variants_enabled: false,
          variants: [{ color_name: "Silver", color_hex: "#D4D4D8", storage: null, stock: 2, image: null, active: true }],
        }),
      ]),
    );
    const res = parseVariantUpdateZip(zip, CATEGORIES, catalogWithIssues, existingVariants);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.map((r) => r.status)).toEqual(["conflict", "conflict", "conflict"]);
    expect(res.rows[0]?.errors.join(" ")).toMatch(/Current stock \(4\) differs from expected stock \(1\)/i);
    expect(res.rows[1]?.errors.join(" ")).toMatch(/inactive/i);
    expect(res.rows[2]?.errors.join(" ")).toMatch(/existing variant record/i);

    // Also verify fresh pre-write check rejects preexisting flags
    const flaggedMap = new Map([[IPHONE_ID, { ...CATALOG[0]!, color_variants_enabled: true }]]);
    const recheck = evaluateVariantUpdateMatch(res.rows[0]!.entry, flaggedMap, countVariantsByProduct([]));
    expect(recheck.ok).toBe(false);
    if (!recheck.ok) expect(recheck.reasons.join(" ")).toMatch(/variant flags enabled/i);
  });

  it("keeps review rows unselectable until explicitly reconciled to exact stock and confirmed", () => {
    const zip = makeZip(makeManifest([makeReviewEntry()]));
    const res = parseVariantUpdateZip(zip, CATEGORIES, CATALOG, []);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    const row = res.rows[0]!;
    expect(canConfirmReviewRow(row)).toBe(false);
    expect(isVariantRowSelectable(row)).toBe(false);

    // Added combination starts at 0 -> still cannot confirm
    const unallocated = {
      ...row,
      draftColorEnabled: true,
      draftVariants: [{ color_name: "Blue", color_hex: "#3B82F6", storage: null, stock: 0, image: null, active: true }],
    };
    expect(canConfirmReviewRow(unallocated)).toBe(false);

    // Reconciled to exact stock (3) -> can confirm, but still not selectable until reviewConfirmed === true
    const reconciled = {
      ...unallocated,
      draftVariants: [
        { color_name: "Blue", color_hex: "#3B82F6", storage: null, stock: 2, image: null, active: true },
        { color_name: "Blue Black", color_hex: "#1B2430", storage: null, stock: 1, image: null, active: true },
      ],
    };
    expect(canConfirmReviewRow(reconciled)).toBe(true);
    expect(isVariantRowSelectable(reconciled)).toBe(false);

    const confirmed = { ...reconciled, reviewConfirmed: true };
    expect(isVariantRowSelectable(confirmed)).toBe(true);
    expect(buildInitialVariantRpcArgs(confirmed)._expected_stock).toBe(3);
  });
});