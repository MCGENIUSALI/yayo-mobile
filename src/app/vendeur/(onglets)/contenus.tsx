import { router } from 'expo-router';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarClock,
  Copy,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { performance, percentChange, statusAt, type ContentItem, type ContentStatus } from '@/domain/content';
import { formatCount } from '@/domain/feed';
import { formatFC } from '@/domain/money';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ContentTile, outOfStockLinks, ProductPickerSheet, useSellerCatalog } from '@/ui/Content';
import { Alert, useToast } from '@/ui/Feedback';
import { Chip } from '@/ui/Form';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, MenuRow, StatTile, TrendPill } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { useRefusal } from '@/ui/SocialSheets';
import { Text } from '@/ui/Text';

type Tab = ContentStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: 'published', label: 'Publiées' },
  { id: 'scheduled', label: 'Programmées' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'hidden', label: 'Masquées' },
];

/** SV1 · Mes publications (SV1b empty), SV0 · Ajouter du contenu, SV7 · Actions. */
export default function SellerContents() {
  const { shop, state, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const stamp = useRefusal();
  const [tab, setTab] = useState<Tab>('published');
  const [adding, setAdding] = useState(false);
  const [acting, setActing] = useState<ContentItem | null>(null);
  const [replacing, setReplacing] = useState<{ item: ContentItem; from: string } | null>(null);
  const now = new Date().toISOString();
  const tile = Math.floor((width - space.screen * 2 - space.sm * 2) / 3);

  const mine = useMemo(
    () =>
      Object.values(state.content.items)
        .filter((i) => i.shopId === shop?.shopId && i.kind !== 'story')
        .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)),
    [state.content.items, shop?.shopId],
  );
  const by = (t: Tab) => mine.filter((i) => statusAt(i, now) === t);
  const shown = by(tab);
  const perf = performance(mine, '7d', now);
  const viewsTrend = perf.previous ? percentChange(perf.views, perf.previous.views) : null;
  const story = Object.values(state.content.items).find((i) => i.shopId === shop?.shopId && i.kind === 'story' && statusAt(i, now) === 'published');
  const verified = shop?.status === 'verified';

  const open = (i: ContentItem) => {
    const st = statusAt(i, now);
    if (st === 'hidden') return router.push({ pathname: '/vendeur/contenu/masque/[id]', params: { id: i.id } });
    if (i.kind === 'live') return router.push({ pathname: '/vendeur/live/[id]', params: { id: i.id } });
    if (st === 'draft') return router.push({ pathname: '/vendeur/contenu/nouveau', params: { id: i.id } });
    setActing(i);
  };

  if (!shop || shop.status === 'draft') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.lg }]}>
        <EmptyState
          icon={Video}
          title="Ouvre ta boutique d’abord"
          body="Tes vidéos et photos font vendre tes produits. Termine l’ouverture de ta boutique pour publier."
          action={<Button label={shop ? 'Vérifier mon identité' : 'Ouvrir ma boutique'} onPress={() => router.push(shop ? '/vendeur/verification' : '/vendeur/creer')} />}
        />
      </View>
    );
  }

  const outLinks = acting ? outOfStockLinks(acting, byId) : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text variant="bodyM" color={color.text.secondary}>
            {shop.profile.name}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            Contenus
          </Text>
        </View>

        <View style={styles.stats}>
          <StatTile
            icon={BarChart3}
            label="Vues (7 j)"
            value={formatCount(perf.views)}
            footer={viewsTrend !== null ? <TrendPill value={`${viewsTrend > 0 ? '+' : ''}${viewsTrend} %`} suffix="vs sem. dernière" tone={viewsTrend >= 0 ? 'up' : 'down'} /> : undefined}
          />
          <StatTile icon={BadgeCheck} label="Ventes via contenus" value={formatFC(perf.salesAmount)} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TABS.map((t) => (
            <Chip key={t.id} label={`${t.label} · ${by(t.id).length}`} selected={tab === t.id} onPress={() => setTab(t.id)} />
          ))}
        </ScrollView>

        {shown.length === 0 ? (
          <EmptyState
            icon={Video}
            title={tab === 'published' ? 'Publie ta première vidéo' : 'Rien ici pour l’instant'}
            body={
              tab === 'published'
                ? 'Montre un produit en usage et lie-le : les acheteurs commandent directement depuis ta vidéo.'
                : tab === 'hidden'
                  ? 'Aucun contenu masqué par la modération. Continue comme ça.'
                  : 'Tes contenus apparaîtront ici.'
            }
            action={tab === 'published' ? <Button label="Ajouter du contenu" leadingIcon={Plus} onPress={() => setAdding(true)} /> : undefined}
          />
        ) : (
          <View style={styles.grid}>
            {shown.map((i) => (
              <ContentTile
                key={i.id}
                item={i}
                width={tile}
                badge={i.kind === 'live' ? 'Live' : outOfStockLinks(i, byId).length ? 'Rupture' : statusAt(i, now) === 'hidden' ? 'Masqué' : undefined}
                onPress={() => open(i)}
              />
            ))}
          </View>
        )}

        <View style={styles.menu}>
          <MenuRow icon={BarChart3} title="Performance des contenus" onPress={() => router.push('/vendeur/contenu/performance')} />
          <MenuRow icon={LayoutGrid} title="Mes collections" onPress={() => router.push('/vendeur/collections')} />
          <MenuRow
            icon={Sparkles}
            title={story ? 'Ma story' : 'Créer une story'}
            subtitle={story ? 'En ligne pendant 24 h' : 'Coulisses, arrivages, promos du jour'}
            onPress={() => router.push('/vendeur/contenu/story')}
          />
          <MenuRow icon={BookOpen} title="Guide qualité" onPress={() => router.push('/vendeur/contenu/guide')} />
        </View>
      </ScrollView>

      <PressableScale accessibilityRole="button" accessibilityLabel="Ajouter du contenu" onPress={() => setAdding(true)} haptic="medium" scaleTo={pressScale.button} style={styles.fab}>
        <Plus size={22} color={color.icon.inverse} strokeWidth={2.5} />
        <Text variant="labelL" color={color.text.inverse}>
          Contenu
        </Text>
      </PressableScale>

      {/* SV0 / SV0b */}
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Ajouter du contenu">
        {verified ? (
          <>
            <AddRow icon={Video} title="Vidéo produit" subtitle="Filme ou importe, puis lie jusqu’à 5 produits" onPress={() => go(() => setAdding(false), { pathname: '/vendeur/contenu/nouveau', params: { kind: 'video' } })} />
            <AddRow icon={ImageIcon} title="Photos produit" subtitle="Jusqu’à 10 photos en carrousel" onPress={() => go(() => setAdding(false), { pathname: '/vendeur/contenu/nouveau', params: { kind: 'photos' } })} />
            <AddRow icon={Sparkles} title="Story · 24 h" subtitle="Coulisses, arrivages, promos du jour" onPress={() => go(() => setAdding(false), '/vendeur/contenu/story')} />
            <AddRow icon={CalendarClock} title="Programmer un live" subtitle="Présente tes produits en direct" onPress={() => go(() => setAdding(false), '/vendeur/live/nouveau')} />
            <Alert tone="info" icon={ShieldCheck} title="Tout achat passe par le séquestre YA YO" body="Les acheteurs commandent depuis ton contenu et tu es payé à la livraison." />
          </>
        ) : (
          <View style={styles.unverified}>
            <View style={styles.shield}>
              <ShieldCheck size={28} color={color.icon.secondary} strokeWidth={2} />
            </View>
            <Text variant="h4" align="center">
              Termine ta vérification pour publier
            </Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              Seules les boutiques vérifiées peuvent publier des contenus. Tu peux préparer des brouillons en attendant.
            </Text>
            <Button label="Voir ma vérification" onPress={() => go(() => setAdding(false), shop.status === 'submitted' ? '/vendeur/statut' : '/vendeur/verification')} />
            <Button label="Préparer un brouillon" variant="ghost" onPress={() => go(() => setAdding(false), { pathname: '/vendeur/contenu/nouveau', params: { kind: 'video' } })} />
          </View>
        )}
      </Sheet>

      {/* SV7 */}
      <Sheet visible={!!acting} onClose={() => setActing(null)} title={acting?.caption || 'Publication'}>
        {acting ? (
          <>
            {outLinks.length ? (
              <Alert
                tone="warning"
                title={`${outLinks.length} produit${outLinks.length > 1 ? 's' : ''} lié${outLinks.length > 1 ? 's' : ''} en rupture`}
                body={`${outLinks.map((p) => p.name).join(', ')} n’a plus de stock : son bouton Commander est masqué.`}
              />
            ) : null}
            <View>
              <MenuRow icon={BarChart3} title="Voir les statistiques" onPress={() => go(() => setActing(null), { pathname: '/vendeur/contenu/[id]', params: { id: acting.id } })} />
              <MenuRow icon={Pencil} title="Modifier la légende et les produits" onPress={() => go(() => setActing(null), { pathname: '/vendeur/contenu/nouveau', params: { id: acting.id } })} />
              {outLinks.length ? (
                <MenuRow
                  icon={RefreshCw}
                  title="Remplacer le produit en rupture"
                  onPress={() => {
                    setReplacing({ item: acting, from: outLinks[0]!.id });
                    setActing(null);
                  }}
                />
              ) : null}
              <MenuRow
                icon={Copy}
                title="Dupliquer"
                onPress={() => {
                  dispatch({ type: 'content/duplicate', id: acting.id, at: stamp() });
                  setActing(null);
                  setTab('draft');
                  toast('Copie ajoutée aux brouillons.', 'success');
                }}
              />
              <ActionRow
                icon={EyeOff}
                title="Dépublier"
                subtitle="Repasse en brouillon, invisible des acheteurs"
                onPress={() => {
                  dispatch({ type: 'content/unpublish', id: acting.id, at: stamp() });
                  setActing(null);
                  toast('Publication repassée en brouillon.', 'success');
                }}
              />
              <ActionRow
                icon={Trash2}
                danger
                title="Supprimer"
                subtitle="Les commandes déjà passées ne sont pas touchées"
                onPress={() => {
                  dispatch({ type: 'content/delete', id: acting.id, at: stamp() });
                  setActing(null);
                  toast('Publication supprimée.', 'success');
                }}
              />
            </View>
          </>
        ) : null}
      </Sheet>

      <ProductPickerSheet
        visible={!!replacing}
        selected={[]}
        max={1}
        title="Remplacer le produit"
        note="Choisis un produit en ligne et en stock pour remplacer celui en rupture."
        onClose={() => setReplacing(null)}
        onDone={(ids) => {
          if (replacing && ids[0]) {
            dispatch({ type: 'content/replaceProduct', id: replacing.item.id, from: replacing.from, to: ids[0], at: stamp() });
            toast('Produit remplacé.', 'success');
          }
          setReplacing(null);
        }}
      />
    </View>
  );
}

function go(close: () => void, href: Parameters<typeof router.push>[0]) {
  close();
  router.push(href);
}

function AddRow({ icon: Icon, title, subtitle, onPress }: { icon: LucideIcon; title: string; subtitle: string; onPress: () => void }) {
  return <MenuRow icon={Icon} title={title} subtitle={subtitle} onPress={onPress} />;
}

function ActionRow({ icon: Icon, title, subtitle, danger = false, onPress }: { icon: LucideIcon; title: string; subtitle: string; danger?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} haptic="selection" scaleTo={pressScale.card} style={styles.action}>
      <View style={styles.actionIcon}>
        <Icon size={20} color={danger ? color.icon.danger : color.icon.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelL" color={danger ? color.text.danger : color.text.primary}>
          {title}
        </Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { paddingHorizontal: space.screen, paddingBottom: 120, gap: space.lg },
  stats: { flexDirection: 'row', gap: space.md },
  chips: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  menu: { gap: space.sm },
  fab: {
    position: 'absolute',
    right: space.screen,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.bg.inverse,
  },
  unverified: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  shield: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  actionIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});
