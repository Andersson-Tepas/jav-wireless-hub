ALTER TABLE public.product_variants
  ADD COLUMN price_override numeric(10,2)
  CHECK (price_override IS NULL OR (price_override >= 0 AND price_override <= 999999.99));

CREATE OR REPLACE FUNCTION public.parse_variant_price_override(_val jsonb)
RETURNS numeric(10,2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  txt text;
  n numeric;
BEGIN
  IF _val IS NULL OR jsonb_typeof(_val) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(_val) NOT IN ('number', 'string') THEN
    RAISE EXCEPTION 'Invalid price override';
  END IF;
  txt := btrim(_val #>> '{}');
  IF txt = '' THEN
    RETURN NULL;
  END IF;
  IF txt !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
    RAISE EXCEPTION 'Price override must be a non-negative USD amount with at most 2 decimal places';
  END IF;
  n := txt::numeric;
  IF n < 0 OR n > 999999.99 THEN
    RAISE EXCEPTION 'Price override must be between 0.00 and 999999.99';
  END IF;
  RETURN n::numeric(10,2);
END $$;

REVOKE ALL ON FUNCTION public.parse_variant_price_override(jsonb) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.configure_product_variants(
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
  r jsonb;
  vid uuid;
  total bigint;
  has_price_key boolean;
  parsed_price numeric(10,2);
BEGIN
  IF NOT public.has_role((select auth.uid()), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF p.stock <> _expected_stock THEN RAISE EXCEPTION 'Stock changed; reload and reconcile again'; END IF;
  IF jsonb_typeof(_variants) <> 'array' OR jsonb_array_length(_variants) > 200 THEN RAISE EXCEPTION 'Invalid combinations'; END IF;
  PERFORM set_config('jav.variant_config', p.id::text, true);
  IF NOT (_color OR _storage) THEN
    IF p.color_variants_enabled OR p.storage_variants_enabled THEN
      UPDATE public.products SET color_variants_enabled = false, storage_variants_enabled = false WHERE id = p.id;
      UPDATE public.product_variants SET active = false WHERE product_id = p.id;
    END IF;
    PERFORM set_config('jav.variant_config', '', true);
    RETURN;
  END IF;
  SELECT coalesce(sum((value->>'stock')::integer), 0) INTO total
  FROM jsonb_array_elements(_variants)
  WHERE coalesce((value->>'active')::boolean, true);
  IF total <> p.stock OR jsonb_array_length(_variants) = 0 THEN
    RAISE EXCEPTION 'Allocate exactly the current product stock; use inventory adjustments separately';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_variants)
    WHERE coalesce((value->>'active')::boolean, true)
      AND ((nullif(btrim(value->>'color_name'), '') IS NOT NULL) <> _color OR (nullif(btrim(value->>'storage'), '') IS NOT NULL) <> _storage)
  ) THEN
    RAISE EXCEPTION 'Incomplete variant dimensions';
  END IF;
  UPDATE public.product_variants SET active = false WHERE product_id = p.id;
  FOR r IN SELECT value FROM jsonb_array_elements(_variants) LOOP
    vid := nullif(r->>'id', '')::uuid;
    has_price_key := (r ? 'price_override');
    parsed_price := CASE WHEN has_price_key THEN public.parse_variant_price_override(r->'price_override') ELSE NULL END;
    IF vid IS NULL THEN
      SELECT id INTO vid FROM public.product_variants
      WHERE product_id = p.id
        AND coalesce(lower(regexp_replace(btrim(color_name), '\s+', ' ', 'g')), '') = coalesce(lower(regexp_replace(btrim(r->>'color_name'), '\s+', ' ', 'g')), '')
        AND coalesce(lower(regexp_replace(btrim(storage), '\s+', ' ', 'g')), '') = coalesce(lower(regexp_replace(btrim(r->>'storage'), '\s+', ' ', 'g')), '');
    END IF;
    IF vid IS NULL THEN
      INSERT INTO public.product_variants(product_id, color_name, color_hex, storage, stock, image, active, price_override)
      VALUES(
        p.id,
        nullif(btrim(r->>'color_name'), ''),
        nullif(r->>'color_hex', ''),
        nullif(btrim(r->>'storage'), ''),
        (r->>'stock')::integer,
        nullif(r->>'image', ''),
        coalesce((r->>'active')::boolean, true),
        parsed_price
      );
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.product_variants
        WHERE id = vid AND product_id = p.id
          AND color_name IS NOT DISTINCT FROM nullif(btrim(r->>'color_name'), '')
          AND storage IS NOT DISTINCT FROM nullif(btrim(r->>'storage'), '')
      ) THEN
        RAISE EXCEPTION 'Invalid or changed variant identity';
      END IF;
      UPDATE public.product_variants
      SET
        color_hex = nullif(r->>'color_hex', ''),
        stock = (r->>'stock')::integer,
        image = nullif(r->>'image', ''),
        active = coalesce((r->>'active')::boolean, true),
        price_override = CASE WHEN has_price_key THEN parsed_price ELSE price_override END
      WHERE id = vid;
    END IF;
  END LOOP;
  UPDATE public.products SET color_variants_enabled = _color, storage_variants_enabled = _storage, stock = total WHERE id = p.id;
  PERFORM set_config('jav.variant_config', '', true);
END $$;

CREATE OR REPLACE FUNCTION public.configure_initial_product_variants(
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
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_variants)
    WHERE (value ? 'price_override') AND jsonb_typeof(value->'price_override') <> 'null'
  ) THEN
    RAISE EXCEPTION 'Variant prices are not allowed in initial variant updates';
  END IF;
  PERFORM public.configure_product_variants(_product_id, _color, _storage, _variants, _expected_stock);
