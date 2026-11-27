import { unzipSync } from "fflate";

export const ZIP_IMPORT_LIMITS = {
  maxZipBytes: 100 * 1024 * 1024,
  maxEntries: 500,
  maxTotalUncompressedBytes: 150 * 1024 * 1024,
  maxManifestBytes: 2 * 1024 * 1024,
  maxImageBytes: 5_000_000,
  maxProducts: 500,
} as const;

export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";
export type ProductSpec = { label: string; value: string };
export type RowStatus = "ready" | "duplicate_db" | "duplicate_zip" | "invalid" | "importing" | "imported" | "skipped" | "failed";

export type ParsedImportProduct = {
  image_file: string;
  name: string;
  brand: string;
  model: string;
  category_id: string;
  capacity: string;
  price: number;
  stock: number;
  colors: string[];
  description: string;
  features: string[];
  specs: ProductSpec[];
  financing: string | null;
  source: string;
};

export type ImportRow = {
  index: number;
  key: string;
  product: ParsedImportProduct;
  imageBytes: Uint8Array | null;
  imageMime: AllowedImageMime | null;
  status: RowStatus;
  errors: string[];
  selected: boolean;
  importError?: string;
};

export type ExistingProductRef = { name: string; category_id: string };
export type ExistingProductForImageUpdate = {
  id: string;
  name: string;
  category_id: string;
  image: string;
  active?: boolean;
};

export type ImageUpdateRowStatus =
  | "ready"
  | "missing"
  | "ambiguous"
  | "duplicate_zip"
  | "invalid"
  | "updating"
  | "updated"
  | "skipped"
  | "failed";

export type ParsedImageUpdateEntry = {
  image_file: string;
  name: string;
  category_id: string;
  note: string;
  product_id: string | null;
};

export type ImageUpdateRow = {
  index: number;
  key: string;
  entry: ParsedImageUpdateEntry;
  matchedProduct: ExistingProductForImageUpdate | null;
  imageBytes: Uint8Array | null;
  imageMime: AllowedImageMime | null;
  status: ImageUpdateRowStatus;
  errors: string[];
  selected: boolean;
  updateError?: string;
};

export function normalizeProductName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function productMatchKey(name: string, categoryId: string): string {
  return `${normalizeProductName(name)}::${categoryId.trim().toLowerCase()}`;
}

export function isSafeZipPath(path: string): boolean {
  if (!path || path.length > 255) return false;
  if (path.startsWith("/") || path.startsWith("\\") || path.endsWith("/")) return false;
  if (path.includes("\\") || path.includes("\0") || /[\x00-\x1f\x7f]/.test(path)) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  const parts = path.split("/");
  return parts.every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}

export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readStr(obj: Record<string, unknown>, key: string, maxLen: number, required: boolean, errors: string[]): string {
  const v = obj[key];
  if (typeof v !== "string") { errors.push(`${key} must be a string`); return ""; }
  const trimmed = v.trim();
  if (required && !trimmed) errors.push(`${key} is required`);
  if (trimmed.length > maxLen) errors.push(`${key} exceeds ${maxLen} characters`);
  return trimmed;
}

function readStrArray(obj: Record<string, unknown>, key: string, maxItems: number, maxLen: number, errors: string[]): string[] {
  const v = obj[key];
  if (!Array.isArray(v)) { errors.push(`${key} must be an array`); return []; }
  if (v.length > maxItems) errors.push(`${key} exceeds ${maxItems} items`);
  const out: string[] = [];
  for (const item of v.slice(0, maxItems)) {
    if (typeof item !== "string") { errors.push(`${key} items must be strings`); continue; }
    const t = item.trim();
    if (t.length > maxLen) errors.push(`${key} item exceeds ${maxLen} characters`);
    if (t) out.push(t);
  }
  return out;
}

function readSpecs(obj: Record<string, unknown>, errors: string[]): ProductSpec[] {
  const v = obj["specs"];
  if (!Array.isArray(v)) { errors.push("specs must be an array"); return []; }
  if (v.length > 50) errors.push("specs exceeds 50 items");
  const out: ProductSpec[] = [];
  for (const item of v.slice(0, 50)) {
    if (!isRecord(item) || typeof item["label"] !== "string" || typeof item["value"] !== "string") {
      errors.push("Each spec must have string label and value"); continue;
    }
    const label = item["label"].trim();
    const value = item["value"].trim();
    if (!label || !value) { errors.push("Spec label and value cannot be empty"); continue; }
    if (label.length > 100 || value.length > 300) { errors.push("Spec label or value is too long"); continue; }
    out.push({ label, value });
  }
  return out;
}

