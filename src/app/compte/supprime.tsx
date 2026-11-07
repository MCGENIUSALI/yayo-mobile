import { router } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { HeroIcon } from '@/ui/Feedback';
import { BottomBar, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';

/** D12 · Compte supprimé. The visitor can keep browsing as a guest. */
export default function AccountDeleted() {
  return (
    <Screen>
      <View style={styles.center}>
        <HeroIcon icon={CircleCheck} bg={color.bg.successSubtle} fg={color.icon.success} />
        <Text variant="h2" align="center" accessibilityRole="header">
          Ton compte est supprimé
        </Text>
        <Text variant="bodyL" color={color.text.secondary} align="center">
          Tes données personnelles ont été effacées. Merci d’avoir utilisé YA YO. Tu peux revenir quand tu veux avec un nouveau compte.
        </Text>
      </View>
      <BottomBar bordered={false} background={color.bg.canvas}>
        <Button label="Revenir à l’accueil" onPress={() => router.navigate('/')} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.screen },
});
