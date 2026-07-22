"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

export type AuthorizationState = "checking" | "authorized" | "denied";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authorization: AuthorizationState;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorization, setAuthorization] = useState<AuthorizationState>("checking");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.email) {
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "allowedUsers", user.email))
      .then((snapshot) => {
        if (!cancelled) setAuthorization(snapshot.exists() ? "authorized" : "denied");
      })
      .catch(() => {
        // allowedUsersに未登録の場合、Firestoreルールによりpermission-deniedで拒否される
        if (!cancelled) setAuthorization("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value: AuthContextValue = {
    user,
    loading,
    authorization,
    async signInWithEmail(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signInWithGoogle() {
      await signInWithPopup(auth, googleProvider);
    },
    async logout() {
      await signOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function getUserLabel(user: User): string {
  return user.displayName || user.email || "不明なユーザー";
}
