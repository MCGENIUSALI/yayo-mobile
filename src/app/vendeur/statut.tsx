import { router } from 'expo-router';
import { Clock, FileCheck, FlaskConical, ShieldCheck, Store } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { formatDay } from '@/domain/format';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { HeroIcon, TimelineStep, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';
import { useSwitchMode } from '@/store/useSwitchMode';


const validatedLabel = (iso: string) => {
  const d = formatDay(iso);
  return d === 'Aujourd’hui' || d === 'Hier' ? `Validée ${d.toLowerCase()}` : `Validée le ${d}`;
};

/** V3 · Vérification en cours (étape 3 sur 3), also the "Vérification d’identité" row of V12. */
export default function ShopStatus() {
  const { shop, dispatch } = useSeller();
  const toast = useToast();
  const switchTo = useSwitchMode();

  if (!shop || shop.status === 'draft') {
    return (
      <Screen>
        <TopAppBar title="Ma boutique" background={color.bg.canvas} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Ton dossier n’a pas encore été envoyé.
          </Text>
          <Button label={shop ? 'Terminer ma vérification' : 'Ouvrir ma boutique'} onPress={() => router.replace(shop ? '/vendeur/verification' : '/vendeur/creer')} fill />
        </Content>
      </Screen>
    );
  }

  const verified = shop.status === 'verified';
  return (
    <Screen>
      <TopAppBar title="" background={color.bg.canvas} onBack={() => (router.canGoBack() ? router.back() : switchTo('seller', '/vendeur/tableau'))} />
      <Content gap={space.xl} top={space.lg}>
        <View style={styles.hero}>
          <HeroIcon icon={verified ? ShieldCheck : Clock} bg={verified ? color.bg.successSubtle : color.bg.warningSubtle} fg={verified ? color.icon.success : color.icon.warning} />
          <Text variant="h2" align="center" accessibilityRole="header">
            {verified ? 'Ta boutique est vérifiée' : 'Ta boutique est en cours de vérification'}
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            {verified
              ? 'Tes produits en ligne sont visibles par les acheteurs et tu reçois tes paiements sur ton compte Mobile Money.'
              : 'Notre équipe valide ton dossier sous 24 à 48 h. Tu peux déjà préparer ton catalogue : il sera publié dès la validation.'}
          </Text>
          <Badge label={verified ? validatedLabel(shop.verifiedAt!) : 'En attente de validation'} tone={verified ? 'success' : 'warning'} />
        </View>

        <View>
          <TimelineStep title="Boutique créée" description={shop.profile.name} state="done" icon={Store} />
          <TimelineStep title="Vérification des documents" description={verified ? 'Validée' : 'En cours'} state={verified ? 'done' : 'current'} icon={FileCheck} />
          <TimelineStep title="Boutique publiée" description="Visible par les acheteurs" state={verified ? 'done' : 'upcoming'} icon={Clock} last />
        </View>

        {!verified ? (
          <View style={styles.demo}>
            <View style={styles.demoTitle}>
              <FlaskConical size={16} color={color.icon.secondary} strokeWidth={2} />
              <Text variant="labelS" color={color.text.secondary}>
                Mode démo · l’équipe YA YO valide les dossiers
              </Text>
            </View>
            <Button
              label="Simuler la validation"
              variant="outline"
              size="M"
              haptic="success"
              onPress={() => {
                dispatch({ type: 'seller/demoApprove' });
                toast('Boutique validée (démo).', 'success');
              }}
              fill
            />
          </View>
        ) : null}
      </Content>
      <BottomBar>
        <Button label={verified ? 'Aller à mon tableau de bord' : 'Ajouter mes premiers produits'} haptic="medium" onPress={() => switchTo('seller', verified ? '/vendeur/tableau' : '/vendeur/produits')} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  demo: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.border.strong, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  demoTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
