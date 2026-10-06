import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore, setSession } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, driver: null, ready: false });
  const [meta, setMeta] = useState({ cities: [], bodyTypes: [], assistantMode: "rules" });

  const logout = useCallback(async () => {
    await tokenStore.set(null);
    setSession(null);
    setState({ user: null, driver: null, ready: true });
  }, []);

  const refresh = useCallback(async () => {
    const r = await api("/auth/me");
    setState({ user: r.user, driver: r.driver, ready: true });
    return r;
  }, []);

  useEffect(() => {
    api("/meta").then(setMeta).catch(() => {});
    (async () => {
      const t = await tokenStore.get();
      if (!t) return setState((s) => ({ ...s, ready: true }));
      setSession(t, logout);
      try { await refresh(); }
      catch (e) {
        // Выходим только если токен недействителен; при сбое сети оставляем вход и показываем экран входа позже
        if (e.status === 401) await logout();
        else setState((s) => ({ ...s, ready: true, user: null }));
      }
    })();
  }, [logout, refresh]);

  const login = async (t) => {
    await tokenStore.set(t);
    setSession(t, logout);
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh, meta }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
