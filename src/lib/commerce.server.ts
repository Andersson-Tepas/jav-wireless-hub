import { z } from "zod";
import { effectiveVariantPrice, hasVariants, selectionLabel } from "./variants";
const atomicOrderResult = z.object({
  order: z.object({ id: z.string(), order_number: z.string(), email: z.string(), total: z.coerce.number(), status: z.string(), payment_status: z.string() }),
  items: z.array(z.object({ product_id: z.string(), variant_id: z.string().nullable(), name: z.string(), price: z.coerce.number(), quantity: z.number(), image: z.string().nullable(), color_snapshot: z.string().nullable(), storage_snapshot: z.string().nullable() })),
  reused: z.boolean(),
});
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  billCarrierFees,
  type OrderInput,
  type ServiceInput,
} from "./commerce.schemas";

async function notifyStaff(
  formName: string,
  reference: string,
  fields: { label: string; value: string }[],
) {
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("form-submission", "javwireless5@gmail.com", {
      templateData: { formName, reference, fields },
      idempotencyKey: `form-${reference}`,
    });
  } catch (e) {
    console.error("Form notification email failed", e);
  }
}

const digits = (s: string) => s.replace(/\D/g, "");

const matchesContact = (email: string, phone: string, contact: string) => {
  const c = contact.toLowerCase().trim();
  return (
    email.toLowerCase() === c ||
    (digits(c).length >= 7 && digits(phone) === digits(c))
  );
};

export async function createOrderCore(data: OrderInput) {
  const { data: result, error } = await supabaseAdmin.rpc("create_order_atomic", { _input: data });
  if (error || !result) throw new Error(error?.message ?? "Could not create the order");
  const parsed = atomicOrderResult.parse(result);
  const order = parsed.order;
  const lines = parsed.items.map(i => ({ p: { ...i, name: [i.name, selectionLabel(i)].filter(Boolean).join(" — ") }, quantity: i.quantity }));
  const subtotal = Number(order.total);
  const isZelle = data.payment_method === "zelle";
  const isCard = data.payment_method === "card";
  const isPaypal = data.payment_method === "paypal";

  if (!parsed.reused) await notifyStaff("Checkout order", order.order_number, [
    { label: "Name", value: data.customer_name },
    { label: "Email", value: data.email },
    { label: "Phone", value: data.phone },
    {
      label: "Delivery",
      value:
        data.delivery_method === "shipping"
          ? `Shipping — ${data.address ?? ""}`
          : "In-store pickup",
    },
    { label: "Payment method", value: data.payment_method },
    ...(isZelle && data.payment_reference
      ? [{ label: "Zelle reference", value: data.payment_reference }]
      : []),
    {
      label: "Items",
      value: lines.map((l) => `${l.quantity} × ${l.p.name}`).join(", "),
    },
    { label: "Total", value: `$${subtotal.toFixed(2)}` },
    ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
  ]);

  let checkout_url: string | null = null;

  if (isCard && order.payment_status !== "confirmed" && order.status !== "cancelled") {
    const { createCheckoutSession, safeOrigin } = await import("./stripe.server");
    const origin = safeOrigin(data.return_origin ?? "");
    const track = `${origin}/seguimiento?orden=${encodeURIComponent(
      order.order_number,
    )}&contacto=${encodeURIComponent(order.email)}`;

    const session = await createCheckoutSession({
      kind: "order",
      id: order.id,
      reference: order.order_number,
      email: order.email,
      lines: lines.map((l) => ({
        name: l.p.name,
        amount: Number(l.p.price),
        quantity: l.quantity,
      })),
      successUrl: track,
      cancelUrl: track,
    });

    checkout_url = session.url;
  }

  if (isPaypal && order.payment_status !== "confirmed" && order.status !== "cancelled") {
    const { safeOrigin } = await import("./stripe.server");
    const { createPaypalOrder } = await import("./paypal.server");
    const origin = safeOrigin(data.return_origin ?? "");

    const pp = await createPaypalOrder({
      kind: "order",
      id: order.id,
      reference: order.order_number,
      total: subtotal,
      lines: lines.map(l => ({ name: l.p.name, amount: Number(l.p.price), quantity: l.quantity })),
      returnUrl: `${origin}/api/public/paypal-return?kind=order&id=${order.id}`,
      cancelUrl: `${origin}/seguimiento?orden=${encodeURIComponent(
        order.order_number,
      )}&contacto=${encodeURIComponent(order.email)}`,
    });

    await supabaseAdmin
      .from("orders")
      .update({ payment_reference: pp.id })
      .eq("id", order.id);

    checkout_url = pp.url;
  }

  return {
    order_number: order.order_number,
    email: order.email,
    checkout_url,
    total: subtotal,
    status: order.status,
    items: parsed.items,
  };
}

