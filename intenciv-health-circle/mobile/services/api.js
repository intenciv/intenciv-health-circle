import axios from 'axios';
import { CONFIG } from '../constants/config';
import * as storage from './storage';

export const api = axios.create({ baseURL: CONFIG.API_URL, timeout: 20_000 });

api.interceptors.request.use(async cfg => {
  const t = await storage.getAccess();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config || {};
    if (err.response?.status === 401 && !orig._retry) {
      const rt = await storage.getRefresh();
      if (!rt) return Promise.reject(err);
      orig._retry = true;
      try {
        refreshing ||= axios.post(`${CONFIG.API_URL}/auth/refresh-token`, { refresh_token: rt });
        const { data } = await refreshing;
        refreshing = null;
        await storage.saveAccess(data.access_token);
        orig.headers.Authorization = `Bearer ${data.access_token}`;
        return api(orig);
      } catch (e) {
        refreshing = null;
        await storage.clearSession();
      }
    }
    return Promise.reject(err);
  }
);
