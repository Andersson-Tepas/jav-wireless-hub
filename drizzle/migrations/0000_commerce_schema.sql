create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.categories (id text primary key, name text not null, sort int not null default 0);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "categories admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, brand text not null default '', model text not null default '',
  category_id text not null references public.categories(id),
  price numeric(10,2) not null default 0, old_price numeric(10,2),
  stock int not null default 0, colors text[] not null default '{}', capacity text not null default '',
  description text not null default '', features text[] not null default '{}', specs jsonb not null default '[]',
  financing text, image text not null default '',
  is_featured boolean not null default false, is_bestseller boolean not null default false,
  is_new boolean not null default false, is_offer boolean not null default false,
  active boolean not null default true, created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "products admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create sequence public.order_number_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('JW-' || nextval('public.order_number_seq')),
  customer_name text not null, email text not null, phone text not null, address text,
  delivery_method text not null check (delivery_method in ('pickup','shipping')),
  payment_method text not null check (payment_method in ('card','paypal','zelle')),
  payment_reference text,
  status text not null default 'received',
  tracking_number text, carrier text,
  subtotal numeric(10,2) not null default 0, total numeric(10,2) not null default 0,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders admin read" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "orders admin update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null, price numeric(10,2) not null, quantity int not null check (quantity > 0), image text
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "items admin read" on public.order_items for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null, created_at timestamptz not null default now()
);
grant select on public.order_status_history to authenticated;
grant all on public.order_status_history to service_role;
alter table public.order_status_history enable row level security;
create policy "history admin read" on public.order_status_history for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  channel text not null default 'email', recipient text not null, message text not null,
  status text not null default 'pending', created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications admin" on public.notifications for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "notifications admin update" on public.notifications for update to authenticated using (public.has_role(auth.uid(),'admin'));

create sequence public.service_ref_seq start 5001;
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SR-' || nextval('public.service_ref_seq')),
  service_slug text not null, service_name text not null,
  customer_name text not null, email text not null, phone text not null,
  details jsonb not null default '{}', amount numeric(10,2),
  payment_method text not null, payment_reference text,
  status text not null default 'received',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, update on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;
create policy "sr admin read" on public.service_requests for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "sr admin update" on public.service_requests for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.status_label(s text) returns text language sql immutable as $$
  select case s when 'received' then 'Pedido recibido' when 'payment_pending' then 'Pago pendiente'
  when 'payment_confirmed' then 'Pago confirmado' when 'preparing' then 'Preparando pedido'
  when 'prepared' then 'Pedido preparado' when 'handed_to_carrier' then 'Entregado a paquetería'
  when 'in_transit' then 'En camino' when 'ready_for_pickup' then 'Listo para recoger'
  when 'picked_up' then 'Recogido' when 'delivered' then 'Entregado' else s end $$;

create or replace function public.on_order_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.updated_at := now();
    insert into public.order_status_history(order_id, status) values (new.id, new.status);
    if tg_op = 'UPDATE' then
      insert into public.notifications(order_id, channel, recipient, message)
      values (new.id, 'email', new.email, 'Tu pedido #' || new.order_number || ': ' || public.status_label(new.status) || '.');
    end if;
  elsif row(new.*) is distinct from row(old.*) then
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger orders_status_after_insert after insert on public.orders for each row execute function public.on_order_status();
create trigger orders_status_before_update before update on public.orders for each row execute function public.on_order_status();

insert into public.categories(id,name,sort) values
('telefonos','Teléfonos',1),('accesorios','Accesorios',2),('perfumes','Perfumes',3),('joyeria','Joyería',4),
('trajes','Trajes',5),('herramientas','Herramientas',6),('gift-shop','Gift Shop',7),('otros','Otros',8);

