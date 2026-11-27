-- Isolated local test database only. Never apply this fixture to Lovable Cloud.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('email','fixture@example.invalid') $$;
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, price numeric NOT NULL DEFAULT 10, stock integer NOT NULL DEFAULT 0, image text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true);
CREATE SEQUENCE order_number_seq START 1;
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL DEFAULT ('TEST-' || nextval('order_number_seq')), customer_name text NOT NULL, email text NOT NULL, phone text NOT NULL, address text, delivery_method text, payment_method text, payment_reference text, payment_status text DEFAULT 'pending', notes text, subtotal numeric, total numeric, status text);
CREATE TABLE public.order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES public.orders(id), product_id uuid REFERENCES public.products(id), name text, price numeric, quantity integer, image text);
CREATE TABLE public.inventory_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid REFERENCES public.products(id), kind text, quantity integer, stock_after integer, reason text, created_by uuid, created_by_email text, created_at timestamptz DEFAULT now());
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid REFERENCES orders(id),message text);
CREATE FUNCTION public.on_stock_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN new; END $$;
CREATE TRIGGER products_stock_change AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.on_stock_change();