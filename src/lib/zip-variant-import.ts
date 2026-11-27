import { unzipSync } from "fflate";
import { normalizeOption, validateAllocation, variantDraftSchema, type VariantDraft } from "./variants";
import { isSafeZipPath, normalizeProductName, ZIP_IMPORT_LIMITS } from "./zip-product-import";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;

export const VARIANT_UPDATE_MANIFEST_KIND = "jav-product-variant-update";

export type ManifestEntryStatus = "ready_for_admin_confirmation" | "review" | "skip";

export type SuggestedColor = { name: string; hex: string };

export type ParsedVariantUpdateEntry = {
  product_id: string;
  name: string;
  category_id: string;
  expected_stock: number;
  existing_colors: string[];
  existing_capacity: string;
  manifest_status: ManifestEntryStatus;
  color_variants_enabled: boolean;
  storage_variants_enabled: boolean;
  variants: VariantDraft[];
  suggested_colors: SuggestedColor[];
  suggested_storage: string[];
  market_source: string | null;
  note: string;
};

export type VariantUpdateManifestMeta = {
  catalog_snapshot: string | null;
  catalog_total: number | null;
  excluded_categories: Record<string, number>;
};

export type ExistingProductForVariantUpdate = {
  id: string;
  name: string;
  category_id: string;
  stock: number;
  active: boolean;
  color_variants_enabled: boolean;
  storage_variants_enabled: boolean;
  colors?: string[];
  capacity?: string;
};

export type ExistingVariantRef = {
  id: string;
  product_id: string;
};

export type VariantUpdateRowStatus =
  | "ready"
  | "review"
  | "skip"
  | "conflict"
  | "invalid"
  | "updating"
  | "updated"
  | "failed";

export type VariantUpdateRow = {
  index: number;
  entry: ParsedVariantUpdateEntry;
  matchedProduct: ExistingProductForVariantUpdate | null;
  status: VariantUpdateRowStatus;
  errors: string[];
  selected: boolean;
  reviewConfirmed: boolean;
  draftColorEnabled: boolean;
  draftStorageEnabled: boolean;
  draftVariants: VariantDraft[];
  updateError?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readStr(obj: Record<string, unknown>, key: string, maxLen: number, required: boolean, errors: string[]): string {
  const v = obj[key];
  if (typeof v !== "string") {
    errors.push(`${key} must be a string`);
    return "";
  }
  const trimmed = v.trim();
  if (required && !trimmed) errors.push(`${key} is required`);
  if (trimmed.length > maxLen) errors.push(`${key} exceeds ${maxLen} characters`);
  return trimmed;
}

function readStrArray(obj: Record<string, unknown>, key: string, maxItems: number, maxLen: number, errors: string[]): string[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    errors.push(`${key} must be an array`);
    return [];
  }
  if (v.length > maxItems) errors.push(`${key} exceeds ${maxItems} items`);
  const out: string[] = [];
  for (const item of v.slice(0, maxItems)) {
    if (typeof item !== "string") {
      errors.push(`${key} items must be strings`);
      continue;
    }
    const t = item.trim();
    if (t.length > maxLen) errors.push(`${key} item exceeds ${maxLen} characters`);
    if (t) out.push(t);
  }
  return out;
}

function readSuggestedColors(obj: Record<string, unknown>, errors: string[]): SuggestedColor[] {
  const v = obj["suggested_colors"];
  if (!Array.isArray(v)) {
    errors.push("suggested_colors must be an array");
    return [];
  }
  if (v.length > 50) errors.push("suggested_colors exceeds 50 items");
  const out: SuggestedColor[] = [];
  for (const item of v.slice(0, 50)) {
    if (!isRecord(item) || typeof item["name"] !== "string" || typeof item["hex"] !== "string") {
      errors.push("Each suggested color must have string name and hex");
      continue;
    }
    const name = item["name"].trim();
    const hex = item["hex"].trim();
    if (!name || name.length > 80 || !HEX_RE.test(hex)) {
      errors.push("Each suggested color must have a valid name and #RRGGBB hex");
      continue;
    }
    out.push({ name, hex });
  }
  return out;
}

