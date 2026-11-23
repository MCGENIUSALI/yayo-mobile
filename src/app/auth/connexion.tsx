import { router } from 'expo-router';
import { Globe, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authReduce, emailError, normalizeEmail, normalizePhone, phoneError, resendWaitSeconds, type IdentifierKind } from '@/domain/auth';
import { formatLocalMsisdn } from '@/domain/paymentProvider';
import { useStore } from '@/store/AppStore';
import { isServerMode } from '@/lib/supabase';
import { demoOtpCode } from '@/store/otpProvider';
import { sendCode } from '@/store/serverAuth';
import { color, space } from '@/theme/tokens';
import { Logo, OrDivider } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { Segmented, TextField } from '@/ui/Form';
import { Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { IconButton } from '@/ui/TopAppBar';

/** A5 · Connexion ou inscription: one screen for both, a code instead of a password. */
export default function SignIn() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<IdentifierKind>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const value = kind === 'phone' ? phone : email;
  const error = kind === 'phone' ? phoneError(phone) : emailError(email);
  const reason = state.auth.signedOutReason;

  const submit = () => {
    setTouched(true);
    if (error || sending) {
      if (error) haptic('warning');
      return;
    }
    const target = kind === 'phone' ? normalizePhone(phone)! : normalizeEmail(email)!;
    const at = new Date().toISOString();
    const channel = kind === 'phone' ? ('sms' as const) : ('email' as const);
    if (isServerMode()) {
      // A code already sent to this identity is still valid: go back to it instead of sending another.
      const c = state.auth.challenge;
      if (c?.server && c.target === target && resendWaitSeconds(c, at) > 0) {
        router.push('/auth/code');
        return;
      }
      setSending(true);
      void sendCode(kind, target, channel).then((r) => {
        setSending(false);
        if (!r.ok) {
          haptic('warning');
          toast(r.message, 'danger');
          return;
        }
        dispatch({ type: 'auth/serverCodeSent', kind, target, channel, at: new Date().toISOString() });
        router.push('/auth/code');
      });
      return;
    }
    const action = { type: 'auth/requestCode' as const, kind, target, channel, code: demoOtpCode(), at };
    const r = authReduce(state.auth, action);
    if (!r.ok) {
      // A code already sent to this identity is still valid: go back to it instead of failing.
      if ((r.code === 'TOO_SOON' || r.code === 'LOCKED') && state.auth.challenge?.target === target) {
        router.push('/auth/code');
        return;
      }
      haptic('warning');
      toast(r.message, 'danger');
      return;
    }
    // Short "sending" state: one tap, one code (no duplicate submissions).
    setSending(true);
    setTimeout(() => {
      dispatch(action);
      setSending(false);
      router.push('/auth/code');
    }, 600);
  };

  return (
    <Screen>
      <Content topInset top={space.xl} gap={space.xl} style={styles.grow}>
        <View style={styles.head}>
          <Logo />
          {/* Opened from A9 or A10: the guest can go back to browsing. */}
          {router.canGoBack() ? <IconButton icon={X} label="Fermer, continuer sans compte" onPress={() => router.back()} /> : null}
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="h1" accessibilityRole="header">
            Connexion ou inscription
          </Text>
          <Text variant="bodyL" color={color.text.secondary}>
            {kind === 'phone'
              ? 'Entre ton numéro : on t’envoie un code par SMS. Pas de mot de passe à retenir.'
              : 'Entre ton e-mail : on t’envoie un code. Pas de mot de passe à retenir.'}
          </Text>
        </View>

        {reason ? (
          <Alert
            tone="info"
            title={reason === 'expired' ? 'Ta session a expiré' : 'Tu as été déconnecté'}
            body={reason === 'expired' ? 'Par sécurité, reconnecte-toi avec un nouveau code.' : 'Ton compte est en cours d’examen. Contacte le support YA YO.'}
          />
        ) : null}

        <Segmented
          options={[
            { value: 'phone', label: 'Téléphone' },
            { value: 'email', label: 'Email' },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setTouched(false);
          }}
        />

        <View style={{ gap: space.xs }}>
          {kind === 'phone' ? (
            <TextField
              key="phone"
              label="Numéro de téléphone"
              prefix="phone-cd"
              value={phone}
              onChangeText={(t) => setPhone(formatLocalMsisdn(t))}
              placeholder="81 234 5678"
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="send"
              onSubmitEditing={submit}
              error={touched && value ? (error ?? undefined) : undefined}
              autoFocus
            />
          ) : (
            <TextField
              key="email"
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="nom@exemple.cd"
              keyboardType="email-address"
              inputMode="email"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={submit}
              error={touched && value ? (error ?? undefined) : undefined}
              autoFocus
            />
          )}
          {kind === 'phone' && !(touched && value && error) ? (
            <Text variant="bodyS" color={color.text.tertiary}>
              Vodacom, Orange, Airtel ou Africell
            </Text>
          ) : null}
        </View>

        <Button label="Recevoir le code" loading={sending} disabled={!value} haptic="medium" onPress={submit} fill />
        <OrDivider />
        <Button
          label="Continuer avec Google"
          variant="outline"
          leadingIcon={Globe}
          onPress={() => toast('La connexion Google arrive avec le serveur YA YO. Utilise ton numéro ou ton e-mail.')}
          fill
        />

        <View style={styles.spacer} />
        <Text variant="bodyS" color={color.text.tertiary} align="center">
          En continuant, tu acceptes les Conditions d’utilisation et la Politique de confidentialité de YA YO.
        </Text>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grow: { flexGrow: 1 },
  spacer: { flexGrow: 1, minHeight: space.xl },
});