function extractValidatedZipManifest(
  zipBytes: Uint8Array,
): { entries: Record<string, Uint8Array>; rawProducts: unknown[] } | { error: string } {
  if (zipBytes.byteLength === 0) return { error: "The ZIP file is empty." };
  if (zipBytes.byteLength > ZIP_IMPORT_LIMITS.maxZipBytes) return { error: "The ZIP file exceeds the 100 MB limit." };

  let entryCount = 0;
  let headerTotal = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes, {
      filter(file) {
        if (file.name.endsWith("/") || file.name.startsWith("__MACOSX/")) return false;
        entryCount += 1;
        if (entryCount > ZIP_IMPORT_LIMITS.maxEntries) throw new Error("ZIP exceeds the 500-file limit.");
        if (file.name === "products.json" && file.originalSize > ZIP_IMPORT_LIMITS.maxManifestBytes) throw new Error("products.json exceeds the 2 MB limit.");
        if (file.name !== "products.json" && file.originalSize > ZIP_IMPORT_LIMITS.maxImageBytes) throw new Error(`File "${file.name}" exceeds the 5 MB limit.`);
        headerTotal += file.originalSize;
        if (headerTotal > ZIP_IMPORT_LIMITS.maxTotalUncompressedBytes) throw new Error("Uncompressed ZIP content exceeds the 150 MB limit.");
        return true;
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read the ZIP archive." };
  }

  let actualTotal = 0;
  for (const [name, data] of Object.entries(entries)) {
    actualTotal += data.byteLength;
    if (actualTotal > ZIP_IMPORT_LIMITS.maxTotalUncompressedBytes) return { error: "Uncompressed ZIP content exceeds the 150 MB limit." };
    if (name === "products.json" && data.byteLength > ZIP_IMPORT_LIMITS.maxManifestBytes) return { error: "products.json exceeds the 2 MB limit." };
  }

  const manifestBytes = entries["products.json"];
  if (!manifestBytes) return { error: "Missing root products.json in the ZIP archive." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { error: "products.json is not valid JSON." };
  }

  if (!isRecord(parsed) || parsed["version"] !== 1 || !Array.isArray(parsed["products"])) {
    return { error: "Manifest must be a JSON object with version: 1 and a products array." };
  }
  const rawProducts = parsed["products"];
  if (rawProducts.length === 0) return { error: "Manifest contains no products." };
  if (rawProducts.length > ZIP_IMPORT_LIMITS.maxProducts) return { error: `Manifest exceeds the ${ZIP_IMPORT_LIMITS.maxProducts}-product limit.` };
  return { entries, rawProducts };
}

function validateZipImage(
  rawImageFile: string,
  entries: Record<string, Uint8Array>,
  errors: string[],
): { imageBytes: Uint8Array | null; imageMime: AllowedImageMime | null } {
  if (!rawImageFile) {
    errors.push("image_file is required");
    return { imageBytes: null, imageMime: null };
  }
  if (!isSafeZipPath(rawImageFile)) {
    errors.push("image_file has an invalid or unsafe path");
    return { imageBytes: null, imageMime: null };
  }
  if (!/\.(jpe?g|png|webp)$/i.test(rawImageFile)) {
    errors.push("image_file must be PNG, JPG, JPEG, or WebP");
  }
  const found = Object.prototype.hasOwnProperty.call(entries, rawImageFile) ? entries[rawImageFile] : undefined;
  if (!found) {
    errors.push(`Image not found in ZIP: ${rawImageFile}`);
    return { imageBytes: null, imageMime: null };
  }
  if (found.byteLength === 0) {
    errors.push("Image file is empty");
    return { imageBytes: null, imageMime: null };
  }
  if (found.byteLength > ZIP_IMPORT_LIMITS.maxImageBytes) {
    errors.push("Image exceeds 5 MB limit");
    return { imageBytes: null, imageMime: null };
  }
  const mime = detectImageMime(found);
  if (!mime) {
    errors.push("Image content is not a valid PNG, JPG, or WebP");
    return { imageBytes: null, imageMime: null };
  }
  return { imageBytes: found, imageMime: mime };
}

export function parseProductZip(
  zipBytes: Uint8Array,
  validCategoryIds: ReadonlySet<string>,
  existingProducts: readonly ExistingProductRef[],
): { rows: ImportRow[] } | { error: string } {
  const extracted = extractValidatedZipManifest(zipBytes);
  if ("error" in extracted) return extracted;
  const { entries, rawProducts } = extracted;

  const existingKeys = new Set(existingProducts.map((p) => productMatchKey(p.name, p.category_id)));
  const seenInZip = new Set<string>();

  const rows: ImportRow[] = rawProducts.map((raw, index) => {
    const errors: string[] = [];
    const obj = isRecord(raw) ? raw : {};
    if (!isRecord(raw)) errors.push("Product entry must be an object");

    const rawImageFile = typeof obj["image_file"] === "string" ? obj["image_file"] : "";
    const { imageBytes, imageMime } = validateZipImage(rawImageFile, entries, errors);

    const name = readStr(obj, "name", 200, true, errors);
    const brand = readStr(obj, "brand", 120, false, errors);
    const model = readStr(obj, "model", 120, false, errors);
    const category_id = readStr(obj, "category_id", 80, true, errors);
    if (category_id && !validCategoryIds.has(category_id)) errors.push(`Unknown category "${category_id}"`);
    const capacity = readStr(obj, "capacity", 120, false, errors);
    const description = readStr(obj, "description", 5000, false, errors);
    const source = obj["source"] === undefined || obj["source"] === null ? "" : readStr(obj, "source", 300, false, errors);

    const priceRaw = obj["price"];
    const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : NaN;
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) errors.push("price must be a non-negative number");

    const stockRaw = obj["stock"];
    const stock = typeof stockRaw === "number" && Number.isInteger(stockRaw) ? stockRaw : NaN;
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) errors.push("stock must be a non-negative integer");

    const colors = readStrArray(obj, "colors", 30, 60, errors);
    const features = readStrArray(obj, "features", 50, 200, errors);
    const specs = readSpecs(obj, errors);

    let financing: string | null = null;
    const finRaw = obj["financing"];
    if (finRaw !== null && finRaw !== undefined) {
      if (typeof finRaw !== "string") errors.push("financing must be a string or null");
      else if (finRaw.trim().length > 200) errors.push("financing exceeds 200 characters");
      else financing = finRaw.trim() || null;
    }

    const key = productMatchKey(name, category_id);
    let status: RowStatus = "ready";
    if (errors.length > 0) status = "invalid";
    else if (existingKeys.has(key)) status = "duplicate_db";
    else if (seenInZip.has(key)) status = "duplicate_zip";
    else seenInZip.add(key);

    return {
      index,
      key,
      product: { image_file: rawImageFile, name, brand, model, category_id, capacity, price: Number.isFinite(price) ? price : 0, stock: Number.isInteger(stock) ? stock : 0, colors, description, features, specs, financing, source },
      imageBytes,
      imageMime,
      status,
      errors,
      selected: status === "ready",
    };
  });

  return { rows };
}

