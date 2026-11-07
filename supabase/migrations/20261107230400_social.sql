-- YA YO · modération des commentaires par le vendeur (SV4, SV8) et données de départ.

/** p_action : hide | show | pin | unpin. Un seul commentaire épinglé par publication. */
create or replace function public.moderate_comment(p_comment uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.comments;
begin
  select cm.* into c from public.comments cm join public.posts p on p.id = cm.post_id
  where cm.id = p_comment and p.shop_id = public.my_shop_id() for update of cm;
  if c.id is null then perform public.fail('NOT_FOUND', 'Commentaire introuvable.'); end if;
  if c.author_id = auth.uid() then perform public.fail('OWN_COMMENT', 'C’est ta propre réponse.'); end if;
  case p_action
    when 'hide' then update public.comments set status = 'masked', pinned = false where id = c.id;
    when 'show' then update public.comments set status = 'visible', auto_masked = false where id = c.id;
    when 'pin' then
      if c.status <> 'visible' then perform public.fail('INVALID_TRANSITION', 'Réaffiche le commentaire avant de l’épingler.'); end if;
      update public.comments set pinned = false where post_id = c.post_id and pinned;
      update public.comments set pinned = true where id = c.id;
    when 'unpin' then update public.comments set pinned = false where id = c.id;
    else perform public.fail('BAD_ACTION', 'Action inconnue.');
  end case;
end $$;

revoke execute on function public.moderate_comment(uuid, text) from public, anon;
grant execute on function public.moderate_comment(uuid, text) to authenticated;

-- Données de référence, reprises de l'app (pas de données de démonstration).
insert into public.categories (name, department, position) values
  ('Électronique › Audio', 'electronique', 1), ('Électronique › Enceintes', 'electronique', 2), ('Électronique › Accessoires', 'electronique', 3),
  ('Mode › Vêtements', 'mode', 10), ('Mode › Chaussures', 'mode', 11),
  ('Beauté › Soins', 'beaute', 20), ('Maison › Déco', 'maison', 30)
on conflict (name) do nothing;

insert into public.delivery_slots (id, label, position) values
  ('asap', 'Dès que possible', 1), ('tomorrow-am', 'Demain 9h–12h', 2), ('tomorrow-pm', 'Demain 14h–18h', 3)
on conflict (id) do nothing;

-- Code promo de l'app (C1) : 10 %, plafonné à 20 000 FC.
insert into public.promo_codes (code, percent, cap) values ('YAYO10', 10, 20000) on conflict (code) do nothing;
