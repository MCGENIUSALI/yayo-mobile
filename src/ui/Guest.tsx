import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { color, space } from '@/theme/tokens';
import { Button } from './Button';
import { HeroIcon } from './Feedback';
import { Text } from './Text';

/**
 * A10 · A tab that needs an account, seen by a guest: says what it will hold
 * and offers to sign in. Never a dead end: the guest can keep browsing.
 */
export function GuestPrompt({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <View style={styles.box}>
      <HeroIcon icon={icon} bg={color.bg.surfaceSunken} fg={color.icon.secondary} animate={false} />
      <Text variant="h4" align="center">
        {title}
      </Text>
      <Text variant="bodyM" color={color.text.secondary} align="center">
        {body}
      </Text>
      <Button label="Se connecter ou s’inscrire" haptic="medium" onPress={() => router.push('/auth/connexion')} fill />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: space.md, paddingTop: space.screen * 2, paddingHorizontal: space.screen },
});
