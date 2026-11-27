import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildImageUpdatePayload,
  buildProductInsertPayload,
  parseImageUpdateZip,
  parseProductZip,
  productMatchKey,
  resolveUniqueTargetProduct,
  ZIP_IMPORT_LIMITS,
} from "@/lib/zip-product-import";

const VALID_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const VALID_JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const VALID_WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);

const CATEGORIES = new Set(["herramientas", "joyeria", "accesorios", "telefonos"]);

const EXISTING_JEWELRY = [
  "Hoop Earrings Collection",
  "Gold-Tone Iced Cuban Link Necklace",
  "Gold-Tone Chain Necklace Collection",
  "Silver-Tone Tennis Necklace Collection",
  "Assorted Necklaces and Pendants",
  "Silver-Tone Chains and Religious Pendants",
].map((name) => ({ name, category_id: "joyeria" }));

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    image_file: "herramientas/brand/drill.jpg",
    name: "Cordless Impact Driver",
    brand: "DeWalt",
    model: "DCF887",
    category_id: "herramientas",
    capacity: "20V",
    price: 149.99,
    stock: 4,
    colors: ["Yellow", "Black"],
    description: "Brushless cordless impact driver.",
    features: ["3-speed settings", "LED work light"],
    specs: [{ label: "Voltage", value: "20V" }],
    financing: null,
    source: "Provisional catalog sheet",
    ...overrides,
  };
}

function makeZip(manifest: unknown, files: Record<string, Uint8Array> = {}) {
  return zipSync({
    ...(manifest !== undefined ? { "products.json": strToU8(JSON.stringify(manifest)) } : {}),
    ...files,
  });
}

