import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Clock, Eye, Info, MousePointerClick, Send, ShoppingBag, Tag, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAX_CAPTION, newDraft, statusAt } from '@/domain/content';
import { formatDayTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import type { Photo } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { LinkedProductRow, ProductPickerSheet, useSellerCatalog } from '@/ui/Content';
import { Alert, useCountdown, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { AddPhotoTile, PhotoTile, StatTile } from '@/ui/Seller';
import { useRefusal } from '@/ui/SocialSheets';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** SV14 · Créer une story, or SV15 · Ma story while one is online (24 h). */
export default function Story() {
  const { state, shop } = useSeller();
  const now = new Date().toISOString();
  const story = Object.values(state.content.items).find((i) => i.shopId === shop?.shopId && i.kind === 'story' && statusAt(i, now) === 'published');
  return story ? <MyStory id={story.id} /> : <NewStory />;
}

function NewStory() {
  const { shop, dispatch } = useSeller();
  const { byId, linkable } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [text, setText] = useState('');
  const [product, setProduct] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const verified = shop?.status === 'verified';
  const p = product ? byId(product) : undefined;

  const share = () => {
    if (!photo) return;
    dispatch({
      type: 'content/save',
      draft: { ...newDraft('story'), media: [photo], caption: text, productIds: product && linkable.includes(product) ? [product] : [] },
      mode: 'publish',
      at: stamp(),
    });
    toast('Story partagée pour 24 h.', 'success');
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Créer une story" />
      <Content>
        <View style={styles.canvas}>
          {photo ? (
            <>
              <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
              {text ? (
                <View style={styles.overlay}>
                  <Text variant="h3" color={color.text.inverse}>
                    {text}
                  </Text>
                </View>
              ) : null}
              <View style={styles.remove}>
                <PhotoTile photo={photo} size={56} label="Photo de la story" onRemove={() => setPhoto(null)} />
              </View>
            </>
          ) : (
            <AddPhotoTile size={120} title="Photo de la story" label="Ajouter une photo" onPick={setPhoto} />
          )}
          <View style={styles.badge}>
            <Badge label="Story · 24 h" icon={Clock} tone="neutral" />
          </View>
        </View>
        <TextField label="Texte sur la photo" placeholder="Arrivage du jour !" value={text} maxLength={Math.min(60, MAX_CAPTION)} onChangeText={setText} />
        {p ? (
          <LinkedProductRow product={p} actionLabel="Retirer" onRemove={() => setProduct(null)} />
        ) : (
          <Button label="Lier un produit" variant="outline" leadingIcon={Tag} onPress={() => setPicking(true)} fill />
        )}
        {!verified ? <Alert tone="warning" title="Termine ta vérification pour publier" body="Seules les boutiques vérifiées peuvent partager une story." /> : null}
      </Content>
      <BottomBar>
        <Button label="Partager la story" variant="accent" leadingIcon={Send} disabled={!photo || !verified} onPress={share} fill />
      </BottomBar>
      <ProductPickerSheet
        visible={picking}
        selected={product ? [product] : []}
        max={1}
        title="Lier un produit"
        note="Un produit en ligne et en stock : les acheteurs le commandent depuis ta story."
        onClose={() => setPicking(false)}
        onDone={(ids) => {
          setProduct(ids[0] ?? null);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

function MyStory({ id }: { id: string }) {
  const { state, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const s = state.content.items[id]!;
  const { ms } = useCountdown(s.expiresAt);
  const left = Math.ceil(ms / 3_600_000);
  const p = s.productIds[0] ? byId(s.productIds[0]) : undefined;
  return (
    <Screen>
      <TopAppBar title="Ma story" />
      <Content>
        <View style={styles.head}>
          <View style={styles.thumb}>{s.media[0] ? <Image source={s.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Badge label={`Expire dans ${left} h`} icon={Clock} tone="warning" />
            <Text variant="bodyS" color={color.text.secondary}>{`Publiée ${formatDayTime(s.publishedAt!)}`}</Text>
            {s.caption ? <Text variant="labelM">{s.caption}</Text> : null}
            {p ? <Text variant="bodyS">{`Produit lié : ${p.name}, ${formatFC(p.price)}`}</Text> : null}
          </View>
        </View>
        <View style={styles.row}>
          <StatTile icon={Eye} label="Vues" value={s.stats.views.toLocaleString('fr-FR')} />
          <StatTile icon={MousePointerClick} label="Clics produit" value={s.stats.productClicks.toLocaleString('fr-FR')} />
        </View>
        <View style={styles.row}>
          <StatTile icon={ShoppingBag} label="Ventes générées" value={`${s.stats.sales} · ${formatFC(s.stats.salesAmount)}`} />
        </View>
        <Alert tone="info" icon={Info} title="Après 24 h, la story disparaît" body="Ses chiffres restent dans Performance des contenus." />
      </Content>
      <BottomBar>
        <Button
          label="Supprimer la story"
          variant="destructive"
          leadingIcon={Trash2}
          onPress={() => {
            dispatch({ type: 'content/delete', id: s.id, at: stamp() });
            toast('Story supprimée.', 'success');
            router.back();
          }}
          fill
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { height: 420, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.bg.inverse, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', left: space.lg, top: '40%', backgroundColor: color.bg.accent, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xs, transform: [{ rotate: '-6deg' }] },
  remove: { position: 'absolute', right: space.md, bottom: space.md },
  badge: { position: 'absolute', top: space.md, right: space.md },
  head: { flexDirection: 'row', gap: space.md },
  thumb: { width: 110, height: 160, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  row: { flexDirection: 'row', gap: space.md },
});
