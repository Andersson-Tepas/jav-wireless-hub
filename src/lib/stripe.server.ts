import { createHmac, timingSafeEqual } from "crypto";

// Works with sk_test_ or sk_live_ keys; the mode follows the key, no code changes needed.
export async function createCheckoutSession(opts: {
  kind: "order" | "service"; id: string; reference: string; email: string;
  lines: { name: string; amount: number; quantity: number }[]; successUrl: string; cancelUrl: string;
}) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Card payments are not configured yet");
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("customer_email", opts.email);
  p.set("success_url", opts.successUrl);
  p.set("cancel_url", opts.cancelUrl);
  p.set("client_reference_id", opts.reference);
  p.set("payment_method_types[0]", "card");
  for (const [k, v] of Object.entries({ kind: opts.kind, id: opts.id, reference: opts.reference })) {
    p.set(`metadata[${k}]`, v);
    p.set(`payment_intent_data[metadata][${k}]`, v);
  }
  opts.lines.forEach((l, i) => {
    p.set(`line_items[${i}][quantity]`, String(l.quantity));
    p.set(`line_items[${i}][price_data][currency]`, "usd");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.amount * 100)));
    p.set(`line_items[${i}][price_data][product_data][name]`, l.name.slice(0, 250));
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `${opts.kind}-${opts.id}` },
    body: p,
  });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !json.url || !json.id) {
    console.error("Stripe session error", json.error?.message);
    throw new Error("Could not start the card payment");
  }
  return { id: json.id, url: json.url };
}

export function verifyStripeSignature(body: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = header.split(",").map((s) => s.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && timingSafeEqual(b, expected); });
}

export function safeOrigin(origin: string) {
  const u = new URL(origin);
  if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("Invalid origin");
  return u.origin;
}
