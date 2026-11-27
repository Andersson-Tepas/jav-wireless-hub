ALTER TABLE public.products ADD COLUMN color_variants_enabled boolean NOT NULL DEFAULT false, ADD COLUMN storage_variants_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.product_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 color_name text, color_hex text, storage text, stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0 AND stock <= 1000000), image text, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(color_name IS NULL OR (length(btrim(color_name)) BETWEEN 1 AND 80 AND color_name = btrim(color_name))),
 CHECK(storage IS NULL OR (length(btrim(storage)) BETWEEN 1 AND 80 AND storage = btrim(storage))),
 CHECK(color_hex IS NULL OR (color_name IS NOT NULL AND color_hex ~ '^#[0-9A-Fa-f]{6}$')),
 CHECK(image IS NULL OR (length(image) <= 4000 AND image ~ '^https://')),
 CHECK(color_name IS NOT NULL OR storage IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.product_variants TO authenticated;
GRANT SELECT ON public.product_variants TO anon;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY variants_read ON public.product_variants FOR SELECT TO anon, authenticated USING ((active AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.active AND (p.color_variants_enabled OR p.storage_variants_enabled))) OR (select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY variants_insert ON public.product_variants FOR INSERT TO authenticated WITH CHECK ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY variants_update ON public.product_variants FOR UPDATE TO authenticated USING ((select public.has_role((select auth.uid()), 'admin'))) WITH CHECK ((select public.has_role((select auth.uid()), 'admin')));
CREATE UNIQUE INDEX variants_normalized_combination ON public.product_variants(product_id, coalesce(lower(regexp_replace(btrim(color_name), '\s+', ' ', 'g')), ''), coalesce(lower(regexp_replace(btrim(storage), '\s+', ' ', 'g')), ''));
ALTER TABLE public.order_items ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT, ADD COLUMN color_snapshot text, ADD COLUMN storage_snapshot text;
CREATE INDEX order_items_variant_idx ON public.order_items(variant_id);
ALTER TABLE public.inventory_movements ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT, ADD COLUMN variant_label text;
CREATE INDEX inventory_variant_idx ON public.inventory_movements(variant_id, created_at DESC);
ALTER TABLE public.orders ADD COLUMN checkout_key uuid, ADD COLUMN checkout_fingerprint text;
CREATE UNIQUE INDEX orders_checkout_key_idx ON public.orders(checkout_key) WHERE checkout_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.on_stock_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d integer;
BEGIN
 IF new.color_variants_enabled OR new.storage_variants_enabled THEN RETURN new; END IF;
 IF tg_op='INSERT' THEN d:=new.stock; ELSE d:=new.stock-old.stock; END IF;
 IF d<>0 THEN INSERT INTO public.inventory_movements(product_id,kind,quantity,stock_after,reason,created_by,created_by_email) VALUES(new.id,CASE WHEN tg_op='INSERT' THEN 'initial' WHEN d>0 THEN 'in' ELSE 'out' END,abs(d),new.stock,CASE WHEN tg_op='INSERT' THEN 'Stock inicial' WHEN auth.uid() IS NULL THEN 'Venta en línea' ELSE 'Ajuste desde el panel' END,auth.uid(),auth.jwt()->>'email'); END IF;
 RETURN new;
END $$;

CREATE FUNCTION public.variant_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; delta integer; label text;
BEGIN
 IF tg_op='UPDATE' AND (new.product_id<>old.product_id OR new.color_name IS DISTINCT FROM old.color_name OR new.storage IS DISTINCT FROM old.storage) THEN RAISE EXCEPTION 'Variant identity is immutable; deactivate it and add a new combination'; END IF;
 SELECT * INTO p FROM public.products WHERE id=new.product_id FOR UPDATE;
 IF p.color_variants_enabled OR p.storage_variants_enabled THEN
   UPDATE public.products SET stock=(SELECT coalesce(sum(stock),0) FROM public.product_variants WHERE product_id=p.id AND active) WHERE id=p.id;
 END IF;
 IF tg_op='INSERT' THEN delta:=new.stock; ELSE delta:=new.stock-old.stock; END IF;
 label:=concat_ws(' / ',new.color_name,new.storage);
 IF delta<>0 THEN INSERT INTO public.inventory_movements(product_id,variant_id,variant_label,kind,quantity,stock_after,reason,created_by,created_by_email) VALUES(p.id,new.id,label,CASE WHEN delta>0 THEN 'in' ELSE 'out' END,abs(delta),new.stock,CASE WHEN NOT(p.color_variants_enabled OR p.storage_variants_enabled) THEN 'Variant allocation (not additional product inventory)' WHEN auth.uid() IS NULL THEN 'Online variant sale' ELSE 'Variant stock adjustment' END,auth.uid(),auth.jwt()->>'email'); END IF;
 RETURN new;
END $$;
CREATE TRIGGER variant_change_after AFTER INSERT OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.variant_change();

CREATE FUNCTION public.check_variant_inventory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; p public.products; total bigint;
BEGIN
 IF tg_table_name='products' THEN pid:=new.id; ELSE pid:=new.product_id; END IF;
 SELECT * INTO p FROM public.products WHERE id=pid;
 IF p.color_variants_enabled OR p.storage_variants_enabled THEN
  SELECT coalesce(sum(stock),0) INTO total FROM public.product_variants WHERE product_id=pid AND active;
  IF total<>p.stock OR NOT EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=pid AND active) THEN RAISE EXCEPTION 'Variant stock must reconcile to product total'; END IF;
  IF EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=pid AND active AND ((color_name IS NOT NULL)<>p.color_variants_enabled OR (storage IS NOT NULL)<>p.storage_variants_enabled)) THEN RAISE EXCEPTION 'Each active variant must match enabled dimensions'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_product_variants AFTER INSERT OR UPDATE ON public.products DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_variant_inventory();
