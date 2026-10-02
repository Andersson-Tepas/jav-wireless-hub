import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const fmt = (d: string) => new Date(d).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
export const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1 text-xs font-semibold ${className}`}>{label}{children}</label>;
}

export function Kpi({ label, value, tone = "primary" }: { label: string; value: string | number; tone?: "primary" | "accent" | "success" | "muted" }) {
  const color = { primary: "text-primary", accent: "text-accent", success: "text-success", muted: "text-muted-foreground" }[tone];
  return <div className="card-soft p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className={`mt-1 font-display text-3xl font-bold ${color}`}>{value}</p></div>;
}

export const paymentStatusLabels: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmado", rejected: "Rechazado" };

export function useAdminOrders() {
  return useQuery({ queryKey: ["admin-orders"], queryFn: async () => (await supabase.from("orders").select("*, order_items(name,quantity,price), order_status_history(status,previous_status,changed_by_email,created_at)").order("created_at", { ascending: false })).data ?? [] });
}
export function useAdminProducts() {
  return useQuery({ queryKey: ["admin-products"], queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false })).data ?? [] });
}
export function useAdminCategories() {
  return useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [] });
}
export function useAdminRequests() {
  return useQuery({ queryKey: ["admin-requests"], queryFn: async () => (await supabase.from("service_requests").select("*").order("created_at", { ascending: false })).data ?? [] });
}
export function useLowStock() {
  return useQuery({ queryKey: ["admin-settings"], queryFn: async () => {
    const { data } = await supabase.from("settings").select("*");
    return data ?? [];
  } });
}
// Same source as Panel → Clientes: customer_profiles excluding admins.
export function useAdminCustomers() {
  return useQuery({ queryKey: ["admin-customers"], queryFn: async () => {
    const [{ data: p }, { data: admins }] = await Promise.all([
      supabase.from("customer_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = new Set((admins ?? []).map((a) => a.user_id));
    return (p ?? []).filter((x) => !adminIds.has(x.user_id));
  } });
}
export const lowStockFrom = (rows: { key: string; value: string }[] | undefined) => Number(rows?.find((r) => r.key === "low_stock_threshold")?.value ?? 5) || 5;
