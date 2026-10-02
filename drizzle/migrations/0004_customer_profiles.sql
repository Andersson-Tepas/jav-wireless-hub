CREATE TABLE public.customer_profiles (
  user_id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  provider text NOT NULL DEFAULT 'email',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles own or admin read" ON public.customer_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles own update" ON public.customer_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX customer_profiles_email_idx ON public.customer_profiles (lower(email));

CREATE OR REPLACE FUNCTION public.grant_first_admin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.raw_app_meta_data->>'provider','email') = 'email'
     and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  elsif not exists (select 1 from public.user_roles where user_id = new.id and role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  end if;
  insert into public.customer_profiles(user_id, email, full_name, avatar_url, phone, provider, created_at)
  values (new.id, coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    nullif(coalesce(new.phone, new.raw_user_meta_data->>'phone', ''), ''),
    coalesce(new.raw_app_meta_data->>'provider','email'), new.created_at)
  on conflict (user_id) do nothing;
  return new;
end $function$;

INSERT INTO public.customer_profiles(user_id, email, full_name, avatar_url, phone, provider, created_at)
SELECT u.id, coalesce(u.email,''),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  nullif(coalesce(u.phone, u.raw_user_meta_data->>'phone', ''), ''),
  coalesce(u.raw_app_meta_data->>'provider','email'), u.created_at
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'user' FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;