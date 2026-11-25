-- YA YO · V10 « Brouillon » et « Publier le produit » : le vendeur relit la ligne qu'il vient de créer.
-- L'app crée le produit puis lit son id (insert … returning, via PostgREST .select('id')).
-- La règle de lecture passait par product_is_visible(id), qui cherche le produit dans la
-- table : pendant l'insert, la nouvelle ligne n'y est pas encore visible, donc la base
-- refusait (« new row violates row-level security policy ») et l'app affichait
-- « Le serveur YA YO n'a pas pu enregistrer ». On teste maintenant la boutique sur la ligne
-- elle-même. Même correction pour les publications (posts), qui suivent le même schéma.

drop policy if exists "produit : visible" on public.products;
create policy "produit : visible" on public.products for select
  using (shop_id = public.my_shop_id() or public.product_is_visible(id) or public.is_admin());

drop policy if exists "publication : visible" on public.posts;
create policy "publication : visible" on public.posts for select
  using (shop_id = public.my_shop_id() or public.post_is_visible(id) or public.is_admin());
