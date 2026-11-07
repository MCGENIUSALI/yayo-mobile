import { router, useLocalSearchParams } from 'expo-router';
import { FlaskConical, Lock, PackageCheck, PackageOpen, Store } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { plural } from '@/domain/format';
import { pickupCodeFor } from '@/domain/seller';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Commerce';
import { Alert, HeroIcon, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** V7 · Remise au livreur: the courier types the seller's code to confirm the pick-up. */
export default function HandOver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, dispatch } = useSeller();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const order = orders.find((o) => o.id === id);

  if (!order || order.seller === 'new' || order.seller === 'preparing') {
    return (
      <Screen>
        <TopAppBar title="Remise au livreur" background={color.bg.canvas} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            {order ? 'Marque d’abord la commande comme prête pour la collecte.' : 'Commande introuvable.'}
          </Text>
          <Button
            label={order ? 'Voir la commande' : 'Mes commandes'}
            onPress={() => (order ? router.replace({ pathname: '/vendeur/commande/[id]', params: { id: order.id } }) : router.navigate('/vendeur/commandes'))}
            fill
          />
        </Content>
      </Screen>
    );
  }

  const code = pickupCodeFor(order.id);
  const items = order.lines.reduce((n, l) => n + l.qty, 0);
  const done = order.seller === 'handed_over';

  if (done) {
    return (
      <Screen>
        <TopAppBar title="Remise au livreur" background={color.bg.canvas} onBack={() => router.navigate('/vendeur/commandes')} />
        <View style={styles.done}>
          <HeroIcon icon={PackageCheck} bg={color.bg.successSubtle} fg={color.icon.success} />
          <Text variant="h2" align="center" accessibilityRole="header">
            Colis remis
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            {order.courier?.name ?? 'Le livreur'} a confirmé la collecte de #{order.id}. Ton paiement est libéré dès que l’acheteur confirme la réception.
          </Text>
        </View>
        <BottomBar>
          <Button label="Retour aux commandes" haptic="light" onPress={() => router.navigate('/vendeur/commandes')} fill />
        </BottomBar>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopAppBar title="Remise au livreur" background={color.bg.canvas} />
      <Content gap={space.lg} top={space.sm}>
        <View style={styles.between}>
          <Text variant="labelL">Commande #{order.id}</Text>
          <Badge label={order.delivery === 'picking_up' ? 'En collecte' : 'Livreur assigné'} icon={Store} tone="accent" />
        </View>

        {order.courier ? (
          <View style={styles.courier}>
            <Avatar initials={order.courier.initials} verified />
            <View style={{ flex: 1 }}>
              <Text variant="labelL">{order.courier.name} arrive</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {order.courier.vehicle} · Livreur vérifié · à 4 min
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.code}>
          <View style={styles.inline}>
            <Lock size={18} color={color.icon.accent} strokeWidth={2} />
            <Text variant="labelM" color={color.text.accent}>
              Code de remise
            </Text>
          </View>
          <View style={styles.digits} accessible accessibilityLabel={`Code de remise : ${code.split('').join(' ')}`}>
            {code.split('').map((d, i) => (
              <View key={i} style={styles.digit}>
                <Text variant="code">{d}</Text>
              </View>
            ))}
          </View>
          <Text variant="bodyS" color={color.text.secondary} align="center">
            Le livreur saisit ce code pour confirmer la collecte. Ne remets le colis qu’à lui.
          </Text>
        </View>

        <Alert tone="info" icon={PackageOpen} title="Vérifie avant de remettre" body={`Colis fermé, étiquette #${order.id} collée, ${plural(items, 'article', 'articles')}.`} />

        <View style={styles.demo}>
          <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
          <Text variant="bodyS" color={color.text.secondary} style={{ flex: 1 }}>
            Démo : le bouton ci-dessous joue le livreur qui saisit le code dans son app.
          </Text>
        </View>
      </Content>
      <BottomBar>
        <Button
          label="Le livreur a récupéré le colis"
          variant="outline"
          haptic="success"
          loading={busy}
          onPress={() => {
            setBusy(true);
            setTimeout(() => {
              dispatch({ type: 'seller/demoCourierPickup', orderId: order.id });
              setBusy(false);
              haptic('success');
              toast('Collecte confirmée par le livreur.', 'success');
            }, 600);
          }}
          fill
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  courier: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.bg.surface, borderRadius: radius.lg, padding: space.lg },
  code: {
    backgroundColor: color.bg.accentSubtle,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.accent,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  digits: { flexDirection: 'row', gap: 10 },
  digit: { width: 52, height: 60, borderRadius: radius.md, backgroundColor: color.bg.surface, alignItems: 'center', justifyContent: 'center' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.screen },
});
