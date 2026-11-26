DROP POLICY IF EXISTS "promo products public read" ON public.promotion_products;

CREATE POLICY "promo products public read"
ON public.promotion_products
FOR SELECT
TO anon, authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.active
        AND p.starts_at <= now()
        AND (p.ends_at IS NULL OR p.ends_at > now())
    )
    AND EXISTS (
      SELECT 1
      FROM public.products pr
      WHERE pr.id = promotion_products.product_id
        AND pr.active
    )
  )
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
);