import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authReduce, displayTarget, lockMinutesLeft, OTP_LENGTH, OTP_RESEND_AFTER_MS } from '@/domain/auth';
import { useStore } from '@/store/AppStore';
import { demoOtpCode } from '@/store/otpProvider';
import { color, radius, space } from '@/theme/tokens';
import { OtpInput } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { Alert, useCountdown, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** D11 · Confirme la suppression: the account's own code, same rules as A6. */
export default function ConfirmDeletion() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const c = state.auth.challenge?.purpose === 'delete' ? state.auth.challenge : undefined;
  const [code, setCode] = useState('');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useCountdown(c && !c.lockedUntil ? new Date(new Date(c.sentAt).getTime() + OTP_RESEND_AFTER_MS).toISOString() : undefined);
  const lock = useCountdown(c?.lockedUntil);

  const leave = () => {
    dispatch({ type: 'auth/cancelChallenge' });
    router.back();
  };

  if (!c) {
    return (
      <Screen>
        <TopAppBar title="Confirmer la suppression" />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Demande d’abord un code depuis « Supprimer mon compte ».
          </Text>
        </Content>
      </Screen>
    );
  }

  const locked = !!c.lockedUntil && lock.ms > 0;

  const confirm = (value: string) => {
    if (busy || value.length !== OTP_LENGTH || locked) return;
    const action = { type: 'auth/deleteAccount' as const, code: value, at: new Date().toISOString() };
    const r = authReduce(state.auth, action);
    setBusy(true);
    setTimeout(() => {
      dispatch(action);
      setBusy(false);
      if (!r.ok) {
        haptic('warning');
        setError({ code: r.code, message: r.message });
        return;
      }
      haptic('success');
      // Signed out: the root navigator shows D12 by itself.
    }, 500);
  };

  const sendAgain = () => {
    const action = {
      type: 'auth/requestCode' as const,
      kind: c.kind,
      target: c.target,
      channel: c.channel === 'email' ? ('email' as const) : ('sms' as const),
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
    setCode('');
    setError(null);
    toast('Nouveau code envoyé.', 'success');
  };

  return (
    <Screen>
      <TopAppBar title="Confirmer la suppression" onBack={leave} />
      <Content gap={space.xl}>
        <View style={{ gap: space.sm }}>
          <Text variant="h2" accessibilityRole="header">
            Saisis ton code
          </Text>
          <Text variant="bodyL" color={color.text.secondary}>
            {`Code envoyé ${c.kind === 'phone' ? 'par SMS au' : 'par e-mail à'} ${displayTarget(c.kind, c.target)}. Ton compte sera supprimé dès que le code est validé.`}
          </Text>
        </View>
        <OtpInput
          value={code}
          error={!!error}
          disabled={locked || busy}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
        />
        {error ? (
          <Alert
            tone="danger"
            title={error.code === 'EXPIRED' ? 'Code expiré' : locked ? 'Trop d’essais' : 'Code incorrect'}
            body={locked ? `Attends ${lockMinutesLeft(c, new Date().toISOString())} min avant de redemander un code.` : error.message.replace(/^Code incorrect\. /, '')}
          />
        ) : null}
        <View style={styles.demo} accessibilityLabel={`Mode démo. Ton code est ${c.code.split('').join(' ')}`}>
          <Text variant="caption" color={color.text.secondary}>
            MODE DÉMO · AUCUN MESSAGE N’EST ENVOYÉ
          </Text>
          <Text variant="labelL">Ton code : {c.code}</Text>
        </View>
      </Content>
      <BottomBar>
        <Button
          label="Supprimer définitivement"
          variant="destructive"
          haptic="warning"
          loading={busy}
          disabled={code.length !== OTP_LENGTH || locked}
          onPress={() => confirm(code)}
          fill
        />
        <Button
          label={resend.ms > 0 ? `Renvoyer le code dans ${resend.label}` : 'Recevoir un nouveau code'}
          variant="ghost"
          disabled={resend.ms > 0 && !c.lockedUntil}
          onPress={sendAgain}
          fill
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  demo: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.strong,
    padding: space.md,
    gap: 2,
  },
});
