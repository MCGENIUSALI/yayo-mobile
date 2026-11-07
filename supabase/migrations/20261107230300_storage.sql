-- YA YO · fichiers (photos, vidéos, pièces).
-- Chaque fichier est rangé sous le dossier de son auteur : <id du compte>/...
--   media : photos de produits, publications, avatars de boutique. Lecture publique.
--   private : pièces d'identité, selfies, photos de litige et de passage. Lecture
--             par l'auteur et YA YO seulement ; l'app les affiche par lien signé.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('private', 'private', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "media : lecture publique" on storage.objects for select using (bucket_id = 'media');
create policy "media : déposer dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media : remplacer ses fichiers" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media : supprimer ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "privé : lire les siens" on storage.objects for select to authenticated
  using (bucket_id = 'private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "privé : déposer dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);
