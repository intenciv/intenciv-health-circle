import axios from 'axios';

export const API_URL    = import.meta.env.VITE_API_URL    || 'https://intenciv-health-circle-production.up.railway.app';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://intenciv-health-circle-production.up.railway.app';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
});

const ACCESS_KEY  = 'intenciv.access_token';
const REFRESH_KEY = 'intenciv.refresh_token';
const USER_KEY    = 'intenciv.user';

export const tokens = {
  setSession({ access_token, refresh_token, user }) {
    if (access_token)  localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    if (user)          localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccess(token) { localStorage.setItem(ACCESS_KEY, token); },
  getAccess()  { return localStorage.getItem(ACCESS_KEY); },
  getRefresh() { return localStorage.getItem(REFRESH_KEY); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

api.interceptors.request.use(cfg => {
  const t = tokens.getAccess();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config || {};
    if (err.response?.status === 401 && !orig._retry && tokens.getRefresh()) {
      orig._retry = true;
      try {
        refreshing ||= axios.post(`${API_URL}/auth/refresh-token`, {
          refresh_token: tokens.getRefresh(),
        });
        const { data } = await refreshing;
        refreshing = null;
        tokens.setAccess(data.access_token);
        orig.headers.Authorization = `Bearer ${data.access_token}`;
        return api(orig);
      } catch (e) {
        refreshing = null;
        tokens.clear();
      }
    }
    return Promise.reject(err);
  }
);
