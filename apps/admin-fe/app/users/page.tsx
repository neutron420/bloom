"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Search, User, Mail, Calendar, Ban, Eye, Users as UsersIcon, Shield, AlertTriangle, X, Activity, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";

export default function UsersPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchUsers();
  }, [isAuthenticated, authLoading, router, page, search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers(page, 20, search);
      setUsers(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (userId: string) => {
    try {
      setLoadingDetails(true);
      setShowModal(true);
      setSelectedUser(users.find(u => u.id === userId));
      
      // Fetch full user details and activity
      const [details, activity] = await Promise.all([
        adminApi.getUser(userId),
        adminApi.getUserActivity(userId).catch(() => null), // Activity is optional
      ]);
      
      setUserDetails(details.user);
      setUserActivity(activity);
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      alert("Failed to load user details");
      setShowModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setUserDetails(null);
    setUserActivity(null);
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
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage and monitor all users</p>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <UsersIcon className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">Total:</span>
                <span className="text-sm font-semibold text-gray-900">{total}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : users.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                                {user.name?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{user.name}</p>
                                <p className="text-xs text-gray-500 font-mono">ID: {user.id.substring(0, 12)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900">{user.email || "No email"}</span>
                              {user.isAdmin && (
                                <Shield className="w-4 h-4 text-blue-600" />
                              )}
                              {user.suspended && (
                                <Ban className="w-4 h-4 text-red-600" />
                              )}
                              {user.flagged && (
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleViewUser(user.id)}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium flex items-center space-x-1"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                              </button>
                              {user.suspended ? (
                                <button 
                                  onClick={async () => {
                                    if (confirm("Unsuspend this user?")) {
                                      try {
                                        await adminApi.unsuspendUser(user.id);
                                        fetchUsers();
                                      } catch (error) {
                                        alert("Failed to unsuspend user");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                <button 
                                  onClick={async () => {
                                    const reason = prompt("Enter suspension reason (optional):");
                                    if (reason !== null) {
                                      try {
                                        await adminApi.suspendUser(user.id, reason || undefined);
                                        fetchUsers();
                                      } catch (error) {
                                        alert("Failed to suspend user");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 transition-colors text-sm font-medium"
                                >
                                  Suspend
                                </button>
                              )}
                              {user.flagged ? (
                                <button 
                                  onClick={async () => {
                                    if (confirm("Unflag this user?")) {
                                      try {
                                        await adminApi.unflagUser(user.id);
                                        fetchUsers();
                                      } catch (error) {
                                        alert("Failed to unflag user");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
                                >
                                  Unflag
                                </button>
                              ) : (
                                <button 
                                  onClick={async () => {
                                    const reason = prompt("Enter flag reason (optional):");
                                    if (reason !== null) {
                                      try {
                                        await adminApi.flagUser(user.id, reason || undefined);
                                        fetchUsers();
                                      } catch (error) {
                                        alert("Failed to flag user");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 transition-colors text-sm font-medium"
                                >
                                  Flag
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing <span className="font-medium">{((page - 1) * 20) + 1}</span> to <span className="font-medium">{Math.min(page * 20, total)}</span> of <span className="font-medium">{total}</span> users
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * 20 >= total}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No users found</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* User Details Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-lg">
                  {userDetails?.name?.charAt(0).toUpperCase() || selectedUser?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {userDetails?.name || selectedUser?.name || "User Details"}
                  </h2>
                  <p className="text-sm text-gray-500 font-mono">{userDetails?.id || selectedUser?.id}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : userDetails ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-gray-900 mt-1">{userDetails.name || "N/A"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <p className="text-gray-900 mt-1 flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{userDetails.email || "No email"}</span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">User ID</label>
                        <p className="text-gray-900 mt-1 font-mono text-sm">{userDetails.id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Profile Picture</label>
                        <p className="text-gray-900 mt-1">
                          {userDetails.profilePicture ? (
                            <img src={userDetails.profilePicture} alt="Profile" className="w-16 h-16 rounded-lg" />
                          ) : (
                            "No profile picture"
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Created At</label>
                        <p className="text-gray-900 mt-1 flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{userDetails.createdAt ? new Date(userDetails.createdAt).toLocaleString() : "N/A"}</span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Last Updated</label>
                        <p className="text-gray-900 mt-1">
                          {userDetails.updatedAt ? new Date(userDetails.updatedAt).toLocaleString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Status & Permissions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Shield className={`w-5 h-5 ${userDetails.isAdmin ? "text-blue-600" : "text-gray-400"}`} />
                        <div>
                          <p className="font-medium text-gray-900">Admin Status</p>
                          <p className="text-sm text-gray-600">
                            {userDetails.isAdmin ? "Administrator" : "Regular User"}
                          </p>
                          {userDetails.isAdmin && userDetails.adminAssignedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Assigned: {new Date(userDetails.adminAssignedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Ban className={`w-5 h-5 ${userDetails.suspended ? "text-red-600" : "text-gray-400"}`} />
                        <div>
                          <p className="font-medium text-gray-900">Suspension Status</p>
                          <p className="text-sm text-gray-600">
                            {userDetails.suspended ? "Suspended" : "Active"}
                          </p>
                          {userDetails.suspended && userDetails.suspendedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Suspended: {new Date(userDetails.suspendedAt).toLocaleDateString()}
                              {userDetails.suspensionReason && ` - ${userDetails.suspensionReason}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`w-5 h-5 ${userDetails.flagged ? "text-orange-600" : "text-gray-400"}`} />
                        <div>
                          <p className="font-medium text-gray-900">Flag Status</p>
                          <p className="text-sm text-gray-600">
                            {userDetails.flagged ? "Flagged" : "Not Flagged"}
                          </p>
                          {userDetails.flagged && userDetails.flaggedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Flagged: {new Date(userDetails.flaggedAt).toLocaleDateString()}
                              {userDetails.flagReason && ` - ${userDetails.flagReason}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Activity Statistics */}
                  {userActivity && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Activity Statistics</span>
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">Total Meetings</p>
                          <p className="text-2xl font-semibold text-gray-900">{userActivity.activity?.totalMeetings || 0}</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                          <p className="text-2xl font-semibold text-gray-900">{userActivity.activity?.totalMessages || 0}</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">Join Requests</p>
                          <p className="text-2xl font-semibold text-gray-900">{userActivity.activity?.totalJoinRequests || 0}</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">Screen Shares</p>
                          <p className="text-2xl font-semibold text-gray-900">{userActivity.activity?.totalScreenShares || 0}</p>
                        </div>
                      </div>
                      {userActivity.activity?.lastMeeting && (
                        <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-900 mb-2">Last Meeting</p>
                          <p className="text-sm text-gray-600">
                            Room: {userActivity.activity.lastMeeting.meeting?.roomId || "N/A"}
                          </p>
                          <p className="text-sm text-gray-600">
                            Joined: {new Date(userActivity.activity.lastMeeting.joinedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recent Meetings */}
                  {userDetails.meetings && userDetails.meetings.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Calendar className="w-5 h-5" />
                        <span>Recent Meetings ({userDetails.meetings.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {userDetails.meetings.slice(0, 5).map((meeting: any) => (
                          <div key={meeting.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {meeting.meeting?.title || meeting.meeting?.roomId || "Untitled Meeting"}
                                </p>
                                <p className="text-sm text-gray-500 font-mono mt-1">
                                  Room: {meeting.meeting?.roomId || "N/A"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-600">
                                  {new Date(meeting.joinedAt).toLocaleDateString()}
                                </p>
                                {meeting.leftAt && (
                                  <p className="text-xs text-gray-500">
                                    Left: {new Date(meeting.leftAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Join Requests */}
                  {userDetails.joinRequests && userDetails.joinRequests.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5" />
                        <span>Recent Join Requests ({userDetails.joinRequests.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {userDetails.joinRequests.slice(0, 5).map((request: any) => (
                          <div key={request.id} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {request.meeting?.title || request.meeting?.roomId || "Untitled Meeting"}
                                </p>
                                <p className="text-sm text-gray-500 font-mono mt-1">
                                  Room: {request.meeting?.roomId || "N/A"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  request.status === "approved"
                                    ? "bg-green-50 text-green-700"
                                    : request.status === "declined"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-yellow-50 text-yellow-700"
                                }`}>
                                  {request.status || "pending"}
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(request.requestedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Failed to load user details</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
