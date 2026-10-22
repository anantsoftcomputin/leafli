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
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  isStaff: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      try {
        // Ensures the profile exists (and grants admin to configured owners).
        await api("/api/auth/bootstrap", { name: u.displayName ?? undefined });
      } catch (e) {
        console.error("bootstrap failed", e);
      }
      unsubProfile = onSnapshot(doc(db, "users", u.uid), (s) => {
        setProfile(s.exists() ? (s.data() as UserProfile) : null);
        setLoading(false);
      });
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
        logout: () => signOut(auth),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
