import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, IdentifierKind, OtpChannel, Role } from '@/domain/auth';
import { supabase } from '@/lib/supabase';

/**
 * Connexion par code avec Supabase Auth (A5–A7, E8, E9).
 * Le serveur génère, envoie et vérifie le code ; l'app n'en voit jamais la valeur.
 * Le profil (nom, ville, commune) vit dans la table `profiles`.
 */

export type ServerFailure = { ok: false; code: string; message: string };

const NETWORK = 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.';

/** Supabase error codes → message shown on A5/A6. */
export function authErrorMessage(code: string | undefined, kind: IdentifierKind): ServerFailure {
  switch (code) {
    case 'otp_expired':
      // Supabase uses the same code for a wrong code and an expired one.
      return { ok: false, code: 'WRONG_CODE', message: 'Code incorrect ou expiré. Vérifie les chiffres, ou demande un nouveau code.' };
    case 'over_sms_send_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return { ok: false, code: 'RATE_LIMITED', message: 'Trop de codes demandés. Réessaie dans une heure ou contacte le support.' };
    case 'phone_provider_disabled':
    case 'sms_send_failed':
      return { ok: false, code: 'SMS_UNAVAILABLE', message: 'L’envoi de SMS n’est pas encore ouvert. Connecte-toi avec ton e-mail.' };
    case 'email_provider_disabled':
    case 'email_address_invalid':
      return { ok: false, code: 'EMAIL_UNAVAILABLE', message: kind === 'email' ? 'Cette adresse e-mail n’est pas acceptée.' : 'Connexion impossible pour l’instant.' };
    case 'user_banned':
      return { ok: false, code: 'SUSPENDED', message: 'Ton compte est en cours d’examen. Contacte le support YA YO.' };
    case 'network':
      return { ok: false, code: 'NETWORK', message: NETWORK };
    default:
      return { ok: false, code: 'SERVER', message: 'Le serveur YA YO n’a pas pu répondre. Réessaie dans un instant.' };
  }
}

const codeOf = (e: unknown): string | undefined => {
  if (!e || typeof e !== 'object') return undefined;
  const err = e as { code?: string; name?: string; status?: number };
  if (err.code) return err.code;
  if (err.name === 'AuthRetryableFetchError' || err.status === 0) return 'network';
  return undefined;
};

function client(c?: SupabaseClient | null): SupabaseClient {
  const x = c ?? supabase;
  if (!x) throw new Error('Supabase non configuré');
  return x;
}

/** A5 / A6 « Recevoir un nouveau code ». Supabase envoie par SMS ou par e-mail ; pas d'appel vocal. */
export async function sendCode(kind: IdentifierKind, target: string, _channel: OtpChannel, c?: SupabaseClient | null): Promise<{ ok: true } | ServerFailure> {
  try {
    const { error } = await client(c).auth.signInWithOtp(
      kind === 'phone' ? { phone: target, options: { shouldCreateUser: true } } : { email: target, options: { shouldCreateUser: true } },
    );
    return error ? authErrorMessage(codeOf(error), kind) : { ok: true };
  } catch (e) {
    return authErrorMessage(codeOf(e) ?? 'network', kind);
  }
}

export type VerifyResult = { ok: true; userId: string; account: Account | null } | ServerFailure;

/** A6 : vérifie le code, puis charge le compte (null s'il reste à créer le profil, A7). */
export async function verifyCode(kind: IdentifierKind, target: string, code: string, c?: SupabaseClient | null): Promise<VerifyResult> {
  try {
    const { data, error } = await client(c).auth.verifyOtp(
      kind === 'phone' ? { phone: target, token: code, type: 'sms' } : { email: target, token: code, type: 'email' },
    );
    if (error || !data.user) return authErrorMessage(codeOf(error), kind);
    const account = await loadAccount(data.user.id, c);
    return { ok: true, userId: data.user.id, account };
  } catch (e) {
    return authErrorMessage(codeOf(e) ?? 'network', kind);
  }
}

interface ProfileRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  commune: string | null;
  is_admin: boolean;
  suspended: boolean;
  onboarded_at: string | null;
  created_at: string;
}

/** Profile row + shop / courier status → the app's Account. Null until A7 is done. */
export function toAccount(p: ProfileRow, shop?: { status: string } | null, courier?: { status: string } | null): Account | null {
  if (!p.onboarded_at || !p.name.trim()) return null;
  const roles: Role[] = ['buyer'];
  const pendingRoles: Role[] = [];
  if (shop?.status === 'approved') roles.push('seller');
  else if (shop?.status === 'pending') pendingRoles.push('seller');
  if (courier?.status === 'approved') roles.push('courier');
  else if (courier?.status === 'pending') pendingRoles.push('courier');
  if (p.is_admin) roles.push('admin');
  return {
    id: p.id,
    phone: p.phone ?? undefined,
    email: p.email ?? undefined,
    name: p.name,
    city: p.city ?? '',
    commune: p.commune ?? '',
    roles,
    pendingRoles,
    status: p.suspended ? 'suspended' : 'active',
    createdAt: p.created_at,
    termsAcceptedAt: p.onboarded_at,
  };
}

export async function loadAccount(userId: string, c?: SupabaseClient | null): Promise<Account | null> {
  const db = client(c);
  const [profile, shop, courier] = await Promise.all([
    db.from('profiles').select('id, name, phone, email, city, commune, is_admin, suspended, onboarded_at, created_at').eq('id', userId).maybeSingle(),
    db.from('shops').select('status').eq('owner_id', userId).maybeSingle(),
    db.from('couriers').select('status').eq('user_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (!profile.data) return null;
  return toAccount(profile.data as ProfileRow, shop.data, courier.data);
}

/** A7 : enregistre le profil. L'e-mail facultatif d'un compte téléphone va dans le profil. */
export async function saveProfile(
  userId: string,
  profile: { name: string; city: string; commune: string; email?: string },
  c?: SupabaseClient | null,
): Promise<{ ok: true; account: Account } | ServerFailure> {
  try {
    const db = client(c);
    const fields: Record<string, string> = {
      name: profile.name.trim().replace(/\s+/g, ' '),
      city: profile.city,
      commune: profile.commune,
      onboarded_at: new Date().toISOString(),
    };
    const { error } = await db.from('profiles').update(fields).eq('id', userId);
    if (error) return authErrorMessage(codeOf(error), 'phone');
    if (profile.email?.trim()) {
      // Never linked without proof: Supabase e-mails a confirmation link, and the
      // address reaches the profile only once confirmed (trigger on auth.users).
      // A failure here does not block the account.
      await db.auth.updateUser({ email: profile.email.trim() }).catch(() => undefined);
    }
    const account = await loadAccount(userId, c);
    if (!account) return { ok: false, code: 'SERVER', message: 'Le profil n’a pas été enregistré. Réessaie.' };
    return { ok: true, account };
  } catch (e) {
    return authErrorMessage(codeOf(e) ?? 'network', 'phone');
  }
}

export async function signOutServer(c?: SupabaseClient | null): Promise<void> {
  try {
    await client(c).auth.signOut();
  } catch {
    // Already signed out or offline: the local session is closed anyway.
  }
}
