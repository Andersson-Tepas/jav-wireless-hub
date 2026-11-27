import { strToU8, unzipSync, zipSync } from "fflate";
import { compareVariantStorageThenColor, effectiveVariantPrice, MAX_VARIANT_PRICE, normalizePrice, selectionLabel } from "./variants";
import { isSafeZipPath, ZIP_IMPORT_LIMITS } from "./zip-product-import";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export const VARIANT_PRICE_UPDATE_MANIFEST_KIND = "jav-variant-price-update";
export const VARIANT_PRICE_MANIFEST_FILENAME = "variant-prices.json";

export const VARIANT_PRICE_SAMPLE_JSON = JSON.stringify(
  {
    version: 1,
    kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND,
    entries: [
      {
        product_id: "00000000-0000-4000-8000-000000000001",
        variant_id: "00000000-0000-4000-8000-000000000002",
        expected_base_price: 499.99,
        expected_price_override: null,
        price_override: 549.99,
        note: "256 GB tier",
      },
    ],
  },
  null,
  2,
);

export type ExistingProductForPriceUpdate = {
  id: string;
  name: string;
  category_id: string;
  price: number;
  active: boolean;
  color_variants_enabled: boolean;
  storage_variants_enabled: boolean;
};

export type ExistingVariantForPriceUpdate = {
  id: string;
  product_id: string;
  color_name: string | null;
  color_hex: string | null;
  storage: string | null;
  stock: number;
  active: boolean;
  price_override: number | null;
};

export type ParsedVariantPriceEntry = {
  product_id: string;
  variant_id: string;
  expected_base_price: number | null;
  expected_price_override: number | null;
  price_override: number | null;
  note: string;
};

export type VariantPriceRowStatus =
  | "ready"
  | "unchanged"
  | "conflict"
  | "invalid"
  | "updating"
  | "updated"
  | "failed";

export type VariantPriceUpdateRow = {
  index: number;
  entry: ParsedVariantPriceEntry;
  matchedProduct: ExistingProductForPriceUpdate | null;
  matchedVariant: ExistingVariantForPriceUpdate | null;
  currentEffectivePrice: number | null;
  proposedEffectivePrice: number | null;
  status: VariantPriceRowStatus;
  errors: string[];
  selected: boolean;
  updateError?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseStrictPrice(
  val: unknown,
  field: string,
  allowNull: boolean,
  errors: string[],
): number | null {
  if (val === null) {
    if (!allowNull) errors.push(`${field} is required`);
    return null;
  }
  if (typeof val !== "number" && typeof val !== "string") {
    errors.push(`${field} must be a valid USD amount${allowNull ? " or null" : ""}`);
    return null;
  }
  const text = typeof val === "number" ? (Number.isFinite(val) ? String(val) : "") : val.trim();
  if (!text || !PRICE_RE.test(text)) {
    errors.push(`${field} must be a non-negative USD number with at most 2 decimals`);
    return null;
  }
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > MAX_VARIANT_PRICE) {
    errors.push(`${field} must be between 0.00 and ${MAX_VARIANT_PRICE}`);
    return null;
  }
  return Math.round(n * 100) / 100;
}

