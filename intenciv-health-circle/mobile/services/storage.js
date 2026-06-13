/**
 * Tokens — stored ONLY in Expo SecureStore (per security spec).
 * User profile is cached separately for offline UI rendering.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS  = 'intenciv.access_token';
const REFRESH = 'intenciv.refresh_token';
const USER    = 'intenciv.user';

export async function saveSession({ access_token, refresh_token, user }) {
  if (access_token)  await SecureStore.setItemAsync(ACCESS, access_token);
  if (refresh_token) await SecureStore.setItemAsync(REFRESH, refresh_token);
  if (user)          await SecureStore.setItemAsync(USER, JSON.stringify(user));
}

export async function saveAccess(token)   { await SecureStore.setItemAsync(ACCESS, token); }
export async function saveUser(user)      { await SecureStore.setItemAsync(USER, JSON.stringify(user)); }
export async function getAccess()         { return SecureStore.getItemAsync(ACCESS); }
export async function getRefresh()        { return SecureStore.getItemAsync(REFRESH); }
export async function getUser() {
  const v = await SecureStore.getItemAsync(USER);
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(USER),
  ]);
}
