import { router } from 'expo-router';
import { BadgeCheck, Clock, FileCheck, FlaskConical, Send, ShieldCheck, UserCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { requiredDocs } from '@/domain/courier';
import { formatDay } from '@/domain/format';
import { useCourier } from '@/store/useCourier';
import { useSwitchMode } from '@/store/useSwitchMode';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, HeroIcon, TimelineStep, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** L3 · Validation en attente, also "Documents KYC" of L14. */
export default function CourierStatus() {
  const { space: courier, dispatch } = useCourier();
  const toast = useToast();
  const switchTo = useSwitchMode();
  const home = () => switchTo('courier', '/livreur/accueil');

  if (!courier || courier.status === 'draft') {
    return (
      <Screen>
        <TopAppBar title="Devenir livreur" onBack={home} />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Ton dossier n’a pas encore été envoyé.
          </Text>
          <Button label={courier ? 'Envoyer mes documents' : 'Devenir livreur'} onPress={() => router.replace(courier ? '/livreur/documents' : '/livreur/inscription')} fill />
        </Content>
      </Screen>
    );
  }

  const verified = courier.status === 'verified';
  const docs = requiredDocs(courier.profile.transport).filter((d) => courier.docs[d.key]).length;
  const sent = courier.submittedAt ? formatDay(courier.submittedAt) : '';

  return (
    <Screen>
      <TopAppBar title="" background={color.bg.canvas} onBack={() => (router.canGoBack() ? router.back() : home())} />
      <Content gap={space.xl} top={space.sm}>
        <View style={styles.hero}>
          <HeroIcon icon={verified ? BadgeCheck : UserCheck} bg={verified ? color.bg.successSubtle : color.bg.warningSubtle} fg={verified ? color.icon.success : color.icon.warning} />
          <Text variant="h2" align="center" accessibilityRole="header">
            {verified ? 'Ton compte livreur est activé' : 'Ton dossier est en cours de validation'}
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            {verified
              ? 'Active ta disponibilité depuis l’accueil : les missions proches de ta zone te sont proposées.'
              : 'Un administrateur YA YO vérifie tes documents sous 48 h. Tu recevras une notification dès que tu pourras accepter des missions.'}
          </Text>
        </View>

        <View>
          <TimelineStep title="Dossier envoyé" description={`${sent} · ${docs} document${docs > 1 ? 's' : ''}`} state="done" icon={Send} />
          <TimelineStep
            title="Vérification par un administrateur"
            description={verified && courier.verifiedAt ? `Validée ${formatDay(courier.verifiedAt).replace(/^(\d)/, 'le $1').toLowerCase()}` : 'En cours'}
            state={verified ? 'done' : 'current'}
            icon={FileCheck}
          />
          <TimelineStep title="Compte livreur activé" description="Tu peux te mettre disponible" state={verified ? 'done' : 'upcoming'} icon={ShieldCheck} last />
        </View>

        {!verified ? (
          <>
            <Alert tone="warning" icon={Clock} title="Document refusé ?" body="Si une pièce est illisible, tu pourras la remplacer depuis cet écran." />
            <Button label="Remplacer un document" variant="ghost" size="M" onPress={() => router.push('/livreur/documents')} />
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
                  dispatch({ type: 'courier/demoApprove' });
                  toast('Compte livreur validé (démo).', 'success');
                }}
                fill
              />
            </View>
          </>
        ) : null}
      </Content>
      <BottomBar>
        {verified ? (
          <Button label="Aller à l’accueil livreur" haptic="medium" onPress={home} fill />
        ) : (
          <Button label="Contacter le support" variant="outline" onPress={() => toast('Le support YA YO sera joignable ici une fois le serveur branché.')} fill />
        )}
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingTop: space.xl },
  demo: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.border.strong, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  demoTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
