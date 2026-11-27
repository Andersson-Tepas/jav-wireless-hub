import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { CartProvider, useCart } from "@/lib/cart";
import {
  cartIdentity,
  compatibleVariants,
  effectiveVariantPrice,
  hasVariants,
  parsePriceOverrideInput,
  selectionLabel,
  stockLabel,
  summarizeProductPricing,
  validateAllocation,
  variantSuggestion,
  type Variant,
  type VariantDraft,
} from "@/lib/variants";
import { orderSchema } from "@/lib/commerce.schemas";

const draft = (color: string | null, storage: string | null, stock = 2): VariantDraft => ({ color_name: color, color_hex: null, storage, stock, image: null, active: true });
const variant = (color: string | null, storage: string | null, stock = 2, price_override: number | null = null): Variant => ({
  ...draft(color, storage, stock),
  price_override,
  id: crypto.randomUUID(),
  product_id: crypto.randomUUID(),
  created_at: "2026-11-27",
});
describe("variant rules", () => {
  it("keeps existing products opt-out and does not infer stock from descriptions", () => {
    expect(hasVariants({})).toBe(false);
    expect(hasVariants({ color_variants_enabled: false, storage_variants_enabled: false })).toBe(false);
    expect(variantSuggestion("herramientas")).toContain("OFF");
    expect(variantSuggestion("perfumes")).toContain("OFF");
  });
  it("supports color-only stock", () => expect(validateAllocation([draft("Black", null, 3)], true, false, 3).valid).toBe(true));
  it("supports storage-only stock", () => expect(validateAllocation([draft(null, "128 GB", 5)], false, true, 5).valid).toBe(true));
  it("accepts only actual combinations, not a Cartesian product", () => {
    const rows = [variant("Black", "128 GB"), variant("White", "256 GB")];
    expect(compatibleVariants(rows, "Black", "256 GB")).toHaveLength(0);
    expect(compatibleVariants(rows, "Black", "128 GB")).toHaveLength(1);
  });
  it("retains zero-stock combinations but labels them unavailable", () => {
    expect(validateAllocation([draft("Black", null, 0)], true, false, 0).valid).toBe(true);
    expect(stockLabel(0)).toBe("Out of stock"); expect(stockLabel(2)).toBe("Only 2 left"); expect(stockLabel(5)).toBe("5 units in stock");
  });
  it("requires exact stock reconciliation without loss or duplication", () => {
    expect(validateAllocation([draft("Black", null, 2)], true, false, 3).valid).toBe(false);
    expect(validateAllocation([draft("Black", null, 4)], true, false, 3).valid).toBe(false);
    expect(validateAllocation([draft("Black", null, 2), draft("White", null, 1)], true, false, 3).valid).toBe(true);
  });
  it("rejects duplicate normalized combinations, missing dimensions, negative and fractional stock", () => {
    expect(validateAllocation([draft("Black", null, 1), draft(" black ", null, 1)], true, false, 2).valid).toBe(false);
    expect(validateAllocation([draft("Black", null, 2)], true, true, 2).valid).toBe(false);
    expect(validateAllocation([draft("Black", null, -1)], true, false, -1).valid).toBe(false);
    expect(validateAllocation([draft("Black", null, 1.5)], true, false, 1.5).valid).toBe(false);
  });
  it("retains legacy order payloads but rejects malformed variant IDs", () => {
    const input = { customer_name: "Test Customer", email: "test@example.invalid", phone: "5551234567", delivery_method: "pickup", payment_method: "card", items: [{ id: crypto.randomUUID(), quantity: 1 }] };
    expect(orderSchema.safeParse(input).success).toBe(true);
    expect(orderSchema.safeParse({ ...input, items: [{ ...input.items[0], variant_id: "invalid" }] }).success).toBe(false);
  });
  it("preserves immutable selection display", () => expect(selectionLabel({ color_snapshot: "Black", storage_snapshot: "128 GB" })).toBe("Black / 128 GB"));
});