export async function revalidateCartItemsCore(items: { id: string; variant_id?: string | null | undefined }[]) {
  if (!items.length) return [];
  const productIds = [...new Set(items.map((i) => i.id))];
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => !!v))];
  const [{ data: products, error: pErr }, variantsRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,name,price,stock,image,active,color_variants_enabled,storage_variants_enabled")
      .in("id", productIds),
    variantIds.length
      ? supabaseAdmin
          .from("product_variants")
          .select("id,product_id,color_name,storage,stock,image,active,price_override")
          .in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pErr || variantsRes.error) throw new Error("Could not verify current cart prices");
  const pMap = new Map((products ?? []).map((p) => [p.id, p]));
  const vMap = new Map((variantsRes.data ?? []).map((v) => [v.id, v]));

  return items.map((item) => {
    const p = pMap.get(item.id);
    if (!p || !p.active) {
      return { id: item.id, variant_id: item.variant_id ?? null, available: false, price: null as number | null, stock: 0, image: null as string | null, color_snapshot: null as string | null, storage_snapshot: null as string | null };
    }
    if (hasVariants(p)) {
      const v = item.variant_id ? vMap.get(item.variant_id) : undefined;
      if (!v || v.product_id !== p.id || !v.active) {
        return { id: item.id, variant_id: item.variant_id ?? null, available: false, price: null as number | null, stock: 0, image: p.image, color_snapshot: null as string | null, storage_snapshot: null as string | null };
      }
      return {
        id: p.id,
        variant_id: v.id,
        available: v.stock > 0,
        price: effectiveVariantPrice(p.price, v),
        stock: v.stock,
        image: v.image || p.image,
        color_snapshot: v.color_name,
        storage_snapshot: v.storage,
      };
    }
    if (item.variant_id) {
      return { id: p.id, variant_id: item.variant_id, available: false, price: null as number | null, stock: 0, image: p.image, color_snapshot: null as string | null, storage_snapshot: null as string | null };
    }
    return {
      id: p.id,
      variant_id: null,
      available: p.stock > 0,
      price: Number(p.price),
      stock: p.stock,
      image: p.image,
      color_snapshot: null,
      storage_snapshot: null,
    };
  });
}

