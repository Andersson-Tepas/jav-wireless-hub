import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const variantsQuery = (productId: string) => queryOptions({
  queryKey: ["product-variants", productId],
  queryFn: async () => {
    const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("created_at").limit(200);
    if (error) throw error;
    return data;
  },
});

export type VariantPricingRow = {
  product_id: string;
  active: boolean;
  stock: number;
  price_override: number | null;
};

export const publicVariantPricingQuery = queryOptions({
  queryKey: ["product-variants", "pricing-summary"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("product_variants")
      .select("product_id, active, stock, price_override")
      .eq("active", true)
      .limit(2000);
    if (error) throw error;
    const byProduct: Record<string, VariantPricingRow[]> = {};
    for (const row of data ?? []) {
      const list = byProduct[row.product_id] ?? [];
      list.push(row);
      byProduct[row.product_id] = list;
    }
    return byProduct;
  },
});