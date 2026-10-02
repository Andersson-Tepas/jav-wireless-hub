import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contact = {
  customer_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(30),
};

const orderSchema = z.object({
  ...contact,
  address: z.string().trim().max(300).optional(),
  delivery_method: z.enum(["pickup", "shipping"]),
  payment_method: z.enum(["card", "paypal", "zelle"]),
  payment_reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
}).refine((d) => d.delivery_method !== "shipping" || (d.address && d.address.length > 5), { message: "Dirección requerida", path: ["address"] })
  .refine((d) => d.payment_method !== "zelle" || (d.payment_reference && d.payment_reference.length > 2), { message: "Referencia de Zelle requerida", path: ["payment_reference"] });

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.items.map((i) => i.id);
    const { data: products, error } = await supabaseAdmin.from("products").select("id,name,price,stock,image,active").in("id", ids);
    if (error) throw new Error("No se pudo procesar el pedido");
    const lines = data.items.map((i) => {
      const p = products.find((x) => x.id === i.id);
      if (!p || !p.active) throw new Error("Un producto ya no está disponible");
      if (p.stock < i.quantity) throw new Error(`Stock insuficiente para ${p.name}`);
      return { p, quantity: i.quantity };
    });
    const subtotal = lines.reduce((n, l) => n + Number(l.p.price) * l.quantity, 0);
    const status = data.payment_method === "zelle" ? "payment_pending" : "payment_confirmed";
    const { data: order, error: oErr } = await supabaseAdmin.from("orders").insert({
      customer_name: data.customer_name, email: data.email, phone: data.phone,
      address: data.delivery_method === "shipping" ? data.address : null,
      delivery_method: data.delivery_method, payment_method: data.payment_method,
      payment_reference: data.payment_method === "zelle" ? data.payment_reference : `SIM-${Date.now()}`,
      notes: data.notes ?? null, subtotal, total: subtotal, status,
    }).select().single();
    if (oErr || !order) throw new Error("No se pudo crear el pedido");
    await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ order_id: order.id, product_id: l.p.id, name: l.p.name, price: l.p.price, quantity: l.quantity, image: l.p.image })));
    for (const l of lines) await supabaseAdmin.from("products").update({ stock: l.p.stock - l.quantity }).eq("id", l.p.id);
    return { order_number: order.order_number, email: order.email };
  });

const lookupSchema = z.object({ order_number: z.string().trim().min(3).max(20), contact: z.string().trim().min(3).max(255) });

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const num = data.order_number.toUpperCase().replace(/^#/, "");
    const { data: order } = await supabaseAdmin.from("orders").select("*").eq("order_number", num).maybeSingle();
    const c = data.contact.toLowerCase();
    const digits = (s: string) => s.replace(/\D/g, "");
    if (!order || !(order.email.toLowerCase() === c || (digits(c).length >= 7 && digits(order.phone) === digits(c)))) return { found: false as const };
    const [{ data: items }, { data: history }] = await Promise.all([
      supabaseAdmin.from("order_items").select("name,price,quantity,image").eq("order_id", order.id),
      supabaseAdmin.from("order_status_history").select("status,created_at").eq("order_id", order.id).order("created_at"),
    ]);
    return {
      found: true as const,
      order: {
        order_number: order.order_number, created_at: order.created_at, updated_at: order.updated_at,
        status: order.status, delivery_method: order.delivery_method, payment_method: order.payment_method,
        total: Number(order.total), tracking_number: order.tracking_number, carrier: order.carrier, customer_name: order.customer_name,
      },
      items: (items ?? []).map((i) => ({ ...i, price: Number(i.price) })),
      history: history ?? [],
    };
  });

const serviceSchema = z.object({
  ...contact,
  service_slug: z.string().max(60),
  service_name: z.string().max(100),
  details: z.record(z.string(), z.string().max(1000)),
  amount: z.number().min(0).max(100000).nullable(),
  payment_method: z.enum(["card", "paypal", "zelle", "store"]),
  payment_reference: z.string().trim().max(120).optional(),
});

export const createServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("service_requests").insert({
      ...data, payment_reference: data.payment_reference ?? null,
    }).select("reference").single();
    if (error || !row) throw new Error("No se pudo enviar la solicitud");
    return { reference: row.reference };
  });

export const lookupServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ reference: z.string().trim().min(3).max(20), contact: z.string().trim().min(3).max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("service_requests").select("*").eq("reference", data.reference.toUpperCase()).maybeSingle();
    const c = data.contact.toLowerCase();
    const digits = (s: string) => s.replace(/\D/g, "");
    if (!r || !(r.email.toLowerCase() === c || (digits(c).length >= 7 && digits(r.phone) === digits(c)))) return { found: false as const };
    return { found: true as const, request: { reference: r.reference, service_name: r.service_name, status: r.status, created_at: r.created_at, updated_at: r.updated_at, amount: r.amount === null ? null : Number(r.amount), payment_method: r.payment_method } };
  });
