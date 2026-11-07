import { Redirect, router } from 'expo-router';
import { Clock, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authReduce, displayTarget, lockMinutesLeft, OTP_LENGTH, OTP_RESEND_AFTER_MS, type OtpChannel } from '@/domain/auth';
import { useStore } from '@/store/AppStore';
import { demoOtpCode } from '@/store/otpProvider';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { OtpInput } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { Alert, useCountdown, useToast } from '@/ui/Feedback';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic, PressableScale } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

const BY: Record<OtpChannel, string> = { sms: 'par SMS', call: 'par appel', email: 'par e-mail' };

type Feedback = { code: string; message: string } | null;

/** A6 · Code OTP and E8 · Code incorrect ou expiré. */
export default function CodeScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const c = state.auth.challenge;
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const resend = useCountdown(c && !c.lockedUntil ? new Date(new Date(c.sentAt).getTime() + OTP_RESEND_AFTER_MS).toISOString() : undefined);
  const lock = useCountdown(c?.lockedUntil);

  // Signed in or code consumed: the navigator moves on; nothing to verify here.
  if (!c) {
    if (state.auth.signup) return <Redirect href="/auth/profil" />;
    // Signed in or blocked: the root navigator is already switching screens.
    if (state.auth.session || state.auth.blocked) return null;
    return <Redirect href="/auth/connexion" />;
  }

  const locked = !!c.lockedUntil && lock.ms > 0;
  const lockEnded = !!c.lockedUntil && lock.ms === 0;
  const error = feedback && feedback.code !== 'RESENT';
  const canResend = (!locked && resend.ms === 0) || lockEnded;

  const verify = (value: string) => {
    if (busy || value.length !== OTP_LENGTH || locked) return;
    const action = { type: 'auth/verifyCode' as const, code: value, at: new Date().toISOString() };
    const r = authReduce(state.auth, action);
    setBusy(true);
    // Short check delay so the result never flashes; one verification at a time.
    setTimeout(() => {
      dispatch(action);
      setBusy(false);
      if (!r.ok) {
        haptic('warning');
        setFeedback({ code: r.code, message: r.message });
        return;
      }
      haptic('success');
      if (r.auth.signup) router.replace('/auth/profil');
      // Signed in or blocked: the root navigator switches screens by itself.
    }, 500);
  };

  const sendAgain = (channel: OtpChannel) => {
    const action = { type: 'auth/requestCode' as const, kind: c.kind, target: c.target, channel, code: demoOtpCode(), at: new Date().toISOString() };
    const r = authReduce(state.auth, action);
    if (!r.ok) {
      haptic('warning');
      toast(r.message, 'danger');
      return;
    }
    dispatch(action);
    setCode('');
    setFeedback({ code: 'RESENT', message: '' });
    toast(channel === 'call' ? 'Tu vas recevoir un appel avec ton code.' : 'Nouveau code envoyé.', 'success');
  };

  const target = displayTarget(c.kind, c.target);
  const title = error ? `Saisis le code reçu ${BY[c.channel]}` : c.kind === 'phone' ? 'Vérifie ton numéro' : 'Vérifie ton e-mail';

  return (
    <Screen>
      <TopAppBar
        title=""
        background={color.bg.canvas}
        onBack={() => {
          dispatch({ type: 'auth/cancelChallenge' });
          router.back();
        }}
      />
      <Content gap={space.xl} top={space.sm}>
        <View style={{ gap: space.sm }}>
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="bodyL" color={color.text.secondary}>
            {c.channel === 'call' ? `Appel en cours au ${target}.` : `Code envoyé ${BY[c.channel]} ${c.kind === 'phone' ? 'au' : 'à'} ${target}.`}
          </Text>
          {!error ? (
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={c.kind === 'phone' ? 'Modifier le numéro' : 'Modifier l’e-mail'}
              onPress={() => {
                dispatch({ type: 'auth/cancelChallenge' });
                router.back();
              }}
              hitSlop={8}
              scaleTo={pressScale.icon}
              style={{ alignSelf: 'flex-start' }}
            >
              <Text variant="labelM">{c.kind === 'phone' ? 'Modifier le numéro' : 'Modifier l’e-mail'}</Text>
            </PressableScale>
          ) : null}
        </View>

        <OtpInput
          value={code}
          error={!!error}
          disabled={locked || busy}
          onChange={(v) => {
            setCode(v);
            if (feedback) setFeedback(null);
            if (v.length === OTP_LENGTH) verify(v);
          }}
        />

        {error ? (
          <Alert
            tone="danger"
            title={feedback.code === 'EXPIRED' ? 'Code expiré' : locked ? 'Trop d’essais' : 'Code incorrect'}
            body={locked ? `Attends ${lockMinutesLeft(c, new Date().toISOString())} min avant de redemander un code.` : feedback.message.replace(/^Code incorrect\. /, '')}
          />
        ) : (
          <>
            {!canResend ? (
              <View style={styles.timer} accessibilityLiveRegion="polite">
                <Clock size={16} color={color.icon.secondary} strokeWidth={2} />
                <Text variant="bodyM" color={color.text.secondary}>
                  Renvoyer le code dans {resend.label}
                </Text>
              </View>
            ) : null}
            <Alert
              tone="info"
              title="Code non reçu ?"
              body={c.kind === 'phone' ? 'Vérifie ton réseau. Tu pourras demander un nouveau code ou un appel vocal.' : 'Regarde dans tes courriers indésirables. Tu pourras demander un nouveau code.'}
            />
          </>
        )}

        <View style={styles.demo} accessibilityLabel={`Mode démo. Ton code est ${c.code.split('').join(' ')}`}>
          <Text variant="caption" color={color.text.secondary}>
            MODE DÉMO · AUCUN MESSAGE N’EST ENVOYÉ
          </Text>
          <Text variant="labelL">Ton code : {c.code}</Text>
        </View>
      </Content>

      <BottomBar>
        {error || canResend ? (
          <>
            <Button
              label={locked ? `Nouveau code dans ${lock.label}` : 'Recevoir un nouveau code'}
              variant={error ? 'outline' : 'primary'}
              disabled={!canResend}
              onPress={() => sendAgain(c.kind === 'phone' ? 'sms' : 'email')}
              fill
            />
            {c.kind === 'phone' ? (
              <Button label="Recevoir le code par appel" variant="ghost" leadingIcon={Phone} disabled={!canResend} onPress={() => sendAgain('call')} fill />
            ) : null}
          </>
        ) : (
          <Button label="Vérifier" loading={busy} disabled={code.length !== OTP_LENGTH} haptic="medium" onPress={() => verify(code)} fill />
        )}
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  demo: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.strong,
    padding: space.md,
    gap: 2,
  },
});
