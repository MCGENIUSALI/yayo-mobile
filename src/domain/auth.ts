/**
 * US-01 · S’inscrire et se connecter (Figma A1–A8, E8, E9), mock côté appareil.
 *
 * Le contrat suit celui de l’authentification du dashboard (yayo-dashboard,
 * docs/authentification.md) pour que le futur serveur serve les deux apps :
 * - statut de compte `active` | `suspended`, sessions d’un compte suspendu refusées ;
 * - rôles jamais accordés par le client : « Vendeur » et « Livreur » créent une
 *   demande (`pendingRoles`) que l’équipe YA YO valide, seul « Acheteur » est immédiat ;
 * - session opaque à durée d’inactivité et durée absolue (valeurs « Se souvenir de
 *   moi » du dashboard : 7 jours / 30 jours), nouvel identifiant à chaque connexion ;
 * - pas de mot de passe : code à usage unique par SMS, appel ou e-mail (Figma A5),
 *   limité en essais et en envois comme les liens e-mail du dashboard.
 *
 * Aucun secret n’existe ici : c’est une démo locale. Le vrai code sera généré et
 * vérifié par le serveur, jamais par l’app.
 */

export type Role = 'buyer' | 'seller' | 'courier' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type OtpChannel = 'sms' | 'call' | 'email';
export type IdentifierKind = 'phone' | 'email';

export interface Account {
  id: string;
  /** E.164, e.g. "+243812345678". */
  phone?: string;
  email?: string;
  name: string;
  city: string;
  commune: string;
  roles: Role[];
  /** Roles requested on A8, waiting for YA YO validation (shop check, KYC). */
  pendingRoles: Role[];
  status: AccountStatus;
  createdAt: string;
  termsAcceptedAt: string;
}

export interface OtpChallenge {
  kind: IdentifierKind;
  /** Normalised phone (E.164) or e-mail. */
  target: string;
  channel: OtpChannel;
  /** Demo only: the real code never reaches the app. */
  code: string;
  sentAt: string;
  expiresAt: string;
  attemptsLeft: number;
  /** Send times for this target in the current window (rate limit). */
  sends: string[];
  lockedUntil?: string;
}