function readVariants(obj: Record<string, unknown>, errors: string[]): VariantDraft[] {
  const v = obj["variants"];
  if (!Array.isArray(v)) {
    errors.push("variants must be an array");
    return [];
  }
  if (v.length > 200) errors.push("variants exceeds 200 items");
  const out: VariantDraft[] = [];
  const seenKeys = new Set<string>();

  for (const raw of v.slice(0, 200)) {
    if (!isRecord(raw)) {
      errors.push("Each variant entry must be an object");
      continue;
    }
    if (raw["image"] !== null) {
      errors.push("Variant image must be null (image updates are not allowed)");
      continue;
    }
    const colorName = raw["color_name"] === null ? null : typeof raw["color_name"] === "string" ? raw["color_name"].trim() || null : undefined;
    const colorHex = raw["color_hex"] === null ? null : typeof raw["color_hex"] === "string" ? raw["color_hex"].trim() || null : undefined;
    const storage = raw["storage"] === null ? null : typeof raw["storage"] === "string" ? raw["storage"].trim() || null : undefined;
    const stock = typeof raw["stock"] === "number" && Number.isInteger(raw["stock"]) ? raw["stock"] : NaN;
    const active = typeof raw["active"] === "boolean" ? raw["active"] : undefined;

    if (colorName === undefined || colorHex === undefined || storage === undefined || active === undefined || !Number.isInteger(stock)) {
      errors.push("Variant entry has invalid field types");
      continue;
    }
    if (colorHex !== null && colorName === null) {
      errors.push("color_hex requires color_name");
      continue;
    }
    const draft: VariantDraft = { color_name: colorName, color_hex: colorHex, storage, stock, image: null, active };
    const parsed = variantDraftSchema.safeParse(draft);
    if (!parsed.success) {
      errors.push("Variant row failed validation (dimensions, hex, or stock)");
      continue;
    }
    const comboKey = `${normalizeOption(parsed.data.color_name)}\u0000${normalizeOption(parsed.data.storage)}`;
    if (seenKeys.has(comboKey)) {
      errors.push("Duplicate variant combination in product entry");
      continue;
    }
    seenKeys.add(comboKey);
    out.push(parsed.data);
  }
  return out;
}

export function countVariantsByProduct(variants: readonly ExistingVariantRef[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of variants) {
    counts.set(v.product_id, (counts.get(v.product_id) ?? 0) + 1);
  }
  return counts;
}

export function evaluateVariantUpdateMatch(
  entry: Pick<ParsedVariantUpdateEntry, "product_id" | "name" | "category_id" | "expected_stock">,
  productsById: ReadonlyMap<string, ExistingProductForVariantUpdate>,
  existingVariantCounts: ReadonlyMap<string, number>,
): { ok: true; product: ExistingProductForVariantUpdate } | { ok: false; product: ExistingProductForVariantUpdate | null; reasons: string[] } {
  const product = productsById.get(entry.product_id) ?? null;
  if (!product) {
    return { ok: false, product: null, reasons: ["Product ID not found in catalog"] };
  }
  const reasons: string[] = [];
  if (!product.active) reasons.push("Product is inactive in catalog");
  if (normalizeProductName(product.name) !== normalizeProductName(entry.name)) {
    reasons.push(`Catalog name mismatch ("${product.name}")`);
  }
  if (product.category_id !== entry.category_id) {
    reasons.push(`Catalog category mismatch ("${product.category_id}")`);
  }
  if (product.stock !== entry.expected_stock) {
    reasons.push(`Current stock (${product.stock}) differs from expected stock (${entry.expected_stock})`);
  }
  if (product.color_variants_enabled || product.storage_variants_enabled) {
    reasons.push("Product already has variant flags enabled");
  }
  const existingCount = existingVariantCounts.get(product.id) ?? 0;
  if (existingCount > 0) {
    reasons.push(`Product already has ${existingCount} existing variant record(s)`);
  }
  if (reasons.length > 0) return { ok: false, product, reasons };
  return { ok: true, product };
}

export function canConfirmReviewRow(row: VariantUpdateRow): boolean {
  if (row.status !== "review" || !row.matchedProduct) return false;
  if (!row.draftColorEnabled && !row.draftStorageEnabled) return false;
  if (row.draftVariants.some((v) => v.image !== null)) return false;
  return validateAllocation(row.draftVariants, row.draftColorEnabled, row.draftStorageEnabled, row.matchedProduct.stock).valid;
}

export function isVariantRowSelectable(row: VariantUpdateRow): boolean {
  if (row.status === "ready" || row.status === "failed") return true;
  if (row.status === "review") return row.reviewConfirmed && canConfirmReviewRow(row);
  return false;
}

export function buildInitialVariantRpcArgs(row: VariantUpdateRow) {
  if (!row.matchedProduct) throw new Error("Row has no matched catalog product.");
  if (!row.draftColorEnabled && !row.draftStorageEnabled) {
    throw new Error("Enable color or storage variants before applying.");
  }
  if (row.draftVariants.some((v) => v.image !== null)) {
    throw new Error("Variant images are not allowed in bulk variant updates.");
  }
  const check = validateAllocation(row.draftVariants, row.draftColorEnabled, row.draftStorageEnabled, row.matchedProduct.stock);
  if (!check.valid) throw new Error(check.error);
  return {
    _product_id: row.matchedProduct.id,
    _color: row.draftColorEnabled,
    _storage: row.draftStorageEnabled,
    _variants: row.draftVariants.map((v) => ({
      color_name: v.color_name,
      color_hex: v.color_hex,
      storage: v.storage,
      stock: v.stock,
      image: null,
      active: v.active,
    })),
    _expected_stock: row.matchedProduct.stock,
  };
}

