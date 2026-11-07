import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Film, Link2, Play } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { draftError, MAX_CAPTION, MAX_CAROUSEL_PHOTOS, MAX_LINKED_PRODUCTS, moderateText, newDraft, type ContentDraft, type ContentKind } from '@/domain/content';
import { posts } from '@/domain/feed';
import type { Photo } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { LinkedProductRow, ProductPickerSheet, ScheduleSheet, useSellerCatalog } from '@/ui/Content';
import { Alert, useToast } from '@/ui/Feedback';
import { Segmented, TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { AddPhotoTile, PhotoTile, SwitchRow } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { PICK_ERROR, pickPhoto } from '@/ui/pickPhoto';
import { useRefusal } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** Demo clips shipped with the app (the feed videos), offered when no camera or gallery is available. */
const DEMO_CLIPS = posts.filter((p) => p.video != null).map((p) => ({ video: p.video!, cover: p.poster ?? p.media[0]! }));

/** SV2 · Nouvelle publication (and its edit), SV3 · Lier des produits, SV5 · Programmer, SV6b · Quitter sans publier. */
export default function NewPublication() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const { shop, state, dispatch } = useSeller();
  const { byId, linkable } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const existing = params.id ? state.content.items[params.id] : undefined;
  const initial = useMemo<ContentDraft>(
    () =>
      existing
        ? {
            kind: existing.kind,
            caption: existing.caption,
            media: existing.media,
            video: existing.video,
            productIds: existing.productIds,
            allowComments: existing.allowComments,
            allowShare: existing.allowShare,
            buyButton: existing.buyButton,
          }
        : newDraft(params.kind === 'photos' ? 'photos' : 'video'),
    // Only the first render seeds the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [d, setD] = useState<ContentDraft>(initial);
  const [linking, setLinking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [videoSheet, setVideoSheet] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<ContentDraft>) => {
    setD((x) => ({ ...x, ...p }));
    setError(null);
  };
  const verified = shop?.status === 'verified';
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const allowed = [...linkable, ...(existing?.productIds ?? [])];
  const caption = moderateText(d.caption);
  const isPublished = existing?.status === 'published';

  const save = (mode: 'draft' | 'publish' | 'schedule', scheduledAt?: string) => {
    if (mode !== 'draft') {
      const err = draftError(d, allowed);
      if (err) return setError(err);
    }
    dispatch({ type: 'content/save', id: existing?.id, draft: d, mode, scheduledAt, at: stamp() });
    toast(mode === 'draft' ? 'Gardé dans Brouillons.' : mode === 'schedule' ? 'Publication programmée.' : isPublished ? 'Publication mise à jour.' : 'Publié. Tes abonnés le voient dans leur fil.', 'success');
    router.back();
  };

  const pickVideo = async (source: 'camera' | 'library') => {
    const r = await pickPhoto(source, ['videos']);
    if (r.ok) {
      patch({ video: r.uri });
      setVideoSheet(false);
      setPickError(null);
    } else setPickError(PICK_ERROR[r.reason]);
  };

  const back = () => (dirty ? setLeaving(true) : router.back());
  const products = d.productIds.map(byId).filter((p) => !!p);

  return (
    <Screen>
      <TopAppBar title={existing ? 'Modifier la publication' : 'Nouvelle publication'} onBack={back} />
      <Content gap={space.xl}>
        {!existing ? (
          <Segmented<ContentKind>
            value={d.kind}
            onChange={(k) => patch({ kind: k, media: [], video: undefined })}
            options={[
              { value: 'video', label: 'Vidéo' },
              { value: 'photos', label: 'Photos' },
            ]}
          />
        ) : null}

        {d.kind === 'video' ? (
          <View style={styles.videoRow}>
            <View style={styles.preview}>
              {d.media[0] ? <Image source={d.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={styles.previewIcon}>{d.video ? <Play size={28} color={color.icon.inverse} strokeWidth={2} /> : <Film size={28} color={color.icon.secondary} strokeWidth={2} />}</View>
              {!d.video ? (
                <Text variant="caption" color={color.text.secondary} style={styles.previewNote}>
                  Aucune vidéo
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1, gap: space.sm }}>
              <Button label={d.video ? 'Changer la vidéo' : 'Ajouter une vidéo'} size="S" variant="outline" onPress={() => setVideoSheet(true)} />
              <Text variant="labelM">Couverture</Text>
              <View style={styles.photos}>
                {d.media[0] ? <PhotoTile photo={d.media[0]} size={72} label="Couverture" onRemove={() => patch({ media: [] })} /> : <AddPhotoTile size={72} title="Couverture de la vidéo" onPick={(p) => patch({ media: [p] })} />}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Text variant="labelM">{`Photos (${d.media.length}/${MAX_CAROUSEL_PHOTOS})`}</Text>
            <View style={styles.photos}>
              {d.media.map((p, i) => (
                <PhotoTile key={i} photo={p} size={80} label={`Photo ${i + 1}`} onRemove={() => patch({ media: d.media.filter((_, j) => j !== i) })} />
              ))}
              {d.media.length < MAX_CAROUSEL_PHOTOS ? <AddPhotoTile size={80} title="Photo du carrousel" onPick={(p: Photo) => patch({ media: [...d.media, p] })} /> : null}
            </View>
          </View>
        )}

        <View style={{ gap: space.xs }}>
          <TextField label="Légende" placeholder="Le son 360° de la JBL Pulse en vrai 🔊" value={d.caption} multiline maxLength={MAX_CAPTION} onChangeText={(t) => patch({ caption: t })} />
          <Text variant="caption" color={caption.violations.length ? color.text.danger : color.text.tertiary}>
            {caption.violations.length ? 'Un numéro, un lien ou un paiement hors YA YO sera masqué à la publication.' : 'Pas de numéro ni de lien de paiement : ils seront masqués.'}
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <View style={styles.between}>
            <Text variant="h4">{`Produits liés (${d.productIds.length})`}</Text>
            {d.productIds.length < MAX_LINKED_PRODUCTS ? (
              <PressableScale accessibilityRole="button" onPress={() => setLinking(true)} scaleTo={pressScale.icon} style={styles.link}>
                <Link2 size={18} color={color.icon.primary} strokeWidth={2} />
                <Text variant="labelM">Lier un produit</Text>
              </PressableScale>
            ) : null}
          </View>
          {products.map((p) => (
            <LinkedProductRow key={p!.id} product={p!} onRemove={() => patch({ productIds: d.productIds.filter((x) => x !== p!.id) })} />
          ))}
          {products.length === 0 ? (
            <Text variant="bodyS" color={color.text.secondary}>
              Lie au moins un produit : c’est lui que les acheteurs commandent depuis ta publication.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: space.md }}>
          <SwitchRow title="Autoriser les commentaires" subtitle="Modérés automatiquement" value={d.allowComments} onChange={(v) => patch({ allowComments: v })} />
          <SwitchRow title="Autoriser le partage et la republication" subtitle="Partage WhatsApp, republication sur le profil" value={d.allowShare} onChange={(v) => patch({ allowShare: v })} />
          <SwitchRow title={d.kind === 'video' ? 'Bouton « Commander » sur la vidéo' : 'Bouton « Commander » sur les photos'} subtitle="Ouvre l’achat rapide sous séquestre" value={d.buyButton} onChange={(v) => patch({ buyButton: v })} />
        </View>

        {!verified ? <Alert tone="warning" title="Boutique pas encore vérifiée" body="Tu peux préparer ce contenu en brouillon. Tu le publieras une fois ta vérification validée." /> : null}
        {error ? <Alert tone="danger" title="Il manque une information" body={error} /> : null}
        <Text variant="caption" color={color.text.tertiary}>
          Mode démo : la vidéo et les photos restent sur ce téléphone, rien n’est envoyé à un serveur.
        </Text>
      </Content>

      <BottomBar>
        {verified ? (
          <View style={styles.footer}>
            {!isPublished ? <Button label="Programmer" variant="outline" onPress={() => setScheduling(true)} style={{ flex: 1 }} /> : null}
            <Button label={isPublished ? 'Enregistrer' : 'Publier'} haptic="medium" onPress={() => save('publish')} style={{ flex: 1 }} />
          </View>
        ) : (
          <Button label="Garder en brouillon" onPress={() => save('draft')} fill />
        )}
      </BottomBar>

      <ProductPickerSheet
        visible={linking}
        selected={d.productIds}
        onClose={() => setLinking(false)}
        onDone={(ids) => {
          patch({ productIds: ids });
          setLinking(false);
        }}
      />
      <ScheduleSheet
        visible={scheduling}
        onClose={() => setScheduling(false)}
        onConfirm={(iso) => {
          setScheduling(false);
          save('schedule', iso);
        }}
      />

      <Sheet visible={videoSheet} onClose={() => setVideoSheet(false)} title="Vidéo produit">
        <View style={styles.footer}>
          <Button label="Filmer" variant="outline" size="M" onPress={() => pickVideo('camera')} style={{ flex: 1 }} />
          <Button label="Galerie" variant="outline" size="M" onPress={() => pickVideo('library')} style={{ flex: 1 }} />
        </View>
        {pickError ? (
          <Text variant="bodyS" color={color.text.danger}>
            {pickError}
          </Text>
        ) : null}
        <Text variant="bodyS" color={color.text.secondary}>
          Format 9:16 conseillé, 15 à 60 secondes. Ou choisis une vidéo de démo :
        </Text>
        <View style={styles.photos}>
          {DEMO_CLIPS.map((c, i) => (
            <PressableScale
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Vidéo de démo ${i + 1}`}
              onPress={() => {
                patch({ video: c.video, media: d.media.length ? d.media : [c.cover] });
                setVideoSheet(false);
              }}
              scaleTo={pressScale.card}
            >
              <Image source={c.cover} style={styles.demoClip} contentFit="cover" />
            </PressableScale>
          ))}
        </View>
      </Sheet>

      {/* SV6b */}
      <Sheet
        visible={leaving}
        onClose={() => setLeaving(false)}
        title="Quitter sans publier ?"
        footer={
          <View style={{ flex: 1, gap: space.sm }}>
            <Button
              label="Garder en brouillon"
              onPress={() => {
                setLeaving(false);
                save('draft');
              }}
              fill
            />
            <Button
              label="Abandonner les modifications"
              variant="ghost"
              onPress={() => {
                setLeaving(false);
                router.back();
              }}
              fill
            />
          </View>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          {`Ta ${d.kind === 'video' ? 'vidéo' : 'sélection de photos'}, ta légende et tes ${d.productIds.length} produit${d.productIds.length > 1 ? 's' : ''} lié${d.productIds.length > 1 ? 's' : ''} seront gardés dans Brouillons.`}
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  videoRow: { flexDirection: 'row', gap: space.lg },
  preview: { width: 140, height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { alignItems: 'center', justifyContent: 'center' },
  previewNote: { marginTop: space.xs },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footer: { flex: 1, flexDirection: 'row', gap: space.md },
  demoClip: { width: 72, height: 100, borderRadius: radius.md },
});
