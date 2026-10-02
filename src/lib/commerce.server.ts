import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { OrderInput, ServiceInput } from "./commerce.schemas";

const digits = (s: string) => s.replace(/\D/g, "");
const matchesContact = (email: string, phone: string, contact: string) => {
  const c = contact.toLowerCase().trim();
  return email.toLowerCase() === c || (digits(c).length >= 7 && digits(phone) === digits(c));
};

export async function createOrderCore(data: OrderInput) {
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
  const isZelle = data.payment_method === "zelle";
  const { data: order, error: oErr } = await supabaseAdmin.from("orders").insert({
    customer_name: data.customer_name, email: data.email, phone: data.phone,
    address: data.delivery_method === "shipping" ? (data.address ?? null) : null,
    delivery_method: data.delivery_method, payment_method: data.payment_method,
    // Only a Zelle confirmation code is stored; card/PayPal are simulated and no card data is ever saved.
    payment_reference: isZelle ? (data.payment_reference ?? null) : `SIM-${Date.now()}`,
    payment_status: isZelle ? "pending" : "confirmed",
    notes: data.notes ?? null, subtotal, total: subtotal, status: isZelle ? "payment_pending" : "payment_confirmed",
  }).select().single();
  if (oErr || !order) throw new Error("No se pudo crear el pedido");
  await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ order_id: order.id, product_id: l.p.id, name: l.p.name, price: l.p.price, quantity: l.quantity, image: l.p.image })));
  for (const l of lines) await supabaseAdmin.from("products").update({ stock: l.p.stock - l.quantity }).eq("id", l.p.id);
  return { order_number: order.order_number, email: order.email };
}

export async function lookupOrderCore(orderNumber: string, contact: string) {
  const num = orderNumber.toUpperCase().replace(/^#/, "").trim();
  const { data: order } = await supabaseAdmin.from("orders").select("*").eq("order_number", num).maybeSingle();
  if (!order || !matchesContact(order.email, order.phone, contact)) return { found: false as const };
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
}

export async function createServiceRequestCore(data: ServiceInput) {
  const { data: svc } = await supabaseAdmin.from("services").select("slug,name,active").eq("slug", data.service_slug).maybeSingle();
  if (!svc || !svc.active) throw new Error("Este servicio no está disponible");
  const { data: row, error } = await supabaseAdmin.from("service_requests").insert({
    customer_name: data.customer_name, email: data.email, phone: data.phone,
    service_slug: svc.slug, service_name: svc.name, details: data.details, amount: data.amount,
    payment_method: data.payment_method, payment_reference: data.payment_reference ?? null,
    payment_status: data.payment_method === "card" || data.payment_method === "paypal" ? "confirmed" : "pending",
  }).select("reference").single();
  if (error || !row) throw new Error("No se pudo enviar la solicitud");
  return { reference: row.reference };
}

export async function lookupServiceRequestCore(reference: string, contact: string) {
  const { data: r } = await supabaseAdmin.from("service_requests").select("*").eq("reference", reference.toUpperCase().trim()).maybeSingle();
  if (!r || !matchesContact(r.email, r.phone, contact)) return { found: false as const };
  return { found: true as const, request: { reference: r.reference, service_name: r.service_name, status: r.status, created_at: r.created_at, updated_at: r.updated_at, amount: r.amount === null ? null : Number(r.amount), payment_method: r.payment_method } };
}
