import * as SecureStore from "expo-secure-store";

const KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  USER: "user",
};

export async function saveAuth(
  access: string,
  refresh: string,
  user: object
) {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, access);
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refresh);
  await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getUser(): Promise<any | null> {
  const u = await SecureStore.getItemAsync(KEYS.USER);
  return u ? JSON.parse(u) : null;
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.USER);
}
