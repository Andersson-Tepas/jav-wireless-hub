CREATE OR REPLACE FUNCTION public.guard_variant_product_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF tg_op='INSERT' THEN
  IF new.color_variants_enabled OR new.storage_variants_enabled THEN RAISE EXCEPTION 'Save the product first, then reconcile confirmed variants'; END IF;
 ELSE
  IF (new.color_variants_enabled IS DISTINCT FROM old.color_variants_enabled OR new.storage_variants_enabled IS DISTINCT FROM old.storage_variants_enabled) AND coalesce(current_setting('jav.variant_config',true),'')<>new.id::text THEN RAISE EXCEPTION 'Use reconciled variant configuration'; END IF;
  IF (old.color_variants_enabled OR old.storage_variants_enabled) AND new.stock IS DISTINCT FROM old.stock AND pg_trigger_depth()<=1 AND coalesce(current_setting('jav.variant_config',true),'')<>new.id::text THEN RAISE EXCEPTION 'Adjust stock by variant, not aggregate product stock'; END IF;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER variant_product_write_guard BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_variant_product_write();
-- A caller cannot set this transaction-local marker through the Data API; only the admin-verified configuration function sets it.
CREATE OR REPLACE FUNCTION public.configure_product_variants(_product_id uuid,_color boolean,_storage boolean,_variants jsonb,_expected_stock integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; r jsonb; vid uuid; total bigint;
BEGIN
 IF NOT public.has_role((select auth.uid()),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO p FROM public.products WHERE id=_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
 IF p.stock<>_expected_stock THEN RAISE EXCEPTION 'Stock changed; reload and reconcile again'; END IF;
 IF jsonb_typeof(_variants)<>'array' OR jsonb_array_length(_variants)>200 THEN RAISE EXCEPTION 'Invalid combinations'; END IF;
 PERFORM set_config('jav.variant_config',p.id::text,true);
 IF NOT (_color OR _storage) THEN
  IF p.color_variants_enabled OR p.storage_variants_enabled THEN
   UPDATE public.products SET color_variants_enabled=false,storage_variants_enabled=false WHERE id=p.id;
   UPDATE public.product_variants SET active=false WHERE product_id=p.id;
  END IF;
  PERFORM set_config('jav.variant_config','',true);
  RETURN;
 END IF;
 SELECT coalesce(sum((value->>'stock')::integer),0) INTO total FROM jsonb_array_elements(_variants) WHERE coalesce((value->>'active')::boolean,true);
 IF total<>p.stock OR jsonb_array_length(_variants)=0 THEN RAISE EXCEPTION 'Allocate exactly the current product stock; use inventory adjustments separately'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_variants) WHERE coalesce((value->>'active')::boolean,true) AND ((nullif(btrim(value->>'color_name'),'') IS NOT NULL)<>_color OR (nullif(btrim(value->>'storage'),'') IS NOT NULL)<>_storage)) THEN RAISE EXCEPTION 'Incomplete variant dimensions'; END IF;
 UPDATE public.product_variants SET active=false WHERE product_id=p.id;
 FOR r IN SELECT value FROM jsonb_array_elements(_variants) LOOP
  vid:=nullif(r->>'id','')::uuid;
  IF vid IS NULL THEN SELECT id INTO vid FROM public.product_variants WHERE product_id=p.id AND coalesce(lower(regexp_replace(btrim(color_name),'\s+',' ','g')),'')=coalesce(lower(regexp_replace(btrim(r->>'color_name'),'\s+',' ','g')),'') AND coalesce(lower(regexp_replace(btrim(storage),'\s+',' ','g')),'')=coalesce(lower(regexp_replace(btrim(r->>'storage'),'\s+',' ','g')),''); END IF;
  IF vid IS NULL THEN INSERT INTO public.product_variants(product_id,color_name,color_hex,storage,stock,image,active) VALUES(p.id,nullif(btrim(r->>'color_name'),''),nullif(r->>'color_hex',''),nullif(btrim(r->>'storage'),''),(r->>'stock')::integer,nullif(r->>'image',''),coalesce((r->>'active')::boolean,true));
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.product_variants WHERE id=vid AND product_id=p.id AND color_name IS NOT DISTINCT FROM nullif(btrim(r->>'color_name'),'') AND storage IS NOT DISTINCT FROM nullif(btrim(r->>'storage'),'')) THEN RAISE EXCEPTION 'Invalid or changed variant identity'; END IF;
   UPDATE public.product_variants SET color_hex=nullif(r->>'color_hex',''),stock=(r->>'stock')::integer,image=nullif(r->>'image',''),active=coalesce((r->>'active')::boolean,true) WHERE id=vid;
  END IF;
 END LOOP;
 UPDATE public.products SET color_variants_enabled=_color,storage_variants_enabled=_storage,stock=total WHERE id=p.id;
 PERFORM set_config('jav.variant_config','',true);
END $$;
CREATE OR REPLACE FUNCTION public.adjust_product_inventory(_product_id uuid,_variant_id uuid DEFAULT NULL,_delta integer DEFAULT 0,_expected_stock integer DEFAULT -1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; v public.product_variants;
BEGIN
 IF NOT public.has_role((select auth.uid()),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _delta=0 OR abs(_delta::bigint)>1000000 THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;
 SELECT * INTO p FROM public.products WHERE id=_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
 IF p.color_variants_enabled OR p.storage_variants_enabled THEN
  SELECT * INTO v FROM public.product_variants WHERE id=_variant_id AND product_id=p.id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an active variant'; END IF;
  IF v.stock<>_expected_stock THEN RAISE EXCEPTION 'Stock changed; reload'; END IF;
  UPDATE public.product_variants SET stock=stock+_delta WHERE id=v.id;
 ELSE
  IF _variant_id IS NOT NULL OR p.stock<>_expected_stock THEN RAISE EXCEPTION 'Stock changed; reload'; END IF;
  IF p.stock+_delta<0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
  UPDATE public.products SET stock=stock+_delta WHERE id=p.id;
 END IF;
END $$;
CREATE FUNCTION public.guard_order_variant_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF ROW(new.variant_id,new.color_snapshot,new.storage_snapshot) IS DISTINCT FROM ROW(old.variant_id,old.color_snapshot,old.storage_snapshot) THEN RAISE EXCEPTION 'Order variant snapshots are immutable'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER order_variant_snapshot_guard BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_order_variant_snapshot();
REVOKE ALL ON FUNCTION public.guard_variant_product_write(),public.guard_order_variant_snapshot() FROM public,anon,authenticated;
