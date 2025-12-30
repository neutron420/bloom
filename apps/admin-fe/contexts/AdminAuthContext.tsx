"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminApi } from "@/lib/adminApi";

interface AdminUser {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  isMainAdmin?: boolean;
  role?: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string, adminType?: "SUPER_ADMIN" | "MAIN_ADMIN") => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
        // Enrich user data - check if this is main admin based on email or name
        const isMainAdminUser = 
          userData.email === "mainadmin@example.com" || 
          userData.name === "Main Admin" ||
          userData.isMainAdmin === true ||
          userData.role === "MAIN_ADMIN";
        
        const enrichedUserData = {
          ...userData,
          isMainAdmin: isMainAdminUser,
          role: userData.role || (isMainAdminUser ? "MAIN_ADMIN" : "SUPER_ADMIN"),
        };
        
        // Update localStorage with enriched data
        localStorage.setItem("admin_user", JSON.stringify(enrichedUserData));
        setUser(enrichedUserData);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, adminType?: "SUPER_ADMIN" | "MAIN_ADMIN"): Promise<boolean> => {
    try {
      const response = await adminApi.adminLogin(email, password, adminType);
      if (response && response.token && response.user) {
        // Ensure isMainAdmin and role are set correctly
        const userData = {
          ...response.user,
          isMainAdmin: response.user.isMainAdmin === true || response.user.role === "MAIN_ADMIN",
          role: response.user.role || (response.user.isMainAdmin ? "MAIN_ADMIN" : "SUPER_ADMIN"),
        };
        
        localStorage.setItem("admin_token", response.token);
        localStorage.setItem("admin_user", JSON.stringify(userData));
        setUser(userData);
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

  const refreshUser = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;

    try {
      // Re-login to get fresh user data with isMainAdmin and role
      // For now, we'll update from localStorage if we can determine the role
      const userStr = localStorage.getItem("admin_user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        // If email is mainadmin@example.com, set as main admin
        if (userData.email === "mainadmin@example.com" || userData.name === "Main Admin") {
          const enrichedUserData = {
            ...userData,
            isMainAdmin: true,
            role: "MAIN_ADMIN",
          };
          localStorage.setItem("admin_user", JSON.stringify(enrichedUserData));
          setUser(enrichedUserData);
        }
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        refreshUser,
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

