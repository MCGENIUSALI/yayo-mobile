import type { Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useRequireAccount } from '@/store/useRequireAccount';
import { color, space } from '@/theme/tokens';
import { Button } from './Button';
import { EmptyState } from './Seller';
import { LargeTitleBar } from './TopAppBar';

/** A buyer tab that needs an account (Commandes, Alertes, Profil), seen by a guest. */
export function GuestTab({ title, icon, heading, body, resume }: { title: string; icon: LucideIcon; heading: string; body: string; resume: Href }) {
  const requireAccount = useRequireAccount();
  return (
    <View style={styles.screen}>
      <LargeTitleBar title={title} />
      <View style={styles.body}>
        <EmptyState
          icon={icon}
          title={heading}
          body={body}
          action={<Button label="Se connecter ou s’inscrire" onPress={() => requireAccount(resume)} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.screen, paddingBottom: space.xl * 2 },
});
