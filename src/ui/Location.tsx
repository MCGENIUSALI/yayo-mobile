import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  changePlace,
  cityNames,
  communeNames,
  GEO_COUNTRIES,
  provinceNames,
  type Place,
  type PlaceField,
} from '@/domain/geo';
import { useGeo } from '@/store/geo';
import { color, radius, space } from '@/theme/tokens';
import { SelectField } from './Auth';
import { Button } from './Button';
import { TextField } from './Form';
import { Text } from './Text';

/**
 * Dependent address fields shared by the buyer (A7, addresses), the seller
 * (shop location) and the courier (L1): pays → province → ville / territoire
 * → commune (when the city has an official list) → quartier → avenue.
 * Changing a level clears the levels under it.
 */
export function LocationFields({
  value,
  onChange,
  error,
  quartier = 'optional',
  street = false,
  upTo = 'commune',
  labels,
}: {
  value: Partial<Place>;
  onChange: (next: Partial<Place>) => void;
  /** First invalid level (from `placeError`), shown under that field once the form was submitted. */
  error?: { field: PlaceField; message: string } | null;
  quartier?: 'required' | 'optional' | 'hidden';
  street?: boolean;
  /** "city": stop at the ville (courier zones pick several communes on their own field). */
  upTo?: 'city' | 'commune';
  labels?: { commune?: string };
}) {
  const country = value.country ?? GEO_COUNTRIES[0]!.code;
  const geo = useGeo(country);
  const ds = geo.status === 'ready' ? geo.data : undefined;
  const provinces = provinceNames(ds);
  const cities = cityNames(ds, value.province);
  const communes = communeNames(ds, value.province, value.city);
  const errorOf = (f: PlaceField) => (error?.field === f ? error.message : undefined);
  const countryName = GEO_COUNTRIES.find((c) => c.code === country);

  return (
    <View style={styles.group}>
      <SelectField
        label="Pays"
        value={countryName ? `${countryName.flag}  ${countryName.name}` : undefined}
        placeholder="Choisis ton pays"
        options={GEO_COUNTRIES.map((c) => `${c.flag}  ${c.name}`)}
        onChange={(label) => {
          const c = GEO_COUNTRIES.find((x) => `${x.flag}  ${x.name}` === label);
          if (c) onChange(changePlace(value, 'country', c.code));
        }}
        error={errorOf('country')}
      />

      {geo.status === 'loading' ? (
        <Text variant="bodyS" color={color.text.secondary}>
          Chargement des provinces…
        </Text>
      ) : geo.status === 'error' ? (
        <View style={styles.notice}>
          <Text variant="bodyS" color={color.text.danger} style={styles.flex}>
            {geo.message}
          </Text>
          <Button label="Réessayer" variant="outline" size="S" onPress={geo.retry} />
        </View>
      ) : (
        <>
          <SelectField
            label="Province"
            value={value.province}
            placeholder="Choisis ta province"
            options={provinces}
            onChange={(v) => onChange(changePlace(value, 'province', v))}
            error={errorOf('province')}
          />
          <SelectField
            label="Ville ou territoire"
            value={value.city}
            placeholder={value.province ? 'Choisis ta ville' : 'Choisis d’abord la province'}
            options={cities}
            disabled={!value.province}
            onChange={(v) => onChange(changePlace(value, 'city', v))}
            error={errorOf('city')}
          />
          {upTo === 'city' ? null : communes.length > 0 ? (
            <SelectField
              label={labels?.commune ?? 'Commune'}
              value={value.commune}
              placeholder="Choisis ta commune"
              options={communes}
              onChange={(v) => onChange(changePlace(value, 'commune', v))}
              error={errorOf('commune')}
              hint="Elle sert à estimer la livraison."
            />
          ) : value.city ? (
            <View style={styles.info}>
              <MapPin size={16} color={color.icon.secondary} strokeWidth={2} />
              <Text variant="bodyS" color={color.text.secondary} style={styles.flex}>
                Pas de liste officielle des communes pour {value.city} : indique ton quartier.
              </Text>
            </View>
          ) : null}
        </>
      )}

      {quartier !== 'hidden' ? (
        <TextField
          label={quartier === 'required' || (value.city && communes.length === 0) ? 'Quartier' : 'Quartier (optionnel)'}
          value={value.quartier ?? ''}
          onChangeText={(t) => onChange({ ...value, quartier: t })}
          placeholder="Ex. Matonge"
          autoCapitalize="words"
          autoComplete="address-line2"
          error={errorOf('quartier')}
        />
      ) : null}
      {street ? (
        <TextField
          label="Avenue, numéro, repère (optionnel)"
          value={value.street ?? ''}
          onChangeText={(t) => onChange({ ...value, street: t })}
          placeholder="Ex. 8, av. Lukandu, portail bleu"
          autoComplete="street-address"
          textContentType="fullStreetAddress"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.bg.surfaceSunken,
  },
});
