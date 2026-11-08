import { router } from 'expo-router';
import { CircleAlert, CircleCheck, CircleX, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { blockerText, DELETE_REASONS } from '@/domain/account';
import { authReduce, currentAccount, displayTarget } from '@/domain/auth';
import { deletionBlockers } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { isServerMode } from '@/lib/supabase';
import { demoOtpCode } from '@/store/otpProvider';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, HeroIcon, useToast } from '@/ui/Feedback';
import { Chip, Section } from '@/ui/Form';
import { BottomBar, Card, Content, Screen } from '@/ui/Layout';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const DELETED = [
  'Ton profil, ton numéro et ton e-mail',
  'Tes adresses, ton panier et tes favoris',
  'Ta discussion avec le support',
  'Ta boutique et ton dossier livreur, si tu en as',
];
const KEPT = ['Tes commandes passées, sans ton nom, pour la comptabilité des vendeurs'];

/** D9 · Supprimer mon compte, and D10 · Suppression impossible pour l’instant. */
export default function DeleteAccountScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const account = currentAccount(state.auth);
  const [reason, setReason] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const blockers = deletionBlockers(state);

  if (!account) return null;

  // D10: shown once the buyer asked to continue while something is still running.
  if (checked && blockers.length) {
    return (
      <Screen>
        <TopAppBar title="Supprimer mon compte" />
        <Content gap={space.xl}>
          <View style={styles.hero}>
            <HeroIcon icon={CircleAlert} bg={color.bg.warningSubtle} fg={color.icon.warning} />
            <Text variant="h3" align="center" accessibilityRole="header">
              Pas encore possible
            </Text>
            <Text variant="bodyM" color={color.text.secondary} align="center">
              Ton compte a encore une activité en cours. On la termine d’abord pour protéger ton argent et celui des autres.
            </Text>
          </View>
          {blockers.map((b, i) => {
            const t = blockerText(b);
            return <Alert key={i} tone="warning" title={t.title} body={t.body} />;
          })}
        </Content>
        <BottomBar>
          {blockers.some((b) => b.kind === 'order' || b.kind === 'dispute' || b.kind === 'refund') ? (
            <Button label="Voir mes commandes" onPress={() => router.navigate('/commandes')} fill />
          ) : null}
          {blockers.some((b) => b.kind === 'shop' || b.kind === 'courier') ? (
            <Button label="Contacter le support" variant="outline" onPress={() => router.push('/aide/discussion')} fill />
          ) : null}
          <Button label="Garder mon compte" variant="ghost" onPress={() => router.back()} fill />
        </BottomBar>
      </Screen>
    );
  }

  const kind = account.phone ? ('phone' as const) : ('email' as const);
  const target = (account.phone ?? account.email)!;

  const proceed = () => {
    if (blockers.length) {
      setChecked(true);
      return;
    }
    if (isServerMode()) {
      // Not on the server yet: no code is sent and nothing is deleted.
      toast('La suppression du compte n’est pas encore ouverte sur le serveur YA YO.', 'neutral');
      return;
    }
    const action = {
      type: 'auth/requestCode' as const,
      kind,
      target,
      channel: kind === 'phone' ? ('sms' as const) : ('email' as const),
      code: demoOtpCode(),
      at: new Date().toISOString(),
      purpose: 'delete' as const,
    };
    const r = authReduce(state.auth, action);
    if (!r.ok) {
      toast(r.message, 'danger');
      return;
    }
    dispatch(action);
    router.push('/compte/confirmer-suppression');
  };

  return (
    <Screen>
      <TopAppBar title="Supprimer mon compte" />
      <Content gap={space.xl}>
        <View style={styles.hero}>
          <HeroIcon icon={Trash2} bg={color.bg.dangerSubtle} fg={color.icon.danger} />
          <Text variant="h3" align="center" accessibilityRole="header">
            Tu nous quittes ?
          </Text>
          <Text variant="bodyM" color={color.text.secondary} align="center">
            La suppression est définitive. Tu ne pourras pas récupérer ton compte.
          </Text>
        </View>

        <Card gap={space.sm}>
          <Text variant="labelL">Ce qui est supprimé</Text>
          {DELETED.map((t) => (
            <Line key={t} icon={CircleX} tint={color.icon.danger} text={t} />
          ))}
          <Text variant="labelL" style={{ marginTop: space.sm }}>
            Ce qui est gardé
          </Text>
          {KEPT.map((t) => (
            <Line key={t} icon={CircleCheck} tint={color.icon.success} text={t} />
          ))}
        </Card>

        <Section title="Pourquoi pars-tu ? (facultatif)">
          <View style={styles.chips}>
            {DELETE_REASONS.map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
            ))}
          </View>
        </Section>

        <Text variant="bodyS" color={color.text.secondary}>
          {`Pour confirmer, on t’envoie un code ${kind === 'phone' ? 'au' : 'à'} ${displayTarget(kind, target)}.`}
        </Text>
      </Content>
      <BottomBar>
        <Button label="Continuer" variant="destructive" haptic="warning" onPress={proceed} fill />
        <Button label="Garder mon compte" variant="ghost" onPress={() => router.back()} fill />
      </BottomBar>
    </Screen>
  );
}

function Line({ icon: Icon, tint, text }: { icon: typeof CircleX; tint: string; text: string }) {
  return (
    <View style={styles.line}>
      <Icon size={18} color={tint} strokeWidth={2} />
      <Text variant="bodyM" color={color.text.secondary} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderRadius: radius.sm },
});
