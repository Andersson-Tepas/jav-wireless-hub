CREATE FUNCTION public.configure_initial_product_variants(
  _product_id uuid,
  _color boolean,
  _storage boolean,
  _variants jsonb,
  _expected_stock integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.products;
BEGIN
  IF NOT public.has_role((select auth.uid()), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT (_color OR _storage) THEN
    RAISE EXCEPTION 'Enable color or storage variants to configure initial variants';
  END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF NOT p.active THEN
    RAISE EXCEPTION 'Product is inactive';
  END IF;
  IF p.color_variants_enabled OR p.storage_variants_enabled OR EXISTS (
    SELECT 1 FROM public.product_variants WHERE product_id = p.id
  ) THEN
    RAISE EXCEPTION 'Product already has existing variants or variant flags';
  END IF;
  IF p.stock <> _expected_stock THEN
    RAISE EXCEPTION 'Stock changed; reload and reconcile again';
  END IF;
  IF jsonb_typeof(_variants) <> 'array' OR jsonb_array_length(_variants) = 0 OR jsonb_array_length(_variants) > 200 THEN
    RAISE EXCEPTION 'Invalid combinations';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_variants)
    WHERE nullif(btrim(value->>'image'), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Variant images are not allowed in bulk variant updates';
  END IF;
  PERFORM public.configure_product_variants(_product_id, _color, _storage, _variants, _expected_stock);
END $$;

REVOKE ALL ON FUNCTION public.configure_initial_product_variants(uuid, boolean, boolean, jsonb, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.configure_initial_product_variants(uuid, boolean, boolean, jsonb, integer) TO authenticated;