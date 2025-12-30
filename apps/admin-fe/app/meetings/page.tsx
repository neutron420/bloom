"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Calendar, Users, Clock, Trash2, Activity } from "lucide-react";

export default function MeetingsPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchMeetings();
  }, [isAuthenticated, authLoading, router, page, activeOnly]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getMeetings(page, 20, activeOnly);
      setMeetings(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    try {
      await adminApi.deleteMeeting(id);
      fetchMeetings();
    } catch (error) {
      console.error("Failed to delete meeting:", error);
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

  const activeCount = meetings.filter(m => m.participants?.some((p: any) => !p.leftAt)).length;
  const totalParticipants = meetings.reduce((sum, m) => sum + (m._count?.participants || m.participants?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Meeting Management</h1>
                <p className="text-sm text-gray-600 mt-1">Monitor and manage all meetings</p>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => {
                    setActiveOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">Active only</span>
              </label>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Total Meetings</p>
                  <p className="text-2xl font-semibold text-gray-900">{total}</p>
                </div>
                <Calendar className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Active Meetings</p>
                  <p className="text-2xl font-semibold text-gray-900">{activeCount}</p>
                </div>
                <Activity className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Total Participants</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalParticipants}</p>
                </div>
                <Users className="w-10 h-10 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Meetings Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : meetings.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Meeting</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Participants</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {meetings.map((meeting) => (
                        <tr key={meeting.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-gray-900 font-mono">{meeting.roomId || meeting.id}</p>
                              <p className="text-xs text-gray-500 font-mono mt-1">ID: {meeting.id.substring(0, 12)}...</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900 font-medium">{meeting._count?.participants || meeting.participants?.length || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">
                                {meeting.createdAt ? new Date(meeting.createdAt).toLocaleDateString() : "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              meeting.participants?.some((p: any) => !p.leftAt)
                                ? "bg-green-50 text-green-700 border border-green-200" 
                                : "bg-gray-50 text-gray-700 border border-gray-200"
                            }`}>
                              {meeting.participants?.some((p: any) => !p.leftAt) ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {meeting.participants?.some((p: any) => !p.leftAt) && (
                                <button
                                  onClick={async () => {
                                    if (confirm("End this meeting? All participants will be disconnected.")) {
                                      try {
                                        await adminApi.endMeeting(meeting.id);
                                        fetchMeetings();
                                      } catch (error) {
                                        alert("Failed to end meeting");
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 transition-colors text-sm font-medium"
                                >
                                  End
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMeeting(meeting.id)}
                                className="px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors text-sm font-medium flex items-center space-x-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
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
                    Showing <span className="font-medium">{((page - 1) * 20) + 1}</span> to <span className="font-medium">{Math.min(page * 20, total)}</span> of <span className="font-medium">{total}</span> meetings
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
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No meetings found</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
