import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Orders matched by the signed-in user's verified email; customers never get direct table access.
export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (!email) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("order_number, status, total, delivery_method, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load orders");
    return data ?? [];
  });
