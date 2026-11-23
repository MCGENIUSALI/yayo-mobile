import { router } from 'expo-router';
import { Banknote, Bike, ChevronRight, Clock, Power, Wallet } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { earnings, missionStage, missionTab } from '@/domain/courier';
import { formatFC } from '@/domain/money';
import { useCourier, openMission } from '@/store/useCourier';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ActiveMissionCard, AvailabilityCard, ProposalCard, SectionHead } from '@/ui/Courier';
import { Alert, useToast } from '@/ui/Feedback';
import { BottomBar } from '@/ui/Layout';
import { haptic, PressableScale } from '@/ui/Pressable';
import { EmptyState, StatTile } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

/** L4 · Accueil · Disponible, L12 · Accueil · Indisponible. */
export default function CourierHome() {
  const { account, space, missions, due, pickup, dispatch } = useCourier();
  const toast = useToast();
  const now = new Date().toISOString();
  const firstName = account?.name.split(' ')[0] ?? '';
  const verified = space?.status === 'verified';
  const active = missions.filter((o) => missionTab(o) === 'active');
  const proposed = missions.filter((o) => missionTab(o) === 'proposed');
  const today = earnings(missions, 'day', now);
  const week = earnings(missions, 'week', now);

  const header = <LargeTitleBar title={`Bonjour ${firstName}`} subtitle={verified ? `Livreur vérifié · ${space.profile.zones[0] ?? ''}` : 'Livreur'} />;

  if (!space || space.status === 'draft' || space.status === 'submitted') {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          {space?.status === 'submitted' ? (
            <PressableScale accessibilityRole="link" onPress={() => router.push('/livreur/statut')} scaleTo={pressScale.card}>
              <Alert tone="info" icon={Clock} title="Dossier en cours de validation" body="Un administrateur YA YO vérifie tes documents sous 48 h. Touche pour suivre ton dossier." />
            </PressableScale>
          ) : null}
          <EmptyState
            icon={Bike}
            title={space?.status === 'submitted' ? 'Bientôt tes premières missions' : space ? 'Termine ton inscription' : 'Livre avec YA YO'}
            body={
              space?.status === 'submitted'
                ? 'Dès que ton compte est validé, active ta disponibilité pour recevoir des missions près de chez toi.'
                : space
                  ? 'Il reste à envoyer tes documents pour que l’équipe YA YO valide ton compte.'
                  : 'Dis-nous comment tu te déplaces et où tu livres, puis envoie tes documents. Tu es payé à chaque mission.'
            }
            action={
              space?.status === 'submitted' ? (
                <Button label="Suivre mon dossier" variant="outline" onPress={() => router.push('/livreur/statut')} />
              ) : (
                <Button label={space ? 'Envoyer mes documents' : 'Devenir livreur'} onPress={() => router.push(space ? '/livreur/documents' : '/livreur/inscription')} />
              )
            }
          />
        </ScrollView>
      </View>
    );
  }

  const setAvailable = (v: boolean) => {
    dispatch({ type: 'courier/setAvailable', available: v });
    toast(v ? 'Tu es disponible : les missions proches te sont proposées.' : 'Tu ne reçois plus de missions.', v ? 'success' : 'neutral');
  };

  const activeCards = active.map((o, i) =>
    i === 0 ? (
      <ActiveMissionCard key={o.id} order={o} pickup={pickup(o)} stage={missionStage(o) as 'pickup' | 'delivery' | 'handover'} onOpen={() => openMission(o)} />
    ) : (
      <PressableScale key={o.id} accessibilityRole="link" onPress={() => openMission(o)} scaleTo={pressScale.card} style={styles.next}>
        <Text variant="labelM" style={{ flex: 1 }}>
          Ensuite · #{o.mission!.id}
        </Text>
        <ChevronRight size={18} color={color.icon.secondary} strokeWidth={2} />
      </PressableScale>
    ),
  );

  if (!space.available) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <AvailabilityCard available={false} onChange={setAvailable} />
          {active.length ? (
            <>
              <Text variant="bodyS" color={color.text.secondary}>
                Termine tes missions en cours : elles restent à toi.
              </Text>
              {activeCards}
            </>
          ) : null}
          <EmptyState
            icon={Power}
            title="Tu ne reçois pas de missions"
            body={`Gains de la semaine : ${formatFC(week.gains)}.${due.amount ? ' Pense à reverser ton cash avant ce soir.' : ''}`}
            action={due.amount ? <Button label={`Reverser ${formatFC(due.amount)}`} variant="outline" leadingIcon={Banknote} onPress={() => router.push('/livreur/cash')} /> : undefined}
          />
        </ScrollView>
        <BottomBar>
          <Button label="Me rendre disponible" haptic="success" onPress={() => setAvailable(true)} fill />
        </BottomBar>
      </View>
    );
  }

  const offer = proposed[0];
  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AvailabilityCard available onChange={setAvailable} />
        <View style={styles.tiles}>
          <StatTile icon={Wallet} label="Gains du jour" value={formatFC(today.gains)} />
          <PressableScale accessibilityRole="link" accessibilityLabel={`Cash à reverser : ${formatFC(due.amount)}`} onPress={() => router.push('/livreur/cash')} scaleTo={pressScale.card} style={styles.flex}>
            <StatTile icon={Banknote} label="Cash à reverser" value={formatFC(due.amount)} />
          </PressableScale>
        </View>

        {activeCards}

        <SectionHead
          title="Nouvelle mission"
          action={
            offer ? (
              <PressableScale accessibilityRole="link" onPress={() => openMission(offer)} hitSlop={8} scaleTo={pressScale.icon} style={styles.link}>
                <Text variant="labelM" color={color.text.accent}>
                  Voir la carte
                </Text>
                <ChevronRight size={16} color={color.icon.accent} strokeWidth={2} />
              </PressableScale>
            ) : undefined
          }
        />
        {offer ? (
          <ProposalCard
            key={offer.id}
            order={offer}
            pickup={pickup(offer)}
            onOpen={() => openMission(offer)}
            onDecline={() => {
              dispatch({ type: 'courier/decline', orderId: offer.id });
              toast('Mission refusée : elle est proposée à un autre livreur.');
            }}
            onAccept={() => {
              dispatch({ type: 'courier/orderEvent', orderId: offer.id, event: { type: 'courier.accept' } });
              haptic('success');
              router.push({ pathname: '/livreur/mission/[id]', params: { id: offer.id } });
            }}
          />
        ) : (
          <View style={styles.quiet}>
            <Text variant="bodyM" color={color.text.secondary}>
              Aucune mission proposée pour l’instant. Reste disponible : tu es prévenu dès qu’un colis est prêt près de toi.
            </Text>
          </View>
        )}
        {proposed.length > 1 ? (
          <Button label={`Voir les ${proposed.length} missions proposées`} variant="ghost" size="M" onPress={() => router.navigate('/livreur/missions')} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row', gap: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  quiet: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  next: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
});
