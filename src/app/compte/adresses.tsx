import { router } from 'expo-router';
import { MapPin, Pencil, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAX_ADDRESSES } from '@/domain/account';
import { buyerAddresses, defaultAddressId } from '@/domain/state';
import type { Address } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Feedback';
import { Radio } from '@/ui/Form';
import { BottomBar, Content, Screen } from '@/ui/Layout';
import { PressableScale } from '@/ui/Pressable';
import { EmptyState } from '@/ui/Seller';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** D13 · Mes adresses: the radio picks the default address, the card opens D15. */
export default function AddressesScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const list = useMemo(() => buyerAddresses(state), [state]);
  const current = defaultAddressId(state);
  const full = list.length >= MAX_ADDRESSES;

  const makeDefault = (a: Address) => {
    if (a.id === current) return;
    dispatch({ type: 'address/setDefault', id: a.id, at: new Date().toISOString() });
    toast(`${a.label} est ton adresse par défaut.`, 'success');
  };

  return (
    <Screen>
      <TopAppBar title="Mes adresses" />
      <Content>
        {list.length === 0 ? (
          <EmptyState icon={MapPin} title="Aucune adresse" body="Ajoute l’adresse où tu veux recevoir tes colis. Le livreur s’en sert pour te trouver." />
        ) : (
          <>
            <Text variant="bodyM" color={color.text.secondary}>
              L’adresse par défaut est proposée en premier quand tu commandes.
            </Text>
            <View style={{ gap: space.md }} accessibilityRole="radiogroup">
              {list.map((a) => (
                <AddressRow key={a.id} address={a} isDefault={a.id === current} onDefault={() => makeDefault(a)} />
              ))}
            </View>
          </>
        )}
      </Content>
      <BottomBar>
        <Button
          label="Ajouter une adresse"
          leadingIcon={Plus}
          disabled={full}
          onPress={() => router.push('/compte/adresse')}
          fill
        />
        {full ? (
          <Text variant="bodyS" color={color.text.secondary} align="center">
            {`Tu as atteint ${MAX_ADDRESSES} adresses : supprimes-en une pour en ajouter.`}
          </Text>
        ) : null}
      </BottomBar>
    </Screen>
  );
}

function AddressRow({ address: a, isDefault, onDefault }: { address: Address; isDefault: boolean; onDefault: () => void }) {
  return (
    <View style={[styles.card, isDefault && styles.cardOn]}>
      <PressableScale
        accessibilityRole="radio"
        accessibilityState={{ checked: isDefault }}
        accessibilityLabel={`Adresse par défaut : ${a.label}`}
        onPress={onDefault}
        haptic="selection"
        scaleTo={pressScale.icon}
        style={styles.radio}
      >
        <Radio checked={isDefault} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Modifier ${a.label}, ${a.line}`}
        onPress={() => router.push({ pathname: '/compte/adresse', params: { id: a.id } })}
        haptic="selection"
        scaleTo={pressScale.card}
        style={styles.body}
      >
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="labelL">{a.label}</Text>
            {isDefault ? <Badge label="Par défaut" tone="accent" /> : null}
          </View>
          <Text variant="bodyM" color={color.text.secondary}>
            {a.line}
          </Text>
          {a.landmark ? (
            <Text variant="bodyS" color={color.text.secondary}>
              {a.landmark}
            </Text>
          ) : null}
          <Text variant="bodyS" color={color.text.tertiary}>
            {a.phone}
          </Text>
        </View>
        <Pencil size={18} color={color.icon.secondary} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: color.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.default,
    padding: space.lg,
    gap: space.md,
  },
  cardOn: { borderWidth: 2, borderColor: color.border.focus, padding: space.lg - 1 },
  radio: { paddingTop: 2 },
  body: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
