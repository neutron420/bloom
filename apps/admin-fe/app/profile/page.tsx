"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Sidebar } from "@/components/Sidebar";
import { User, Mail, Shield, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { isAuthenticated, user, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900">Admin Profile</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your admin account</p>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Header Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-blue-600 rounded-lg flex items-center justify-center text-white text-3xl font-semibold">
                  {user.name?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-1">{user.name}</h2>
                  <p className="text-gray-600 mb-3">Administrator</p>
                  <div className="flex items-center space-x-4">
                    <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-xs text-green-700 font-medium">Active</p>
                    </div>
                    <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-xs text-blue-700 font-medium">Super Admin</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Email Address</p>
                    <p className="text-base font-semibold text-gray-900">{user.email || "N/A"}</p>
                    <p className="text-xs text-gray-500 mt-1">Primary contact email</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Shield className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Role</p>
                    <p className="text-base font-semibold text-gray-900">Administrator</p>
                    <p className="text-xs text-gray-500 mt-1">Full system access</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">User ID</p>
                    <p className="text-base font-semibold text-gray-900 font-mono text-sm break-all">{user.id}</p>
                    <p className="text-xs text-gray-500 mt-1">Unique identifier</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Account Status</p>
                    <p className="text-base font-semibold text-green-600">Active</p>
                    <p className="text-xs text-gray-500 mt-1">All permissions enabled</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Capabilities */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Capabilities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900 mb-1">User Management</p>
                  <p className="text-sm text-gray-600">View, manage, ban, and moderate all users</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900 mb-1">Meeting Control</p>
                  <p className="text-sm text-gray-600">Monitor and manage active meetings</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900 mb-1">Join Requests</p>
                  <p className="text-sm text-gray-600">Review and approve join requests</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-900 mb-1">Analytics</p>
                  <p className="text-sm text-gray-600">Access real-time statistics and reports</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
