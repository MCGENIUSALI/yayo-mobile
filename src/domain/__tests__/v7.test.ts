import { describe, expect, it } from '@jest/globals';
import { authGate, currentAccount, DEMO_PHONE_EXISTING } from '../auth';
import {
  addressLine,
  BUNDLED_GEO,
  changePlace,
  cityNames,
  communeNames,
  placeError,
  provinceNames,
  provinceOfCity,
  searchNames,
} from '../geo';
import { buyerAddresses, createInitialState, reducer, restoreState, STATE_VERSION, type Action, type AppState } from '../state';

const T0 = '2026-11-07T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();
const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const cd = BUNDLED_GEO.CD;

function signIn(s: AppState, phone: string): AppState {
  s = run(s, { type: 'auth/onboarded' }, { type: 'auth/requestCode', kind: 'phone', target: phone, channel: 'sms', code: '123456', at: at(0) });
  return reducer(s, { type: 'auth/verifyCode', code: '123456', at: at(5) });
}

describe('geographic reference (RDC)', () => {
  it('has the 26 provinces and the 24 communes of Kinshasa', () => {
    expect(provinceNames(cd)).toHaveLength(26);
    expect(provinceNames(cd)).toEqual(expect.arrayContaining(['Kinshasa', 'Kasaï-Oriental', 'Nord-Kivu', 'Haut-Katanga', 'Kongo-Central']));
    expect(cityNames(cd, 'Kinshasa')).toEqual(['Kinshasa']);
    expect(communeNames(cd, 'Kinshasa', 'Kinshasa')).toHaveLength(24);
    expect(communeNames(cd, 'Kinshasa', 'Kinshasa')).toEqual(expect.arrayContaining(['Gombe', 'Kalamu', 'Mont-Ngafula', 'Nsele', 'Maluku']));
  });

  it('puts border cities in the right province', () => {
    expect(provinceOfCity(cd, 'Goma')).toBe('Nord-Kivu');
    expect(provinceOfCity(cd, 'Bukavu')).toBe('Sud-Kivu');
    expect(provinceOfCity(cd, 'Bandundu')).toBe('Kwilu');
    expect(provinceOfCity(cd, 'Lubumbashi')).toBe('Haut-Katanga');
    expect(provinceOfCity(cd, 'Kolwezi')).toBe('Lualaba');
    expect(provinceOfCity(cd, 'Mbuji-Mayi')).toBe('Kasaï-Oriental');
  });

  it('searches without accents or dashes, prefix matches first', () => {
    expect(searchNames(provinceNames(cd), 'kasai or')).toEqual(['Kasaï-Oriental']);
    expect(searchNames(communeNames(cd, 'Kinshasa', 'Kinshasa'), 'mont nga')).toEqual(['Mont-Ngafula']);
    expect(searchNames(provinceNames(cd), 'kivu')).toEqual(['Nord-Kivu', 'Sud-Kivu']);
    expect(searchNames(['A', 'B'], '  ')).toEqual(['A', 'B']);
  });

  it('clears the levels under a changed one', () => {
    const p = { country: 'CD', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', quartier: 'Golf' };
    expect(changePlace(p, 'province', 'Nord-Kivu')).toEqual({ country: 'CD', province: 'Nord-Kivu', quartier: 'Golf', city: undefined, commune: undefined });
    expect(changePlace(p, 'city', 'Kinshasa')).toBe(p);
  });

  it('asks the commune where there is an official list, the quartier elsewhere', () => {
    expect(placeError(cd, { country: 'CD', province: 'Kinshasa', city: 'Kinshasa' })?.field).toBe('commune');
    expect(placeError(cd, { country: 'CD', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe' })).toBeNull();
    expect(placeError(cd, { country: 'CD', province: 'Nord-Kivu', city: 'Beni' })?.field).toBe('quartier');
    expect(placeError(cd, { country: 'CD', province: 'Nord-Kivu', city: 'Beni', quartier: 'Mabakanga' })).toBeNull();
    expect(placeError(cd, { country: 'CD', province: 'Kinshasa', city: 'Goma' })?.field).toBe('city');
    expect(placeError(cd, { country: 'FR', province: 'Kinshasa' })?.field).toBe('country');
  });
});

describe('guest browsing and sign-in', () => {
  it('opens the app as a guest once the onboarding is done, the two states being separate', () => {
    const s = createInitialState(T0);
    expect(authGate(s.auth)).toBe('onboarding');
    const guest = reducer(s, { type: 'auth/onboarded' });
    expect(authGate(guest.auth)).toBe('guest');
    const signedIn = signIn(s, DEMO_PHONE_EXISTING);
    expect(authGate(signedIn.auth)).toBe('app');
    // Signing out keeps the onboarding done: back to guest browsing, not to the onboarding.
    expect(authGate(reducer(signedIn, { type: 'auth/signOut' }).auth)).toBe('guest');
  });

  it('lets a guest fill the cart but not pay', () => {
    let s = reducer(createInitialState(T0), { type: 'auth/onboarded' });
    s = reducer(s, { type: 'cart/add', productId: 'jbl-go-3', color: 'Noir', qty: 1, at: at(1) });
    expect(s.cart.some((l) => l.productId === 'jbl-go-3' && l.color === 'Noir')).toBe(true);
    s = reducer(s, { type: 'checkout/pay', at: at(2) });
    expect(s.lastError?.code).toBe('NOT_SIGNED_IN');
    expect(s.activeCheckoutId).toBeUndefined();
  });

  it('creates an account outside Kinshasa with the quartier, and keeps a profile photo', () => {
    let s = signIn(createInitialState(T0), '97 555 1234');
    s = reducer(s, {
      type: 'auth/createAccount',
      profile: { name: 'Esther Kavira', country: 'CD', province: 'Nord-Kivu', city: 'Beni', quartier: '', acceptTerms: true },
      at: at(10),
    });
    expect(s.lastError?.message).toBe('Indique ton quartier.');
    s = reducer(s, {
      type: 'auth/createAccount',
      profile: { name: 'Esther Kavira', country: 'CD', province: 'Nord-Kivu', city: 'Beni', quartier: ' Mabakanga ', acceptTerms: true },
      at: at(11),
    });
    const acc = currentAccount(s.auth)!;
    expect(acc).toMatchObject({ country: 'CD', province: 'Nord-Kivu', city: 'Beni', commune: '', quartier: 'Mabakanga' });
    s = reducer(s, { type: 'auth/setAvatar', avatar: 'file:///data/user/0/cd.yayo/files/photos/1.jpg', at: at(12) });
    expect(currentAccount(s.auth)!.avatar).toContain('/photos/1.jpg');
    s = reducer(s, { type: 'auth/setAvatar', avatar: 'javascript:alert(1)', at: at(13) });
    expect(s.lastError?.code).toBe('INVALID_PHOTO');
    expect(currentAccount(s.auth)!.avatar).toContain('/photos/1.jpg');
    s = reducer(s, { type: 'auth/setAvatar', avatar: undefined, at: at(14) });
    expect(currentAccount(s.auth)!.avatar).toBeUndefined();
  });
});

describe('delivery addresses', () => {
  it('adds a validated address to the account and delivers the order there', () => {
    let s = signIn(createInitialState(T0), DEMO_PHONE_EXISTING);
    expect(buyerAddresses(s).map((a) => a.label)).toEqual(['Maison', 'Bureau']);
    s = reducer(s, { type: 'address/add', label: 'Chez maman', place: { country: 'CD', province: 'Kinshasa', city: 'Kinshasa', street: '3, av. Kasa-Vubu' }, at: at(20) });
    expect(s.lastError?.message).toBe('Choisis ta commune.');
    s = reducer(s, {
      type: 'address/add',
      label: 'Chez maman',
      place: { country: 'CD', province: 'Kinshasa', city: 'Kinshasa', commune: 'Ngaba', quartier: 'Mukulua', street: '3, av. Kasa-Vubu' },
      at: at(21),
    });
    const added = buyerAddresses(s).at(-1)!;
    expect(added.line).toBe('3, av. Kasa-Vubu, Q. Mukulua, Ngaba');
    expect(s.draft.addressId).toBe(added.id);
    s = reducer(s, { type: 'checkout/pay', at: at(30) });
    const order = s.orders[s.checkouts[s.activeCheckoutId!]!.orderIds[0]!]!;
    expect(order.dropoff).toBe(added.line);
    expect(order.buyer?.commune).toBe('Ngaba');
  });

  it('formats lines outside Kinshasa with the city', () => {
    expect(addressLine({ city: 'Goma', commune: 'Karisimbi', quartier: 'Majengo', street: '12, av. du Lac' })).toBe('12, av. du Lac, Q. Majengo, Karisimbi, Goma');
  });
});

describe('v6 → v7', () => {
  it('moves a cash draft back to Mobile Money, completes places and keeps Jean’s addresses', () => {
    const v6 = JSON.parse(JSON.stringify({ ...createInitialState(T0), version: 6 })) as Record<string, unknown>;
    delete v6.addressBook;
    (v6.draft as Record<string, unknown>).method = 'cash';
    const accounts = (v6.auth as { accounts: Record<string, Record<string, unknown>> }).accounts;
    delete accounts['U-1']!.province;
    delete accounts['U-1']!.country;
    const restored = restoreState(v6, T0);
    expect(restored.version).toBe(STATE_VERSION);
    expect(restored.draft.method).toBe('mobile_money');
    expect(restored.auth.accounts['U-1']).toMatchObject({ country: 'CD', province: 'Kinshasa', city: 'Kinshasa' });
    expect(restored.addressBook['U-1']?.map((a) => a.id)).toEqual(['home', 'office']);
    // Cash orders placed before the change keep their method.
    expect(Object.values(restored.orders).some((o) => o.method === 'cash')).toBe(true);
  });
});
