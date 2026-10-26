import { createFileRoute } from "@tanstack/react-router";

// Meta WhatsApp Cloud API webhook (standalone; does not touch n8n or other integrations).
// GET: subscription verification with META_WEBHOOK_VERIFY_TOKEN.
// POST: X-Hub-Signature-256 HMAC-SHA256 check with META_APP_SECRET over the raw body.

async function hmacHex(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/whatsapp-meta-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const verifyToken = process.env["META_WEBHOOK_VERIFY_TOKEN"];
        if (!verifyToken) return new Response("Not configured", { status: 500 });
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode === "subscribe" && safeEqual(token, verifyToken) && challenge.length <= 200) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const appSecret = process.env["META_APP_SECRET"];
        if (!appSecret) return new Response("Not configured", { status: 500 });
        const body = await request.text();
        if (body.length > 4 * 1024 * 1024) return new Response("Too large", { status: 413 });
        const header = request.headers.get("x-hub-signature-256") ?? "";
        if (!header.startsWith("sha256=")) return new Response("Invalid signature", { status: 401 });
        const expected = await hmacHex(appSecret, body);
        if (!safeEqual(header.slice(7).toLowerCase(), expected)) return new Response("Invalid signature", { status: 401 });

        try {
          const payload = JSON.parse(body) as { object?: string; entry?: { changes?: { field?: string }[] }[] };
          const fields = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).map((c) => c.field));
          console.log("[whatsapp-meta-webhook] verified event", payload.object, fields.join(","));
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
