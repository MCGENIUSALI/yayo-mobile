import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authReduce, displayTarget, profileError } from '@/domain/auth';
import { BUNDLED_GEO, completePlace, placeError, type Place } from '@/domain/geo';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Checkbox, StepLabel } from '@/ui/Auth';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { LocationFields } from '@/ui/Location';
import { haptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { ProfilePhotoEditor } from '@/ui/PhotoPicker';
import { TopAppBar } from '@/ui/TopAppBar';

/** A7 · Créer mon profil (step 1 of 2, after the code proved the phone or e-mail). */
export default function CreateProfile() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const signup = state.auth.signup;
  const [name, setName] = useState('');
  // Kinshasa preselected (most YA YO buyers); every level can be changed.
  const [place, setPlace] = useState<Partial<Place>>({ country: 'CD', province: 'Kinshasa', city: 'Kinshasa' });
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  if (!signup) {
    if (state.auth.session) return null;
    return <Redirect href="/auth/connexion" />;
  }

  const profile = { name, ...place, email: signup.kind === 'phone' ? email : undefined, acceptTerms: terms };
  const error = profileError(profile);
  const full = completePlace(place);
  const placeIssue = touched ? placeError(BUNDLED_GEO[full.country], full) : null;

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
    // The session now exists: the photo goes on the new account, then the navigator opens A8.
    if (avatar) dispatch({ type: 'auth/setAvatar', avatar });
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
          <ProfilePhotoEditor
            name={name}
            photo={avatar}
            size={64}
            onSave={(uri) => {
              setAvatar(uri);
              return true;
            }}
            onRemove={() => setAvatar(undefined)}
          />
          <View style={{ flex: 1 }}>
            <Text variant="labelM">Photo de profil</Text>
            <Text variant="bodyS" color={color.text.secondary}>
              Optionnelle · aide les livreurs à te reconnaître.
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
        <LocationFields value={place} onChange={setPlace} error={placeIssue} />

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
});
