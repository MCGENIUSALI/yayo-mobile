import { describe, expect, it } from '@jest/globals';
import {
  authGate,
  authReduce,
  createAuthState,
  currentAccount,
  DEMO_PHONE_EXISTING,
  DEMO_PHONE_SUSPENDED,
  displayTarget,
  emailError,
  initialsOf,
  normalizePhone,
  phoneError,
  profileError,
  resendWaitSeconds,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  type AuthAction,
  type AuthState,
} from '../auth';
import { createInitialState, reducer, restoreState } from '../state';

const T0 = '2026-11-03T10:00:00.000Z';
const at = (s: number) => new Date(new Date(T0).getTime() + s * 1000).toISOString();

function run(auth: AuthState, ...actions: AuthAction[]): AuthState {
  return actions.reduce((a, act) => {
    const r = authReduce(a, act);
    if (!r.ok) throw new Error(`${act.type}: ${r.code}`);
    return r.auth;
  }, auth);
}

const send = (target: string, s = 0, code = '482913'): AuthAction => ({ type: 'auth/requestCode', kind: 'phone', target, channel: 'sms', code, at: at(s) });
const verify = (code: string, s = 10): AuthAction => ({ type: 'auth/verifyCode', code, at: at(s) });
const profile = { name: 'Grâce Mbuyi', city: 'Kinshasa', commune: 'Kalamu', acceptTerms: true };

describe('identifiers (A5)', () => {
  it('accepts Congolese mobile numbers in every usual form', () => {
    expect(normalizePhone('81 234 5678')).toBe('+243812345678');
    expect(normalizePhone('0812345678')).toBe('+243812345678');
    expect(normalizePhone('+243 99 123 4567')).toBe('+243991234567');
    expect(normalizePhone('90 123 4567')).toBe('+243901234567');
    expect(normalizePhone('71 234 5678')).toBeNull();
    expect(phoneError('81 23')).toBe('Le numéro doit avoir 9 chiffres après +243.');
    expect(phoneError('')).toBe('Saisis ton numéro de téléphone.');
  });

  it('validates and masks e-mails', () => {
    expect(emailError('jean@email')).toBe('Cette adresse e-mail n’est pas valide.');
    expect(emailError(' Jean.Mukendi@Email.cd ')).toBeNull();
    expect(displayTarget('email', 'jean.mukendi@email.cd')).toBe('j•••@email.cd');
    expect(displayTarget('phone', '+243812345678')).toBe('+243 81 234 5678');
    expect(initialsOf('Jean  Mukendi')).toBe('JM');
  });
});

describe('one-time code (A6, E8)', () => {
  it('signs an existing account in with a fresh session', () => {
    const a = run(createAuthState(), { type: 'auth/onboarded' }, send('81 234 5678'), verify('482913'));
    expect(currentAccount(a)?.name).toBe('Jean Mukendi');
    expect(a.challenge).toBeUndefined();
    expect(authGate(a)).toBe('app');
  });

  it('counts down attempts, then locks for 15 minutes', () => {
    let a = run(createAuthState(), send('81 234 5678'));
    const r1 = authReduce(a, verify('129407'));
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.code).toBe('WRONG_CODE');
    expect(r1.message).toContain('Il te reste 2 essais');
    a = r1.auth!;
    a = authReduce(a, verify('000000', 11)).auth!;
    const r3 = authReduce(a, verify('111111', 12));
    expect(!r3.ok && r3.code).toBe('LOCKED');
    a = r3.auth!;
    // Even the right code is refused while locked, and so is a new code.
    expect(authReduce(a, verify('482913', 13)).ok).toBe(false);
    const again = authReduce(a, send('81 234 5678', 60));
    expect(!again.ok && again.code).toBe('LOCKED');
    // After 15 minutes a new code can be requested.
    expect(authReduce(a, send('81 234 5678', 16 * 60, '135790')).ok).toBe(true);
  });

  it('refuses expired codes and codes used twice', () => {
    const a = run(createAuthState(), send('81 234 5678'));
    const late = authReduce(a, verify('482913', 11 * 60));
    expect(!late.ok && late.code).toBe('EXPIRED');
    const signedIn = run(a, verify('482913'));
    const reuse = authReduce({ ...signedIn, session: undefined }, verify('482913', 20));
    expect(!reuse.ok && reuse.code).toBe('NO_CHALLENGE');
  });

  it('enforces the 45 s resend delay and the hourly cap', () => {
    let a = run(createAuthState(), send('81 234 5678'));
    expect(resendWaitSeconds(a.challenge, at(15))).toBe(30);
    const early = authReduce(a, send('81 234 5678', 20));
    expect(!early.ok && early.code).toBe('TOO_SOON');
    for (let i = 1; i < 5; i++) a = run(a, send('81 234 5678', i * 60));
    const capped = authReduce(a, send('81 234 5678', 6 * 60));
    expect(!capped.ok && capped.code).toBe('RATE_LIMITED');
  });

  it('sends a voice call code on the same number', () => {
    const a = run(createAuthState(), send('81 234 5678'), { type: 'auth/requestCode', kind: 'phone', target: '812345678', channel: 'call', code: '246810', at: at(50) });
    expect(a.challenge?.channel).toBe('call');
    expect(a.challenge?.sends.length).toBe(2);
  });
});

