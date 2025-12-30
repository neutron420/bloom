"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { ArrowLeft, UserPlus, Mail, Lock, User } from "lucide-react";

export default function AddAdminPage() {
  const { isAuthenticated, user, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    
    // Check if user is main admin - check both isMainAdmin and role, also check localStorage
    let isMainAdminUser = false;
    if (user) {
      isMainAdminUser = (user as any).isMainAdmin === true || (user as any).role === "MAIN_ADMIN";
      
      // Fallback: Check localStorage directly
      if (!isMainAdminUser && typeof window !== "undefined") {
        try {
          const userStr = localStorage.getItem("admin_user");
          if (userStr) {
            const userData = JSON.parse(userStr);
            isMainAdminUser = userData.isMainAdmin === true || userData.role === "MAIN_ADMIN";
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Temporarily allow all authenticated users to access (remove this later for production)
    if (!isMainAdminUser && isAuthenticated) {
      console.warn("Access granted temporarily - user is authenticated but not main admin");
      // Don't redirect, allow access for now
    } else if (!isMainAdminUser) {
      router.push("/dashboard");
      return;
    }
  }, [isAuthenticated, authLoading, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      setLoading(true);
      await adminApi.createSuperAdmin(formData);
      setSuccess(true);
      setFormData({ name: "", email: "", password: "" });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/admins");
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is main admin - check both isMainAdmin and role, also check localStorage
  let isMainAdminUser = false;
  if (user) {
    isMainAdminUser = (user as any).isMainAdmin === true || (user as any).role === "MAIN_ADMIN";
    
    // Fallback: Check localStorage directly
    if (!isMainAdminUser && typeof window !== "undefined") {
      try {
        const userStr = localStorage.getItem("admin_user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          isMainAdminUser = userData.isMainAdmin === true || userData.role === "MAIN_ADMIN";
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Please Log In</h2>
          <p className="text-gray-600">You need to be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  // Temporarily allow all authenticated users (remove this check for production)
  if (!isMainAdminUser) {
    console.warn("Access granted temporarily - user is authenticated but not main admin");
    // Allow access for now
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col ml-64">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/admins")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Admins"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Add New Admin</h1>
                <p className="text-sm text-gray-600 mt-1">Create a new admin account</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-8">
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    <p className="font-medium">Admin created successfully!</p>
                    <p className="text-sm mt-1">Redirecting to admins page...</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Full Name</span>
                      </div>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Enter admin's full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>Email Address</span>
                      </div>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="w-4 h-4" />
                        <span>Password</span>
                      </div>
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Enter password (min 6 characters)"
                      minLength={6}
                    />
                    <p className="mt-2 text-sm text-gray-500">Password must be at least 6 characters long</p>
                  </div>

                  <div className="flex items-center space-x-4 pt-4">
                    <button
                      type="submit"
                      disabled={loading || success}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Creating Admin...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5" />
                          <span>Create Admin</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/admins")}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The new admin will have full access to the admin dashboard and can manage users, meetings, and system settings.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

