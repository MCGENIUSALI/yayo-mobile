import { createApiClient } from './client';
import { API_URL } from './config';
import { createEndpoints, type Endpoints } from './endpoints';
import { deviceTokenStore } from './deviceTokens';

export { ApiError } from './client';
export { isServerMode } from './config';

let lostListener: (() => void) | undefined;

/** The API, or null in demo mode (no EXPO_PUBLIC_API_URL). */
export const api: Endpoints | null = API_URL
  ? createEndpoints(createApiClient({ baseUrl: API_URL, tokens: deviceTokenStore, onSessionLost: () => lostListener?.() }))
  : null;

/** The store registers here to show the sign-in screen when the server ends the session. */
export function onSessionLost(listener: (() => void) | undefined) {
  lostListener = listener;
}
