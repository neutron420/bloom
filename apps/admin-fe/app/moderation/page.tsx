"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { AlertTriangle, User, X, CheckCircle } from "lucide-react";

export default function ModerationPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any>(null);
  const [type, setType] = useState<"users" | "messages" | "all">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchQueue();
  }, [isAuthenticated, authLoading, router, type]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getModerationQueue(1, 50, type);
      setQueue(data);
    } catch (error) {
      console.error("Failed to fetch moderation queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnflag = async (userId: string) => {
    if (confirm("Unflag this user?")) {
      try {
        await adminApi.unflagUser(userId);
        fetchQueue();
      } catch (error) {
        alert("Failed to unflag user");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col ml-64">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Moderation Queue</h1>
                <p className="text-sm text-gray-600 mt-1">Review flagged content and users</p>
              </div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "users" | "messages" | "all")}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg"
              >
                <option value="all">All</option>
                <option value="users">Users</option>
                <option value="messages">Messages</option>
              </select>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : queue ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Flagged Users</p>
                      <p className="text-2xl font-semibold text-gray-900">{queue.summary?.flaggedUsers || 0}</p>
                    </div>
                    <AlertTriangle className="w-10 h-10 text-orange-600" />
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Flagged Messages</p>
                      <p className="text-2xl font-semibold text-gray-900">{queue.summary?.flaggedMessages || 0}</p>
                    </div>
                    <AlertTriangle className="w-10 h-10 text-red-600" />
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Total Items</p>
                      <p className="text-2xl font-semibold text-gray-900">{queue.summary?.total || 0}</p>
                    </div>
                    <AlertTriangle className="w-10 h-10 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Flagged Users */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Flagged Users</h3>
                </div>
                {queue.data?.users?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Flagged At</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reason</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Stats</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {queue.data.users.map((user: any) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                  {user.name?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{user.name}</p>
                                  <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {user.flaggedAt ? new Date(user.flaggedAt).toLocaleString() : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {user.flagReason || "No reason provided"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <div className="space-y-1">
                                <p>Messages: {user.stats?.messages || 0}</p>
                                <p>Meetings: {user.stats?.meetings || 0}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleUnflag(user.id)}
                                className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-sm font-medium flex items-center space-x-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Unflag</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No flagged users</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-red-600 font-medium">Failed to load moderation queue</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

