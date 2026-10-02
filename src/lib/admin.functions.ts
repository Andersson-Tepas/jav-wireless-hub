import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uploadSchema = z.object({
  filename: z.string().max(120),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().max(7_500_000),
});

/** Uploads a product photo. Only admins; returns a long-lived link stored on the product. */
export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Administrators only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.contentType.split("/")[1];
    const path = `${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const up = await supabaseAdmin.storage.from("product-images").upload(path, bytes, { contentType: data.contentType });
    if (up.error) throw new Error("Could not upload the image");
    const signed = await supabaseAdmin.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error || !signed.data) throw new Error("Could not generate the link");
    return { url: signed.data.signedUrl };
  });
