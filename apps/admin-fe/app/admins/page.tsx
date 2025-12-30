"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { UserCog, Plus, Edit2, Trash2, Power, PowerOff, X, LogOut, User } from "lucide-react";

export default function AdminsPage() {
  const { isAuthenticated, user, loading: authLoading, logout } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

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
    
    fetchAdmins();
  }, [isAuthenticated, authLoading, router, user]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminApi.getSuperAdmins();
      console.log("Fetched admins data:", data);
      const adminsList = data.admins || [];
      console.log("Admins list:", adminsList);
      setAdmins(adminsList);
    } catch (error: any) {
      console.error("Failed to fetch admins:", error);
      setError(error.message || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (admin: any) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: "", // Don't pre-fill password
    });
    setShowEditModal(true);
    setError("");
  };

  const handleUpdate = async () => {
    if (!formData.name || !formData.email) {
      setError("Name and email are required");
      return;
    }

    try {
      setError("");
      const updateData: any = {
        name: formData.name,
        email: formData.email,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      await adminApi.updateSuperAdmin(editingAdmin.id, updateData);
      setShowEditModal(false);
      setEditingAdmin(null);
      setFormData({ name: "", email: "", password: "" });
      fetchAdmins();
    } catch (error: any) {
      setError(error.message || "Failed to update admin");
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    if (id === user?.id) {
      alert("Cannot deactivate yourself");
      return;
    }

    if (confirm(`Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this admin?`)) {
      try {
        await adminApi.toggleSuperAdmin(id);
        fetchAdmins();
      } catch (error: any) {
        alert(error.message || "Failed to toggle admin status");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (id === user?.id) {
      alert("Cannot delete yourself");
      return;
    }

    if (confirm("Are you sure you want to delete this admin? This action cannot be undone.")) {
      try {
        await adminApi.deleteSuperAdmin(id);
        fetchAdmins();
      } catch (error: any) {
        alert(error.message || "Failed to delete admin");
      }
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
          <p className="text-gray-600 mb-4">You need to be logged in to access this page.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Temporarily allow all authenticated users (remove this check for production)
  if (!isMainAdminUser) {
    console.warn("Access granted temporarily - user is authenticated but not main admin");
    // Allow access for now, but show a warning
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col ml-64">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Admin Management</h1>
                <p className="text-xs text-gray-600 mt-0.5">Manage admin accounts</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push("/admins/add")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 shadow-md font-medium text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Admin</span>
                </button>
                {/* Profile & Logout */}
                <div className="flex items-center space-x-2 pl-3 border-l border-gray-200">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "A"}
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs font-medium text-gray-900">{user?.name || "Admin"}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email || ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {error && !showEditModal && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {/* Summary Stats */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-0.5">Total Admins</p>
                  <p className="text-2xl font-bold text-gray-900">{admins.length}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-0.5">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {admins.filter(a => a.isActive).length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-600 mb-0.5">Inactive</p>
                  <p className="text-2xl font-bold text-red-600">
                    {admins.filter(a => !a.isActive).length}
                  </p>
                </div>
              </div>

              {/* Admins Table */}
              {admins.length > 0 ? (
                <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Admin</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {admins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm flex-shrink-0">
                                {admin.name?.charAt(0).toUpperCase() || admin.email?.charAt(0).toUpperCase() || "A"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{admin.name || admin.email || "Unnamed Admin"}</p>
                                {admin.role && (
                                  <p className="text-xs text-purple-600 font-medium mt-0.5">
                                    Role: {admin.role === "SUPER_ADMIN" ? "Super Admin" : admin.role === "MAIN_ADMIN" ? "Main Admin" : admin.role}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-gray-900 text-sm truncate max-w-xs">{admin.email}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 w-fit ${
                              admin.isActive
                                ? "bg-green-100 text-green-700 border border-green-300"
                                : "bg-red-100 text-red-700 border border-red-300"
                            }`}>
                              {admin.isActive ? (
                                <>
                                  <Power className="w-3 h-3" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <PowerOff className="w-3 h-3" />
                                  <span>Inactive</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-xs text-gray-600">
                              {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "N/A"}
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => handleToggle(admin.id, admin.isActive)}
                                disabled={admin.id === user?.id}
                                className={`p-1.5 rounded-lg transition-all ${
                                  admin.isActive
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-green-100 text-green-700 hover:bg-green-200"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={admin.isActive ? "Deactivate Admin" : "Activate Admin"}
                              >
                                {admin.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleEdit(admin)}
                                className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
                                title="Edit Admin Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(admin.id)}
                                disabled={admin.id === user?.id}
                                className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title={admin.id === user?.id ? "Cannot delete yourself" : "Delete Admin (Permanent)"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium text-lg mb-2">No admins</p>
                  <p className="text-sm text-gray-500 mb-6">Click "Add Admin" in the sidebar or the button above to create your first admin</p>
                  <button
                    onClick={() => router.push("/admins/add")}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 shadow-lg font-medium mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Admin</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Admin</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAdmin(null);
                  setFormData({ name: "", email: "", password: "" });
                  setError("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password"
                  />
                </div>
              </div>
              <div className="mt-6 flex space-x-2">
                <button
                  onClick={handleUpdate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAdmin(null);
                    setFormData({ name: "", email: "", password: "" });
                    setError("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