describe("parseProductZip", () => {
  it("accepts a valid v1 manifest with PNG, JPG, and WebP images", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          makeItem({ image_file: "herramientas/brand/drill.jpg", name: "Drill A", category_id: "herramientas" }),
          makeItem({ image_file: "joyeria/ring.png", name: "Gold Ring", category_id: "joyeria" }),
          makeItem({ image_file: "accesorios/case.webp", name: "Rugged Case", category_id: "accesorios" }),
        ],
      },
      {
        "herramientas/brand/drill.jpg": VALID_JPG,
        "joyeria/ring.png": VALID_PNG,
        "accesorios/case.webp": VALID_WEBP,
      },
    );
    const res = parseProductZip(zip, CATEGORIES, EXISTING_JEWELRY);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows).toHaveLength(3);
    expect(res.rows.map((r) => [r.status, r.selected, r.imageMime])).toEqual([
      ["ready", true, "image/jpeg"],
      ["ready", true, "image/png"],
      ["ready", true, "image/webp"],
    ]);
  });

  it("rejects missing products.json and unsupported manifest version", () => {
    const missing = parseProductZip(makeZip(undefined, { "a.jpg": VALID_JPG }), CATEGORIES, []);
    expect("error" in missing && missing.error).toMatch(/products\.json/i);

    const badVer = parseProductZip(makeZip({ version: 2, products: [makeItem()] }), CATEGORIES, []);
    expect("error" in badVer && badVer.error).toMatch(/version: 1/i);
  });

  it("detects existing inactive jewelry duplicates by normalized name + category and skips within-ZIP duplicates", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          makeItem({ image_file: "joyeria/1.jpg", name: "  hoop   earrings collection ", category_id: "joyeria" }),
          makeItem({ image_file: "joyeria/2.jpg", name: "Gold-Tone Iced Cuban Link Necklace", category_id: "joyeria" }),
          makeItem({ image_file: "accesorios/1.jpg", name: "Hoop Earrings Collection", category_id: "accesorios" }),
          makeItem({ image_file: "accesorios/2.jpg", name: "  hoop earrings   collection", category_id: "accesorios" }),
        ],
      },
      {
        "joyeria/1.jpg": VALID_JPG,
        "joyeria/2.jpg": VALID_JPG,
        "accesorios/1.jpg": VALID_JPG,
        "accesorios/2.jpg": VALID_JPG,
      },
    );
    const res = parseProductZip(zip, CATEGORIES, EXISTING_JEWELRY);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.map((r) => [r.status, r.selected])).toEqual([
      ["duplicate_db", false],
      ["duplicate_db", false],
      ["ready", true],
      ["duplicate_zip", false],
    ]);
    expect(productMatchKey("  Gold-Tone   Chain Necklace Collection", "joyeria")).toBe(
      productMatchKey("gold-tone chain necklace collection", "joyeria"),
    );
  });

  it("marks invalid paths, missing/disguised images, unknown categories, and bad price/stock", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          makeItem({ image_file: "../escape.jpg", name: "Bad Path" }),
          makeItem({ image_file: "accesorios/fake.jpg", name: "Fake Image", category_id: "accesorios" }),
          makeItem({ image_file: "herramientas/brand/drill.jpg", name: "Bad Fields", category_id: "nonexistent", price: -5, stock: 1.5 }),
          makeItem({ image_file: "herramientas/brand/missing.jpg", name: "Missing File" }),
        ],
      },
      {
        "accesorios/fake.jpg": strToU8("not actually an image"),
        "herramientas/brand/drill.jpg": VALID_JPG,
      },
    );
    const res = parseProductZip(zip, CATEGORIES, []);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    for (const row of res.rows) {
      expect(row.status).toBe("invalid");
      expect(row.selected).toBe(false);
      expect(row.errors.length).toBeGreaterThan(0);
    }
    expect(res.rows[0]?.errors.join(" ")).toMatch(/unsafe path/i);
    expect(res.rows[1]?.errors.join(" ")).toMatch(/not a valid PNG, JPG, or WebP/i);
    expect(res.rows[2]?.errors.join(" ")).toMatch(/Unknown category/i);
    expect(res.rows[2]?.errors.join(" ")).toMatch(/price/i);
    expect(res.rows[2]?.errors.join(" ")).toMatch(/stock/i);
    expect(res.rows[3]?.errors.join(" ")).toMatch(/Image not found/i);
  });

  it("enforces ZIP entry count and per-image 5 MB bounds", () => {
    const tooMany: Record<string, Uint8Array> = { "products.json": strToU8(JSON.stringify({ version: 1, products: [makeItem()] })) };
    for (let i = 0; i < ZIP_IMPORT_LIMITS.maxEntries + 1; i++) tooMany[`f/${i}.jpg`] = VALID_JPG;
    const countRes = parseProductZip(zipSync(tooMany, { level: 0 }), CATEGORIES, []);
    expect("error" in countRes && countRes.error).toMatch(/500-file limit/i);

    const bigImage = new Uint8Array(ZIP_IMPORT_LIMITS.maxImageBytes + 1);
    bigImage.set(VALID_JPG, 0);
    const sizeRes = parseProductZip(makeZip({ version: 1, products: [makeItem()] }, { "herramientas/brand/drill.jpg": bigImage }), CATEGORIES, []);
    expect("error" in sizeRes && sizeRes.error).toMatch(/5 MB limit/i);
  });

  it("forces inactive draft flags, omits source, and rejects data URLs in buildProductInsertPayload", () => {
    const itemWithOverrides = makeItem({
      active: true,
      is_new: false,
      is_featured: true,
      is_bestseller: true,
      is_offer: true,
      old_price: 199.99,
    });
    const zip = makeZip({ version: 1, products: [itemWithOverrides] }, { "herramientas/brand/drill.jpg": VALID_JPG });
    const res = parseProductZip(zip, CATEGORIES, []);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;

    const payload = buildProductInsertPayload(res.rows[0]!.product, "https://storage.example.com/signed/abc.jpg");
    expect(payload.active).toBe(false);
    expect(payload.is_new).toBe(true);
    expect(payload.is_featured).toBe(false);
    expect(payload.is_bestseller).toBe(false);
    expect(payload.is_offer).toBe(false);
    expect(payload.old_price).toBeNull();
    expect(payload.image).toBe("https://storage.example.com/signed/abc.jpg");
    expect("source" in payload).toBe(false);

    expect(() => buildProductInsertPayload(res.rows[0]!.product, "data:image/jpeg;base64,/9j/")).toThrow(/storage image URL/i);
  });
});

