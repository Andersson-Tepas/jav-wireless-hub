CREATE FUNCTION public.guard_variant_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF coalesce(current_setting('jav.variant_config',true),'')<>new.product_id::text AND (tg_op='INSERT' OR (tg_op='UPDATE' AND new.active IS DISTINCT FROM old.active)) THEN RAISE EXCEPTION 'Add or activate combinations through reconciled variant configuration'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER guard_variant_configuration BEFORE INSERT OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.guard_variant_configuration();
REVOKE ALL ON FUNCTION public.guard_variant_configuration() FROM public,anon,authenticated;
CREATE FUNCTION public.notification_variant_details() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE details text;
BEGIN
 IF new.order_id IS NOT NULL THEN
  SELECT string_agg(quantity::text || ' × ' || name || ' — ' || concat_ws(' / ',color_snapshot,storage_snapshot),'; ' ORDER BY id) INTO details FROM public.order_items WHERE order_id=new.order_id AND (color_snapshot IS NOT NULL OR storage_snapshot IS NOT NULL);
  IF details IS NOT NULL THEN new.message:=new.message || ' ' || details; END IF;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER notification_variant_details BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notification_variant_details();
REVOKE ALL ON FUNCTION public.notification_variant_details() FROM public,anon,authenticated;
