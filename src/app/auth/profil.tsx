import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authReduce, CITIES, displayTarget, initialsOf, profileError } from '@/domain/auth';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Checkbox, SelectField, StepLabel } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** A7 · Créer mon profil (step 1 of 2, after the code proved the phone or e-mail). */
export default function CreateProfile() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const signup = state.auth.signup;
  const [name, setName] = useState('');
  const [city, setCity] = useState('Kinshasa');
  const [commune, setCommune] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!signup) {
    if (state.auth.session) return null;
    return <Redirect href="/auth/connexion" />;
  }

  const profile = { name, city, commune: commune ?? '', email: signup.kind === 'phone' ? email : undefined, acceptTerms: terms };
  const error = profileError(profile);

  const submit = () => {
    setTouched(true);
    if (error) {
      haptic('warning');
      toast(error, 'danger');
      return;
    }
    const action = { type: 'auth/createAccount' as const, profile, at: new Date().toISOString() };
    const r = authReduce(state.auth, action);
    if (!r.ok) {
      haptic('warning');
      toast(r.message, 'danger');
      return;
    }
    haptic('success');
    dispatch(action);
    // The session now exists: the navigator opens A8.
  };

  const cancel = () => {
    dispatch({ type: 'auth/cancelChallenge' });
    router.replace('/auth/connexion');
  };

  return (
    <Screen>
      <TopAppBar title="Créer ton compte" onBack={cancel} background={color.bg.canvas} />
      <Content gap={space.lg} top={space.xs}>
        <StepLabel>Étape 1 sur 2 · Nouveau compte</StepLabel>

        <View style={styles.photoRow}>
          <View style={styles.avatar} accessibilityLabel={`Initiales ${initialsOf(name || '?')}`}>
            <Text variant="h3" color={color.text.accent}>
              {name.trim() ? initialsOf(name) : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelM">Photo de profil</Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Optionnelle · aide les livreurs à te reconnaître. Tu pourras l’ajouter depuis ton profil.
            </Text>
          </View>
        </View>

        <TextField
          label="Nom complet"
          value={name}
          onChangeText={setName}
          placeholder="Prénom et nom"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          error={touched && name.trim().length < 2 ? 'Indique ton nom complet.' : undefined}
        />
        <SelectField
          label="Ville"
          value={city}
          placeholder="Choisis ta ville"
          options={Object.keys(CITIES)}
          onChange={(v) => {
            setCity(v);
            if (commune && !CITIES[v]?.includes(commune)) setCommune(undefined);
          }}
        />
        <SelectField label="Commune" value={commune} placeholder="Choisis ta commune" options={CITIES[city] ?? []} onChange={setCommune} />
        {touched && !commune ? (
          <Text variant="bodyS" color={color.text.danger}>
            Choisis ta commune : elle sert à estimer la livraison.
          </Text>
        ) : null}

        {signup.kind === 'phone' ? (
          <TextField
            label="Email (optionnel)"
            value={email}
            onChangeText={setEmail}
            placeholder="nom@exemple.cd"
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        ) : (
          <View style={{ gap: space.xs }}>
            <Text variant="labelM">Email</Text>
            <Text variant="bodyL" color={color.text.secondary}>
              {displayTarget('email', signup.target)} · vérifié
            </Text>
          </View>
        )}

        <Checkbox checked={terms} onChange={setTerms} label="J’accepte les Conditions d’utilisation et la Politique de confidentialité." />
      </Content>
      <BottomBar>
        <Button label="Continuer" haptic="medium" onPress={submit} fill />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.bg.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