export function resolveUniqueTargetProduct(
  entry: Pick<ParsedImageUpdateEntry, "name" | "category_id" | "product_id">,
  existingProducts: readonly ExistingProductForImageUpdate[],
):
  | { ok: true; product: ExistingProductForImageUpdate }
  | { ok: false; status: "missing" | "ambiguous" | "invalid"; reason: string } {
  const key = productMatchKey(entry.name, entry.category_id);
  const matchesByKey = existingProducts.filter((p) => productMatchKey(p.name, p.category_id) === key);

  if (entry.product_id) {
    const byId = existingProducts.find((p) => p.id === entry.product_id);
    if (!byId) return { ok: false, status: "missing", reason: `Product ID "${entry.product_id}" not found in catalog` };
    if (productMatchKey(byId.name, byId.category_id) !== key) {
      return { ok: false, status: "invalid", reason: "product_id does not match name and category_id" };
    }
    return { ok: true, product: byId };
  }

  if (matchesByKey.length === 0) {
    return { ok: false, status: "missing", reason: "No matching product found in catalog" };
  }
  if (matchesByKey.length > 1) {
    return { ok: false, status: "ambiguous", reason: `Multiple catalog products (${matchesByKey.length}) match this name and category` };
  }
  return { ok: true, product: matchesByKey[0]! };
}

