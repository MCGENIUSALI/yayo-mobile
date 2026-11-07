import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { addressError, type AddressField, type AddressInput } from '@/domain/account';
import { CITIES, currentAccount } from '@/domain/auth';
import { buyerAddresses, defaultAddressId } from '@/domain/state';
import { useStore } from '@/store/AppStore';
import { color, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Checkbox, SelectField } from '@/ui/Auth';
import { useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** "+243 81 234 5678" → "81 234 5678" (the field shows the +243 prefix). */
const localPhone = (p?: string) => (p ?? '').replace(/^\+?243\s?/, '');

/** D14 · Nouvelle adresse, D15 · Modifier l’adresse (with `id`). */
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const account = currentAccount(state.auth);
  const existing = useMemo(() => (id ? buyerAddresses(state).find((a) => a.id === id) : undefined), [id, state]);
  const isDefault = !!existing && defaultAddressId(state) === existing.id;
  const firstAddress = buyerAddresses(state).length === 0;

  const [form, setForm] = useState<AddressInput>(() => ({
    label: existing?.label ?? '',
    city: existing?.city ?? account?.city ?? 'Kinshasa',
    commune: existing?.commune ?? account?.commune ?? '',
    street: existing?.street ?? '',
    landmark: existing?.landmark ?? '',
    phone: localPhone(existing?.phone ?? (account?.phone ? `+243 ${account.phone.slice(4)}` : '')),
  }));
  const [makeDefault, setMakeDefault] = useState(isDefault || firstAddress);
  const [error, setError] = useState<{ field: AddressField; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<AddressInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  if (id && !existing) {
    return (
      <Screen>
        <TopAppBar title="Adresse" />
        <Content>
          <Text variant="bodyM" color={color.text.secondary}>
            Cette adresse n’existe plus.
          </Text>
        </Content>
      </Screen>
    );
  }

  const save = () => {
    const err = addressError(form);
    if (err) {
      setError(err);
      return;
    }
    dispatch({ type: 'address/save', id: existing?.id, input: form, makeDefault, at: new Date().toISOString() });
    toast(existing ? 'Adresse mise à jour.' : 'Adresse enregistrée.', 'success');
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    setConfirmDelete(false);
    dispatch({ type: 'address/delete', id: existing.id, at: new Date().toISOString() });
    toast('Adresse supprimée.');
    router.back();
  };

  const fieldError = (f: AddressField) => (error?.field === f ? error.message : undefined);

  return (
    <Screen>
      <TopAppBar
        title={existing ? 'Modifier l’adresse' : 'Nouvelle adresse'}
        action={existing ? { icon: Trash2, label: 'Supprimer cette adresse', onPress: () => setConfirmDelete(true) } : undefined}
      />
      <Content>
        <TextField
          label="Nom de l’adresse"
          placeholder="Maison, Bureau, Chez maman…"
          value={form.label}
          maxLength={30}
          error={fieldError('label')}
          onChangeText={(label) => set({ label })}
        />
        <SelectField
          label="Ville"
          value={form.city}
          placeholder="Choisis la ville"
          options={Object.keys(CITIES)}
          onChange={(city) => set({ city, commune: CITIES[city]?.includes(form.commune) ? form.commune : '' })}
        />
        <View style={{ gap: space.xs }}>
          <SelectField
            label="Commune"
            value={form.commune || undefined}
            placeholder="Choisis la commune"
            options={CITIES[form.city] ?? []}
            onChange={(commune) => set({ commune })}
          />
          {fieldError('commune') ? (
            <Text variant="bodyS" color={color.text.danger}>
              {fieldError('commune')}
            </Text>
          ) : null}
        </View>
        <TextField
          label="Quartier, avenue et numéro"
          placeholder="Q. Matonge, 12 av. Kasa-Vubu"
          value={form.street}
          maxLength={120}
          error={fieldError('street')}
          onChangeText={(street) => set({ street })}
        />
        <TextField
          label="Repère pour le livreur (facultatif)"
          placeholder="En face de la pharmacie"
          value={form.landmark}
          maxLength={80}
          muted
          onChangeText={(landmark) => set({ landmark })}
        />
        <TextField
          label="Téléphone sur place"
          prefix="phone-cd"
          keyboardType="phone-pad"
          placeholder="81 234 5678"
          value={form.phone}
          maxLength={14}
          error={fieldError('phone')}
          onChangeText={(phone) => set({ phone })}
        />
        <Text variant="bodyS" color={color.text.secondary}>
          Le livreur appelle ce numéro s’il ne trouve pas l’adresse. Le vendeur ne le voit pas.
        </Text>
        {isDefault ? (
          <Text variant="bodyS" color={color.text.secondary}>
            C’est ton adresse par défaut.
          </Text>
        ) : (
          <Checkbox checked={makeDefault} onChange={setMakeDefault} label="Utiliser comme adresse par défaut" />
        )}
      </Content>
      <BottomBar>
        <Button label={existing ? 'Enregistrer les modifications' : 'Enregistrer l’adresse'} haptic="medium" onPress={save} fill />
      </BottomBar>

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer cette adresse ?"
        footer={
          <View style={{ flex: 1, gap: space.md }}>
            <Button label="Supprimer l’adresse" variant="destructive" haptic="warning" onPress={remove} fill />
            <Button label="Annuler" variant="ghost" onPress={() => setConfirmDelete(false)} fill />
          </View>
        }
      >
        <Text variant="bodyM" color={color.text.secondary}>
          {isDefault
            ? `${existing?.label} est ton adresse par défaut. Ta prochaine adresse deviendra l’adresse par défaut. Tes commandes en cours ne changent pas.`
            : `${existing?.label} sera retirée de tes adresses. Tes commandes en cours ne changent pas.`}
        </Text>
      </Sheet>
    </Screen>
  );
}
