"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, login, register, guestLogin, getCurrentUser, googleAuth } from "../lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  guestSignIn: (name: string) => Promise<void>;
  signInWithGoogle: (token: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("bloom_token");
    const storedUser = localStorage.getItem("bloom_user");

    if (storedToken && storedUser) {
      // Set token and user immediately from localStorage for instant UI update
      setToken(storedToken);
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        // Verify token is still valid in the background
        getCurrentUser(storedToken)
          .then(({ user }) => {
            setUser(user);
            localStorage.setItem("bloom_user", JSON.stringify(user));
          })
          .catch(() => {
            // Token invalid, clear storage
            localStorage.removeItem("bloom_token");
            localStorage.removeItem("bloom_user");
            setToken(null);
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      // No stored auth, set loading to false immediately
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await login({ email, password });
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("bloom_token", response.token);
    localStorage.setItem("bloom_user", JSON.stringify(response.user));
  };

  const signUp = async (name: string, email: string, password: string) => {
    const response = await register({ name, email, password });
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("bloom_token", response.token);
    localStorage.setItem("bloom_user", JSON.stringify(response.user));
  };

  const guestSignIn = async (name: string) => {
    const response = await guestLogin({ name });
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("bloom_token", response.token);
    localStorage.setItem("bloom_user", JSON.stringify(response.user));
  };

  const signInWithGoogle = async (googleToken: string) => {
    const response = await googleAuth(googleToken);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem("bloom_token", response.token);
    localStorage.setItem("bloom_user", JSON.stringify(response.user));
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("bloom_token");
    localStorage.removeItem("bloom_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signUp,
        guestSignIn,
        signInWithGoogle,
        signOut,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