describe("parseImageUpdateZip", () => {
  const EXISTING_CATALOG = [
    { id: "p-sunglasses", name: "Assorted Sunglasses Collection", category_id: "accesorios", image: "https://storage.example.com/old/sunglasses.jpg", active: false },
    { id: "p-dup-1", name: "USB-C Cable", category_id: "accesorios", image: "https://storage.example.com/old/c1.jpg", active: true },
    { id: "p-dup-2", name: "usb-c   cable", category_id: "accesorios", image: "https://storage.example.com/old/c2.jpg", active: true },
    { id: "p-ring", name: "Gold Ring", category_id: "joyeria", image: "https://storage.example.com/old/ring.jpg", active: true },
  ];

  it("accepts the minimal image-update manifest (name, category_id, image_file, note) and matches uniquely", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          {
            name: "Assorted Sunglasses Collection",
            category_id: "accesorios",
            image_file: "Accessories/lentes-de-sol-coleccion.png",
            note: "AI-recreated clean studio photo; verify before publishing",
          },
        ],
      },
      { "Accessories/lentes-de-sol-coleccion.png": VALID_PNG },
    );

    const res = parseImageUpdateZip(zip, CATEGORIES, EXISTING_CATALOG);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.status).toBe("ready");
    expect(res.rows[0]?.selected).toBe(true);
    expect(res.rows[0]?.matchedProduct?.id).toBe("p-sunglasses");
    expect(res.rows[0]?.entry.note).toBe("AI-recreated clean studio photo; verify before publishing");
    expect(res.rows[0]?.imageMime).toBe("image/png");
  });

  it("skips missing, ambiguous, duplicate-in-ZIP, and inconsistent product_id entries while allowing consistent product_id", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          { name: "Nonexistent Product", category_id: "accesorios", image_file: "Accessories/a.png", note: "" },
          { name: "USB-C Cable", category_id: "accesorios", image_file: "Accessories/b.png", note: "Ambiguous without id" },
          { name: "Assorted Sunglasses Collection", category_id: "accesorios", image_file: "Accessories/a.png", note: "First ok" },
          { name: "  assorted   sunglasses collection ", category_id: "accesorios", image_file: "Accessories/b.png", note: "Duplicate in ZIP" },
          { name: "Gold Ring", category_id: "joyeria", product_id: "p-sunglasses", image_file: "Accessories/a.png", note: "Wrong id" },
          { name: "USB-C Cable", category_id: "accesorios", product_id: "p-dup-2", image_file: "Accessories/b.png", note: "Disambiguated by id" },
        ],
      },
      { "Accessories/a.png": VALID_PNG, "Accessories/b.png": VALID_PNG },
    );

    const res = parseImageUpdateZip(zip, CATEGORIES, EXISTING_CATALOG);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.map((r) => [r.status, r.selected, r.matchedProduct?.id ?? null])).toEqual([
      ["missing", false, null],
      ["ambiguous", false, null],
      ["ready", true, "p-sunglasses"],
      ["duplicate_zip", false, null],
      ["invalid", false, null],
      ["ready", true, "p-dup-2"],
    ]);
  });

  it("reuses safe path, magic-byte image validation, and category validation in image-update mode", () => {
    const zip = makeZip(
      {
        version: 1,
        products: [
          { name: "Assorted Sunglasses Collection", category_id: "accesorios", image_file: "../evil.png", note: "" },
          { name: "Assorted Sunglasses Collection", category_id: "accesorios", image_file: "Accessories/fake.png", note: "" },
          { name: "Assorted Sunglasses Collection", category_id: "unknown_cat", image_file: "Accessories/ok.png", note: "" },
        ],
      },
      { "Accessories/fake.png": strToU8("not a png"), "Accessories/ok.png": VALID_PNG },
    );

    const res = parseImageUpdateZip(zip, CATEGORIES, EXISTING_CATALOG);
    expect("rows" in res).toBe(true);
    if (!("rows" in res)) return;
    expect(res.rows.every((r) => r.status === "invalid" && !r.selected)).toBe(true);
  });

  it("builds an image-only update payload and rejects data URLs, and rechecks unique identity", () => {
    const payload = buildImageUpdatePayload("https://storage.example.com/signed/new.png");
    expect(Object.keys(payload)).toEqual(["image"]);
    expect(payload.image).toBe("https://storage.example.com/signed/new.png");
    expect(() => buildImageUpdatePayload("data:image/png;base64,iVBOR")).toThrow(/storage image URL/i);

    const missingCheck = resolveUniqueTargetProduct(
      { name: "Assorted Sunglasses Collection", category_id: "accesorios", product_id: null },
      EXISTING_CATALOG.filter((p) => p.id !== "p-sunglasses"),
    );
    expect(missingCheck.ok).toBe(false);
    if (!missingCheck.ok) expect(missingCheck.status).toBe("missing");
  });
});