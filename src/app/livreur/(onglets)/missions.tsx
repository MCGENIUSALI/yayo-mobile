import { router } from 'expo-router';
import { Bike, CircleCheck, Inbox } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { missionStage, missionTab, type MissionTab } from '@/domain/courier';
import { formatTime } from '@/domain/format';
import { useCourier, openMission } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ActiveMissionCard, HistoryRow, MissionRow, ProposalCard } from '@/ui/Courier';
import { useToast } from '@/ui/Feedback';
import { Segmented } from '@/ui/Form';
import { haptic } from '@/ui/Pressable';
import { EmptyState } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

/** L13 · Mes missions: en cours, proposées, terminées. */
export default function Missions() {
  const { space: courier, missions, pickup, dispatch } = useCourier();
  const toast = useToast();
  const [tab, setTab] = useState<MissionTab>('active');
  const by = (t: MissionTab) => missions.filter((o) => missionTab(o) === t);
  const active = by('active');
  const proposed = by('proposed');
  const done = by('done');

  if (courier?.status !== 'verified') {
    return (
      <View style={styles.screen}>
        <LargeTitleBar title="Missions" />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState icon={Bike} title="Pas encore de missions" body="Les missions arrivent une fois ton compte livreur validé par l’équipe YA YO." action={<Button label="Voir mon inscription" variant="outline" onPress={() => router.navigate('/livreur/accueil')} />} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Missions" subtitle={`${active.length} en cours · ${proposed.length} proposée${proposed.length > 1 ? 's' : ''}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Segmented<MissionTab>
          options={[
            { value: 'active', label: 'En cours' },
            { value: 'proposed', label: 'Proposées' },
            { value: 'done', label: 'Terminées' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'active' ? (
          active.length ? (
            <>
              <ActiveMissionCard order={active[0]!} pickup={pickup(active[0]!)} stage={missionStage(active[0]!) as 'pickup' | 'delivery' | 'handover'} onOpen={() => openMission(active[0]!)} />
              {active.length > 1 ? (
                <View style={styles.group}>
                  <Text variant="caption" color={color.text.secondary} style={styles.overline}>
                    ENSUITE
                  </Text>
                  {active.slice(1).map((o) => (
                    <MissionRow key={o.id} order={o} caption={`Acceptée à ${formatTime(o.milestones.acceptedAt ?? o.mission!.proposedAt)}`} onPress={() => openMission(o)} />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="Aucune mission en cours"
              body={courier.available ? 'Accepte une mission proposée pour commencer.' : 'Active ta disponibilité depuis l’accueil pour recevoir des missions.'}
              action={proposed.length ? <Button label="Voir les missions proposées" variant="outline" onPress={() => setTab('proposed')} /> : undefined}
            />
          )
        ) : null}

        {tab === 'proposed' ? (
          proposed.length ? (
            proposed.map((o) => (
              <ProposalCard
                key={o.id}
                order={o}
                pickup={pickup(o)}
                onOpen={() => openMission(o)}
                onDecline={() => {
                  dispatch({ type: 'courier/decline', orderId: o.id });
                  toast('Mission refusée : elle est proposée à un autre livreur.');
                }}
                onAccept={() => {
                  dispatch({ type: 'courier/orderEvent', orderId: o.id, event: { type: 'courier.accept' } });
                  haptic('success');
                  router.push({ pathname: '/livreur/mission/[id]', params: { id: o.id } });
                }}
              />
            ))
          ) : (
            <EmptyState icon={Inbox} title="Aucune mission proposée" body={courier.available ? 'Tu es prévenu dès qu’un colis est prêt près de toi.' : 'Tu es indisponible : active-toi depuis l’accueil.'} />
          )
        ) : null}

        {tab === 'done' ? (
          done.length ? (
            <View style={styles.list}>
              {done.map((o) => (
                <HistoryRow key={o.id} order={o} onPress={() => openMission(o)} />
              ))}
            </View>
          ) : (
            <EmptyState icon={CircleCheck} title="Aucune mission terminée" body="Tes livraisons apparaîtront ici." />
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  group: { gap: space.sm, backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingTop: space.lg, paddingHorizontal: space.xs },
  overline: { letterSpacing: 0.6, paddingHorizontal: space.md },
  list: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
});
