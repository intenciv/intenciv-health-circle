import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import * as storage from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);

  const refreshUser = useCallback(async () => {
    const cached = await storage.getUser();
    setUser(cached);
  }, []);

  useEffect(() => {
    (async () => {
      const u = await storage.getUser();
      setUser(u);
      if (u) connectSocket().catch(() => {});
      setLoading(false);
    })();
  }, []);

  async function setSession(data) {
    await storage.saveSession(data);
    setUser(data.user);
    connectSocket().catch(() => {});
  }

  async function updateUser(patch) {
    const next = { ...(user || {}), ...patch };
    await storage.saveUser(next);
    setUser(next);
  }

  async function logout() {
    disconnectSocket();
    await storage.clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, setSession, updateUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { api };
