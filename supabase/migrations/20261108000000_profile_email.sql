-- YA YO · l'e-mail ou le téléphone confirmé sur le compte Supabase est recopié dans le profil.
-- (A7 : l'e-mail facultatif d'un compte téléphone n'arrive au profil qu'une fois confirmé.)

create or replace function public.sync_profile_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
    set email = case when new.email_confirmed_at is not null then nullif(new.email, '') else email end,
        phone = case when new.phone_confirmed_at is not null and coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') else phone end
    where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, email_confirmed_at, phone, phone_confirmed_at on auth.users
  for each row execute function public.sync_profile_identity();

revoke execute on function public.sync_profile_identity() from public, anon, authenticated;
