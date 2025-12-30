"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";

export default function RefreshUserPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Try to refresh user data from API
    const refreshUser = async () => {
      try {
        // Get current token
        const token = localStorage.getItem("admin_token");
        if (!token) {
          router.push("/login");
          return;
        }

        // Call an API endpoint that returns user info
        // For now, just reload the page after clearing and re-reading localStorage
        const userStr = localStorage.getItem("admin_user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          console.log("Current user data:", userData);
          
          // Force page reload to refresh context
          window.location.reload();
        }
      } catch (error) {
        console.error("Error refreshing user:", error);
      }
    };

    refreshUser();
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Refreshing user data...</p>
      </div>
    </div>
  );
}

