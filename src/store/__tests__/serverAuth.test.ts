import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authGate, authReduce, createAuthState, type Account, type AuthState } from '@/domain/auth';
import { authErrorMessage, saveProfile, sendCode, toAccount, verifyCode } from '../serverAuth';

jest.mock('@/lib/supabase', () => ({ supabase: null, isServerMode: () => false }));

const at = (m: number) => new Date(Date.UTC(2026, 10, 8, 10, m)).toISOString();

const row: { id: string; name: string; phone: string | null; email: string | null; city: string | null; commune: string | null; is_admin: boolean; suspended: boolean; onboarded_at: string | null; created_at: string } = {
  id: 'u1',
  name: 'Jean Mukendi',
  phone: '+243812345678',
  email: null,
  city: 'Kinshasa',
  commune: 'Kalamu',
  is_admin: false,
  suspended: false,
  onboarded_at: at(0),
  created_at: at(0),
};

/** Minimal stand-in for the Supabase client: auth calls and `from(table)…` chains. */
function fakeClient(opts: { otpError?: string; verifyError?: string; profile?: typeof row | null; shop?: { status: string } | null; updateError?: string }) {
  const calls: { op: string; args: unknown }[] = [];
  const chain = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      update: (fields: unknown) => {
        calls.push({ op: `update:${table}`, args: fields });
        return { eq: async () => ({ error: opts.updateError ? { code: opts.updateError } : null }) };
      },
      maybeSingle: async () => ({
        data: table === 'profiles' ? (opts.profile === undefined ? row : opts.profile) : table === 'shops' ? (opts.shop ?? null) : null,
        error: null,
      }),
    };
    return q;
  };
  const client = {
    auth: {
      signInWithOtp: async (args: unknown) => {
        calls.push({ op: 'otp', args });
        return { error: opts.otpError ? { code: opts.otpError } : null };
      },
      verifyOtp: async (args: unknown) => {
        calls.push({ op: 'verify', args });
        return opts.verifyError ? { data: { user: null }, error: { code: opts.verifyError } } : { data: { user: { id: 'u1' } }, error: null };
      },
      updateUser: async (args: unknown) => {
        calls.push({ op: 'updateUser', args });
        return { error: null };
      },
    },
    from: chain,
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('server sign-in (Supabase)', () => {
  it('asks Supabase to send the code by SMS or e-mail', async () => {
    const f = fakeClient({});
    await expect(sendCode('phone', '+243812345678', 'sms', f.client)).resolves.toEqual({ ok: true });
    await sendCode('email', 'jean@exemple.cd', 'email', f.client);
    expect(f.calls.map((c) => c.args)).toEqual([
      { phone: '+243812345678', options: { shouldCreateUser: true } },
      { email: 'jean@exemple.cd', options: { shouldCreateUser: true } },
    ]);
  });

  it('explains when SMS are not open yet', async () => {
    const f = fakeClient({ otpError: 'phone_provider_disabled' });
    await expect(sendCode('phone', '+243812345678', 'sms', f.client)).resolves.toMatchObject({ ok: false, code: 'SMS_UNAVAILABLE' });
    expect(authErrorMessage('over_email_send_rate_limit', 'email').code).toBe('RATE_LIMITED');
    expect(authErrorMessage(undefined, 'email').message).toMatch(/serveur YA YO/);
  });

  it('verifies the code and loads the account, or null when the profile is not created yet', async () => {
    const known = await verifyCode('phone', '+243812345678', '123456', fakeClient({}).client);
    expect(known).toMatchObject({ ok: true, userId: 'u1', account: { id: 'u1', name: 'Jean Mukendi', roles: ['buyer'] } });
    const fresh = await verifyCode('email', 'new@exemple.cd', '123456', fakeClient({ profile: { ...row, name: '', onboarded_at: null } }).client);
    expect(fresh).toMatchObject({ ok: true, userId: 'u1', account: null });
    const wrong = await verifyCode('phone', '+243812345678', '000000', fakeClient({ verifyError: 'otp_expired' }).client);
    expect(wrong).toMatchObject({ ok: false, code: 'WRONG_CODE' });
  });

  it('saves A7 and asks Supabase to confirm the optional e-mail', async () => {
    const f = fakeClient({});
    const r = await saveProfile('u1', { name: ' Jean   Mukendi ', city: 'Kinshasa', commune: 'Kalamu', email: 'jean@exemple.cd' }, f.client);
    expect(r).toMatchObject({ ok: true, account: { id: 'u1' } });
    expect(f.calls.find((c) => c.op === 'update:profiles')?.args).toMatchObject({ name: 'Jean Mukendi', city: 'Kinshasa', commune: 'Kalamu' });
    expect(f.calls.find((c) => c.op === 'updateUser')?.args).toEqual({ email: 'jean@exemple.cd' });
  });

  it('derives roles from the shop and courier reviews, never from the app', () => {
    expect(toAccount(row, { status: 'approved' }, { status: 'pending' })).toMatchObject({ roles: ['buyer', 'seller'], pendingRoles: ['courier'] });
    expect(toAccount({ ...row, suspended: true, is_admin: true })).toMatchObject({ status: 'suspended', roles: ['buyer', 'admin'] });
  });
});

describe('auth state in server mode', () => {
  const account = toAccount(row) as Account;
  const sent = (auth: AuthState) => {
    const r = authReduce(auth, { type: 'auth/serverCodeSent', kind: 'phone', target: '81 234 5678', channel: 'sms', at: at(1) });
    if (!r.ok) throw new Error(r.message);
    return r.auth;
  };

  it('keeps no code on the phone and refuses the demo check', () => {
    const auth = sent(createAuthState());
    expect(auth.challenge).toMatchObject({ server: true, code: '', target: '+243812345678' });
    expect(authReduce(auth, { type: 'auth/verifyCode', code: '', at: at(2) }).ok).toBe(false);
  });

  it('counts wrong codes and locks after three (E8)', () => {
    let auth = sent(createAuthState());
    for (let i = 0; i < 2; i++) {
      const r = authReduce(auth, { type: 'auth/serverWrongCode', at: at(2) });
      expect(r.ok).toBe(false);
      auth = r.auth ?? auth;
    }
    const third = authReduce(auth, { type: 'auth/serverWrongCode', at: at(2) });
    expect(third).toMatchObject({ ok: false, code: 'LOCKED' });
  });

  it('signs in a known account, or opens A7 for a new one', () => {
    const signedIn = authReduce(sent(createAuthState()), { type: 'auth/serverVerified', userId: 'u1', account, at: at(2) });
    expect(signedIn.ok && authGate(signedIn.auth)).toBe('app');
    const fresh = authReduce(sent(createAuthState()), { type: 'auth/serverVerified', userId: 'u9', account: null, at: at(2) });
    expect(fresh.ok && fresh.auth.signup).toMatchObject({ userId: 'u9', target: '+243812345678' });
    const saved = fresh.ok ? authReduce(fresh.auth, { type: 'auth/serverProfileSaved', account: { ...account, id: 'u9' }, at: at(3) }) : fresh;
    expect(saved.ok && authGate(saved.auth)).toBe('role');
  });

  it('blocks a suspended account (E9) and restores a kept session', () => {
    const blocked = authReduce(sent(createAuthState()), { type: 'auth/serverVerified', userId: 'u1', account: { ...account, status: 'suspended' }, at: at(2) });
    expect(blocked.ok && authGate(blocked.auth)).toBe('blocked');
    const restored = authReduce(createAuthState(), { type: 'auth/serverRestored', account, at: at(4) });
    expect(restored.ok && restored.auth.session?.accountId).toBe('u1');
  });
});
