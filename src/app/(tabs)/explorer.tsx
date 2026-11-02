import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { HeroIcon } from '@/ui/Feedback';
import { LargeTitleBar } from '@/ui/TopAppBar';
import { Text } from '@/ui/Text';

/** Explorer (B2/B3/E3–E5) is part of the P1 discovery increment. No dead end meanwhile. */
export default function ExplorerScreen() {
  return (
    <View style={styles.screen}>
      <LargeTitleBar title="Explorer" />
      <View style={styles.body}>
        <HeroIcon icon={Search} bg={color.bg.surfaceSunken} fg={color.icon.secondary} animate={false} />
        <Text variant="h4" align="center">
          Recherche et catégories
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center">
          La recherche avec filtres arrive avec le fil de découverte. En attendant, retrouve la sélection du moment sur l’accueil.
        </Text>
        <Button label="Voir la sélection" variant="outline" onPress={() => router.navigate('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.screen },
});
