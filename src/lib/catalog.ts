import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categoryNames, productNames, serviceCopy, type Service, type ServiceField } from "@/lib/site-data";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;
export type ServiceRow = Tables<"services">;
export type Spec = { label: string; value: string };

const productCopy: Record<string, Partial<Product>> = {
  "Nova X Pro": { description: "Professional performance, an advanced camera, and all-day battery life.", colors: ["Graphite", "Silver"], features: ["120 Hz OLED display", "48 MP triple camera", "45W fast charging"], financing: "Starting at $79/month for 12 months", specs: [{ label: "Display", value: "6.7-inch OLED" }, { label: "Memory", value: "12 GB RAM" }, { label: "Network", value: "5G / eSIM" }] },
  "Axis Ultra": { description: "Titanium finish and exceptional nighttime photography.", colors: ["Titanium", "Black"], features: ["5x optical zoom", "Titanium body", "8K video"], financing: "Starting at $96/month for 12 months", specs: [{ label: "Display", value: "6.8-inch AMOLED" }, { label: "Battery", value: "5,000 mAh" }] },
  "Flex One": { description: "Compact foldable design with a smart outer display.", colors: ["Blue", "Cream"], features: ["Foldable design", "Outer display", "Hands-free mode"], financing: "Starting at $66/month for 12 months", specs: [{ label: "Display", value: "6.9-inch flexible" }, { label: "Weight", value: "187 g" }] },
  "Air Beats Pro": { description: "Immersive sound with active noise cancellation.", colors: ["White"], features: ["Active noise cancellation", "Spatial audio", "Wireless charging"], capacity: "30-hour battery", specs: [{ label: "Connection", value: "Bluetooth 5.3" }, { label: "Water resistance", value: "IPX4" }] },
  "Cadena Oro 14K": { description: "14-karat Cuban-link gold chain with a secure clasp.", colors: ["Yellow gold"], features: ["14K gold", "Reinforced clasp", "Certificate included"], financing: "Starting at $58/month for 12 months", specs: [{ label: "Material", value: "14K gold" }, { label: "Length", value: "50 cm" }] },
  "Traje Clásico Slim": { description: "A slim-fit two-piece suit ideal for formal events.", colors: ["Navy", "Black", "Gray"], features: ["Slim fit", "Wrinkle-resistant fabric", "Jacket and pants"], capacity: "Sizes 36–46", specs: [{ label: "Material", value: "Polyester/viscose" }, { label: "Pieces", value: "2" }] },
  "Taladro Inalámbrico 20V": { description: "Compact drill with two batteries and a carrying case.", colors: ["Yellow"], features: ["2 batteries included", "50 Nm torque", "LED light"], specs: [{ label: "Voltage", value: "20 V" }, { label: "Speeds", value: "2" }] },
  "Set de Regalo Deluxe": { description: "Gift box with a plush toy, chocolates, and a personalized card.", colors: ["Red"], features: ["Personalized card", "Premium packaging"], capacity: "Medium box", specs: [{ label: "Size", value: "30 x 20 cm" }] },
  "Cargador Rápido 45W": { description: "Fast-charging USB-C charger compatible with most devices.", colors: ["White", "Black"], features: ["USB-C PD", "Thermal protection"], specs: [{ label: "Power", value: "45 W" }] },
  "Eau Noble 100 ml": { description: "An elegant fragrance with amber, vanilla, and woody notes.", colors: ["Amber"], features: ["Long-lasting", "Woody notes", "Gift presentation"], specs: [{ label: "Concentration", value: "Eau de Parfum" }, { label: "Volume", value: "100 ml" }] },
};

export const localizeProduct = (p: Product): Product => ({ ...p, ...(productCopy[p.name] ?? {}), name: productNames[p.name] ?? p.name });

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(localizeProduct);
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

// Rows saved from the admin editor after the seed use their DB values; untouched seed rows use the English display copy.
export const isServiceEdited = (r: { updated_at: string }) => new Date(r.updated_at).getTime() > Date.parse("2026-10-06T17:00:00Z");
export const toService = (r: ServiceRow): Service => (isServiceEdited(r) && serviceCopy[r.slug] ? {
  ...serviceCopy[r.slug]!, name: r.name, short: r.short, description: r.description, requirements: r.requirements, cost: r.cost,
  ...(r.fee !== null ? { fee: Number(r.fee) } : {}), amountField: r.amount_field,
} : serviceCopy[r.slug]) ?? ({
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
