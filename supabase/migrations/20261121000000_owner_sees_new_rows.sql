-- YA YO · le vendeur relit tout de suite ce qu'il vient de créer (V10).
-- L'app écrit via PostgREST (insert … returning). La politique de lecture
-- passait par product_is_visible(), qui relit la table et ne voit pas encore
-- la ligne en cours d'insertion : « new row violates row-level security ».
-- On teste donc la boutique directement sur la ligne.

drop policy if exists "produit : visible" on public.products;
create policy "produit : visible" on public.products for select
  using (shop_id = public.my_shop_id() or (status = 'active' and public.shop_is_public(shop_id)) or public.is_admin());

drop policy if exists "photo : visible" on public.product_photos;
create policy "photo : visible" on public.product_photos for select
  using (public.product_is_visible(product_id)
         or exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()));

drop policy if exists "variante : visible" on public.product_variants;
create policy "variante : visible" on public.product_variants for select
  using (public.product_is_visible(product_id)
         or exists (select 1 from public.products p where p.id = product_id and p.shop_id = public.my_shop_id()));