END $$;

CREATE OR REPLACE FUNCTION public.update_product_variant_prices(
  _product_id uuid,
  _expected_base_price numeric,
  _updates jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.products;
  v public.product_variants;
  r jsonb;
  vid uuid;
  expected_override numeric(10,2);
  new_override numeric(10,2);
  seen uuid[] := '{}';
BEGIN
  IF NOT public.has_role((select auth.uid()), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _expected_base_price IS NULL OR _expected_base_price < 0 OR _expected_base_price > 999999.99 THEN
    RAISE EXCEPTION 'Invalid expected base price';
  END IF;
  IF jsonb_typeof(_updates) <> 'array' OR jsonb_array_length(_updates) = 0 OR jsonb_array_length(_updates) > 200 THEN
    RAISE EXCEPTION 'Invalid price updates';
  END IF;

  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF p.price::numeric(10,2) <> _expected_base_price::numeric(10,2) THEN
    RAISE EXCEPTION 'Product base price changed; reload and try again';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(_updates) LOOP
    IF jsonb_typeof(r) <> 'object' THEN
      RAISE EXCEPTION 'Invalid price update entry';
    END IF;
    vid := nullif(btrim(r->>'variant_id'), '')::uuid;
    IF vid IS NULL THEN
      RAISE EXCEPTION 'Invalid variant_id';
    END IF;
    IF vid = ANY(seen) THEN
      RAISE EXCEPTION 'Duplicate variant_id in price update';
    END IF;
    seen := array_append(seen, vid);

    IF NOT (r ? 'expected_price_override') OR NOT (r ? 'price_override') THEN
      RAISE EXCEPTION 'Each entry must include expected_price_override and price_override';
    END IF;

    expected_override := public.parse_variant_price_override(r->'expected_price_override');
    new_override := public.parse_variant_price_override(r->'price_override');

    SELECT * INTO v FROM public.product_variants WHERE id = vid AND product_id = p.id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant does not belong to this product';
    END IF;
    IF v.price_override IS DISTINCT FROM expected_override THEN
      RAISE EXCEPTION 'Variant price changed; reload and try again';
    END IF;

    UPDATE public.product_variants
    SET price_override = new_override
    WHERE id = v.id;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.update_product_variant_prices(uuid, numeric, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_product_variant_prices(uuid, numeric, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order_atomic(_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.products;
  v public.product_variants;
  o public.orders;
  l record;
  subtotal numeric(12,2) := 0;
  unit_price numeric(10,2);
  expected_total numeric(12,2);
  key uuid;
  fingerprint text;
  lines jsonb := '[]';
  im text;
  c text;
  s text;
BEGIN
  key := nullif(_input->>'checkout_key', '')::uuid;
  fingerprint := md5((_input - 'return_origin')::text);
  IF key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(key::text, 0));
    SELECT * INTO o FROM public.orders WHERE checkout_key = key;
    IF FOUND THEN
      IF o.checkout_fingerprint <> fingerprint THEN RAISE EXCEPTION 'Checkout key already used with different details'; END IF;
      RETURN jsonb_build_object(
        'order', to_jsonb(o),
        'items', (SELECT jsonb_agg(to_jsonb(i)) FROM public.order_items i WHERE order_id = o.id),
        'reused', true
      );
    END IF;
  END IF;
  IF jsonb_typeof(_input->'items') <> 'array' OR jsonb_array_length(_input->'items') NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid items';
  END IF;
  -- Deterministic parent locks serialize all variant/legacy deductions and configuration.
  PERFORM id FROM public.products
  WHERE id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(_input->'items'))
  ORDER BY id FOR UPDATE;

  FOR l IN
    SELECT
      (value->>'id')::uuid AS pid,
      nullif(value->>'variant_id', '')::uuid AS vid,
      sum((value->>'quantity')::integer)::integer AS qty
    FROM jsonb_array_elements(_input->'items')
    GROUP BY 1, 2
    ORDER BY 1, 2
  LOOP
    IF l.qty NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO p FROM public.products WHERE id = l.pid AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
    c := NULL;
    s := NULL;
    im := p.image;
    IF p.color_variants_enabled OR p.storage_variants_enabled THEN
      SELECT * INTO v FROM public.product_variants WHERE id = l.vid AND product_id = p.id AND active FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid variant for %', p.name; END IF;
      IF v.stock < l.qty THEN RAISE EXCEPTION 'Insufficient stock for %', p.name; END IF;
      c := v.color_name;
      s := v.storage;
      im := coalesce(v.image, p.image);
      unit_price := coalesce(v.price_override, p.price)::numeric(10,2);
      UPDATE public.product_variants SET stock = stock - l.qty WHERE id = v.id;
    ELSE
      IF l.vid IS NOT NULL THEN RAISE EXCEPTION 'This product does not accept variants'; END IF;
      IF p.stock < l.qty THEN RAISE EXCEPTION 'Insufficient stock for %', p.name; END IF;
      unit_price := p.price::numeric(10,2);
      UPDATE public.products SET stock = stock - l.qty WHERE id = p.id;
    END IF;
    subtotal := subtotal + (unit_price * l.qty);
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', p.id,
      'variant_id', l.vid,
      'name', p.name,
      'price', unit_price,
      'quantity', l.qty,
      'image', im,
      'color_snapshot', c,
      'storage_snapshot', s
    ));
  END LOOP;

  IF (_input ? 'expected_total') AND jsonb_typeof(_input->'expected_total') <> 'null' THEN
    expected_total := (_input->>'expected_total')::numeric(12,2);
    IF subtotal <> expected_total THEN
      RAISE EXCEPTION 'Prices have changed. Please review your updated cart total and confirm again.';
    END IF;
  END IF;

  INSERT INTO public.orders(
    customer_name, email, phone, address, delivery_method, payment_method,
    payment_reference, payment_status, notes, subtotal, total, status,
    checkout_key, checkout_fingerprint
  )
  VALUES(
    _input->>'customer_name',
    _input->>'email',
    _input->>'phone',
    CASE WHEN _input->>'delivery_method' = 'shipping' THEN _input->>'address' END,
    _input->>'delivery_method',
    _input->>'payment_method',
    CASE WHEN _input->>'payment_method' = 'zelle' THEN _input->>'payment_reference' END,
    'pending',
    _input->>'notes',
    subtotal,
    subtotal,
    'payment_pending',
    key,
    fingerprint
  )
  RETURNING * INTO o;

  INSERT INTO public.order_items(
    order_id, product_id, variant_id, name, price, quantity, image, color_snapshot, storage_snapshot
  )
  SELECT
    o.id,
    (value->>'product_id')::uuid,
    (value->>'variant_id')::uuid,
    value->>'name',
    (value->>'price')::numeric(10,2),
    (value->>'quantity')::integer,
    value->>'image',
    value->>'color_snapshot',
    value->>'storage_snapshot'
  FROM jsonb_array_elements(lines);

  RETURN jsonb_build_object('order', to_jsonb(o), 'items', lines, 'reused', false);
END $$;