import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupSchema, orderSchema, serviceLookupSchema, serviceSchema } from "./commerce.schemas";

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).createOrderCore(data));

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookupSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).lookupOrderCore(data.order_number, data.contact));

export const createServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).createServiceRequestCore(data));

export const lookupServiceRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceLookupSchema.parse(d))
  .handler(async ({ data }) => (await import("./commerce.server")).lookupServiceRequestCore(data.reference, data.contact));

export const getBestSellerProductId = createServerFn({ method: "GET" })
  .handler(async () =>
    (await import("./commerce.server")).getBestSellerProductIdCore()
  );

/** Utility Payments bill photo: validated, stored in a private bucket; only a signed link is kept on the request. */
export const uploadBillImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => (z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(10).max(7_000_000) })).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${crypto.randomUUID()}.${data.contentType.split("/")[1]}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const up = await supabaseAdmin.storage.from("bill-images").upload(path, bytes, { contentType: data.contentType });
    if (up.error) throw new Error("Could not upload the image");
    const signed = await supabaseAdmin.storage.from("bill-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) throw new Error("Could not generate the link");
    return { url: signed.data.signedUrl };
  });

export const uploadTrafficTicketImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => (z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(10).max(7_000_000) })).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `traffic-tickets/${crypto.randomUUID()}.${data.contentType.split("/")[1]}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const up = await supabaseAdmin.storage.from("bill-images").upload(path, bytes, { contentType: data.contentType });
    if (up.error) throw new Error("Could not upload the image");
    const signed = await supabaseAdmin.storage.from("bill-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) throw new Error("Could not generate the link");
    return { url: signed.data.signedUrl };
  });

  export const uploadZelleReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().min(10).max(7_000_000),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const path = `zelle-receipts/${crypto.randomUUID()}.${data.contentType.split("/")[1]}`;

    const bytes = Uint8Array.from(
      atob(data.base64),
      (c) => c.charCodeAt(0)
    );

    const up = await supabaseAdmin.storage
      .from("bill-images")
      .upload(path, bytes, { contentType: data.contentType });

    if (up.error) throw new Error("Could not upload the Zelle receipt");

    const signed = await supabaseAdmin.storage
      .from("bill-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    if (signed.error || !signed.data)
      throw new Error("Could not generate the receipt link");

    return { url: signed.data.signedUrl };
  });
