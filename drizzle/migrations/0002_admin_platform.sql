ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.services (
  slug text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  requirements text[] NOT NULL DEFAULT '{}',
  cost text NOT NULL DEFAULT '',
  fee numeric,
  amount_field boolean NOT NULL DEFAULT false,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_percent numeric,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions public read" ON public.promotions FOR SELECT TO anon, authenticated USING ((active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "promotions admin write" ON public.promotions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.promotion_products (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);
GRANT SELECT ON public.promotion_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_products TO authenticated;
GRANT ALL ON public.promotion_products TO service_role;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo products public read" ON public.promotion_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "promo products admin write" ON public.promotion_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind text NOT NULL,
  quantity integer NOT NULL,
  stock_after integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory admin read" ON public.inventory_movements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.on_stock_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare d integer;
begin
  if tg_op = 'INSERT' then d := new.stock; else d := new.stock - old.stock; end if;
  if d <> 0 then
    insert into public.inventory_movements(product_id, kind, quantity, stock_after, reason, created_by, created_by_email)
    values (new.id, case when tg_op = 'INSERT' then 'initial' when d > 0 then 'in' else 'out' end, abs(d), new.stock,
      case when tg_op = 'INSERT' then 'Stock inicial' when auth.uid() is null then 'Venta en línea' else 'Ajuste desde el panel' end,
      auth.uid(), auth.jwt() ->> 'email');
  end if;
  return new;
end $$;
CREATE TRIGGER products_stock_change AFTER INSERT OR UPDATE OF stock ON public.products FOR EACH ROW EXECUTE FUNCTION public.on_stock_change();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
UPDATE public.orders SET payment_status = CASE WHEN status = 'payment_pending' OR status = 'received' THEN 'pending' ELSE 'confirmed' END;

ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS previous_status text;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS changed_by uuid;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS changed_by_email text;

ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.status_label(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  select case s when 'received' then 'Pedido recibido' when 'payment_pending' then 'Pago pendiente'
  when 'payment_confirmed' then 'Pago confirmado' when 'preparing' then 'Preparando pedido'
  when 'prepared' then 'Pedido preparado' when 'handed_to_carrier' then 'Entregado a paquetería'
  when 'in_transit' then 'En camino' when 'ready_for_pickup' then 'Listo para recoger'
  when 'picked_up' then 'Recogido' when 'delivered' then 'Entregado' when 'cancelled' then 'Cancelado' else s end $$;

CREATE OR REPLACE FUNCTION public.on_order_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    insert into public.order_status_history(order_id, status, previous_status, changed_by, changed_by_email)
    values (new.id, new.status, case when tg_op = 'UPDATE' then old.status end, auth.uid(), auth.jwt() ->> 'email');
    if tg_op = 'UPDATE' then
      if new.status = 'payment_confirmed' and new.payment_status = 'pending' then new.payment_status := 'confirmed'; end if;
      insert into public.notifications(order_id, channel, recipient, message)
      values (new.id, 'email', new.email, 'Tu pedido #' || new.order_number || ': ' || public.status_label(new.status) || '.');
    end if;
  elsif row(new.*) is distinct from row(old.*) then
    new.updated_at := now();
  end if;
  return new;
end $$;

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.settings FOR SELECT TO anon, authenticated USING (is_public OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));