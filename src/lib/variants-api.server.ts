import { z } from "zod";
import { ApiError, handle, ok, readJson, requireAdmin } from "./api.server";
import { variantDraftSchema } from "./variants";

type Context = { request: Request; params: Record<string, string> };
const idOf = (params: Context["params"]) => z.string().uuid().parse(params["id"]);
const configuration = z.object({
  color_enabled: z.boolean(), storage_enabled: z.boolean(), expected_stock: z.number().int().min(0),
  confirm_reconciliation: z.literal(true), variants: z.array(variantDraftSchema).max(200),
}).strict();
const adjustment = z.object({ variant_id: z.string().uuid().nullable().optional(), delta: z.number().int().min(-1000000).max(1000000).refine(n => n !== 0), expected_stock: z.number().int().min(0) }).strict();

export const adminGetVariants = handle(async ({ request, params }: Context) => {
  const { supabase } = await requireAdmin(request);
  const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", idOf(params)).order("created_at").limit(200);
  if (error) throw new ApiError(400, error.message);
  return ok(data);
});
export const adminConfigureVariants = handle(async ({ request, params }: Context) => {
  const { supabase } = await requireAdmin(request);
  const body = configuration.parse(await readJson(request));
  const { error } = await supabase.rpc("configure_product_variants", { _product_id: idOf(params), _color: body.color_enabled, _storage: body.storage_enabled, _variants: body.variants, _expected_stock: body.expected_stock });
  if (error) throw new ApiError(400, error.message);
  return ok({ saved: true });
});
export const adminAdjustInventory = handle(async ({ request, params }: Context) => {
  const { supabase } = await requireAdmin(request);
  const body = adjustment.parse(await readJson(request));
  const { error } = await supabase.rpc("adjust_product_inventory", { _product_id: idOf(params), _delta: body.delta, _expected_stock: body.expected_stock, ...(body.variant_id ? { _variant_id: body.variant_id } : {}) });
  if (error) throw new ApiError(400, error.message);
  return ok({ adjusted: true });
});