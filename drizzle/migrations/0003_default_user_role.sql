create or replace function public.grant_first_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  if coalesce(new.raw_app_meta_data->>'provider','email') = 'email'
     and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
insert into public.user_roles(user_id, role) select distinct user_id, 'user'::app_role from public.user_roles on conflict do nothing;