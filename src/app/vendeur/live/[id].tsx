import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CalendarClock, Eye, Package, Radio, ShieldCheck, ShoppingCart, Trash2, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDayTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useSeller } from '@/store/useSeller';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { LinkedProductRow, useSellerCatalog } from '@/ui/Content';
import { Alert, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, StatTile } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { useRefusal } from '@/ui/SocialSheets';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** A scheduled live (details), SV17 · En direct (demo room), SV18 · Fin du live. */
export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, shop } = useSeller();
  const item = id ? state.content.items[id] : undefined;
  if (!item?.live || item.shopId !== shop?.shopId) {
    return (
      <Screen>
        <TopAppBar title="Live" />
        <EmptyState icon={Radio} title="Live introuvable" body="Il a peut-être été supprimé." />
      </Screen>
    );
  }
  if (item.live.state === 'live') return <LiveRoom id={item.id} />;
  if (item.live.state === 'ended') return <LiveEnded id={item.id} />;
  return <ScheduledLive id={item.id} />;
}

function ScheduledLive({ id }: { id: string }) {
  const { state, dispatch } = useSeller();
  const { byId } = useSellerCatalog();
  const toast = useToast();
  const stamp = useRefusal();
  const item = state.content.items[id]!;
  const live = item.live!;
  return (
    <Screen>
      <TopAppBar
        title="Live programmé"
        action={{
          icon: Trash2,
          label: 'Annuler le live',
          onPress: () => {
            dispatch({ type: 'content/delete', id, at: stamp() });
            toast('Live annulé.', 'success');
            router.back();
          },
        }}
      />
      <Content>
        <View style={styles.head}>
          <View style={styles.poster}>{item.media[0] ? <Image source={item.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Radio size={28} color={color.icon.secondary} strokeWidth={2} />}</View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="h4">{live.title}</Text>
            <Badge label={formatDayTime(live.startsAt)} icon={CalendarClock} tone="warning" />
            {live.description ? (
              <Text variant="bodyS" color={color.text.secondary}>
                {live.description}
              </Text>
            ) : null}
          </View>
        </View>
        <Text variant="h4">{`Produits présentés (${item.productIds.length})`}</Text>
        {item.productIds.map((pid) => {
          const p = byId(pid);
          return p ? <LinkedProductRow key={pid} product={p} /> : null;
        })}
        <Alert tone="info" title="Mode démo" body="Sans serveur, le live est une salle simulée : aucune vidéo n’est diffusée et aucun abonné n’est prévenu." />
      </Content>
      <BottomBar>
        <Button
          label="Démarrer le live"
          variant="destructive"
          leadingIcon={Radio}
          onPress={() => dispatch({ type: 'content/liveStart', id, at: stamp() })}
          fill
        />
      </BottomBar>
    </Screen>
  );
}

function LiveRoom({ id }: { id: string }) {
  const { state, dispatch, orders } = useSeller();
  const { byId } = useSellerCatalog();
  const insets = useSafeAreaInsets();
  const stamp = useRefusal();
  const [ending, setEnding] = useState(false);
  const item = state.content.items[id]!;
  const live = item.live!;
  // Real orders of the presented products since the start (none are simulated).
  const during = orders.filter((o) => o.milestones.createdAt >= live.startedAt! && o.lines.some((l) => item.productIds.includes(l.productId)));
  const amount = during.reduce((t, o) => t + o.itemsTotal, 0);
  const pinned = live.pinnedProductId ? byId(live.pinnedProductId) : undefined;

  const end = () => {
    dispatch({ type: 'content/liveEnd', id, peak: 0, viewers: 0, orders: during.length, salesAmount: amount, at: stamp() });
    setEnding(false);
  };

  return (
    <View style={styles.room}>
      <StatusBar style="light" />
      {item.media[0] ? <Image source={item.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.scrim} />
      <View style={[styles.roomTop, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.onAir}>
          <Text variant="labelS" color={color.text.inverse}>
            EN DIRECT
          </Text>
        </View>
        <Text variant="labelM" color={color.text.inverse} style={{ flex: 1 }}>
          {`Depuis ${formatDayTime(live.startedAt!)}`}
        </Text>
        <PressableScale accessibilityLabel="Terminer le live" onPress={() => setEnding(true)} scaleTo={pressScale.icon} style={styles.close}>
          <X size={24} color={color.icon.inverse} strokeWidth={2} />
        </PressableScale>
      </View>
      <View style={styles.demoBanner}>
        <Text variant="bodyS" color={color.text.inverse}>
          Mode démo : aucune vidéo n’est diffusée et il n’y a pas de spectateurs réels. Les commandes affichées sont les vraies commandes passées dans l’app pendant le live.
        </Text>
      </View>
      <View style={[styles.roomBottom, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.salesPill}>
          <ShieldCheck size={14} color={color.icon.success} strokeWidth={2} />
          <Text variant="labelS" color={color.text.inverse}>{`${during.length} vente${during.length > 1 ? 's' : ''} · ${formatFC(amount)}`}</Text>
        </View>
        <Text variant="labelM" color={color.text.inverse}>
          Produit épinglé
        </Text>
        {pinned ? <LinkedProductRow product={pinned} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {item.productIds.map((pid) => {
            const p = byId(pid);
            if (!p) return null;
            const on = pid === live.pinnedProductId;
            return (
              <PressableScale
                key={pid}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Épingler ${p.name}`}
                onPress={() => dispatch({ type: 'content/livePin', id, productId: pid, at: stamp() })}
                scaleTo={pressScale.card}
                style={[styles.pinChip, on && styles.pinChipOn]}
              >
                <Text variant="labelS" color={on ? color.text.primary : color.text.inverse} numberOfLines={1}>
                  {p.name}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
        <Button label="Terminer le live" variant="destructive" onPress={() => setEnding(true)} fill />
      </View>
      <Sheet
        visible={ending}
        onClose={() => setEnding(false)}
        title="Terminer le live ?"
        footer={
          <View style={{ flex: 1, flexDirection: 'row', gap: space.md }}>
            <Button label="Continuer" variant="outline" onPress={() => setEnding(false)} style={{ flex: 1 }} />
            <Button label="Terminer" variant="destructive" onPress={end} style={{ flex: 1 }} />
          </View>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          Les commandes déjà passées restent en séquestre et se préparent depuis Commandes.
        </Text>
      </Sheet>
    </View>
  );
}

function LiveEnded({ id }: { id: string }) {
  const { state } = useSeller();
  const item = state.content.items[id]!;
  const live = item.live!;
  const minutes = Math.max(1, Math.round((new Date(live.endedAt!).getTime() - new Date(live.startedAt!).getTime()) / 60_000));
  return (
    <Screen>
      <TopAppBar title="Live terminé" />
      <Content>
        <View>
          <Text variant="h3">{live.title}</Text>
          <Text variant="bodyS" color={color.text.secondary}>{`${minutes} min · ${formatDayTime(live.startedAt!)}`}</Text>
        </View>
        <View style={styles.row}>
          <StatTile icon={Users} label="Spectateurs" value={String(live.viewers ?? 0)} />
          <StatTile icon={Eye} label="Pic en direct" value={String(live.peak ?? 0)} />
        </View>
        <View style={styles.row}>
          <StatTile icon={Package} label="Commandes" value={String(live.orders ?? 0)} />
          <StatTile icon={ShoppingCart} label="Ventes générées" value={formatFC(live.salesAmount ?? 0)} />
        </View>
        <Alert tone="info" title="Replay" body="Aucune vidéo n’a été enregistrée en mode démo : le replay sera proposé quand les lives passeront par le serveur YA YO." />
        {live.orders ? (
          <Alert tone="escrow" icon={ShieldCheck} title={`${live.orders} commande${live.orders > 1 ? 's' : ''} en séquestre`} body="Tu es payé à chaque livraison confirmée. Prépare-les depuis Commandes." />
        ) : null}
      </Content>
      <BottomBar>
        <Button label="Fermer" onPress={() => router.back()} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md },
  poster: { width: 96, height: 140, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  room: { flex: 1, backgroundColor: '#000' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  onAir: { backgroundColor: color.text.danger, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  demoBanner: { marginHorizontal: space.lg, marginTop: space.sm, backgroundColor: 'rgba(10,10,11,0.72)', borderRadius: radius.md, padding: space.md },
  roomBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.sm },
  salesPill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', backgroundColor: 'rgba(10,10,11,0.72)', borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 4 },
  pinChip: { borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: space.md, paddingVertical: space.xs, maxWidth: 200 },
  pinChipOn: { backgroundColor: color.bg.surface, borderColor: color.bg.surface },
});
