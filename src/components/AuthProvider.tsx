"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { STAFF_ROLES, type UserProfile } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isStaff: boolean;
  /** Set when sign-in worked but our server couldn't create/load the profile. */
  setupError: string | null;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  isStaff: false,
  setupError: null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsubProfile?.();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setSetupError(null);
      let bootstrapped = false;
      // Ensures the profile exists (and grants admin to configured owners). Retry once for cold starts.
      for (let attempt = 0; attempt < 2 && !bootstrapped; attempt++) {
        try {
          await api("/api/auth/bootstrap", { name: u.displayName ?? undefined });
          bootstrapped = true;
        } catch (e) {
          console.error("bootstrap failed", e);
          if (attempt === 1) setSetupError("You're signed in, but we couldn't set up your account just now. Please try again in a minute.");
          else await new Promise((r) => setTimeout(r, 1200));
        }
      }
      unsubProfile = onSnapshot(
        doc(db, "users", u.uid),
        (s) => {
          setProfile(s.exists() ? (s.data() as UserProfile) : null);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        isStaff: !!profile && STAFF_ROLES.includes(profile.role),
        setupError,
        logout: () => signOut(auth),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
