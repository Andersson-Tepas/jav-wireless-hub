import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export type Variant = Tables<"product_variants">;
export const hasVariants = (p: { color_variants_enabled?: boolean; storage_variants_enabled?: boolean }) => !!(p.color_variants_enabled || p.storage_variants_enabled);
export const normalizeOption = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
export const selectionLabel = (i: { color_snapshot?: string | null; storage_snapshot?: string | null }) => [i.color_snapshot, i.storage_snapshot].filter(Boolean).join(" / ");
export const cartIdentity = (i: { id: string; variant_id?: string | null }) => i.variant_id ? `${i.id}:${i.variant_id}` : i.id;
export const stockLabel = (n: number) => n <= 0 ? "Out of stock" : n <= 2 ? `Only ${n} left` : `${n} units in stock`;

export const MAX_VARIANT_PRICE = 999_999.99;
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export function normalizePrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function parsePriceOverrideInput(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!PRICE_RE.test(trimmed)) return { ok: false, error: "Enter a non-negative USD amount with up to 2 decimals." };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > MAX_VARIANT_PRICE) {
    return { ok: false, error: `Price must be between $0.00 and $${MAX_VARIANT_PRICE.toLocaleString("en-US")}.` };
  }
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function effectiveVariantPrice(
  basePrice: number | string,
  variant?: { price_override?: number | string | null | undefined } | null,
): number {
  const override = normalizePrice(variant?.price_override);
  return override !== null ? override : Number(basePrice);
}

export type ProductPriceSummary = {
  minPrice: number;
  maxPrice: number;
  hasRange: boolean;
  displayPrice: number;
  showOldPrice: boolean;
};

export function summarizeProductPricing(
  product: { price: number | string; old_price?: number | string | null; color_variants_enabled?: boolean; storage_variants_enabled?: boolean },
  variants?: readonly Pick<Variant, "active" | "stock" | "price_override">[] | null,
): ProductPriceSummary {
  const base = Number(product.price);
  const oldPrice = normalizePrice(product.old_price);
  if (!hasVariants(product) || !variants?.length) {
    return { minPrice: base, maxPrice: base, hasRange: false, displayPrice: base, showOldPrice: oldPrice !== null && oldPrice > base };
  }
  const active = variants.filter((v) => v.active);
  if (!active.length) {
    return { minPrice: base, maxPrice: base, hasRange: false, displayPrice: base, showOldPrice: oldPrice !== null && oldPrice > base };
  }
  const available = active.filter((v) => v.stock > 0);
  const pool = available.length > 0 ? available : active;
  const prices = pool.map((v) => effectiveVariantPrice(base, v));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const hasRange = minPrice !== maxPrice;
  const matchesBase = !hasRange && minPrice === base;
  return { minPrice, maxPrice, hasRange, displayPrice: minPrice, showOldPrice: matchesBase && oldPrice !== null && oldPrice > base };
}

const option = z.string().trim().min(1).max(80).nullable();
export const priceOverrideSchema = z
  .number()
  .min(0)
  .max(MAX_VARIANT_PRICE)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Price override must have at most 2 decimal places")
  .nullable();

export const variantDraftSchema = z.object({
  id: z.string().uuid().optional(), color_name: option, storage: option,
  color_hex: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
  stock: z.number().int().min(0).max(1_000_000),
  image: z.string().url().startsWith("https://").max(4000).nullable(), active: z.boolean(),
  price_override: priceOverrideSchema.optional(),
}).refine(v => v.color_name !== null || v.storage !== null, "Choose a dimension");
export type VariantDraft = z.infer<typeof variantDraftSchema>;

export function validateAllocation(rows: VariantDraft[], color: boolean, storage: boolean, stock: number) {
  if (!color && !storage) return { valid: true, total: stock, error: "" };
  const total = rows.filter(v => v.active).reduce((n, v) => n + v.stock, 0);
  const keys = new Set<string>();
  for (const row of rows) {
    if (!variantDraftSchema.safeParse(row).success) return { valid: false, total, error: "Every row needs valid stock, dimensions, hex and an HTTPS image URL." };
    const key = `${normalizeOption(row.color_name)}\u0000${normalizeOption(row.storage)}`;
    if (keys.has(key)) return { valid: false, total, error: "Duplicate combinations are not allowed." };
    keys.add(key);
    if (row.active && ((row.color_name !== null) !== color || (row.storage !== null) !== storage)) return { valid: false, total, error: "Complete each enabled dimension on every active combination." };
  }
  if (!rows.some(v => v.active) || total !== stock) return { valid: false, total, error: "Allocate exactly the current stock. Adjust inventory separately after saving." };
  return { valid: true, total, error: "" };
}

export function compatibleVariants(rows: Variant[], color: string | null, storage: string | null) {
  return rows.filter(v => v.active && (!color || normalizeOption(v.color_name) === normalizeOption(color)) && (!storage || normalizeOption(v.storage) === normalizeOption(storage)));
}

export const storagePresets = ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"];
// Suggestions only; never activate or allocate stock automatically.
export function variantSuggestion(category: string) {
  if (/herramient|tool|perfume|fragran/i.test(category)) return "Variants default OFF. Descriptive colors are not selectable inventory.";
  if (/telefon|phone|tablet|ipad/i.test(category)) return "Color and storage may apply; enter only confirmed combinations and stock.";
  if (/accesor|accessor|joyer|jewel/i.test(category)) return "Color / finish may apply; only use actual selectable finishes.";
  return "Optional: enable only confirmed selectable colors or storage, never descriptive options.";
}