describe("cart variants", () => {
  beforeEach(() => localStorage.clear());
  it("separates variants, merges only the same variant and updates/removes by composite identity", () => {
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    const item = { id: "product", name: "Phone", price: 20, image: "", stock: 5 };
    act(() => { result.current.add({ ...item, variant_id: "black", color_snapshot: "Black" }); result.current.add({ ...item, variant_id: "white", color_snapshot: "White" }); result.current.add({ ...item, variant_id: "black", color_snapshot: "Black" }); });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find(i => i.variant_id === "black")?.quantity).toBe(2);
    act(() => result.current.setQty("product:white", 3));
    expect(result.current.count).toBe(5);
    act(() => result.current.remove("product:black"));
    expect(result.current.items).toHaveLength(1);
    expect(cartIdentity(result.current.items[0] ?? item)).toBe("product:white");
  });
  it("preserves legacy cart identity", () => expect(cartIdentity({ id: "product" })).toBe("product"));

  it("syncs stale cart prices cleanly without altering composite identity", () => {
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    const item = { id: "prod-1", name: "Phone", price: 499.99, image: "", stock: 4, variant_id: "var-256", color_snapshot: "Black", storage_snapshot: "256 GB" };
    act(() => result.current.add(item, 2));
    expect(result.current.total).toBeCloseTo(999.98, 2);
    act(() => result.current.syncItems((prev) => prev.map((i) => ({ ...i, price: 549.99 }))));
    expect(result.current.total).toBeCloseTo(1099.98, 2);
    expect(cartIdentity(result.current.items[0] ?? item)).toBe("prod-1:var-256");
  });
});

describe("variant pricing rules", () => {
  it("inherits base price when price_override is null and uses exact cents override when set", () => {
    expect(effectiveVariantPrice(499.99, { price_override: null })).toBe(499.99);
    expect(effectiveVariantPrice(499.99, { price_override: 549.95 })).toBe(549.95);
    expect(effectiveVariantPrice(499.99, undefined)).toBe(499.99);
  });

  it("validates USD price override inputs strictly (exact cents, non-negative, upper bound)", () => {
    expect(parsePriceOverrideInput("")).toEqual({ ok: true, value: null });
    expect(parsePriceOverrideInput("549.99")).toEqual({ ok: true, value: 549.99 });
    expect(parsePriceOverrideInput("0")).toEqual({ ok: true, value: 0 });
    expect(parsePriceOverrideInput("-10").ok).toBe(false);
    expect(parsePriceOverrideInput("12.345").ok).toBe(false);
    expect(parsePriceOverrideInput("1000000").ok).toBe(false);
    expect(parsePriceOverrideInput("abc").ok).toBe(false);
  });

  it("computes 'From $X' only when available variants differ, excludes out-of-stock when others exist, and hides misleading old_price", () => {
    const product = { price: 499.99, old_price: 599.99, color_variants_enabled: true, storage_variants_enabled: true };
    // Available variants have different effective prices -> range, hide old_price
    const mixed = summarizeProductPricing(product, [
      variant("Black", "128 GB", 2, null),
      variant("Black", "256 GB", 1, 599.99),
      variant("White", "512 GB", 0, 399.99), // out of stock, excluded from starting price
    ]);
    expect(mixed.hasRange).toBe(true);
    expect(mixed.minPrice).toBe(499.99);
    expect(mixed.maxPrice).toBe(599.99);
    expect(mixed.showOldPrice).toBe(false);

    // All available share same custom override -> single price, hide old_price because it differs from base
    const uniformOverride = summarizeProductPricing(product, [
      variant("Black", "256 GB", 2, 549.99),
      variant("White", "256 GB", 3, 549.99),
    ]);
    expect(uniformOverride.hasRange).toBe(false);
    expect(uniformOverride.displayPrice).toBe(549.99);
    expect(uniformOverride.showOldPrice).toBe(false);

    // All unavailable -> coherent fallback across active variants
    const allOut = summarizeProductPricing(product, [
      variant("Black", "128 GB", 0, null),
      variant("Black", "256 GB", 0, 579.99),
    ]);
    expect(allOut.hasRange).toBe(true);
    expect(allOut.minPrice).toBe(499.99);
  });
});