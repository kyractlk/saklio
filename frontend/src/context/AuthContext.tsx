import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";
import { auth } from "@/src/lib/firebase";
import type { ThemeMode } from "@/src/theme";

export interface User {
  id: string;
  name: string;
  email: string;
  theme: ThemeMode;
  currency: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  theme: ThemeMode;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setTheme: (t: ThemeMode) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>("soft");

  const loadProfile = useCallback(async () => {
    const savedTheme = await storage.getItem<ThemeMode>("saklio_theme", "soft");
    if (savedTheme) setThemeState(savedTheme);
    if (!auth.currentUser) {
      setUser(null);
      return;
    }
    try {
      const me = (await api.me()) as User;
      setUser(me);
      if (me.theme) {
        setThemeState(me.theme);
        await storage.setItem("saklio_theme", me.theme);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async () => {
      await loadProfile();
      setLoading(false);
    });
    return unsub;
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res: any = await api.login(email, password);
    setUser(res.user);
    if (res.user.theme) {
      setThemeState(res.user.theme);
      await storage.setItem("saklio_theme", res.user.theme);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const res: any = await api.register(name, email, password);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);

  const setTheme = useCallback(async (t: ThemeMode) => {
    setThemeState(t);
    await storage.setItem("saklio_theme", t);
    try {
      await api.updateProfile({ theme: t });
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = (await api.me()) as User;
      setUser(me);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, theme, signIn, signUp, signOut, setTheme, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
