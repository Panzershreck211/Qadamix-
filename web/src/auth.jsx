import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore, setUnauthorizedHandler } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const [meta, setMeta] = useState({ cities: [], bodyTypes: [], assistantMode: "rules" });

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    api("/meta").then(setMeta).catch(() => {});
    if (!tokenStore.get()) return;
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => { if (e.status === 401) logout(); }) // при сбое сети токен не стираем
      .finally(() => setLoading(false));
  }, [logout]);

  const login = (token, u) => {
    tokenStore.set(token);
    setUser(u);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, meta }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