CREATE CONSTRAINT TRIGGER check_variant_totals AFTER INSERT OR UPDATE ON public.product_variants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_variant_inventory();

CREATE FUNCTION public.configure_product_variants(_product_id uuid,_color boolean,_storage boolean,_variants jsonb,_expected_stock integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; r jsonb; vid uuid; total bigint;
BEGIN
 IF NOT public.has_role((select auth.uid()),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO p FROM public.products WHERE id=_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
 IF p.stock<>_expected_stock THEN RAISE EXCEPTION 'Stock changed; reload and reconcile again'; END IF;
 IF jsonb_typeof(_variants)<>'array' OR jsonb_array_length(_variants)>200 THEN RAISE EXCEPTION 'Invalid combinations'; END IF;
 IF NOT (_color OR _storage) THEN
  IF p.color_variants_enabled OR p.storage_variants_enabled THEN
   UPDATE public.products SET color_variants_enabled=false,storage_variants_enabled=false WHERE id=p.id;
   UPDATE public.product_variants SET active=false WHERE product_id=p.id;
  END IF;
  RETURN;
 END IF;
 SELECT coalesce(sum((value->>'stock')::integer),0) INTO total FROM jsonb_array_elements(_variants) WHERE coalesce((value->>'active')::boolean,true);
 IF total<>p.stock OR jsonb_array_length(_variants)=0 THEN RAISE EXCEPTION 'Allocate exactly the current product stock; use inventory adjustments separately'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_variants) WHERE coalesce((value->>'active')::boolean,true) AND ((nullif(btrim(value->>'color_name'),'') IS NOT NULL)<>_color OR (nullif(btrim(value->>'storage'),'') IS NOT NULL)<>_storage)) THEN RAISE EXCEPTION 'Incomplete variant dimensions'; END IF;
 -- Retain old IDs and historical rows; omitted rows become inactive, never deleted.
 UPDATE public.product_variants SET active=false WHERE product_id=p.id;
 FOR r IN SELECT value FROM jsonb_array_elements(_variants) LOOP
  vid:=nullif(r->>'id','')::uuid;
  IF vid IS NULL THEN
   SELECT id INTO vid FROM public.product_variants WHERE product_id=p.id AND coalesce(lower(regexp_replace(btrim(color_name),'\s+',' ','g')),'')=coalesce(lower(regexp_replace(btrim(r->>'color_name'),'\s+',' ','g')),'') AND coalesce(lower(regexp_replace(btrim(storage),'\s+',' ','g')),'')=coalesce(lower(regexp_replace(btrim(r->>'storage'),'\s+',' ','g')),'');
  END IF;
  IF vid IS NULL THEN INSERT INTO public.product_variants(product_id,color_name,color_hex,storage,stock,image,active) VALUES(p.id,nullif(btrim(r->>'color_name'),''),nullif(r->>'color_hex',''),nullif(btrim(r->>'storage'),''),(r->>'stock')::integer,nullif(r->>'image',''),coalesce((r->>'active')::boolean,true));
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.product_variants WHERE id=vid AND product_id=p.id AND color_name IS NOT DISTINCT FROM nullif(btrim(r->>'color_name'),'') AND storage IS NOT DISTINCT FROM nullif(btrim(r->>'storage'),'')) THEN RAISE EXCEPTION 'Invalid or changed variant identity'; END IF;
   UPDATE public.product_variants SET color_hex=nullif(r->>'color_hex',''),stock=(r->>'stock')::integer,image=nullif(r->>'image',''),active=coalesce((r->>'active')::boolean,true) WHERE id=vid;
  END IF;
 END LOOP;
 UPDATE public.products SET color_variants_enabled=_color,storage_variants_enabled=_storage,stock=total WHERE id=p.id;
