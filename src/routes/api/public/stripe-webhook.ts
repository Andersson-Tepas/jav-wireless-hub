import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 500 });
        const body = await request.text();
        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        if (!verifyStripeSignature(body, request.headers.get("stripe-signature"), secret)) return new Response("Invalid signature", { status: 400 });

        const event = JSON.parse(body) as { type: string; data: { object: { payment_status?: string; payment_intent?: string; id: string; metadata?: Record<string, string> } } };
        const s = event.data.object;
        const paidEvent = event.type === "checkout.session.async_payment_succeeded" || (event.type === "checkout.session.completed" && s.payment_status === "paid");
        if (!paidEvent || !s.metadata?.["id"]) return new Response("ignored");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ref = s.payment_intent ?? s.id;
        if (s.metadata["kind"] === "order") {
          await supabaseAdmin.from("orders").update({ status: "payment_confirmed", payment_status: "confirmed", payment_reference: ref })
            .eq("id", s.metadata["id"]).eq("payment_method", "card").eq("status", "payment_pending");
        } else if (s.metadata["kind"] === "service") {
          await supabaseAdmin.from("service_requests").update({ payment_status: "confirmed", payment_reference: ref })
            .eq("id", s.metadata["id"]).eq("payment_method", "card").eq("payment_status", "pending");
        }
        return new Response("ok");
      },
    },
  },
});