export function parseVariantPriceZip(
  zipBytes: Uint8Array,
  existingProducts: readonly ExistingProductForPriceUpdate[],
  existingVariants: readonly ExistingVariantForPriceUpdate[],
): { rows: VariantPriceUpdateRow[] } | { error: string } {
  if (zipBytes.byteLength === 0) return { error: "The selected ZIP file is empty." };
  if (zipBytes.byteLength > ZIP_IMPORT_LIMITS.maxZipBytes) {
    return { error: `ZIP file exceeds the ${Math.round(ZIP_IMPORT_LIMITS.maxZipBytes / (1024 * 1024))} MB safety limit.` };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch {
    return { error: "Could not read ZIP archive. Make sure it is a valid .zip file." };
  }

  const names = Object.keys(files);
  if (names.length > ZIP_IMPORT_LIMITS.maxEntries) {
    return { error: `ZIP archive has too many entries (limit: ${ZIP_IMPORT_LIMITS.maxEntries}).` };
  }

  let totalUncompressed = 0;
  for (const name of names) {
    if (!isSafeZipPath(name)) return { error: `Unsafe file path in ZIP: ${name}` };
    totalUncompressed += files[name]?.byteLength ?? 0;
    if (totalUncompressed > ZIP_IMPORT_LIMITS.maxTotalUncompressedBytes) {
      return { error: "Uncompressed ZIP contents exceed the safety size limit." };
    }
  }

  const manifestBytes = files[VARIANT_PRICE_MANIFEST_FILENAME];
  if (!manifestBytes) {
    return { error: `Missing root ${VARIANT_PRICE_MANIFEST_FILENAME} manifest in ZIP.` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
  } catch {
    return { error: `${VARIANT_PRICE_MANIFEST_FILENAME} is not valid UTF-8 JSON.` };
  }

  if (!isRecord(parsed)) return { error: `${VARIANT_PRICE_MANIFEST_FILENAME} must be a JSON object.` };
  if (parsed["version"] !== 1) return { error: `Unsupported manifest version (expected 1).` };
  if (parsed["kind"] !== VARIANT_PRICE_UPDATE_MANIFEST_KIND) {
    return { error: `Invalid manifest kind (expected "${VARIANT_PRICE_UPDATE_MANIFEST_KIND}").` };
  }
  if (!Array.isArray(parsed["entries"])) {
    return { error: `${VARIANT_PRICE_MANIFEST_FILENAME} must include an "entries" array.` };
  }
  if (parsed["entries"].length === 0) return { error: "Manifest contains no entries." };
  if (parsed["entries"].length > 2000) return { error: "Manifest exceeds the 2,000 entry limit." };

  const productsById = new Map(existingProducts.map((p) => [p.id.toLowerCase(), p]));
  const variantsById = new Map(existingVariants.map((v) => [v.id.toLowerCase(), v]));
  const seenVariantIds = new Set<string>();

  const rows: VariantPriceUpdateRow[] = parsed["entries"].map((raw, index) => {
    const errors: string[] = [];
    if (!isRecord(raw)) {
      return {
        index,
        entry: { product_id: "", variant_id: "", expected_base_price: null, expected_price_override: null, price_override: null, note: "" },
        matchedProduct: null,
        matchedVariant: null,
        currentEffectivePrice: null,
        proposedEffectivePrice: null,
        status: "invalid",
        errors: ["Entry must be a JSON object"],
        selected: false,
      };
    }

    const productId = typeof raw["product_id"] === "string" ? raw["product_id"].trim() : "";
    const variantId = typeof raw["variant_id"] === "string" ? raw["variant_id"].trim() : "";
    if (!UUID_RE.test(productId)) errors.push("product_id must be a valid UUID");
    if (!UUID_RE.test(variantId)) errors.push("variant_id must be a valid UUID");

    const normVid = variantId.toLowerCase();
    if (UUID_RE.test(variantId)) {
      if (seenVariantIds.has(normVid)) errors.push("Duplicate variant_id in manifest");
      else seenVariantIds.add(normVid);
    }

    const expectedBase = parseStrictPrice(raw["expected_base_price"], "expected_base_price", false, errors);
    const expectedOverride = "expected_price_override" in raw
      ? parseStrictPrice(raw["expected_price_override"], "expected_price_override", true, errors)
      : (errors.push("expected_price_override is required (number or null)"), null);
    const newOverride = "price_override" in raw
      ? parseStrictPrice(raw["price_override"], "price_override", true, errors)
      : (errors.push("price_override is required (number or null)"), null);

    const noteRaw = raw["note"];
    const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 300) : "";

    const entry: ParsedVariantPriceEntry = {
      product_id: productId,
      variant_id: variantId,
      expected_base_price: expectedBase,
      expected_price_override: expectedOverride,
      price_override: newOverride,
      note,
    };

    if (errors.length > 0) {
      return {
        index,
        entry,
        matchedProduct: null,
        matchedVariant: null,
        currentEffectivePrice: null,
        proposedEffectivePrice: null,
        status: "invalid",
        errors,
        selected: false,
      };
    }

    const matchedProduct = productsById.get(productId.toLowerCase()) ?? null;
    const matchedVariant = variantsById.get(normVid) ?? null;
    const conflicts: string[] = [];

    if (!matchedProduct) conflicts.push("Product not found in catalog");
    else if (!matchedProduct.active) conflicts.push("Product is inactive");

    if (!matchedVariant) conflicts.push("Variant not found in catalog");
    else {
      if (matchedProduct && matchedVariant.product_id.toLowerCase() !== matchedProduct.id.toLowerCase()) {
        conflicts.push("Variant does not belong to this product");
      }
      if (!matchedVariant.active) conflicts.push("Variant is inactive");
    }

    if (matchedProduct && expectedBase !== null) {
      const dbBase = normalizePrice(matchedProduct.price);
      if (dbBase !== expectedBase) {
        conflicts.push(`Base price mismatch (expected $${expectedBase.toFixed(2)}, current $${(dbBase ?? 0).toFixed(2)})`);
      }
    }

    if (matchedVariant) {
      const dbOverride = normalizePrice(matchedVariant.price_override);
      if (dbOverride !== expectedOverride) {
        conflicts.push(
          `Current override mismatch (expected ${expectedOverride === null ? "null" : `$${expectedOverride.toFixed(2)}`}, current ${dbOverride === null ? "null" : `$${dbOverride.toFixed(2)}`})`,
        );
      }
    }

    const currentEffectivePrice = matchedProduct && matchedVariant
      ? effectiveVariantPrice(matchedProduct.price, matchedVariant)
      : null;
    const proposedEffectivePrice = matchedProduct
      ? (newOverride !== null ? newOverride : Number(matchedProduct.price))
      : null;

    if (conflicts.length > 0) {
      return {
        index,
        entry,
        matchedProduct,
        matchedVariant,
        currentEffectivePrice,
        proposedEffectivePrice,
        status: "conflict",
        errors: conflicts,
        selected: false,
      };
    }

    const dbOverride = matchedVariant ? normalizePrice(matchedVariant.price_override) : null;
    const isUnchanged = dbOverride === newOverride;

    return {
      index,
      entry,
      matchedProduct,
      matchedVariant,
      currentEffectivePrice,
      proposedEffectivePrice,
      status: isUnchanged ? "unchanged" : "ready",
      errors: [],
      selected: false,
    };
  });

  return { rows };
}

export function buildVariantPriceTemplateZip(
  products: readonly ExistingProductForPriceUpdate[],
  variants: readonly ExistingVariantForPriceUpdate[],
): Uint8Array {
  const activeProducts = new Map(products.filter((p) => p.active).map((p) => [p.id, p]));
  const entries = variants
    .filter((v) => v.active && activeProducts.has(v.product_id))
    .sort((a, b) =>
      (activeProducts.get(a.product_id)?.name ?? a.product_id).localeCompare(activeProducts.get(b.product_id)?.name ?? b.product_id, "en", { numeric: true }) ||
      compareVariantStorageThenColor(a, b) ||
      a.id.localeCompare(b.id)
    )
    .map((v) => {
      const p = activeProducts.get(v.product_id)!;
      const override = normalizePrice(v.price_override);
      return {
        product_id: p.id,
        variant_id: v.id,
        product_name: p.name,
        variant_label: selectionLabel({ color_snapshot: v.color_name, storage_snapshot: v.storage }),
        expected_base_price: normalizePrice(p.price) ?? 0,
        expected_price_override: override,
        price_override: override,
        note: "",
      };
    });

  const payload = JSON.stringify(
    {
      version: 1,
      kind: VARIANT_PRICE_UPDATE_MANIFEST_KIND,
      entries,
    },
    null,
    2,
  );
  return zipSync({ [VARIANT_PRICE_MANIFEST_FILENAME]: strToU8(payload) });
}