describe('sign-up (A7, A8) and account states (E9)', () => {
  it('creates a buyer account after the code, then asks for the profile type', () => {
    let a = run(createAuthState(), send('97 111 2222'), verify('482913'));
    expect(a.signup?.target).toBe('+243971112222');
    expect(a.session).toBeUndefined();
    a = run(a, { type: 'auth/createAccount', profile, at: at(30) });
    expect(currentAccount(a)?.roles).toEqual(['buyer']);
    expect(authGate(a)).toBe('role');
    a = run(a, { type: 'auth/chooseRole', role: 'seller', at: at(40) });
    // Seller is requested, never granted by the app.
    expect(currentAccount(a)?.roles).toEqual(['buyer']);
    expect(currentAccount(a)?.pendingRoles).toEqual(['seller']);
    expect(authGate(a)).toBe('app');
  });

  it('validates the profile and never links an e-mail already in use', () => {
    expect(profileError({ ...profile, name: ' ' })).toBe('Indique ton nom complet.');
    expect(profileError({ ...profile, commune: 'Gombe ville' })).toBe('Choisis ta commune.');
    expect(profileError({ ...profile, acceptTerms: false })).toBe('Accepte les Conditions d’utilisation pour continuer.');
    const a = run(createAuthState(), send('97 111 2222'), verify('482913'));
    const r = authReduce(a, { type: 'auth/createAccount', profile: { ...profile, email: 'jean.mukendi@email.cd' }, at: at(30) });
    expect(!r.ok && r.code).toBe('EMAIL_TAKEN');
  });

  it('blocks a suspended account without opening a session', () => {
    const a = run(createAuthState(), send(DEMO_PHONE_SUSPENDED), verify('482913'));
    expect(a.session).toBeUndefined();
    expect(authGate(a)).toBe('blocked');
    expect(authGate(run(a, { type: 'auth/leaveBlocked' }))).toBe('onboarding');
  });

  it('expires sessions after inactivity or their absolute lifetime', () => {
    const a = run(createAuthState(), send(DEMO_PHONE_EXISTING), verify('482913'));
    const idle = run(a, { type: 'auth/touch', at: at(SESSION_IDLE_MS / 1000 + 60) });
    expect(idle.session).toBeUndefined();
    expect(idle.signedOutReason).toBe('expired');
    let b = a;
    for (let d = 6; d * 24 * 3600 * 1000 < SESSION_ABSOLUTE_MS; d += 6) b = run(b, { type: 'auth/touch', at: at(d * 24 * 3600) });
    expect(b.session).toBeDefined();
    const absolute = run(b, { type: 'auth/touch', at: at(SESSION_ABSOLUTE_MS / 1000 + 20) });
    expect(absolute.session).toBeUndefined();
  });

  it('refuses the session as soon as the account is suspended', () => {
    const a = run(createAuthState(), send(DEMO_PHONE_EXISTING), verify('482913'));
    const suspended = { ...a, accounts: { ...a.accounts, 'U-1': { ...a.accounts['U-1']!, status: 'suspended' as const } } };
    const t = run(suspended, { type: 'auth/touch', at: at(60) });
    expect(t.session).toBeUndefined();
    expect(t.signedOutReason).toBe('suspended');
  });
});

describe('app state integration', () => {
  it('logs auth events without personal data and keeps the account on demo reset', () => {
    let s = createInitialState(T0);
    s = reducer(s, { ...send('81 234 5678'), at: T0 });
    s = reducer(s, { type: 'auth/verifyCode', code: '482913', at: T0 });
    const types = s.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['auth.otp.sent.sms', 'auth.login']));
    expect(JSON.stringify(s.events)).not.toContain('812345678');
    expect(JSON.stringify(s.events)).not.toContain('482913');
    s = reducer(s, { type: 'demo/reset', at: T0 });
    expect(s.auth.session).toBeDefined();
  });

  it('surfaces a wrong code as lastError and keeps the attempt count', () => {
    let s = reducer(createInitialState(T0), { ...send('81 234 5678'), at: T0 });
    s = reducer(s, { type: 'auth/verifyCode', code: '000000', at: T0 });
    expect(s.lastError?.code).toBe('WRONG_CODE');
    expect(s.auth.challenge?.attemptsLeft).toBe(2);
  });

  it('upgrades a v3 session: cart kept, buyer signs in once', () => {
    const v3 = { ...createInitialState(T0), version: 3 } as Record<string, unknown>;
    delete v3.auth;
    const restored = restoreState(JSON.parse(JSON.stringify(v3)), T0);
    expect(restored.cart.length).toBe(3);
    expect(restored.auth.session).toBeUndefined();
    expect(authGate(restored.auth)).toBe('onboarding');
  });
});
