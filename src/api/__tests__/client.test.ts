import { describe, expect, it, jest } from '@jest/globals';
import { ApiError, buildUrl, createApiClient, serverMessageOf } from '../client';
import { normalizeBaseUrl } from '../config';
import { createEndpoints } from '../endpoints';
import { extractTokens, memoryTokenStore } from '../tokens';

type Call = { url: string; init: RequestInit };

function fakeFetch(...answers: (Partial<{ status: number; body: unknown }> | Error)[]) {
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 200, body: {} };
    if (a instanceof Error) throw a;
    const status = a.status ?? 200;
    const text = a.body === undefined ? '' : typeof a.body === 'string' ? a.body : JSON.stringify(a.body);
    return { ok: status >= 200 && status < 300, status, text: async () => text } as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

describe('API client', () => {
  it('builds URLs and drops empty query values', () => {
    expect(buildUrl('https://x.dev', '/products', { page: 1, search: 'jbl sound', category: undefined, mine: '' })).toBe('https://x.dev/products?page=1&search=jbl%20sound');
  });

  it('accepts only http(s) base URLs and trims the slash', () => {
    expect(normalizeBaseUrl(' https://yayo-backend.fly.dev/ ')).toBe('https://yayo-backend.fly.dev');
    expect(normalizeBaseUrl('yayo-backend.fly.dev')).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
  });

  it('sends the token, JSON body and returns the parsed answer', async () => {
    const f = fakeFetch({ status: 201, body: { id: 'a1' } });
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens: memoryTokenStore({ accessToken: 'T1' }), fetchImpl: f.impl });
    await expect(api.request('POST', '/users/addresses', { body: { street: 'Av. Kasa-Vubu' } })).resolves.toEqual({ id: 'a1' });
    expect(header(f.calls[0]!, 'Authorization')).toBe('Bearer T1');
    expect(header(f.calls[0]!, 'Content-Type')).toBe('application/json');
    expect(f.calls[0]!.init.body).toBe('{"street":"Av. Kasa-Vubu"}');
  });

  it('never sends the token to public routes', async () => {
    const f = fakeFetch({ body: [] });
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens: memoryTokenStore({ accessToken: 'T1' }), fetchImpl: f.impl });
    await api.request('GET', '/categories', { auth: false });
    expect(header(f.calls[0]!, 'Authorization')).toBeUndefined();
  });

  it('turns NestJS errors into French messages and keeps the server text', async () => {
    const f = fakeFetch({ status: 400, body: { statusCode: 400, message: ['phoneE164 must match', 'x'], error: 'Bad Request' } });
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens: memoryTokenStore(), fetchImpl: f.impl });
    const e = (await api.request('POST', '/auth/otp/request', { auth: false }).catch((x) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.kind).toBe('invalid');
    expect(e.message).toMatch(/ne sont pas acceptées/);
    expect(e.serverMessage).toBe('phoneE164 must match · x');
  });

  it('reports a network failure without throwing a raw TypeError', async () => {
    const f = fakeFetch(new TypeError('Network request failed'));
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens: memoryTokenStore(), fetchImpl: f.impl });
    await expect(api.request('GET', '/health', { auth: false })).rejects.toMatchObject({ kind: 'network', status: 0 });
  });

  it('renews the session once on 401 and replays the call', async () => {
    const tokens = memoryTokenStore({ accessToken: 'old', refreshToken: 'R' });
    const f = fakeFetch({ status: 401 }, { status: 201, body: { accessToken: 'new' } }, { body: { ok: true } });
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens, fetchImpl: f.impl });
    await expect(api.request('GET', '/orders')).resolves.toEqual({ ok: true });
    expect(f.calls[1]!.url).toBe('https://x.dev/auth/refresh');
    expect(header(f.calls[1]!, 'Authorization')).toBe('Bearer R');
    expect(header(f.calls[2]!, 'Authorization')).toBe('Bearer new');
    await expect(tokens.get()).resolves.toEqual({ accessToken: 'new', refreshToken: 'R' });
  });

  it('signs out when the session cannot be renewed', async () => {
    const tokens = memoryTokenStore({ accessToken: 'old', refreshToken: 'R' });
    const lost = jest.fn();
    const f = fakeFetch({ status: 401 }, { status: 401 });
    const api = createApiClient({ baseUrl: 'https://x.dev', tokens, fetchImpl: f.impl, onSessionLost: lost });
    await expect(api.request('GET', '/orders')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(lost).toHaveBeenCalledTimes(1);
    await expect(tokens.get()).resolves.toBeNull();
  });

  it('reads the usual token shapes', () => {
    expect(extractTokens({ accessToken: 'a', refreshToken: 'r' })).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(extractTokens({ access_token: 'a' })).toEqual({ accessToken: 'a', refreshToken: undefined });
    expect(extractTokens({ tokens: { accessToken: 'a', refreshToken: 'r' }, user: {} })).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(extractTokens({ ok: true })).toBeNull();
    expect(serverMessageOf('oops')).toBe('oops');
  });
});

describe('endpoints', () => {
  it('phone sign-in stores the tokens returned by /auth/otp/verify', async () => {
    const tokens = memoryTokenStore();
    const f = fakeFetch({ status: 201, body: { challengeId: 'ch1' } }, { body: { accessToken: 'A', refreshToken: 'R', user: { id: 'u1' } } });
    const e = createEndpoints(createApiClient({ baseUrl: 'https://x.dev', tokens, fetchImpl: f.impl }));
    await expect(e.auth.requestPhoneCode('+243812345678')).resolves.toMatchObject({ challengeId: 'ch1' });
    expect(f.calls[0]!.init.body).toBe('{"phoneE164":"+243812345678"}');
    await e.auth.verifyPhoneCode('ch1', '123456');
    await expect(tokens.get()).resolves.toEqual({ accessToken: 'A', refreshToken: 'R' });
  });

  it('logout forgets the tokens even if the server call fails', async () => {
    const tokens = memoryTokenStore({ accessToken: 'A' });
    const f = fakeFetch({ status: 500 });
    const e = createEndpoints(createApiClient({ baseUrl: 'https://x.dev', tokens, fetchImpl: f.impl }));
    await expect(e.auth.logout()).rejects.toBeInstanceOf(ApiError);
    await expect(tokens.get()).resolves.toBeNull();
  });

  it('encodes ids in paths and sends cart quantities', async () => {
    const f = fakeFetch({ body: {} });
    const e = createEndpoints(createApiClient({ baseUrl: 'https://x.dev', tokens: memoryTokenStore({ accessToken: 'A' }), fetchImpl: f.impl }));
    await e.cart.setQuantity('p/1', 'JBL-NOIR', 2);
    expect(f.calls[0]!.url).toBe('https://x.dev/cart/p%2F1/JBL-NOIR');
    expect(f.calls[0]!.init.method).toBe('PATCH');
    expect(f.calls[0]!.init.body).toBe('{"quantity":2}');
  });
});
