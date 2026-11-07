import { router, useLocalSearchParams } from 'expo-router';
import { PackageCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { missionPay } from '@/domain/courier';
import { formatTime } from '@/domain/format';
import { formatFC } from '@/domain/money';
import { useCourier } from '@/store/useCourier';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { SummaryRow } from '@/ui/Commerce';
import { HeroIcon } from '@/ui/Feedback';
import { BottomBar, Content, Divider, Screen } from '@/ui/Layout';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';

/** L8 · Livraison confirmée. */
export default function Delivered() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { missions, due } = useCourier();
  const order = missions.find((o) => o.id === id);
  const home = () => router.navigate('/livreur/accueil');

  if (!order || order.delivery !== 'delivered') {
    return (
      <Screen>
        <Content topInset>
          <Text variant="bodyM" color={color.text.secondary}>
            Cette livraison n’est pas encore confirmée.
          </Text>
          <Button label="Mes missions" onPress={() => router.navigate('/livreur/missions')} fill />
        </Content>
      </Screen>
    );
  }

  return (
    <Screen>
      <Content topInset top={space.screen * 2} gap={space.xl}>
        <View style={styles.hero}>
          <HeroIcon icon={PackageCheck} bg={color.bg.successSubtle} fg={color.icon.success} />
          <Text variant="h2" align="center" accessibilityRole="header">
            Colis livré !
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            Mission #{order.mission!.id} terminée à {formatTime(order.milestones.deliveredAt!)}.
          </Text>
          <Badge label="Livrée" icon={PackageCheck} tone="success" />
        </View>
        <View style={styles.card}>
          <SummaryRow label="Ta rémunération" value={`+ ${formatFC(missionPay(order))}`} />
          {order.cashCollected ? <SummaryRow label="Cash encaissé" value={formatFC(order.total)} /> : null}
          <Divider />
          <SummaryRow label="Cash à reverser" value={formatFC(due.amount)} type="total" />
        </View>
      </Content>
      <BottomBar>
        <Button label="Voir les missions disponibles" haptic="light" onPress={home} fill />
        {due.amount ? <Button label="Reverser mon cash" variant="outline" onPress={() => router.push('/livreur/cash')} fill /> : null}
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md },
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
});
