import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, ChevronRight, Eye, Heart, MousePointerClick, Share2, ShieldCheck, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { statusAt, type Comment } from '@/domain/content';
import { formatDay } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Card, Content, Screen } from '@/ui/Layout';
import { useSellerCatalog } from '@/ui/Content';
import { ReplySheet, SellerCommentCard } from '@/ui/ContentComments';
import { Alert } from '@/ui/Feedback';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, StatTile } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  published: { label: 'En ligne', tone: 'success' },
  scheduled: { label: 'Programmée', tone: 'warning' },
  draft: { label: 'Brouillon', tone: 'neutral' },
  hidden: { label: 'Masquée', tone: 'danger' },
  expired: { label: 'Expirée', tone: 'neutral' },
};

/** SV4 · Statistiques d’une publication. */
export default function ContentStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, shop } = useSeller();
  const { byId } = useSellerCatalog();
  const [replying, setReplying] = useState<Comment | null>(null);
  const item = id ? state.content.items[id] : undefined;
  if (!item || item.shopId !== shop?.shopId) {
    return (
      <Screen>
        <TopAppBar title="Statistiques" />
        <EmptyState icon={Eye} title="Publication introuvable" body="Elle a peut-être été supprimée." />
      </Screen>
    );
  }
  const s = item.stats;
  const status = STATUS[statusAt(item, new Date().toISOString())]!;
  const toModerate = (state.content.comments[item.id] ?? []).filter((c) => c.review && c.status !== 'blocked');
  const conversion = s.views ? (s.sales / s.views) * 100 : 0;

  return (
    <Screen>
      <TopAppBar title="Statistiques" />
      <Content>
        <View style={styles.head}>
          <View style={styles.thumb}>{(item.poster ?? item.media[0]) ? <Image source={item.poster ?? item.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="labelL" numberOfLines={2}>
              {item.caption || 'Sans légende'}
            </Text>
            <Text variant="bodyS" color={color.text.secondary}>
              {`${item.publishedAt ? `Publiée le ${formatDay(item.publishedAt)}` : `Créée le ${formatDay(item.createdAt)}`} · ${item.kind === 'video' ? 'Vidéo' : item.kind === 'photos' ? `${item.media.length} photo${item.media.length > 1 ? 's' : ''}` : 'Live'}`}
            </Text>
            <Badge label={status.label} tone={status.tone} />
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.row}>
            <StatTile icon={Eye} label="Vues" value={s.views.toLocaleString('fr-FR')} />
            <StatTile icon={Heart} label="J’aime" value={s.likes.toLocaleString('fr-FR')} />
          </View>
          <View style={styles.row}>
            <StatTile icon={MousePointerClick} label="Clics produit" value={s.productClicks.toLocaleString('fr-FR')} />
            <StatTile icon={ShoppingBag} label="Ventes générées" value={`${s.sales} · ${formatFC(s.salesAmount)}`} />
          </View>
          <View style={styles.row}>
            <StatTile icon={Share2} label="Partages" value={s.shares.toLocaleString('fr-FR')} />
            <StatTile icon={Bookmark} label="Enregistrements" value={s.saves.toLocaleString('fr-FR')} />
          </View>
        </View>
        <Text variant="caption" color={color.text.tertiary}>
          {`Conversion ${conversion.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % (${s.sales} vente${s.sales > 1 ? 's' : ''} pour ${s.views.toLocaleString('fr-FR')} vues). Les vues et clics comptent sur ce téléphone ; les ventes des contenus de démo sont des chiffres de démonstration.`}
        </Text>

        {item.productIds.length ? (
          <Card gap={space.sm}>
            <Text variant="labelL">Par produit lié</Text>
            {item.productIds.map((pid) => {
              const pp = item.perProduct?.[pid] ?? { clicks: 0, sales: 0 };
              return (
                <View key={pid} style={styles.between}>
                  <Text variant="bodyM" numberOfLines={1} style={{ flex: 1 }}>
                    {byId(pid)?.name ?? pid}
                  </Text>
                  <Text variant="labelM">{`${pp.clicks.toLocaleString('fr-FR')} clics · ${pp.sales} vente${pp.sales > 1 ? 's' : ''}`}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        <View style={styles.between}>
          <Text variant="h4">{`Commentaires à modérer (${toModerate.length})`}</Text>
          <PressableScale accessibilityRole="link" onPress={() => router.push({ pathname: '/vendeur/contenu/commentaires/[id]', params: { id: item.id } })} scaleTo={pressScale.icon} style={styles.link}>
            <Text variant="labelM" color={color.text.accent}>
              Tout voir
            </Text>
            <ChevronRight size={18} color={color.icon.accent} strokeWidth={2} />
          </PressableScale>
        </View>
        {toModerate.length ? (
          toModerate.slice(0, 3).map((c) => <SellerCommentCard key={c.id} comment={c} onReply={setReplying} />)
        ) : (
          <Text variant="bodyS" color={color.text.secondary}>
            Rien à modérer pour l’instant.
          </Text>
        )}
        <Alert tone="info" icon={ShieldCheck} title="Modération YA YO" body="Les commentaires avec numéro, lien ou demande de paiement hors application sont masqués automatiquement." />
      </Content>
      <ReplySheet target={replying} onClose={() => setReplying(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 72, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
