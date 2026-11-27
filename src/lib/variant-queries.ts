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