insert into public.products(name,brand,model,category_id,price,old_price,stock,colors,capacity,description,features,specs,financing,image,is_featured,is_bestseller,is_new,is_offer) values
('Nova X Pro','Nova','X Pro 5G','telefonos',899,999,8,'{Grafito,Plata}','256 GB','Potencia profesional, cámara avanzada y batería para todo el día.','{"Pantalla OLED 120 Hz","Cámara triple 48 MP","Carga rápida 45 W"}','[{"label":"Pantalla","value":"6.7 pulgadas OLED"},{"label":"Memoria","value":"12 GB RAM"},{"label":"Red","value":"5G / eSIM"}]','Desde $79 al mes por 12 meses','phone-graphite',true,true,false,true),
('Axis Ultra','Axis','Ultra S24','telefonos',1099,null,5,'{Titanio,Negro}','512 GB','Acabados en titanio y fotografía nocturna excepcional.','{"Zoom óptico 5x","Cuerpo de titanio","Video 8K"}','[{"label":"Pantalla","value":"6.8 pulgadas AMOLED"},{"label":"Batería","value":"5,000 mAh"}]','Desde $96 al mes por 12 meses','phone-titanium',true,false,true,false),
('Flex One','Flex','One Flip','telefonos',749,null,3,'{Azul,Crema}','256 GB','Diseño plegable compacto con pantalla exterior inteligente.','{"Formato plegable","Pantalla exterior","Modo manos libres"}','[{"label":"Pantalla","value":"6.9 pulgadas flexible"},{"label":"Peso","value":"187 g"}]','Desde $66 al mes por 12 meses','phone-fold',false,true,true,false),
('Air Beats Pro','Air Beats','Pro ANC','accesorios',179,219,14,'{Blanco}','30 h de batería','Audio envolvente con cancelación activa de ruido.','{"Cancelación activa","Audio espacial","Carga inalámbrica"}','[{"label":"Conexión","value":"Bluetooth 5.3"},{"label":"Resistencia","value":"IPX4"}]',null,'earbuds',true,true,false,true),
('Eau Noble 100 ml','Maison Royale','Eau de Parfum','perfumes',89,110,20,'{Ámbar}','100 ml','Fragancia elegante con notas de ámbar, vainilla y madera.','{"Larga duración","Notas amaderadas","Presentación de regalo"}','[{"label":"Concentración","value":"Eau de Parfum"},{"label":"Contenido","value":"100 ml"}]',null,'perfume',true,false,true,true),
('Cadena Oro 14K','JAV Gold','Cubana 5 mm','joyeria',649,null,4,'{Oro amarillo}','50 cm','Cadena cubana en oro de 14 quilates con broche de seguridad.','{"Oro 14K","Broche reforzado","Certificado incluido"}','[{"label":"Material","value":"Oro 14K"},{"label":"Largo","value":"50 cm"}]','Desde $58 al mes por 12 meses','jewelry',true,false,false,false),
('Traje Clásico Slim','Bellini','Slim Fit','trajes',199,249,9,'{"Azul marino",Negro,Gris}','Tallas 36–46','Traje de dos piezas en corte slim, ideal para eventos formales.','{"Corte slim","Tela antiarrugas","Saco y pantalón"}','[{"label":"Material","value":"Poliéster/viscosa"},{"label":"Piezas","value":"2"}]',null,'suit',false,true,false,true),
('Taladro Inalámbrico 20V','ProForce','DX-20','herramientas',129,null,11,'{Amarillo}','20 V','Taladro compacto con dos baterías y maletín.','{"2 baterías incluidas","Torque 50 Nm","Luz LED"}','[{"label":"Voltaje","value":"20 V"},{"label":"Velocidades","value":"2"}]',null,'tools',false,false,true,false),
('Set de Regalo Deluxe','JAV Gift','Deluxe','gift-shop',49,null,0,'{Rojo}','Caja mediana','Caja de regalo con peluche, chocolates y tarjeta personalizada.','{"Tarjeta personalizada","Empaque premium"}','[{"label":"Tamaño","value":"30 x 20 cm"}]',null,'gift',false,false,true,false),
('Cargador Rápido 45W','PowerLink','PL-45','accesorios',35,null,40,'{Blanco,Negro}','45 W','Cargador USB-C de carga rápida compatible con la mayoría de equipos.','{"USB-C PD","Protección térmica"}','[{"label":"Potencia","value":"45 W"}]',null,'charger',false,true,false,false);