export function parseImageUpdateZip(
  zipBytes: Uint8Array,
  validCategoryIds: ReadonlySet<string>,
  existingProducts: readonly ExistingProductForImageUpdate[],
): { rows: ImageUpdateRow[] } | { error: string } {
  const extracted = extractValidatedZipManifest(zipBytes);
  if ("error" in extracted) return extracted;
  const { entries, rawProducts } = extracted;

  const seenKeys = new Set<string>();
  const seenTargetIds = new Set<string>();

  const rows: ImageUpdateRow[] = rawProducts.map((raw, index) => {
    const errors: string[] = [];
    const obj = isRecord(raw) ? raw : {};
    if (!isRecord(raw)) errors.push("Product entry must be an object");

    const rawImageFile = typeof obj["image_file"] === "string" ? obj["image_file"] : "";
    const { imageBytes, imageMime } = validateZipImage(rawImageFile, entries, errors);

    const name = readStr(obj, "name", 200, true, errors);
    const category_id = readStr(obj, "category_id", 80, true, errors);
    if (category_id && !validCategoryIds.has(category_id)) errors.push(`Unknown category "${category_id}"`);

    const note = obj["note"] === undefined || obj["note"] === null ? "" : readStr(obj, "note", 500, false, errors);

    let product_id: string | null = null;
    const rawProductId = obj["product_id"];
    if (rawProductId !== undefined && rawProductId !== null) {
      if (typeof rawProductId !== "string" || !rawProductId.trim()) errors.push("product_id must be a non-empty string when provided");
      else if (rawProductId.trim().length > 100) errors.push("product_id exceeds 100 characters");
      else product_id = rawProductId.trim();
    }

    const entry: ParsedImageUpdateEntry = { image_file: rawImageFile, name, category_id, note, product_id };
    const key = productMatchKey(name, category_id);

    let matchedProduct: ExistingProductForImageUpdate | null = null;
    let status: ImageUpdateRowStatus = "ready";

    if (errors.length > 0) {
      status = "invalid";
    } else if (seenKeys.has(key)) {
      status = "duplicate_zip";
      errors.push("Duplicate product entry in ZIP");
    } else {
      const resolved = resolveUniqueTargetProduct(entry, existingProducts);
      if (!resolved.ok) {
        status = resolved.status;
        errors.push(resolved.reason);
      } else if (seenTargetIds.has(resolved.product.id)) {
        status = "duplicate_zip";
        errors.push("Duplicate target product in ZIP");
      } else {
        matchedProduct = resolved.product;
        seenKeys.add(key);
        seenTargetIds.add(resolved.product.id);
      }
    }

    return {
      index,
      key,
      entry,
      matchedProduct,
      imageBytes,
      imageMime,
      status,
      errors,
      selected: status === "ready",
    };
  });

  return { rows };
}

export function buildImageUpdatePayload(storageImageUrl: string): { image: string } {
  if (!storageImageUrl || /^data:/i.test(storageImageUrl.trim())) {
    throw new Error("A valid storage image URL is required.");
  }
  return { image: storageImageUrl.trim() };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function buildProductInsertPayload(product: ParsedImportProduct, storageImageUrl: string) {
  if (!storageImageUrl || /^data:/i.test(storageImageUrl.trim())) {
    throw new Error("A valid storage image URL is required.");
  }
  return {
    name: product.name,
    brand: product.brand,
    model: product.model,
    category_id: product.category_id,
    price: product.price,
    old_price: null,
    stock: product.stock,
    colors: product.colors,
    capacity: product.capacity,
    description: product.description,
    features: product.features,
    specs: product.specs,
    financing: product.financing,
    image: storageImageUrl.trim(),
    is_featured: false,
    is_bestseller: false,
    is_new: true,
    is_offer: false,
    active: false,
  };
}