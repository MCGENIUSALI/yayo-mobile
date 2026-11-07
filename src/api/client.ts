import { extractTokens, type TokenStore } from './tokens';

export type ApiErrorKind = 'network' | 'timeout' | 'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'too_many' | 'server';

/** A failed call, with a message the app can show as is (in French) and the server's own words for debugging. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    readonly serverMessage?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Pas de connexion au serveur YA YO. Vérifie ton réseau puis réessaie.',
  timeout: 'Le serveur YA YO met trop de temps à répondre. Réessaie.',
  invalid: 'Certaines informations ne sont pas acceptées. Vérifie-les puis réessaie.',
  unauthorized: 'Ta session a expiré. Reconnecte-toi.',
  forbidden: 'Tu n’as pas accès à cette action.',
  not_found: 'Introuvable. Il a peut-être été supprimé.',
  conflict: 'Cette action n’est plus possible : la situation a changé. Actualise puis réessaie.',
  too_many: 'Trop de tentatives. Attends un peu avant de réessayer.',
  server: 'Le serveur YA YO a rencontré un problème. Réessaie dans un instant.',
};

export function kindOf(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'too_many';
  return 'server';
}

/** NestJS errors: { statusCode, message: string | string[], error }. */
export function serverMessageOf(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? body : undefined;
  const m = (body as { message?: unknown }).message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join(' · ') || undefined;
  return typeof m === 'string' ? m : undefined;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Multipart body (photo upload); takes precedence over `body`. */
  form?: FormData;
  /** false for public routes (catalogue, OTP request). Default true: the token is sent when there is one. */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiClient {
  request<T = unknown>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, options?: RequestOptions): Promise<T>;
  readonly tokens: TokenStore;
}

export interface ClientConfig {
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Called once the session cannot be renewed: the app shows the sign-in screen. */
  onSessionLost?: () => void;
}

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const qs = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
}

export function createApiClient({ baseUrl, tokens, fetchImpl = fetch, timeoutMs = 15_000, onSessionLost }: ClientConfig): ApiClient {
  // One refresh at a time: parallel calls that all got a 401 wait for the same renewal.
  let refreshing: Promise<boolean> | null = null;

  async function send(method: string, path: string, o: RequestOptions, bearer: string | undefined): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    o.signal?.addEventListener('abort', onAbort);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    let body: BodyInit | undefined;
    if (o.form) body = o.form;
    else if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.body);
    }
    try {
      return await fetchImpl(buildUrl(baseUrl, path, o.query), { method, headers, body, signal: controller.signal });
    } catch {
      if (o.signal?.aborted) throw new ApiError('network', 0, 'Annulé.');
      throw controller.signal.aborted ? new ApiError('timeout', 0, MESSAGES.timeout) : new ApiError('network', 0, MESSAGES.network);
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
    }
  }

  async function parse(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * The spec does not say how /auth/refresh receives the refresh token; the app
   * sends it as the Bearer token (the usual NestJS refresh guard).
   */
  async function renew(): Promise<boolean> {
    const current = await tokens.get();
    if (!current?.refreshToken) return false;
    const res = await send('POST', '/auth/refresh', {}, current.refreshToken).catch(() => null);
    if (!res?.ok) return false;
    const next = extractTokens(await parse(res));
    if (!next) return false;
    await tokens.set({ accessToken: next.accessToken, refreshToken: next.refreshToken ?? current.refreshToken });
    return true;
  }

  async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, o: RequestOptions = {}): Promise<T> {
    const useAuth = o.auth !== false;
    let token = useAuth ? (await tokens.get())?.accessToken : undefined;
    let res = await send(method, path, o, token);

    if (res.status === 401 && useAuth && token) {
      refreshing ??= renew().finally(() => {
        refreshing = null;
      });
      if (await refreshing) {
        token = (await tokens.get())?.accessToken;
        res = await send(method, path, o, token);
      }
      if (res.status === 401) {
        await tokens.set(null);
        onSessionLost?.();
      }
    }

    const data = await parse(res);
    if (!res.ok) {
      const kind = kindOf(res.status);
      throw new ApiError(kind, res.status, MESSAGES[kind], serverMessageOf(data));
    }
    return data as T;
  }

  return { request, tokens };
}
