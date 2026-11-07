import { Ban, MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { HeroIcon, useToast } from '@/ui/Feedback';
import { BottomBar, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';

/** E9 · Compte suspendu: no session is opened; escrow keeps protecting orders in progress. */
export default function Suspended() {
  const { dispatch } = useStore();
  const toast = useToast();
  return (
    <Screen>
      <View style={styles.body}>
        <HeroIcon icon={Ban} bg={color.bg.dangerSubtle} fg={color.icon.danger} />
        <Text variant="h3" align="center" accessibilityRole="header">
          Ton compte est suspendu
        </Text>
        <Text variant="bodyM" color={color.text.secondary} align="center">
          Suite à plusieurs litiges, ton compte est en cours d’examen. Tes commandes en cours restent protégées par le séquestre.
        </Text>
      </View>
      <BottomBar>
        <Button
          label="Contacter le support"
          leadingIcon={MessageCircle}
          onPress={() => toast('Le contact du support sera branché avec le serveur YA YO.')}
          fill
        />
        <Button label="Utiliser un autre numéro" variant="ghost" onPress={() => dispatch({ type: 'auth/leaveBlocked' })} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.screen },
});
