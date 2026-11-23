-- YA YO · fil social en mode serveur (US-20 à US-27, SV1 à SV9).
--  1. La boutique relit ses propres publications à l'écriture (insert … returning),
--     comme pour les produits (20261121000000).
--  2. Numéros et liens masqués par la base dans les légendes et les commentaires
--     (mêmes règles que moderateText dans src/domain/content.ts) : l'app ne peut
--     pas les contourner.
--  3. Vue des commentaires avec le nom court de l'auteur (« Grâce M. ») ou le nom
--     de la boutique quand c'est elle qui répond (badge « Vendeur »), sans
--     ouvrir la table des profils.

drop policy if exists "publication : visible" on public.posts;
create policy "publication : visible" on public.posts for select
  using (shop_id = public.my_shop_id() or public.post_is_visible(id) or public.is_admin());

/** Masque numéros (8 chiffres ou plus) et liens. Renvoie le texte et s'il a fallu masquer. */
create or replace function public.mask_contacts(p_text text, out masked text, out hit boolean)
language plpgsql immutable set search_path = '' as $$
declare m text;
begin
  masked := p_text;
  hit := false;
  -- Les liens d'abord : un lien wa.me/243… ne doit pas être coupé par le masquage du numéro.
  if masked ~* '(https?://|www\.)\S+|\S+\.(com|cd|net|org|me|ly|link)(\M|/)\S*|wa\.me/\S*' then
    masked := regexp_replace(masked, '(https?://|www\.)\S+|\S+\.(com|cd|net|org|me|ly|link)(\M|/)\S*|wa\.me/\S*', '[Lien masqué par YA YO]', 'gi');
    hit := true;
  end if;
  for m in select (regexp_matches(masked, '(?:\+|00)?\d[\d\s.\-]{6,}\d', 'g'))[1] loop
    if length(regexp_replace(m, '\D', '', 'g')) >= 8 then
      masked := replace(masked, m, '[Numéro masqué par YA YO]');
      hit := true;
    end if;
  end loop;
end $$;

create or replace function public.guard_post_caption() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Un brouillon garde ce que le vendeur a tapé ; tout ce qui part en ligne est filtré.
  if new.status <> 'draft' then new.caption := (public.mask_contacts(new.caption)).masked; end if;
  return new;
end $$;
drop trigger if exists posts_guard_caption on public.posts;
create trigger posts_guard_caption before insert or update of caption, status on public.posts
  for each row execute function public.guard_post_caption();

create or replace function public.guard_comment_text() returns trigger
language plpgsql set search_path = '' as $$
declare r record;
begin
  select * into r from public.mask_contacts(new.text);
  if r.hit then
    new.text := r.masked;
    new.status := 'masked';
    new.auto_masked := true;
  end if;
  return new;
end $$;
drop trigger if exists comments_guard_text on public.comments;
create trigger comments_guard_text before insert on public.comments
  for each row execute function public.guard_comment_text();

drop view if exists public.comment_feed;
create view public.comment_feed as
  select c.id, c.post_id, c.reply_to, c.text, c.status, c.auto_masked, c.pinned, c.created_at,
         c.author_id = auth.uid() as mine,
         s.owner_id = c.author_id as seller,
         case when s.owner_id = c.author_id then s.name
              else nullif(trim(split_part(trim(pr.name), ' ', 1) || coalesce(' ' || nullif(left(split_part(trim(pr.name), ' ', 2), 1), '') || '.', '')), '')
         end as author
  from public.comments c
  join public.posts p on p.id = c.post_id
  join public.shops s on s.id = p.shop_id
  join public.profiles pr on pr.id = c.author_id
  where public.post_is_visible(c.post_id)
    and (c.status = 'visible' or c.author_id = auth.uid() or p.shop_id = public.my_shop_id());
grant select on public.comment_feed to anon, authenticated;
