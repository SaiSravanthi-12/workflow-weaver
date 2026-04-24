/**
 * Auth has been removed from the app — this stub keeps the same surface so
 * existing imports continue to compile, but every method is a no-op and the
 * app behaves as if the user is always signed in (anonymously).
 */
import { createContext, useContext, type ReactNode } from "react";

interface StubUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: StubUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const STUB_USER: StubUser = { id: "local", email: "designer@local" };

const value: AuthContextValue = {
  user: STUB_USER,
  loading: false,
  signInWithPassword: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {
    /* no-op */
  },
};

const AuthContext = createContext<AuthContextValue>(value);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
