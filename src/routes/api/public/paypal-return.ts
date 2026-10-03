import { createFileRoute } from "@tanstack/react-router";

// PayPal redirects the buyer here after approval; the capture and verification happen on the server.
export const Route = createFileRoute("/api/public/paypal-return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const kind = url.searchParams.get("kind");
        const id = url.searchParams.get("id") ?? "";
        const back = (ref: string, contact: string) => Response.redirect(`${url.origin}/seguimiento?orden=${encodeURIComponent(ref)}&contacto=${encodeURIComponent(contact)}`, 303);
        if (!/^[A-Z0-9]{5,40}$/.test(token) || !/^[0-9a-f-]{36}$/.test(id) || (kind !== "order" && kind !== "service")) return new Response("Invalid request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { captureAndVerify } = await import("@/lib/paypal.server");
        const table = kind === "order" ? "orders" : "service_requests";
        const { data: row } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
        if (!row || row.payment_method !== "paypal" || row.payment_reference !== token) return new Response("Payment not found", { status: 404 });
        const ref = kind === "order" ? (row as { order_number: string }).order_number : (row as { reference: string }).reference;
        if (row.payment_status === "confirmed") return back(ref, row.email);

        const cap = await captureAndVerify(token);
        const expected = Number(kind === "order" ? (row as { total: number }).total : (row as { amount: number | null }).amount ?? 0);
        if (!cap || cap.customId !== `${kind}:${id}` || cap.currency !== "USD" || Math.abs(cap.value - expected) > 0.009) return back(ref, row.email);

        if (kind === "order") {
          await supabaseAdmin.from("orders").update({ status: "payment_confirmed", payment_status: "confirmed", payment_reference: cap.captureId }).eq("id", id).eq("status", "payment_pending");
        } else {
          await supabaseAdmin.from("service_requests").update({ payment_status: "confirmed", payment_reference: cap.captureId }).eq("id", id).eq("payment_status", "pending");
        }
        return back(ref, row.email);
      },
    },
  },
});