export function parseVariantUpdateZip(
  zipBytes: Uint8Array,
  validCategoryIds: ReadonlySet<string>,
  existingProducts: readonly ExistingProductForVariantUpdate[],
  existingVariants: readonly ExistingVariantRef[],
): { rows: VariantUpdateRow[]; meta: VariantUpdateManifestMeta } | { error: string } {
  if (zipBytes.byteLength === 0) return { error: "The ZIP file is empty." };
  if (zipBytes.byteLength > ZIP_IMPORT_LIMITS.maxZipBytes) return { error: "The ZIP file exceeds the 100 MB limit." };

  let entryCount = 0;
  let headerTotal = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes, {
      filter(file) {
        if (file.name.endsWith("/") || file.name.startsWith("__MACOSX/")) return false;
        if (!isSafeZipPath(file.name)) throw new Error(`ZIP contains an unsafe path: "${file.name}".`);
        entryCount += 1;
        if (entryCount > ZIP_IMPORT_LIMITS.maxEntries) throw new Error("ZIP exceeds the 500-file limit.");
        if (file.name === "variants.json" && file.originalSize > ZIP_IMPORT_LIMITS.maxManifestBytes) {
          throw new Error("variants.json exceeds the 2 MB limit.");
        }
        if (file.name !== "variants.json" && file.originalSize > ZIP_IMPORT_LIMITS.maxImageBytes) {
          throw new Error(`File "${file.name}" exceeds the 5 MB limit.`);
        }
        headerTotal += file.originalSize;
        if (headerTotal > ZIP_IMPORT_LIMITS.maxTotalUncompressedBytes) {
          throw new Error("Uncompressed ZIP content exceeds the 150 MB limit.");
        }
        return file.name === "variants.json";
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read the ZIP archive." };
  }

  const manifestBytes = entries["variants.json"];
  if (!manifestBytes) return { error: "Missing root variants.json in the ZIP archive." };
  if (manifestBytes.byteLength > ZIP_IMPORT_LIMITS.maxManifestBytes) return { error: "variants.json exceeds the 2 MB limit." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { error: "variants.json is not valid JSON." };
  }

  if (!isRecord(parsed)) return { error: "variants.json must contain a JSON object." };
  if (parsed["version"] !== 1) return { error: "Manifest version must be 1." };
  if (parsed["kind"] !== VARIANT_UPDATE_MANIFEST_KIND) {
    return { error: `Manifest kind must be "${VARIANT_UPDATE_MANIFEST_KIND}".` };
  }
  if (parsed["update_images"] !== false) return { error: "Manifest must set update_images: false." };
  if (parsed["update_prices"] !== false) return { error: "Manifest must set update_prices: false." };
  if (parsed["create_products"] !== false) return { error: "Manifest must set create_products: false." };
  if (parsed["requires_admin_confirmation"] !== true) return { error: "Manifest must set requires_admin_confirmation: true." };

  const rawProducts = parsed["products"];
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) return { error: "Manifest contains no products." };
  if (rawProducts.length > ZIP_IMPORT_LIMITS.maxProducts) {
    return { error: `Manifest exceeds the ${ZIP_IMPORT_LIMITS.maxProducts}-product limit.` };
  }

  const excluded_categories: Record<string, number> = {};
  if (parsed["excluded_categories"] !== undefined && parsed["excluded_categories"] !== null) {
    if (!isRecord(parsed["excluded_categories"])) return { error: "excluded_categories must be an object." };
    for (const [k, v] of Object.entries(parsed["excluded_categories"])) {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return { error: `excluded_categories.${k} must be a non-negative integer.` };
      }
      excluded_categories[k] = v;
    }
  }
  const catalog_snapshot = typeof parsed["catalog_snapshot"] === "string" ? parsed["catalog_snapshot"].trim().slice(0, 40) || null : null;
  const catalog_total = typeof parsed["catalog_total"] === "number" && Number.isInteger(parsed["catalog_total"]) && parsed["catalog_total"] >= 0
    ? parsed["catalog_total"]
    : null;

  const productsById = new Map(existingProducts.map((p) => [p.id.toLowerCase(), p]));
  const variantCounts = countVariantsByProduct(existingVariants);
  const seenProductIds = new Set<string>();

  const rows: VariantUpdateRow[] = rawProducts.map((raw, index) => {
    const errors: string[] = [];
    const obj = isRecord(raw) ? raw : {};
    if (!isRecord(raw)) errors.push("Product entry must be an object");

    const rawId = readStr(obj, "product_id", 64, true, errors);
    const product_id = rawId.toLowerCase();
    if (rawId && !UUID_RE.test(rawId)) errors.push("product_id must be a valid UUID");

    const name = readStr(obj, "name", 200, true, errors);
    const category_id = readStr(obj, "category_id", 80, true, errors);
    if (category_id && !validCategoryIds.has(category_id)) errors.push(`Unknown category "${category_id}"`);

    const stockRaw = obj["expected_stock"];
    const expected_stock = typeof stockRaw === "number" && Number.isInteger(stockRaw) ? stockRaw : NaN;
    if (!Number.isInteger(expected_stock) || expected_stock < 0 || expected_stock > 1_000_000) {
      errors.push("expected_stock must be a non-negative integer");
    }

    const existing_colors = readStrArray(obj, "existing_colors", 30, 60, errors);
    const existing_capacity = readStr(obj, "existing_capacity", 120, false, errors);

    const rawStatus = obj["status"];
    const manifest_status: ManifestEntryStatus =
      rawStatus === "ready_for_admin_confirmation" || rawStatus === "review" || rawStatus === "skip"
        ? rawStatus
        : "skip";
    if (rawStatus !== "ready_for_admin_confirmation" && rawStatus !== "review" && rawStatus !== "skip") {
      errors.push("status must be ready_for_admin_confirmation, review, or skip");
    }

    const color_variants_enabled = typeof obj["color_variants_enabled"] === "boolean" ? obj["color_variants_enabled"] : false;
    if (typeof obj["color_variants_enabled"] !== "boolean") errors.push("color_variants_enabled must be a boolean");
    const storage_variants_enabled = typeof obj["storage_variants_enabled"] === "boolean" ? obj["storage_variants_enabled"] : false;
    if (typeof obj["storage_variants_enabled"] !== "boolean") errors.push("storage_variants_enabled must be a boolean");

    const variants = readVariants(obj, errors);
    const suggested_colors = readSuggestedColors(obj, errors);
    const suggested_storage = readStrArray(obj, "suggested_storage", 30, 80, errors);

    let market_source: string | null = null;
    if (obj["market_source"] !== null && obj["market_source"] !== undefined) {
      if (typeof obj["market_source"] !== "string") errors.push("market_source must be a string or null");
      else if (obj["market_source"].trim().length > 1000) errors.push("market_source exceeds 1000 characters");
      else market_source = obj["market_source"].trim() || null;
    }
    const note = obj["note"] === undefined || obj["note"] === null ? "" : readStr(obj, "note", 1000, false, errors);

    if (product_id && UUID_RE.test(product_id)) {
      if (seenProductIds.has(product_id)) errors.push("Duplicate product_id in ZIP");
      else seenProductIds.add(product_id);
    }

    if (errors.length === 0 && manifest_status === "ready_for_admin_confirmation") {
      if (!color_variants_enabled && !storage_variants_enabled) {
        errors.push("Ready entry must enable color or storage variants");
      } else {
        const alloc = validateAllocation(variants, color_variants_enabled, storage_variants_enabled, expected_stock);
        if (!alloc.valid) errors.push(alloc.error);
      }
    }

    const entry: ParsedVariantUpdateEntry = {
      product_id,
      name,
      category_id,
      expected_stock: Number.isInteger(expected_stock) ? expected_stock : 0,
      existing_colors,
      existing_capacity,
      manifest_status,
      color_variants_enabled,
      storage_variants_enabled,
      variants,
      suggested_colors,
      suggested_storage,
      market_source,
      note,
    };

    let status: VariantUpdateRowStatus;
    let matchedProduct: ExistingProductForVariantUpdate | null = null;

    if (errors.length > 0) {
      status = "invalid";
    } else if (manifest_status === "skip") {
      matchedProduct = productsById.get(product_id) ?? null;
      status = "skip";
    } else {
      const match = evaluateVariantUpdateMatch(entry, productsById, variantCounts);
      matchedProduct = match.product;
      if (!match.ok) {
        status = "conflict";
        errors.push(...match.reasons);
      } else {
        status = manifest_status === "ready_for_admin_confirmation" ? "ready" : "review";
      }
    }

    return {
      index,
      entry,
      matchedProduct,
      status,
      errors,
      selected: false,
      reviewConfirmed: false,
      draftColorEnabled: color_variants_enabled,
      draftStorageEnabled: storage_variants_enabled,
      draftVariants: variants.map((v) => ({ ...v })),
    };
  });

  return { rows, meta: { catalog_snapshot, catalog_total, excluded_categories } };
}