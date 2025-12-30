"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminApi } from "@/lib/adminApi";

interface AdminUser {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("admin_token");
    const userStr = localStorage.getItem("admin_user");
    
    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await adminApi.adminLogin(email, password);
      if (response && response.token && response.user) {
        localStorage.setItem("admin_token", response.token);
        localStorage.setItem("admin_user", JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Login error:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.status,
      });
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}