export async function lookupOrderCore(orderNumber: string, contact: string) {
  const num = orderNumber.toUpperCase().replace(/^#/, "").trim();

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*")
    .ilike("order_number", num)
    .maybeSingle();

  if (!order || !matchesContact(order.email, order.phone, contact)) {
    return { found: false as const };
  }

  const [{ data: items }, { data: history }] = await Promise.all([
    supabaseAdmin
      .from("order_items")
      .select("name,price,quantity,image,variant_id,color_snapshot,storage_snapshot")
      .eq("order_id", order.id),
    supabaseAdmin
      .from("order_status_history")
      .select("status,created_at")
      .eq("order_id", order.id)
      .order("created_at"),
  ]);

  return {
    found: true as const,
    order: {
      order_number: order.order_number,
      created_at: order.created_at,
      updated_at: order.updated_at,
      status: order.status,
      delivery_method: order.delivery_method,
      payment_method: order.payment_method,
      total: Number(order.total),
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      customer_name: order.customer_name,
    },
    items: (items ?? []).map((i) => ({ ...i, price: Number(i.price) })),
    history: history ?? [],
  };
}

export async function createServiceRequestCore(data: ServiceInput) {
  const { data: svc } = await supabaseAdmin
    .from("services")
    .select("slug,name,active,fee,amount_field")
    .eq("slug", data.service_slug)
    .maybeSingle();

  if (!svc || !svc.active) {
    throw new Error("This service is not available");
  }

  const isCard = data.payment_method === "card";
  const isPaypal = data.payment_method === "paypal";
  const isRepair = svc.slug === "reparaciones";

  // Server-side fee calculation. Never trust a fee sent by the browser.
  let fee = Number(svc.fee ?? 0);

  if (svc.slug === "pago-de-bills") {
    const carrierFee = billCarrierFees[data.details?.["carrier"] ?? ""];
    if (carrierFee === undefined) {
      throw new Error("Select a valid company");
    }
    fee = carrierFee;
  }

  if (svc.slug === "pago-de-utilidades") {
    fee = 4;
  }

  if (isRepair) {
    const deviceType = data.details?.["device_type"] ?? "";
    const repairFees: Record<string, number> = {
      Television: 30,
      "Computer / Laptop": 20,
      "Cell Phone": 0,
      Tablet: 0,
    };

    if (deviceType === "Other") {
      fee = 0;
    } else if (repairFees[deviceType] !== undefined) {
      fee = repairFees[deviceType];
    } else {
      throw new Error("Select a valid device type");
    }
  }

  const customerAmount = isRepair
    ? 0
    : svc.amount_field
      ? Math.max(0, Number(data.amount ?? 0) - fee)
      : 0;

  const total = isRepair
    ? fee
    : Math.round((fee + customerAmount) * 100) / 100;

  if ((isCard || isPaypal) && total < 0.5) {
    throw new Error("Card payment is not available for this service");
  }

  const { data: row, error } = await supabaseAdmin
    .from("service_requests")
    .insert({
      customer_name: data.customer_name,
      email: data.email,
      phone: data.phone,
      service_slug: svc.slug,
      service_name: svc.name,
      details: data.details,
      amount: svc.amount_field || svc.fee || isRepair ? total : data.amount,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference ?? null,
      payment_status: "pending",
    })
    .select("id,reference")
    .single();

  if (error || !row) {
    throw new Error("Could not submit the request");
  }

  await notifyStaff(`${svc.name} request`, row.reference, [
    { label: "Name", value: data.customer_name },
    { label: "Email", value: data.email },
    { label: "Phone", value: data.phone },
    ...Object.entries((data.details ?? {}) as Record<string, unknown>).map(
      ([k, v]) => ({ label: k, value: String(v ?? "") }),
    ),
    ...(svc.amount_field || svc.fee || isRepair
      ? [{ label: "Total", value: `$${total.toFixed(2)}` }]
      : []),
    { label: "Payment method", value: data.payment_method },
    ...(data.payment_method === "zelle" && data.payment_reference
      ? [{ label: "Zelle reference", value: data.payment_reference }]
      : []),
  ]);

  let checkout_url: string | null = null;

  if (isCard) {
    const { createCheckoutSession, safeOrigin } = await import("./stripe.server");
    const origin = safeOrigin(data.return_origin ?? "");
    const back = `${origin}/seguimiento?orden=${encodeURIComponent(
      row.reference,
    )}&contacto=${encodeURIComponent(data.email)}`;

    const session = await createCheckoutSession({
      kind: "service",
      id: row.id,
      reference: row.reference,
      email: data.email,
      lines: [{ name: svc.name, amount: total, quantity: 1 }],
      successUrl: back,
      cancelUrl: back,
    });

    checkout_url = session.url;
  }

  if (isPaypal) {
    const { safeOrigin } = await import("./stripe.server");
    const { createPaypalOrder } = await import("./paypal.server");
    const origin = safeOrigin(data.return_origin ?? "");

    const pp = await createPaypalOrder({
      kind: "service",
      id: row.id,
      reference: row.reference,
      total,
      returnUrl: `${origin}/api/public/paypal-return?kind=service&id=${row.id}`,
      cancelUrl: `${origin}/seguimiento?orden=${encodeURIComponent(
        row.reference,
      )}&contacto=${encodeURIComponent(data.email)}`,
    });

    await supabaseAdmin
      .from("service_requests")
      .update({ payment_reference: pp.id })
      .eq("id", row.id);

    checkout_url = pp.url;
  }

  return { reference: row.reference, checkout_url };
}

export async function lookupServiceRequestCore(
  reference: string,
  contact: string,
) {
  const { data: r } = await supabaseAdmin
    .from("service_requests")
    .select("*")
    .eq("reference", reference.toUpperCase().trim())
    .maybeSingle();

  if (!r || !matchesContact(r.email, r.phone, contact)) {
    return { found: false as const };
  }

  return {
    found: true as const,
    request: {
      reference: r.reference,
      customer_name: r.customer_name,
      service_name: r.service_name,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      amount: r.amount === null ? null : Number(r.amount),
      payment_method: r.payment_method,
    },
  };
}

export async function getBestSellerProductIdCore() {
  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_status", "confirmed")
      .neq("status", "cancelled");

    if (ordersError || !orders?.length) {
      return { product_id: null, quantity: 0 };
    }

    const orderIds = orders.map((order) => order.id);

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("product_id,quantity")
      .in("order_id", orderIds);

    if (itemsError || !items?.length) {
      return { product_id: null, quantity: 0 };
    }

    const totals = new Map<string, number>();

    for (const item of items) {
      if (!item.product_id) continue;
      totals.set(
        item.product_id,
        (totals.get(item.product_id) ?? 0) + Number(item.quantity ?? 0),
      );
    }

    let product_id: string | null = null;
    let quantity = 0;

    for (const [id, sold] of totals.entries()) {
      if (sold > quantity) {
        product_id = id;
        quantity = sold;
      }
    }

    return { product_id, quantity };
  } catch (error) {
    console.error("Could not calculate best seller", error);
    return { product_id: null, quantity: 0 };
  }
}
