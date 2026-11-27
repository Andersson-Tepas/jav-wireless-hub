import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductDialog } from "@/components/product-catalog";
import { CartProvider } from "@/lib/cart";
import type { Product } from "@/lib/catalog";
import { variantsQuery } from "@/lib/variant-queries";
import type { Variant } from "@/lib/variants";

const product = (stock: number): Product => ({
  id: crypto.randomUUID(), name: "Test Phone", brand: "Apple", model: "Test", category_id: "telefonos",
  capacity: "", price: 499.99, old_price: null, stock, image: "phone-graphite", colors: [], description: "",
  features: [], specs: [], financing: null, active: true, is_new: false, is_featured: false, is_bestseller: false,
  is_offer: false, color_variants_enabled: false, storage_variants_enabled: true, created_at: "2026-11-27",
});

const variant = (productId: string, storage: string, stock: number): Variant => ({
  id: crypto.randomUUID(), product_id: productId, color_name: null, color_hex: null, storage, stock,
  image: null, active: true, price_override: null, created_at: "2026-11-27",
});

function renderDialog(p: Product, variants: Variant[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(variantsQuery(p.id).queryKey, variants);
  const onClose = vi.fn();
  render(<QueryClientProvider client={client}><CartProvider><ProductDialog product={p} onClose={onClose} /></CartProvider></QueryClientProvider>);
  return onClose;
}

afterEach(cleanup);

describe("customer-facing variant labels and zero-stock inquiries", () => {
  it("selects configured zero-stock choices for inquiry but never enables add to cart", () => {
    const p = product(0);
    renderDialog(p, [variant(p.id, "256 GB (label)", 0), variant(p.id, "Storage to be confirmed", 0)]);

    fireEvent.click(screen.getByRole("button", { name: "256 GB — Confirm availability" }));
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByText("Unavailable — Ask about availability")).toBeInTheDocument();
    const capacityInquiry = screen.getByRole("link", { name: "Ask about availability" });
    expect(decodeURIComponent(capacityInquiry.getAttribute("href") ?? "")).toContain("256 GB");
    expect(decodeURIComponent(capacityInquiry.getAttribute("href") ?? "")).not.toContain("(label)");
    expect(decodeURIComponent(capacityInquiry.getAttribute("href") ?? "")).toContain("Please confirm availability");

    fireEvent.click(screen.getByRole("button", { name: "Ask store — Confirm availability" }));
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    const unknownInquiry = decodeURIComponent(screen.getByRole("link", { name: "Ask about availability" }).getAttribute("href") ?? "");
    expect(unknownInquiry).toContain("Ask store");
    expect(unknownInquiry).toContain("Please confirm the exact option and availability");
    expect(unknownInquiry).not.toContain("Storage to be confirmed");
  });

  it("preserves the normal positive-stock variant purchase flow", () => {
    const p = product(2);
    const onClose = renderDialog(p, [variant(p.id, "128 GB", 2)]);
    fireEvent.click(screen.getByRole("button", { name: "128 GB" }));
    expect(screen.getByText("Only 2 left")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Add to cart" });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
