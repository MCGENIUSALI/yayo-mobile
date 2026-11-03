import { Bike, ShoppingBag, Store } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { RoleCard, StepLabel } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';

type Choice = 'buyer' | 'seller' | 'courier';

const CTA: Record<Choice, string> = {
  buyer: 'Commencer mes achats',
  seller: 'Demander l’accès vendeur',
  courier: 'Demander l’accès livreur',
};

/**
 * A8 · Choix du profil (step 2 of 2). Buyer is immediate; seller and courier
 * are requests that YA YO validates (shop check, KYC): the app never grants a
 * role by itself, as on the dashboard.
 */
export default function ChooseRole() {
  const { dispatch } = useStore();
  const toast = useToast();
  const [role, setRole] = useState<Choice>('buyer');

  return (
    <Screen>
      <Content topInset top={space.xl} gap={space.lg}>
        <StepLabel>Étape 2 sur 2</StepLabel>
        <View style={{ gap: space.sm }}>
          <Text variant="h1" accessibilityRole="header">
            Comment veux-tu utiliser YA YO ?
          </Text>
          <Text variant="bodyL" color={color.text.secondary}>
            Tu pourras ajouter un autre profil plus tard depuis ton compte.
          </Text>
        </View>
        <View style={{ gap: space.md }} accessibilityRole="radiogroup">
          <RoleCard icon={ShoppingBag} title="Acheteur" body="J’achète des produits et je suis mes livraisons." selected={role === 'buyer'} onPress={() => setRole('buyer')} />
          <RoleCard
            icon={Store}
            title="Vendeur"
            body="Je vends mes articles et je suis mes revenus."
            badge="Vérification boutique requise"
            selected={role === 'seller'}
            onPress={() => setRole('seller')}
          />
          <RoleCard
            icon={Bike}
            title="Livreur"
            body="Je livre des colis et je suis payé par mission."
            badge="KYC + validation admin"
            selected={role === 'courier'}
            onPress={() => setRole('courier')}
          />
        </View>
        {role !== 'buyer' ? (
          <Text variant="bodyS" color={color.text.secondary}>
            Ta demande part à l’équipe YA YO. En attendant sa validation, tu peux déjà acheter.
          </Text>
        ) : null}
      </Content>
      <BottomBar>
        <Button
          label={CTA[role]}
          haptic="success"
          onPress={() => {
            dispatch({ type: 'auth/chooseRole', role });
            if (role !== 'buyer') toast('Demande envoyée. Tu suis sa validation dans ton profil.', 'success');
          }}
          fill
        />
      </BottomBar>
    </Screen>
  );
}
