import { router } from 'expo-router';
import { Bell, ChartColumn, ChevronRight, Clock, Package, ShieldCheck, Star, Store } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getShop } from '@/domain/catalog';
import { formatFC } from '@/domain/money';
import { dashboard, sellerNotices, trend } from '@/domain/seller';
import { useSeller, useSellerOrderNav } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert } from '@/ui/Feedback';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, SellerOrderCard, StatTile, TrendPill } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** V4 · Tableau de bord vendeur. */
export default function SellerDashboard() {
  const { account, shop, orders, state } = useSeller();
  const nav = useSellerOrderNav();
  const insets = useSafeAreaInsets();
  const now = new Date().toISOString();
  // Small lists (one shop): computed on each render, so "today" never goes stale.
  const d = dashboard(orders, now);
  const unread = shop ? sellerNotices(orders, shop.products, now).filter((n) => !shop.readNotifications.includes(n.id)).length : 0;
  const firstName = account?.name.split(' ')[0] ?? '';
  const fresh = orders.filter((o) => o.seller === 'new');
  const catalogShop = shop?.status === 'verified' ? safeShop(shop.shopId) : undefined;
  const salesTrend = trend(d.salesToday, d.salesYesterday);
  const rating = catalogShop?.rating;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyM" color={color.text.secondary}>
            Bonjour {firstName} 👋
          </Text>
          <Text variant="h1" numberOfLines={1} accessibilityRole="header">
            {shop?.profile.name ?? 'Mon espace vendeur'}
          </Text>
        </View>
        {shop ? (
          <PressableScale
            accessibilityLabel={unread ? `Notifications, ${unread} non lues` : 'Notifications'}
            onPress={() => router.push('/vendeur/notifications')}
            haptic="selection"
            scaleTo={pressScale.icon}
            style={styles.bell}
          >
            <Bell size={24} color={color.icon.primary} strokeWidth={2} />
            {unread ? (
              <View style={styles.dot}>
                <Text variant="caption" color={color.text.inverse}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!shop || shop.status === 'draft' ? (
          <EmptyState
            icon={Store}
            title={shop ? 'Termine l’ouverture de ta boutique' : 'Ouvre ta boutique'}
            body={shop ? 'Il reste à vérifier ton identité pour vendre et recevoir tes paiements.' : 'Présente ta boutique et vérifie ton identité pour commencer à vendre.'}
            action={<Button label={shop ? 'Vérifier mon identité' : 'Ouvrir ma boutique'} onPress={() => router.push(shop ? '/vendeur/verification' : '/vendeur/creer')} />}
          />
        ) : (
          <>
            {shop.status === 'submitted' ? (
              <PressableScale accessibilityRole="link" onPress={() => router.push('/vendeur/statut')} scaleTo={pressScale.card}>
                <Alert tone="info" icon={Clock} title="Vérification en cours" body="Notre équipe valide ton dossier sous 24 à 48 h. Prépare ton catalogue en attendant." />
              </PressableScale>
            ) : null}
            <View style={styles.grid}>
              <View style={styles.row}>
                <StatTile
                  icon={ChartColumn}
                  label="Ventes du jour"
                  value={formatFC(d.salesToday)}
                  footer={salesTrend !== null ? <TrendPill tone={salesTrend >= 0 ? 'up' : 'down'} value={`${salesTrend >= 0 ? '+' : '−'}${Math.abs(salesTrend)} %`} suffix="vs hier" /> : null}
                />
                <StatTile icon={Package} label="Commandes à traiter" value={String(d.toProcess)} footer={<TrendPill tone="flat" value={d.toProcess ? `${fresh.length} nouvelle${fresh.length > 1 ? 's' : ''}` : 'À jour'} />} />
              </View>
              <View style={styles.row}>
                <StatTile icon={ShieldCheck} label="Fonds sécurisés" value={formatFC(d.secured)} footer={<TrendPill tone="success" value="Libérés à la livraison" />} />
                <StatTile icon={Star} label="Note moyenne" value={rating ? `${rating.toString().replace('.', ',')} ★` : '—'} footer={catalogShop?.reviews ? <TrendPill tone="flat" value={`${catalogShop.reviews} avis`} /> : null} />
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text variant="h4" accessibilityRole="header">
                Nouvelles commandes
              </Text>
              <PressableScale accessibilityRole="link" onPress={() => router.navigate('/vendeur/commandes')} hitSlop={8} scaleTo={pressScale.icon} style={styles.link}>
                <Text variant="labelM" color={color.text.accent}>
                  Tout voir
                </Text>
                <ChevronRight size={16} color={color.icon.accent} strokeWidth={2} />
              </PressableScale>
            </View>
            {fresh.length ? (
              fresh.slice(0, 2).map((o, i) => <SellerOrderCard key={o.id} order={o} index={i} onOpen={() => nav.open(o)} onAction={() => nav.act(o)} />)
            ) : (
              <View style={styles.quiet}>
                <Text variant="bodyM" color={color.text.secondary}>
                  {shop.status === 'verified' ? 'Aucune nouvelle commande pour l’instant. Tu es notifié dès qu’un achat est payé.' : 'Les commandes arriveront après la validation de ta boutique.'}
                </Text>
              </View>
            )}
            {state.mode === 'seller' && shop.products.length === 0 ? (
              <Button label="Ajouter mon premier produit" variant="outline" onPress={() => router.push('/vendeur/produit/nouveau')} fill />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function safeShop(id: string) {
  try {
    return getShop(id);
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, backgroundColor: color.bg.surface, paddingHorizontal: space.screen, paddingBottom: space.md },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: color.bg.accent,
    borderWidth: 1.5,
    borderColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  quiet: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
});
