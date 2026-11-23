import { router } from 'expo-router';
import { Banknote, CircleCheck, FlaskConical, MapPin, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DEPOSIT_POINT, payoutOperator, remitDeadline, type RemitChannel } from '@/domain/courier';
import { formatDayTime, formatTime, plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { maskPhone } from '@/domain/seller';
import { useCourier } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { SectionHead } from '@/ui/Courier';
import { Alert, HeroIcon, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { MenuRow } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** L10 · Cash à reverser. */
export default function CashToPayBack() {
  const { space: courier, due, dispatch } = useCourier();
  const toast = useToast();
  const [sheet, setSheet] = useState<RemitChannel | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date().toISOString();

  if (!courier || courier.status !== 'verified') {
    return (
      <Screen>
        <TopAppBar title="Cash à reverser" />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Ton compte livreur doit être validé.
          </Text>
        </Content>
      </Screen>
    );
  }

  const remit = (channel: RemitChannel) => {
    setBusy(true);
    // The Mobile Money / counter confirmation takes a moment, as in C4.
    setTimeout(() => {
      dispatch({ type: 'courier/remitCash', channel });
      setBusy(false);
      setSheet(null);
      haptic('success');
      toast(`${formatFC(due.amount)} reversés à YA YO. Merci !`, 'success');
    }, 900);
  };

  const last = courier.remittances.at(-1);
  if (due.amount === 0) {
    return (
      <Screen>
        <TopAppBar title="Cash à reverser" />
        <Content gap={space.lg} top={space.screen * 2}>
          <View style={styles.hero}>
            <HeroIcon icon={CircleCheck} bg={color.bg.successSubtle} fg={color.icon.success} />
            <Text variant="h2" align="center">
              Rien à reverser
            </Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              {last
                ? `Dernier versement : ${formatFC(last.amount)} ${last.channel === 'mobile_money' ? 'par Mobile Money' : 'au point de dépôt'}, ${formatDayTime(last.at).toLowerCase()}.`
                : 'Le cash des livraisons payées à la livraison apparaîtra ici.'}
            </Text>
          </View>
        </Content>
        <BottomBar>
          <Button label="Retour à l’accueil" onPress={() => router.navigate('/livreur/accueil')} fill />
        </BottomBar>
      </Screen>
    );
  }

  const late = now > remitDeadline(now);
  return (
    <Screen>
      <TopAppBar title="Cash à reverser" />
      <Content gap={space.lg} top={space.sm}>
        <View style={styles.total} accessible accessibilityLabel={`Cash encaissé à reverser à YA YO : ${formatFC(due.amount)}`}>
          <Text variant="bodyM" color={color.text.warning}>
            Cash encaissé à reverser à YA YO
          </Text>
          <Text variant="display">{formatFC(due.amount)}</Text>
          <Text variant="bodyS" color={color.text.secondary}>
            {plural(due.orders.length, 'livraison', 'livraisons')} · {late ? 'à reverser dès que possible' : 'à reverser avant ce soir 20h'}
          </Text>
        </View>
        {late ? <Alert tone="danger" title="Délai de 20h dépassé" body="Reverse ce cash dès maintenant, par Mobile Money ou au point de dépôt." /> : null}

        <SectionHead title="Détail" />
        <View style={styles.list}>
          {due.orders.map((o) => (
            <View key={o.id} style={styles.row}>
              <View style={styles.icon}>
                <Banknote size={20} color={color.icon.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="labelL" numberOfLines={1}>
                  #{o.id} · {o.buyer?.name ?? 'Client'}
                </Text>
                <Text variant="bodyS" color={color.text.secondary}>
                  Livrée {formatTime(o.milestones.deliveredAt!)}
                </Text>
              </View>
              <Text variant="labelM">{formatFC(o.total)}</Text>
            </View>
          ))}
        </View>

        <SectionHead title="Comment reverser ?" />
        <View style={styles.menu}>
          <MenuRow icon={Smartphone} title="Dépôt Mobile Money" subtitle="Vers le compte marchand YA YO" onPress={() => setSheet('mobile_money')} />
          <MenuRow icon={MapPin} title={DEPOSIT_POINT.name} subtitle={`${DEPOSIT_POINT.address} · ${DEPOSIT_POINT.hours}`} onPress={() => setSheet('deposit_point')} />
        </View>
      </Content>
      <BottomBar>
        <Button label="Reverser par Mobile Money" haptic="medium" onPress={() => setSheet('mobile_money')} fill />
      </BottomBar>

      <Sheet
        visible={sheet === 'mobile_money'}
        onClose={() => !busy && setSheet(null)}
        title="Dépôt Mobile Money"
        footer={<Button label={`Reverser ${formatFC(due.amount)}`} haptic="medium" loading={busy} onPress={() => remit('mobile_money')} style={{ flex: 1 }} />}
      >
        <View style={styles.sheet}>
          <SummaryRow label="Montant" value={formatFC(due.amount)} />
          <SummaryRow label="Depuis" value={`${payoutOperator(courier)} · ${maskPhone(courier.profile.payoutPhone)}`} />
          <SummaryRow label="Vers" value="Compte marchand YA YO" />
          <Text variant="bodyS" color={color.text.secondary}>
            Démo : le dépôt est accepté tout de suite. Dans l’app publiée, tu valides avec ton code PIN Mobile Money.
          </Text>
        </View>
      </Sheet>
      <Sheet visible={sheet === 'deposit_point'} onClose={() => !busy && setSheet(null)} title={DEPOSIT_POINT.name}>
        <View style={styles.sheet}>
          <Text variant="bodyM">
            {DEPOSIT_POINT.address} · ouvert {DEPOSIT_POINT.hours}. Donne le montant exact au guichet : l’agent YA YO valide le dépôt dans ton app.
          </Text>
          <View style={styles.demo}>
            <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
            <Text variant="bodyS" color={color.text.secondary} style={{ flex: 1 }}>
              Mode démo · le bouton joue l’agent du guichet.
            </Text>
          </View>
          <Button label="Simuler le dépôt au guichet" variant="outline" loading={busy} onPress={() => remit('deposit_point')} fill />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md },
  total: { backgroundColor: color.bg.warningSubtle, borderRadius: radius.lg, padding: space.xl, gap: space.xs },
  list: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  menu: { backgroundColor: color.bg.surface, borderRadius: radius.lg, overflow: 'hidden' },
  sheet: { gap: space.md, paddingBottom: space.sm },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
