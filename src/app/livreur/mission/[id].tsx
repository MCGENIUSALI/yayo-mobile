import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, CircleX, FlaskConical, Headset, Navigation, Phone, Share2, Store, TriangleAlert, Bike } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { getShop } from '@/domain/catalog';
import { cashToCollect, dropoffLine, etaMinutes, incidentLabel, missionPay, missionStage, parcelCount, COURIER_BASE_PAY } from '@/domain/courier';
import { formatDayTime, plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { pickupCodeFor } from '@/domain/seller';
import { useCourier } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { Chip, CodeInput, RouteStops } from '@/ui/Courier';
import { Alert, useToast } from '@/ui/Feedback';
import { BottomBar, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';
import { TrackingMap } from '@/ui/TrackingMap';

const toMissions = () => router.navigate('/livreur/missions');

/** L5 · Collecte chez le vendeur, L6 · En livraison; also the proposed mission ("Voir la carte") and a failed one. */
export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { missions, pickup, dispatch, state } = useCourier();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [code, setCode] = useState('');
  const [tried, setTried] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const order = missions.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen>
        <TopAppBar title="Mission" onBack={toMissions} />
        <View style={styles.center}>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            Cette mission n’est plus la tienne : elle a peut-être été confiée à un autre livreur.
          </Text>
          <Button label="Mes missions" onPress={toMissions} />
        </View>
      </Screen>
    );
  }

  const stage = missionStage(order);
  const shop = getShop(order.shopId);
  const m = order.mission!;
  const cash = cashToCollect(order);
  const wrongCode = tried !== null && state.lastError?.at === tried && state.lastError.code === 'WRONG_PICKUP_CODE';

  const header = (
    <TopAppBar
      title={`Mission #${m.id}`}
      onBack={() => (router.canGoBack() ? router.back() : toMissions())}
      action={{ icon: Share2, label: 'Partager la mission', onPress: () => Share.share({ message: `Mission YA YO #${m.id} · ${shop.name} → ${order.buyer?.commune ?? 'Kinshasa'}` }).catch(() => undefined) }}
    />
  );

  const accept = () => {
    dispatch({ type: 'courier/orderEvent', orderId: order.id, event: { type: 'courier.accept' } });
    haptic('success');
    toast('Mission acceptée. Rends-toi chez le vendeur.', 'success');
  };

  const collect = () => {
    const at = new Date().toISOString();
    setTried(at);
    dispatch({ type: 'courier/orderEvent', orderId: order.id, event: { type: 'courier.collect', code }, at });
    // The domain decides; the UI only reflects the outcome on the next render.
    if (code.toUpperCase() === pickupCodeFor(order.id)) {
      haptic('success');
      toast('Collecte confirmée. En route vers le client.', 'success');
      setCode('');
    } else {
      haptic('warning');
    }
  };

  const arrive = () => {
    dispatch({ type: 'courier/orderEvent', orderId: order.id, event: { type: 'courier.arrive' } });
    haptic('medium');
    router.push({ pathname: '/livreur/remise/[id]', params: { id: order.id } });
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (stage === 'proposed') {
    body = (
      <>
        <View style={styles.between}>
          <Text variant="h3">{plural(parcelCount(order), 'colis', 'colis')} à livrer</Text>
          <Badge label="Proposée" tone="accent" />
        </View>
        <RouteStops order={order} pickup={pickup(order)} />
        <View style={styles.chips}>
          <Chip icon={Navigation} label={`${m.distanceKm.toLocaleString('fr-FR')} km · ${etaMinutes(m.distanceKm)} min`} />
          {cash ? <Chip icon={Banknote} label={`Cash à encaisser : ${formatFC(cash)}`} tone="warning" /> : null}
        </View>
        <View style={styles.card}>
          <SummaryRow label="Ta rémunération" value={formatFC(missionPay(order))} />
          <Text variant="bodyS" color={color.text.secondary}>
            {formatFC(COURIER_BASE_PAY)} + 500 FC par km. Payée chaque lundi sur ton compte Mobile Money.
          </Text>
        </View>
      </>
    );
    footer = (
      <BottomBar direction="row">
        <Button
          label="Refuser"
          variant="secondary"
          onPress={() => {
            dispatch({ type: 'courier/decline', orderId: order.id });
            toast('Mission refusée : elle est proposée à un autre livreur.');
            toMissions();
          }}
        />
        <Button label="Accepter la mission" variant="accent" haptic="success" onPress={accept} style={styles.flex} />
      </BottomBar>
    );
  } else if (stage === 'pickup') {
    body = (
      <>
        <View style={styles.between}>
          <Text variant="h4" style={styles.flex} numberOfLines={1}>
            Collecte · {shop.name}
          </Text>
          <Badge label="En collecte" icon={Store} tone="warning" />
        </View>
        <Text variant="bodyM" color={color.text.secondary}>
          {pickup(order)} · {plural(parcelCount(order), 'colis', 'colis')}
        </Text>
        <View style={styles.codeCard}>
          <Text variant="labelM" align="center">
            Code de remise donné par le vendeur
          </Text>
          <CodeInput length={4} kind="alnum" value={code} onChange={setCode} error={wrongCode} label="Code de remise à 4 caractères" />
          {wrongCode ? (
            <Text variant="bodyS" color={color.text.danger} align="center" accessibilityLiveRegion="polite">
              Code incorrect. Demande au vendeur le code affiché sur son écran.
            </Text>
          ) : null}
        </View>
        <View style={styles.demo}>
          <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="bodyS" color={color.text.secondary} style={styles.flex}>
            Mode démo · le vendeur te donne le code {pickupCodeFor(order.id)} (il le voit dans son app, écran « Remise au livreur »).
          </Text>
        </View>
      </>
    );
    footer = (
      <BottomBar>
        <Button label="Confirmer la collecte" haptic="medium" disabled={code.length < 4} onPress={collect} fill />
        <Button label="Signaler un problème" variant="ghost" size="M" leadingIcon={TriangleAlert} onPress={() => setHelp(true)} fill />
      </BottomBar>
    );
  } else if (stage === 'delivery' || stage === 'handover') {
    body = (
      <>
        <View style={styles.between}>
          <Text variant="h4" style={styles.flex} numberOfLines={1}>
            Livraison · {order.buyer?.name ?? 'Client'}
          </Text>
          <Badge label="En livraison" icon={Bike} tone="info" />
        </View>
        <Text variant="bodyM" color={color.text.secondary}>
          {dropoffLine(order)}
          {order.courierNote ? ` · ${order.courierNote}` : ''}
        </Text>
        <View style={styles.actions}>
          <Button label="Appeler (masqué)" variant="secondary" size="M" leadingIcon={Phone} onPress={() => toast('Appel via YA YO : numéro du client masqué (simulation).')} style={styles.soft} />
          <Button
            label="Itinéraire"
            variant="secondary"
            size="M"
            leadingIcon={Navigation}
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dropoffLine(order)}, Kinshasa`)}`).catch(() => toast('Impossible d’ouvrir la carte.', 'danger'))}
            style={styles.soft}
          />
        </View>
        {cash ? (
          <Alert tone="warning" icon={Banknote} title={`Cash à encaisser : ${formatFC(cash)}`} body="Paiement à la livraison. Encaisse le montant exact avant de remettre le colis." />
        ) : (
          <Alert tone="info" title="Déjà payé" body="Le client a payé par Mobile Money : ne demande pas d’argent." />
        )}
      </>
    );
    footer = (
      <BottomBar>
        <Button
          label={stage === 'handover' ? 'Continuer la remise' : 'Je suis arrivé'}
          haptic="medium"
          onPress={stage === 'handover' ? () => router.push({ pathname: '/livreur/remise/[id]', params: { id: order.id } }) : arrive}
          fill
        />
      </BottomBar>
    );
  } else {
    // Finished mission opened from the history.
    const failed = stage === 'failed';
    body = (
      <>
        <View style={styles.between}>
          <Text variant="h4">{failed ? 'Livraison en échec' : 'Colis livré'}</Text>
          <Badge label={failed ? 'Échec' : 'Livrée'} icon={failed ? CircleX : undefined} tone={failed ? 'danger' : 'success'} />
        </View>
        <RouteStops order={order} pickup={pickup(order)} />
        {failed && order.incident ? (
          <Alert
            tone="info"
            title={`Motif : ${incidentLabel(order.incident.reason).short}`}
            body={`Déclaré ${formatDayTime(order.incident.at).toLowerCase()}. YA YO a prévenu le client et décide de la suite : nouvelle tentative, retour au vendeur ou remboursement.`}
          />
        ) : null}
        <View style={styles.card}>
          <SummaryRow label={failed ? 'Ta rémunération (tarif de base)' : 'Ta rémunération'} value={formatFC(missionPay(order))} />
          {order.cashCollected ? <SummaryRow label="Cash encaissé" value={formatFC(order.total)} /> : null}
        </View>
      </>
    );
    footer = (
      <BottomBar>
        <Button label="Mes missions" variant="outline" onPress={toMissions} fill />
      </BottomBar>
    );
  }

  return (
    <Screen>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TrackingMap status={order.delivery} width={width} />
        <View style={styles.content}>{body}</View>
      </ScrollView>
      {footer}
      <Sheet visible={help} onClose={() => setHelp(false)} title="Un problème à la collecte ?">
        <Text variant="bodyM" color={color.text.secondary}>
          Le vendeur est absent, le colis n’est pas prêt ou le code ne marche pas : appelle le vendeur ou le support. Ne pars jamais sans avoir saisi le code.
        </Text>
        <Button label="Appeler le vendeur (masqué)" variant="outline" leadingIcon={Phone} onPress={() => { setHelp(false); toast('Appel via YA YO : numéro du vendeur masqué (simulation).'); }} fill />
        <Button label="Contacter le support" variant="outline" leadingIcon={Headset} onPress={() => { setHelp(false); toast('Le support YA YO sera joignable ici une fois le serveur branché.'); }} fill />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.screen },
  content: { paddingHorizontal: space.screen, paddingTop: space.xl, paddingBottom: space.xl, gap: space.lg },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  codeCard: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.md },
  soft: { flex: 1 },
});
