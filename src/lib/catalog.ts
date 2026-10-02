import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categoryNames, productNames, serviceCopy, type Service, type ServiceField } from "@/lib/site-data";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;
export type ServiceRow = Tables<"services">;
export type Spec = { label: string; value: string };

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((p) => ({ ...p, name: productNames[p.name] ?? p.name }));
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").eq("active", true).order("sort");
    if (error) throw error;
    return data.map((c) => ({ ...c, name: categoryNames[c.id] ?? c.name }));
  },
});

export const toService = (r: ServiceRow): Service => serviceCopy[r.slug] ?? ({
  slug: r.slug, name: r.name, short: r.short, description: r.description, requirements: r.requirements, cost: r.cost,
  ...(r.fee !== null ? { fee: Number(r.fee) } : {}), amountField: r.amount_field,
  fields: Array.isArray(r.fields) ? (r.fields as unknown as ServiceField[]) : [],
});

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: async () => {
    const { data, error } = await supabase.from("services").select("*").eq("active", true).order("sort");
    if (error) throw error;
    return data.map(toService);
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data } = await supabase.from("settings").select("key,value");
    return Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) as Record<string, string>;
  },
});

export const promotionsQuery = queryOptions({
  queryKey: ["promotions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("promotions").select("*, promotion_products(product_id)").order("starts_at", { ascending: false });
    if (error) throw error;
    const now = Date.now();
    return data.filter((p) => p.active && new Date(p.starts_at).getTime() <= now && (!p.ends_at || new Date(p.ends_at).getTime() > now));
  },
});

export const specsOf = (p: Product) => (Array.isArray(p.specs) ? (p.specs as Spec[]) : []);
