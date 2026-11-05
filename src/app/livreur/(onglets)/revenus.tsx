import { router } from 'expo-router';
import { ChevronRight, Package, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { earnings, missionPay, payoutOperator, periodStart, type EarningsPeriod } from '@/domain/courier';
import { trend } from '@/domain/seller';
import { formatFC } from '@/domain/money';
import { useCourier, openMission } from '@/store/useCourier';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { HistoryRow, SectionHead } from '@/ui/Courier';
import { Segmented } from '@/ui/Form';
import { Divider } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState, StatTile, TrendPill } from '@/ui/Seller';
import { Text } from '@/ui/Text';
import { LargeTitleBar } from '@/ui/TopAppBar';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function periodLabel(period: EarningsPeriod, now: string): string {
  const start = periodStart(period, now);
  if (period === 'day') return 'Aujourd’hui';
  if (period === 'month') return `${MONTHS[start.getMonth()]!.replace(/^./, (c) => c.toUpperCase())} ${start.getFullYear()}`;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `Semaine du ${start.getDate()} au ${end.getDate()} ${SHORT[end.getMonth()]}`
    : `Semaine du ${start.getDate()} ${SHORT[start.getMonth()]} au ${end.getDate()} ${SHORT[end.getMonth()]}`;
}

const VS: Record<EarningsPeriod, string> = { day: 'vs hier', week: 'vs sem. dernière', month: 'vs mois dernier' };

/** L11 · Revenus et historique. */
export default function CourierEarnings() {
  const { space: courier, missions } = useCourier();
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const now = new Date().toISOString();

  if (courier?.status !== 'verified') {
    return (
      <View style={styles.screen}>
        <LargeTitleBar title="Revenus" />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState icon={Wallet} title="Pas encore de revenus" body="Tu es payé à chaque mission, une fois ton compte validé." />
        </ScrollView>
      </View>
    );
  }

  const e = earnings(missions, period, now);
  const t = trend(e.gains, e.previousGains);
  const deliveredPay = e.items.filter((o) => o.delivery === 'delivered').reduce((s, o) => s + missionPay(o), 0);
  const failedPay = e.gains - deliveredPay;

  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Revenus" subtitle={periodLabel(period, now)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Segmented<EarningsPeriod>
          options={[
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <View style={styles.tiles}>
          <StatTile
            icon={Wallet}
            label="Gains"
            value={formatFC(e.gains)}
            footer={t !== null ? <TrendPill tone={t >= 0 ? 'up' : 'down'} value={`${t >= 0 ? '+' : '−'}${Math.abs(t)} %`} suffix={VS[period]} /> : null}
          />
          <StatTile icon={Package} label="Missions" value={String(e.missions)} />
        </View>

        <View style={styles.card}>
          <SummaryRow label={`Livraisons (${e.delivered})`} value={formatFC(deliveredPay)} />
          {e.failed ? <SummaryRow label={`Échecs (${e.failed}) · tarif de base`} value={formatFC(failedPay)} /> : null}
          <Divider />
          <View style={styles.total}>
            <Text variant="labelL" style={{ flex: 1 }}>
              Versé le lundi sur {payoutOperator(courier)}
            </Text>
            <Text variant="priceL" numberOfLines={1} adjustsFontSizeToFit>
              {formatFC(e.gains)}
            </Text>
          </View>
          <Text variant="bodyS" color={color.text.secondary}>
            3 000 FC par course + 500 FC par km. Une course en échec est payée au tarif de base.
          </Text>
        </View>

        <SectionHead
          title="Historique"
          action={
            <PressableScale accessibilityRole="link" onPress={() => router.navigate('/livreur/historique')} hitSlop={8} scaleTo={pressScale.icon} style={styles.link}>
              <Text variant="labelM" color={color.text.accent}>
                Filtrer
              </Text>
              <ChevronRight size={16} color={color.icon.accent} strokeWidth={2} />
            </PressableScale>
          }
        />
        {e.items.length ? (
          <View style={styles.list}>
            {e.items.slice(0, 5).map((o) => (
              <HistoryRow key={o.id} order={o} onPress={() => openMission(o)} />
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text variant="bodyM" color={color.text.secondary}>
              Aucune mission terminée sur cette période.
            </Text>
          </View>
        )}
        {e.items.length > 5 ? <Button label="Voir tout l’historique" variant="ghost" size="M" onPress={() => router.navigate('/livreur/historique')} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.screen, paddingTop: space.sm, gap: space.lg },
  tiles: { flexDirection: 'row', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  total: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  list: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
});
