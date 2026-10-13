import { createHmac, timingSafeEqual } from "crypto";

// Works with sk_test_, sk_live_, rk_test_, or rk_live_ keys.
// Stripe mode follows the key automatically.
export async function createCheckoutSession(opts: {
  kind: "order" | "service";
  id: string;
  reference: string;
  email: string;
  lines: {
    name: string;
    amount: number;
    quantity: number;
  }[];
  successUrl: string;
  cancelUrl: string;
}) {
  const key = process.env["STRIPE_SECRET_KEY"]?.trim();

  // Make configuration errors explicit without exposing the actual key.
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  if (key.startsWith("pk_")) {
    throw new Error(
      "Wrong Stripe key: STRIPE_SECRET_KEY currently contains a pk_ publishable key",
    );
  }

  if (!key.startsWith("rk_") && !key.startsWith("sk_")) {
    throw new Error(
      "Wrong Stripe key: STRIPE_SECRET_KEY must contain an rk_ or sk_ secret key",
    );
  }

  const p = new URLSearchParams();

  p.set("mode", "payment");
  p.set("customer_email", opts.email);
  p.set("success_url", opts.successUrl);
  p.set("cancel_url", opts.cancelUrl);
  p.set("client_reference_id", opts.reference);
  p.set("payment_method_types[0]", "card");

  for (const [k, v] of Object.entries({
    kind: opts.kind,
    id: opts.id,
    reference: opts.reference,
  })) {
    p.set(`metadata[${k}]`, v);
    p.set(`payment_intent_data[metadata][${k}]`, v);
  }

  opts.lines.forEach((line, index) => {
    p.set(
      `line_items[${index}][quantity]`,
      String(line.quantity),
    );

    p.set(
      `line_items[${index}][price_data][currency]`,
      "usd",
    );

    p.set(
      `line_items[${index}][price_data][unit_amount]`,
      String(Math.round(line.amount * 100)),
    );

    p.set(
      `line_items[${index}][price_data][product_data][name]`,
      line.name.slice(0, 250),
    );
  });

  const res = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `${opts.kind}-${opts.id}`,
      },
      body: p,
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    error?: {
      message?: string;
      type?: string;
      code?: string;
    };
  };

  if (!res.ok || !json.url || !json.id) {
    console.error(
      "Stripe session error",
      json.error?.message ?? `HTTP ${res.status}`,
    );

    throw new Error("Could not start the card payment");
  }

  return {
    id: json.id,
    url: json.url,
  };
}

export function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
) {
  if (!header) return false;

  const parts = header
    .split(",")
    .map((part) => part.split("="));

  const timestampValue = parts.find(
    ([key]) => key === "t",
  )?.[1];

  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value ?? "");

  if (!timestampValue || !signatures.length) {
    return false;
  }

  const timestamp = Number(timestampValue);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (
    Math.abs(Date.now() / 1000 - timestamp) >
    toleranceSec
  ) {
    return false;
  }

  const expectedSignature = Buffer.from(
    createHmac("sha256", secret)
      .update(`${timestampValue}.${body}`)
      .digest("hex"),
  );

  return signatures.some((signature) => {
    const receivedSignature = Buffer.from(signature);

    return (
      receivedSignature.length === expectedSignature.length &&
      timingSafeEqual(
        receivedSignature,
        expectedSignature,
      )
    );
  });
}

export function safeOrigin(origin: string) {
  const url = new URL(origin);

  const isHttps = url.protocol === "https:";
  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";

  if (!isHttps && !isLocalhost) {
    throw new Error("Invalid origin");
  }

  return url.origin;
}