export interface Tokens {
  accessToken: string;
  refreshToken?: string;
}

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}

export function memoryTokenStore(initial: Tokens | null = null): TokenStore {
  let t = initial;
  return {
    get: async () => t,
    set: async (next) => {
      t = next;
    },
  };
}

/**
 * The OpenAPI description does not document the login response. These are the
 * usual NestJS shapes; `npm run api:check` shows the real one.
 */
export function extractTokens(body: unknown): Tokens | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const nested = (b.tokens ?? b.data) as Record<string, unknown> | undefined;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = b[k] ?? nested?.[k];
      if (typeof v === 'string' && v) return v;
    }
    return undefined;
  };
  const accessToken = pick('accessToken', 'access_token', 'token', 'jwt');
  if (!accessToken) return null;
  return { accessToken, refreshToken: pick('refreshToken', 'refresh_token') };
}
