// Sandbox vs Live is detected from the credentials themselves, so switching needs no code changes.
let cached: { base: string; token: string; exp: number } | null = null;

async function auth() {
  if (cached && cached.exp > Date.now()) return cached;

  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];

  if (!id || !secret) {
    const missing = [
      !id ? "PAYPAL_CLIENT_ID" : null,
      !secret ? "PAYPAL_CLIENT_SECRET" : null,
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(`Missing PayPal secret: ${missing}`);
  }

  const basic = btoa(`${id}:${secret}`);

  for (const base of [
    "https://api-m.paypal.com",
    "https://api-m.sandbox.paypal.com",
  ]) {
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (res.ok) {
      const j = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };

      cached = {
        base,
        token: j.access_token,
        exp: Date.now() + (j.expires_in - 60) * 1000,
      };

      return cached;
    }
  }

  throw new Error("PayPal credentials were rejected");
}

async function call<T>(path: string, init: RequestInit = {}) {
  const a = await auth();

  const res = await fetch(`${a.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${a.token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const json = (await res.json().catch(() => ({}))) as T;

  return {
    ok: res.ok,
    status: res.status,
    json,
  };
}

export async function createPaypalOrder(opts: {
  kind: "order" | "service";
  id: string;
  reference: string;
  total: number;
  returnUrl: string;
  cancelUrl: string;
}) {
  const r = await call<{
    id?: string;
    links?: { rel: string; href: string }[];
  }>("/v2/checkout/orders", {
    method: "POST",
    headers: {
      "PayPal-Request-Id": `${opts.kind}-${opts.id}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.reference,
          custom_id: `${opts.kind}:${opts.id}`,
          description: `JAV Wireless ${opts.reference}`,
          amount: {
            currency_code: "USD",
            value: opts.total.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "JAV Wireless",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl,
          },
        },
      },
    }),
  });

  const approve = r.json.links?.find(
    (l) => l.rel === "payer-action" || l.rel === "approve",
  )?.href;

  if (!r.ok || !r.json.id || !approve) {
    console.error("PayPal create error", r.status);
    throw new Error("Could not start the PayPal payment");
  }

  return {
    id: r.json.id,
    url: approve,
  };
}

type Capture = {
  status?: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        custom_id?: string;
        amount: {
          value: string;
          currency_code: string;
        };
      }[];
    };
  }[];
};

// Captures server-side and returns the verified capture, or null if not completed.
export async function captureAndVerify(paypalOrderId: string) {
  let r = await call<Capture>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        "PayPal-Request-Id": `cap-${paypalOrderId}`,
      },
    },
  );

  if (!r.ok) {
    r = await call<Capture>(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
    );
  }

  const cap = r.json.purchase_units?.[0]?.payments?.captures?.find(
    (c) => c.status === "COMPLETED",
  );

  if (!cap) return null;

  return {
    captureId: cap.id,
    customId:
      cap.custom_id ??
      r.json.purchase_units?.[0]?.custom_id ??
      "",
    value: Number(cap.amount.value),
    currency: cap.amount.currency_code,
  };
}