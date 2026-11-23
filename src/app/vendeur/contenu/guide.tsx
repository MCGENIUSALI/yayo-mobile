import { router } from 'expo-router';
import { Ban, CircleCheck, CircleHelp, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme/tokens';
import { Alert } from '@/ui/Feedback';
import { Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const GOOD = [
  { title: 'Montre le produit en usage', body: 'Le son, la taille, la matière : ce qu’une photo ne montre pas' },
  { title: 'Lie le bon produit', body: 'Le produit montré est celui lié, au même prix' },
  { title: 'Vertical et bien éclairé', body: 'Format 9:16, lumière du jour, 15 à 60 secondes' },
  { title: 'Rassure sur la livraison', body: 'Rappelle que le paiement est protégé jusqu’à la réception' },
];
const FORBIDDEN = [
  { title: 'Numéros et liens externes', body: 'Masqués automatiquement et signalés' },
  { title: 'Paiement hors application', body: 'Mobile Money direct ou cash avant livraison' },
  { title: 'Produits interdits ou contrefaits', body: 'Voir la liste dans les conditions vendeur' },
  { title: 'Prix ou photos trompeurs', body: 'Le produit livré doit correspondre au contenu' },
];

/** SV10 · Guide qualité. */
export default function QualityGuide() {
  return (
    <Screen>
      <TopAppBar title="Guide qualité" />
      <Content>
        <Group title="Ce qui fait vendre" icon={CircleCheck} items={GOOD} />
        <Group title="Interdit sur YA YO" icon={Ban} items={FORBIDDEN} />
        <PressableScale accessibilityRole="link" onPress={() => router.push('/aide')}>
          <Alert tone="info" icon={CircleHelp} title="Un doute avant de publier ?" body="Écris au support depuis le Centre d’aide." />
        </PressableScale>
      </Content>
    </Screen>
  );
}

function Group({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: { title: string; body: string }[] }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {items.map((i, n) => (
          <View key={i.title} style={[styles.row, n > 0 && styles.divider]}>
            <View style={styles.icon}>
              <Icon size={20} color={color.icon.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelL">{i.title}</Text>
              <Text variant="bodyS" color={color.text.secondary}>
                {i.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.bg.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: color.border.subtle },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});