export interface Session {
  id: string;
  accountId: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthState {
  onboardingDone: boolean;
  accounts: Record<string, Account>;
  challenge?: OtpChallenge;
  /** Identity proven by OTP but no account yet (A7). */
  signup?: { kind: IdentifierKind; target: string; verifiedAt: string };
  session?: Session;
  /** A8 still to answer after creating the account. */
  needsRoleChoice: boolean;
  /** Set when the verified identity belongs to a suspended account (E9). */
  blocked?: { accountId: string; at: string };
  /** Why the last session ended, shown once on A5. */
  signedOutReason?: 'expired' | 'suspended';
  accountSeq: number;
  sessionSeq: number;
}

/* ---------- Rules ---------- */

export const OTP_LENGTH = 6;
/** Figma A6: "Renvoyer le code dans 00:45". */
export const OTP_RESEND_AFTER_MS = 45_000;
export const OTP_TTL_MS = 10 * 60_000;
/** Figma E8: 3 wrong codes, then wait 15 minutes. */
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_LOCK_MS = 15 * 60_000;
/** Codes sent to one target per hour (dashboard: 3 e-mails per hour; SMS/appel slightly more lenient). */
export const OTP_MAX_SENDS_PER_HOUR = 5;
/** Same as the dashboard's "Se souvenir de moi" session. */
export const SESSION_IDLE_MS = 7 * 24 * 3_600_000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 3_600_000;

export const CITIES: Record<string, string[]> = {
  Kinshasa: ['Bandalungwa', 'Barumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kintambo', 'Limete', 'Lingwala', 'Masina', 'Matete', 'Ngaliema', 'Ndjili'],
  Lubumbashi: ['Annexe', 'Kampemba', 'Kenya', 'Lubumbashi', 'Rwashi'],
  Goma: ['Goma', 'Karisimbi'],
};

const addMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();
const ms = (iso: string) => new Date(iso).getTime();

/** Congo mobile prefixes: Vodacom 81–83, Orange 80/84/85/89, Africell 90/91, Airtel 97–99. */
const CD_PREFIXES = ['80', '81', '82', '83', '84', '85', '89', '90', '91', '97', '98', '99'];

/** "81 234 5678" / "+243 812345678" / "0812345678" → "+243812345678", or null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('243')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length !== 9 || !CD_PREFIXES.includes(d.slice(0, 2))) return null;
  return `+243${d}`;
}

export function phoneError(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (!d) return 'Saisis ton numéro de téléphone.';
  if (d.length < 9) return 'Le numéro doit avoir 9 chiffres après +243.';
  return normalizePhone(input) ? null : 'Ce numéro n’est pas un numéro mobile congolais.';
}

/** "+243812345678" → "+243 81 234 5678". */
export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+243/, '');
  return `+243 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

export function emailError(input: string): string | null {
  if (!input.trim()) return 'Saisis ton adresse e-mail.';
  return normalizeEmail(input) ? null : 'Cette adresse e-mail n’est pas valide.';
}

/** Masked target for A6: "+243 81 234 5678" or "j•••@email.cd". */
export function displayTarget(kind: IdentifierKind, target: string): string {
  if (kind === 'phone') return formatPhone(target);
  const [user = '', domain = ''] = target.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?';
}

export function findAccount(auth: AuthState, kind: IdentifierKind, target: string): Account | undefined {
  return Object.values(auth.accounts).find((a) => (kind === 'phone' ? a.phone === target : a.email === target));
}

export function sessionValid(s: Session | undefined, now: string): boolean {
  if (!s) return false;
  const t = ms(now);
  return t - ms(s.lastSeenAt) < SESSION_IDLE_MS && t - ms(s.createdAt) < SESSION_ABSOLUTE_MS;
}

export function currentAccount(auth: AuthState): Account | undefined {
  return auth.session ? auth.accounts[auth.session.accountId] : undefined;
}

/** Seconds before "Renvoyer le code" is allowed again (0 = now). */
export function resendWaitSeconds(c: OtpChallenge | undefined, now: string): number {
  if (!c) return 0;
  return Math.max(0, Math.ceil((ms(c.sentAt) + OTP_RESEND_AFTER_MS - ms(now)) / 1000));
}

/** Minutes left on an E8 lock (0 = not locked). */
export function lockMinutesLeft(c: OtpChallenge | undefined, now: string): number {
  if (!c?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((ms(c.lockedUntil) - ms(now)) / 60_000));
}

/* ---------- Seed ---------- */

export const DEMO_PHONE_EXISTING = '+243812345678';
export const DEMO_PHONE_SUSPENDED = '+243850000000';
/** Seeded seller (JBL Store Kin, Figma V4 "Bonjour Grâce"). */
export const DEMO_PHONE_SELLER = '+243897654321';
export const DEMO_SELLER_ID = 'U-3';

export function createAuthState(): AuthState {
  return {
    onboardingDone: false,
    accounts: {
      'U-1': {
        id: 'U-1',
        phone: DEMO_PHONE_EXISTING,
        email: 'jean.mukendi@email.cd',
        name: 'Jean Mukendi',
        city: 'Kinshasa',
        commune: 'Kalamu',
        roles: ['buyer'],
        pendingRoles: [],
        status: 'active',
        createdAt: '2026-09-12T08:00:00.000Z',
        termsAcceptedAt: '2026-09-12T08:00:00.000Z',
      },
      'U-2': {
        id: 'U-2',
        phone: DEMO_PHONE_SUSPENDED,
        name: 'Compte suspendu (démo)',
        city: 'Kinshasa',
        commune: 'Limete',
        roles: ['buyer'],
        pendingRoles: [],
        status: 'suspended',
        createdAt: '2026-08-01T08:00:00.000Z',
        termsAcceptedAt: '2026-08-01T08:00:00.000Z',
      },
      [DEMO_SELLER_ID]: demoSellerAccount(),
    },
    needsRoleChoice: false,
    accountSeq: 3,
    sessionSeq: 0,
  };
}

export function demoSellerAccount(): Account {
  return {
    id: DEMO_SELLER_ID,
    phone: DEMO_PHONE_SELLER,
    email: 'grace@jblstorekin.cd',
    name: 'Grâce Kabeya',
    city: 'Kinshasa',
    commune: 'Gombe',
    roles: ['buyer', 'seller'],
    pendingRoles: [],
    status: 'active',
    createdAt: '2026-06-02T08:00:00.000Z',
    termsAcceptedAt: '2026-06-02T08:00:00.000Z',
  };
}

/* ---------- State machine ---------- */

export type AuthAction =
  | { type: 'auth/onboarded' }
  | { type: 'auth/requestCode'; kind: IdentifierKind; target: string; channel: OtpChannel; code: string; at: string }
  | { type: 'auth/verifyCode'; code: string; at: string }
  | { type: 'auth/cancelChallenge' }
  | {
      type: 'auth/createAccount';
      profile: { name: string; city: string; commune: string; email?: string; acceptTerms: boolean };
      at: string;
    }
  | { type: 'auth/chooseRole'; role: 'buyer' | 'seller' | 'courier'; at: string }
  | { type: 'auth/touch'; at: string }
  | { type: 'auth/signOut'; reason?: AuthState['signedOutReason'] }
  | { type: 'auth/leaveBlocked' }
  /** V2 sent: the seller role is requested (never granted by the client). */
  | { type: 'auth/requestRole'; role: 'seller' | 'courier'; at: string }
  /** Demo only: plays the YA YO team validating a pending role. */
  | { type: 'auth/demoGrantRole'; role: 'seller' | 'courier'; at: string };

export type AuthResult = { ok: true; auth: AuthState; event?: string } | { ok: false; code: string; message: string; auth?: AuthState };

const ok = (auth: AuthState, event?: string): AuthResult => ({ ok: true, auth, event });
const fail = (code: string, message: string, auth?: AuthState): AuthResult => ({ ok: false, code, message, auth });

export function profileError(p: { name: string; city: string; commune: string; email?: string; acceptTerms: boolean }): string | null {
  if (p.name.trim().length < 2) return 'Indique ton nom complet.';
  if (!CITIES[p.city]) return 'Choisis ta ville.';
  if (!CITIES[p.city]!.includes(p.commune)) return 'Choisis ta commune.';
  if (p.email?.trim() && !normalizeEmail(p.email)) return 'Cette adresse e-mail n’est pas valide.';
  if (!p.acceptTerms) return 'Accepte les Conditions d’utilisation pour continuer.';
  return null;
}

export function authReduce(auth: AuthState, a: AuthAction): AuthResult {
  switch (a.type) {
    case 'auth/onboarded':
      return ok({ ...auth, onboardingDone: true });

    case 'auth/requestCode': {
      const target = a.kind === 'phone' ? normalizePhone(a.target) : normalizeEmail(a.target);
      if (!target) return fail('INVALID_TARGET', a.kind === 'phone' ? 'Ce numéro n’est pas un numéro mobile congolais.' : 'Cette adresse e-mail n’est pas valide.');
      if (a.kind === 'email' && a.channel !== 'email') return fail('INVALID_CHANNEL', 'Un e-mail ne peut recevoir le code que par e-mail.');
      const prev = auth.challenge?.target === target ? auth.challenge : undefined;
      if (prev?.lockedUntil && ms(a.at) < ms(prev.lockedUntil)) {
        return fail('LOCKED', `Trop d’essais. Réessaie dans ${lockMinutesLeft(prev, a.at)} min.`);
      }
      if (prev && !prev.lockedUntil && resendWaitSeconds(prev, a.at) > 0) {
        return fail('TOO_SOON', `Patiente ${resendWaitSeconds(prev, a.at)} s avant de redemander un code.`);
      }
      const sends = (prev?.sends ?? []).filter((t) => ms(a.at) - ms(t) < 3_600_000);
      if (sends.length >= OTP_MAX_SENDS_PER_HOUR) {
        return fail('RATE_LIMITED', 'Trop de codes demandés. Réessaie dans une heure ou contacte le support.');
      }
      if (!/^\d{6}$/.test(a.code)) return fail('BAD_CODE_FORMAT', 'Code de démo invalide.');
      const challenge: OtpChallenge = {
        kind: a.kind,
        target,
        channel: a.channel,
        code: a.code,
        sentAt: a.at,
        expiresAt: addMs(a.at, OTP_TTL_MS),
        attemptsLeft: OTP_MAX_ATTEMPTS,
        sends: [...sends, a.at],
      };
      return ok({ ...auth, challenge, signup: undefined, blocked: undefined, signedOutReason: undefined }, `auth.otp.sent.${a.channel}`);
    }

    case 'auth/verifyCode': {
      const c = auth.challenge;
      if (!c) return fail('NO_CHALLENGE', 'Demande d’abord un code.');
      if (c.lockedUntil && ms(a.at) < ms(c.lockedUntil)) {
        return fail('LOCKED', `Trop d’essais. Attends ${lockMinutesLeft(c, a.at)} min avant de redemander un code.`);
      }
      if (c.lockedUntil) return fail('LOCKED', 'Demande un nouveau code.');
      if (ms(a.at) >= ms(c.expiresAt)) return fail('EXPIRED', 'Ce code a expiré. Demande un nouveau code.');
      if (a.code !== c.code) {
        const attemptsLeft = c.attemptsLeft - 1;
        const next: OtpChallenge = attemptsLeft <= 0 ? { ...c, attemptsLeft: 0, lockedUntil: addMs(a.at, OTP_LOCK_MS) } : { ...c, attemptsLeft };
        const msg =
          attemptsLeft <= 0
            ? 'Code incorrect. Après 3 erreurs, attends 15 minutes avant de redemander un code.'
            : `Code incorrect. Il te reste ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}. Après 3 erreurs, attends 15 minutes avant de redemander un code.`;
        return fail(attemptsLeft <= 0 ? 'LOCKED' : 'WRONG_CODE', msg, { ...auth, challenge: next });
      }
      // Code consumed: single use.
      const base: AuthState = { ...auth, challenge: undefined };
      const account = findAccount(auth, c.kind, c.target);
      if (!account) return ok({ ...base, signup: { kind: c.kind, target: c.target, verifiedAt: a.at } }, 'auth.otp.verified.new');
      if (account.status === 'suspended') return ok({ ...base, blocked: { accountId: account.id, at: a.at } }, 'auth.login.suspended');
      return ok(startSession(base, account.id, a.at), 'auth.login');
    }

    case 'auth/cancelChallenge':
      return ok({ ...auth, challenge: undefined, signup: undefined });

    case 'auth/createAccount': {
      const s = auth.signup;
      if (!s) return fail('NOT_VERIFIED', 'Vérifie d’abord ton numéro.');
      const err = profileError(a.profile);
      if (err) return fail('INVALID_PROFILE', err);
      const email = s.kind === 'email' ? s.target : normalizeEmail(a.profile.email ?? '') ?? undefined;
      if (email && s.kind === 'phone' && findAccount(auth, 'email', email)) {
        // Never link accounts by e-mail (same rule as the dashboard).
        return fail('EMAIL_TAKEN', 'Cette adresse e-mail est déjà utilisée par un autre compte. Laisse le champ vide ou utilise-en une autre.');
      }
      const id = `U-${auth.accountSeq + 1}`;
      const account: Account = {
        id,
        phone: s.kind === 'phone' ? s.target : undefined,
        email,
        name: a.profile.name.trim().replace(/\s+/g, ' '),
        city: a.profile.city,
        commune: a.profile.commune,
        roles: ['buyer'],
        pendingRoles: [],
        status: 'active',
        createdAt: a.at,
        termsAcceptedAt: a.at,
      };
      const next = startSession({ ...auth, signup: undefined, accounts: { ...auth.accounts, [id]: account }, accountSeq: auth.accountSeq + 1 }, id, a.at);
      return ok({ ...next, needsRoleChoice: true }, 'auth.account.created');
    }

    case 'auth/chooseRole': {
      const acc = currentAccount(auth);
      if (!acc) return fail('NO_SESSION', 'Connecte-toi d’abord.');
      if (a.role === 'buyer') return ok({ ...auth, needsRoleChoice: false }, 'auth.role.buyer');
      // Seller and courier need a YA YO check: the client only files the request.
      const pendingRoles = acc.pendingRoles.includes(a.role) ? acc.pendingRoles : [...acc.pendingRoles, a.role];
      return ok(
        { ...auth, needsRoleChoice: false, accounts: { ...auth.accounts, [acc.id]: { ...acc, pendingRoles } } },
        `auth.role.requested.${a.role}`,
      );
    }

    case 'auth/touch': {
      if (!auth.session) return ok(auth);
      const acc = auth.accounts[auth.session.accountId];
      if (!acc) return ok({ ...auth, session: undefined, needsRoleChoice: false });
      if (acc.status === 'suspended') return ok({ ...auth, session: undefined, needsRoleChoice: false, signedOutReason: 'suspended' }, 'auth.session.refused');
      if (!sessionValid(auth.session, a.at)) return ok({ ...auth, session: undefined, needsRoleChoice: false, signedOutReason: 'expired' }, 'auth.session.expired');
      return ok({ ...auth, session: { ...auth.session, lastSeenAt: a.at } });
    }

    case 'auth/signOut':
      return ok({ ...auth, session: undefined, needsRoleChoice: false, challenge: undefined, signup: undefined, signedOutReason: a.reason }, 'auth.logout');

    case 'auth/leaveBlocked':
      return ok({ ...auth, blocked: undefined });

    case 'auth/requestRole': {
      const acc = currentAccount(auth);
      if (!acc) return fail('NO_SESSION', 'Connecte-toi d’abord.');
      if (acc.roles.includes(a.role) || acc.pendingRoles.includes(a.role)) return ok(auth);
      return ok({ ...auth, accounts: { ...auth.accounts, [acc.id]: { ...acc, pendingRoles: [...acc.pendingRoles, a.role] } } }, `auth.role.requested.${a.role}`);
    }

    case 'auth/demoGrantRole': {
      const acc = currentAccount(auth);
      if (!acc) return fail('NO_SESSION', 'Connecte-toi d’abord.');
      if (!acc.pendingRoles.includes(a.role)) return fail('NO_REQUEST', 'Aucune demande en attente pour ce rôle.');
      const next: Account = { ...acc, roles: [...acc.roles, a.role], pendingRoles: acc.pendingRoles.filter((r) => r !== a.role) };
      return ok({ ...auth, accounts: { ...auth.accounts, [acc.id]: next } }, `auth.role.granted.${a.role}`);
    }
  }
}

/** New opaque session id on every sign-in (session fixation). */
function startSession(auth: AuthState, accountId: string, at: string): AuthState {
  const seq = auth.sessionSeq + 1;
  return {
    ...auth,
    sessionSeq: seq,
    session: { id: `S-${seq}-${Math.abs(hash(`${accountId}${at}${seq}`)).toString(36)}`, accountId, createdAt: at, lastSeenAt: at },
    signedOutReason: undefined,
    blocked: undefined,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** Where the app should be, given the auth state (drives the root navigator). */
export type AuthGate = 'onboarding' | 'signin' | 'blocked' | 'role' | 'app';

export function authGate(auth: AuthState): AuthGate {
  if (auth.session) return auth.needsRoleChoice ? 'role' : 'app';
  if (auth.blocked) return 'blocked';
  return auth.onboardingDone ? 'signin' : 'onboarding';
}
