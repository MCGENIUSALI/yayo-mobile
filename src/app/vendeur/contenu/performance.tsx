import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Eye, MousePointerClick, ShoppingBag, TrendingUp, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { performance, percentChange, type ContentKind, type Period } from '@/domain/content';
import { formatCount } from '@/domain/feed';
import { formatFC } from '@/domain/money';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Form';
import { Card, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, StatTile, TrendPill } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Aujourd’hui' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'all', label: 'Depuis le début' },
];
const KINDS: { id: ContentKind; label: string }[] = [
  { id: 'video', label: 'Vidéos' },
  { id: 'photos', label: 'Photos' },
  { id: 'live', label: 'Lives' },
  { id: 'story', label: 'Stories' },
];

/** SV11 · Performance des contenus. */
export default function ContentPerformance() {
  const { state, shop } = useSeller();
  const [period, setPeriod] = useState<Period>('7d');
  const items = Object.values(state.content.items).filter((i) => i.shopId === shop?.shopId);
  const p = performance(items, period, new Date().toISOString());
  const trend = (cur: number, prev?: number) => {
    const v = prev === undefined ? null : percentChange(cur, prev);
    return v === null ? undefined : <TrendPill value={`${v > 0 ? '+' : ''}${v} %`} tone={v >= 0 ? 'up' : 'down'} />;
  };
  const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

  return (
    <Screen>
      <TopAppBar title="Performance" />
      <Content>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {PERIODS.map((x) => (
            <Chip key={x.id} label={x.label} selected={period === x.id} onPress={() => setPeriod(x.id)} />
          ))}
        </ScrollView>
        {items.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Pas encore de chiffres" body="Publie un contenu pour suivre ses vues, ses clics et ses ventes." />
        ) : (
          <>
            <View style={styles.row}>
              <StatTile icon={Eye} label="Vues contenus" value={formatCount(p.views)} footer={trend(p.views, p.previous?.views)} />
              <StatTile icon={MousePointerClick} label="Clics produit" value={formatCount(p.productClicks)} footer={trend(p.productClicks, p.previous?.productClicks)} />
            </View>
            <View style={styles.row}>
              <StatTile icon={TrendingUp} label="Conversion" value={pct(p.conversion)} />
              <StatTile icon={ShoppingBag} label="Ventes générées" value={`${p.sales}`} />
            </View>
            <Card gap={space.sm}>
              <Text variant="labelL">Ventes générées par type</Text>
              {KINDS.map((k) => (
                <View key={k.id} style={styles.between}>
                  <Text variant="bodyM">{k.label}</Text>
                  <Text variant="labelM">{formatFC(p.byKind[k.id])}</Text>
                </View>
              ))}
              <Text variant="caption" color={color.text.tertiary}>
                Ventes brutes payées en séquestre. Le net encaissé est dans Revenus.
              </Text>
              <Button label="Voir mes revenus" variant="ghost" size="S" leadingIcon={Wallet} onPress={() => router.push('/vendeur/revenus')} />
            </Card>
            <Text variant="h4">Top contenus</Text>
            {p.top.length ? (
              p.top.map((i) => (
                <PressableScale key={i.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/vendeur/contenu/[id]', params: { id: i.id } })} scaleTo={pressScale.card} style={styles.top}>
                  <View style={styles.thumb}>{(i.poster ?? i.media[0]) ? <Image source={i.poster ?? i.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="labelM" numberOfLines={1}>
                      {i.caption || 'Sans légende'}
                    </Text>
                    <Text variant="bodyS" color={color.text.secondary}>{`${formatCount(i.stats.views)} vues · ${i.stats.sales} vente${i.stats.sales > 1 ? 's' : ''}`}</Text>
                  </View>
                </PressableScale>
              ))
            ) : (
              <Text variant="bodyS" color={color.text.secondary}>
                Aucun contenu publié sur cette période.
              </Text>
            )}
            <Text variant="caption" color={color.text.tertiary}>
              Vues du profil et nouveaux abonnés : ces chiffres arriveront avec le serveur YA YO.
            </Text>
          </>
        )}
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.sm },
  thumb: { width: 48, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
});
