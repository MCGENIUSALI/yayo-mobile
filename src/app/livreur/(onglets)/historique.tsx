import { History } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { finishedAt, missionPay, missionTab } from '@/domain/courier';
import { formatDay } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useCourier, openMission } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { HistoryRow } from '@/ui/Courier';
import { Segmented } from '@/ui/Form';
import { EmptyState } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

type Filter = 'all' | 'delivered' | 'failed';

/** Historique: every finished mission, by day (the "Filtrer" of L11). */
export default function CourierHistory() {
  const { missions } = useCourier();
  const [filter, setFilter] = useState<Filter>('all');
  const done = missions.filter((o) => missionTab(o) === 'done' && (filter === 'all' || o.delivery === filter));
  const days: { day: string; items: typeof done }[] = [];
  for (const o of done) {
    const day = formatDay(finishedAt(o) ?? o.milestones.createdAt);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(o);
    else days.push({ day, items: [o] });
  }
  const total = done.reduce((t, o) => t + missionPay(o), 0);

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Historique" subtitle={`${done.length} mission${done.length > 1 ? 's' : ''} · ${formatFC(total)}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Segmented<Filter>
          options={[
            { value: 'all', label: 'Toutes' },
            { value: 'delivered', label: 'Livrées' },
            { value: 'failed', label: 'Échecs' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {days.length ? (
          days.map((d) => (
            <View key={d.day} style={{ gap: space.sm }}>
              <Text variant="labelM" color={color.text.secondary}>
                {d.day}
              </Text>
              <View style={styles.list}>
                {d.items.map((o) => (
                  <HistoryRow key={o.id} order={o} onPress={() => openMission(o)} />
                ))}
              </View>
            </View>
          ))
        ) : (
          <EmptyState icon={History} title="Rien pour l’instant" body={filter === 'failed' ? 'Aucune livraison en échec.' : 'Tes missions terminées apparaîtront ici.'} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  list: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
});
