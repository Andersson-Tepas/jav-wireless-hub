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
  if (error) throw new Error("Could not process the order");
  const lines = data.items.map((i) => {
    const p = products.find((x) => x.id === i.id);
    if (!p || !p.active) throw new Error("An item is no longer available");
    if (p.stock < i.quantity) throw new Error(`Insufficient stock for ${p.name}`);
    return { p, quantity: i.quantity };
  });
  const subtotal = lines.reduce((n, l) => n + Number(l.p.price) * l.quantity, 0);
  const isZelle = data.payment_method === "zelle";
  const isCard = data.payment_method === "card";
  const { data: order, error: oErr } = await supabaseAdmin.from("orders").insert({
    customer_name: data.customer_name, email: data.email, phone: data.phone,
    address: data.delivery_method === "shipping" ? (data.address ?? null) : null,
    delivery_method: data.delivery_method, payment_method: data.payment_method,
    // Only a Zelle confirmation code is stored; card/PayPal are simulated and no card data is ever saved.
    // Card payments are confirmed only by the Stripe webhook; PayPal is still simulated.
    payment_reference: isZelle ? (data.payment_reference ?? null) : isCard ? null : `SIM-${Date.now()}`,
    payment_status: isZelle || isCard ? "pending" : "confirmed",
    notes: data.notes ?? null, subtotal, total: subtotal, status: isZelle || isCard ? "payment_pending" : "payment_confirmed",
  }).select().single();
  if (oErr || !order) throw new Error("Could not create the order");
  await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ order_id: order.id, product_id: l.p.id, name: l.p.name, price: l.p.price, quantity: l.quantity, image: l.p.image })));
  for (const l of lines) await supabaseAdmin.from("products").update({ stock: l.p.stock - l.quantity }).eq("id", l.p.id);
  let checkout_url: string | null = null;
  if (isCard) {
    const { createCheckoutSession, safeOrigin } = await import("./stripe.server");
    const origin = safeOrigin(data.return_origin ?? "");
    const track = `${origin}/seguimiento?orden=${encodeURIComponent(order.order_number)}&contacto=${encodeURIComponent(order.email)}`;
    const session = await createCheckoutSession({ kind: "order", id: order.id, reference: order.order_number, email: order.email,
      lines: lines.map((l) => ({ name: l.p.name, amount: Number(l.p.price), quantity: l.quantity })), successUrl: track, cancelUrl: track });
    checkout_url = session.url;
  }
  return { order_number: order.order_number, email: order.email, checkout_url };
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
  const { data: svc } = await supabaseAdmin.from("services").select("slug,name,active,fee,amount_field").eq("slug", data.service_slug).maybeSingle();
  if (!svc || !svc.active) throw new Error("This service is not available");
  const isCard = data.payment_method === "card";
  // Server-side total: DB fee plus the customer-entered amount only when the service allows one.
  const fee = Number(svc.fee ?? 0);
  const customerAmount = svc.amount_field ? Math.max(0, Number(data.amount ?? 0) - fee) : 0;
  const total = Math.round((fee + customerAmount) * 100) / 100;
  if (isCard && total < 0.5) throw new Error("Card payment is not available for this service");
  const { data: row, error } = await supabaseAdmin.from("service_requests").insert({
    customer_name: data.customer_name, email: data.email, phone: data.phone,
    service_slug: svc.slug, service_name: svc.name, details: data.details, amount: svc.amount_field || svc.fee ? total : data.amount,
    payment_method: data.payment_method, payment_reference: data.payment_reference ?? null,
    payment_status: data.payment_method === "paypal" ? "confirmed" : "pending",
  }).select("id,reference").single();
  if (error || !row) throw new Error("Could not submit the request");
  let checkout_url: string | null = null;
  if (isCard) {
    const { createCheckoutSession, safeOrigin } = await import("./stripe.server");
    const origin = safeOrigin(data.return_origin ?? "");
    const back = `${origin}/seguimiento?orden=${encodeURIComponent(row.reference)}&contacto=${encodeURIComponent(data.email)}`;
    const session = await createCheckoutSession({ kind: "service", id: row.id, reference: row.reference, email: data.email,
      lines: [{ name: svc.name, amount: total, quantity: 1 }], successUrl: back, cancelUrl: back });
    checkout_url = session.url;
  }
  return { reference: row.reference, checkout_url };
}

export async function lookupServiceRequestCore(reference: string, contact: string) {
  const { data: r } = await supabaseAdmin.from("service_requests").select("*").eq("reference", reference.toUpperCase().trim()).maybeSingle();
  if (!r || !matchesContact(r.email, r.phone, contact)) return { found: false as const };
  return { found: true as const, request: { reference: r.reference, service_name: r.service_name, status: r.status, created_at: r.created_at, updated_at: r.updated_at, amount: r.amount === null ? null : Number(r.amount), payment_method: r.payment_method } };
}
