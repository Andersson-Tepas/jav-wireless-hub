import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { CartProvider, useCart } from "@/lib/cart";
import { cartIdentity, compatibleVariants, hasVariants, selectionLabel, stockLabel, validateAllocation, variantSuggestion, type Variant, type VariantDraft } from "@/lib/variants";
import { orderSchema } from "@/lib/commerce.schemas";

const draft = (color: string | null, storage: string | null, stock = 2): VariantDraft => ({ color_name: color, color_hex: null, storage, stock, image: null, active: true });
const variant = (color: string | null, storage: string | null, stock = 2): Variant => ({ ...draft(color, storage, stock), id: crypto.randomUUID(), product_id: crypto.randomUUID(), created_at: "2026-11-27" });
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
});