END $$;
REVOKE ALL ON FUNCTION public.configure_product_variants(uuid,boolean,boolean,jsonb,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.configure_product_variants(uuid,boolean,boolean,jsonb,integer) TO authenticated;

CREATE FUNCTION public.adjust_product_inventory(_product_id uuid,_variant_id uuid,_delta integer,_expected_stock integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.adjust_product_inventory(uuid,uuid,integer,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_inventory(uuid,uuid,integer,integer) TO authenticated;

CREATE FUNCTION public.create_order_atomic(_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; v public.product_variants; o public.orders; l record; subtotal numeric:=0; key uuid; fingerprint text; lines jsonb:='[]'; nm text; im text; c text; s text;
BEGIN
 key:=nullif(_input->>'checkout_key','')::uuid;
 fingerprint:=md5((_input-'return_origin')::text);
 IF key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(key::text,0));
  SELECT * INTO o FROM public.orders WHERE checkout_key=key;
  IF FOUND THEN
   IF o.checkout_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Checkout key already used with different details'; END IF;
   RETURN jsonb_build_object('order',to_jsonb(o),'items',(SELECT jsonb_agg(to_jsonb(i)) FROM public.order_items i WHERE order_id=o.id),'reused',true);
  END IF;
 END IF;
 IF jsonb_typeof(_input->'items')<>'array' OR jsonb_array_length(_input->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid items'; END IF;
 -- Deterministic parent locks serialize all variant/legacy deductions and configuration.
 PERFORM id FROM public.products WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(_input->'items')) ORDER BY id FOR UPDATE;
 FOR l IN SELECT (value->>'id')::uuid AS pid,nullif(value->>'variant_id','')::uuid AS vid,sum((value->>'quantity')::integer)::integer AS qty FROM jsonb_array_elements(_input->'items') GROUP BY 1,2 ORDER BY 1,2 LOOP
  IF l.qty NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO p FROM public.products WHERE id=l.pid AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
  c:=NULL; s:=NULL; im:=p.image;
  IF p.color_variants_enabled OR p.storage_variants_enabled THEN
   SELECT * INTO v FROM public.product_variants WHERE id=l.vid AND product_id=p.id AND active FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid variant for %',p.name; END IF;
   IF v.stock<l.qty THEN RAISE EXCEPTION 'Insufficient stock for %',p.name; END IF;
   c:=v.color_name; s:=v.storage; im:=coalesce(v.image,p.image);
   UPDATE public.product_variants SET stock=stock-l.qty WHERE id=v.id;
  ELSE
   IF l.vid IS NOT NULL THEN RAISE EXCEPTION 'This product does not accept variants'; END IF;
   IF p.stock<l.qty THEN RAISE EXCEPTION 'Insufficient stock for %',p.name; END IF;
   UPDATE public.products SET stock=stock-l.qty WHERE id=p.id;
  END IF;
  subtotal:=subtotal+p.price*l.qty;
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',p.id,'variant_id',l.vid,'name',p.name,'price',p.price,'quantity',l.qty,'image',im,'color_snapshot',c,'storage_snapshot',s));
 END LOOP;
 INSERT INTO public.orders(customer_name,email,phone,address,delivery_method,payment_method,payment_reference,payment_status,notes,subtotal,total,status,checkout_key,checkout_fingerprint) VALUES(_input->>'customer_name',_input->>'email',_input->>'phone',CASE WHEN _input->>'delivery_method'='shipping' THEN _input->>'address' END,_input->>'delivery_method',_input->>'payment_method',CASE WHEN _input->>'payment_method'='zelle' THEN _input->>'payment_reference' END,'pending',_input->>'notes',subtotal,subtotal,'payment_pending',key,fingerprint) RETURNING * INTO o;
 INSERT INTO public.order_items(order_id,product_id,variant_id,name,price,quantity,image,color_snapshot,storage_snapshot) SELECT o.id,(value->>'product_id')::uuid,(value->>'variant_id')::uuid,value->>'name',(value->>'price')::numeric,(value->>'quantity')::integer,value->>'image',value->>'color_snapshot',value->>'storage_snapshot' FROM jsonb_array_elements(lines);
 RETURN jsonb_build_object('order',to_jsonb(o),'items',lines,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.variant_change(),public.check_variant_inventory() FROM public,anon,authenticated;
