"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Calendar, MessageSquare, Clock } from "lucide-react";

const COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#059669'];

export default function AnalyticsPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [userGrowth, setUserGrowth] = useState<any>(null);
  const [meetingStats, setMeetingStats] = useState<any>(null);
  const [peakTimes, setPeakTimes] = useState<any>(null);
  const [mostActiveUsers, setMostActiveUsers] = useState<any>(null);
  const [popularMeetings, setPopularMeetings] = useState<any>(null);
  const [chatStats, setChatStats] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchAnalytics();
  }, [isAuthenticated, authLoading, router, period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [growth, meetings, peaks, activeUsers, popular, chat] = await Promise.all([
        adminApi.getUserGrowth(period),
        adminApi.getMeetingStats(),
        adminApi.getPeakTimes(),
        adminApi.getMostActiveUsers(10),
        adminApi.getPopularMeetings(10),
        adminApi.getChatStats(),
      ]);
      setUserGrowth(growth);
      setMeetingStats(meetings);
      setPeakTimes(peaks);
      setMostActiveUsers(activeUsers);
      setPopularMeetings(popular);
      setChatStats(chat);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
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
                <h1 className="text-2xl font-semibold text-gray-900">Analytics & Reports</h1>
                <p className="text-sm text-gray-600 mt-1">Comprehensive platform analytics</p>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Growth */}
              {userGrowth && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>User Growth</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Users</p>
                      <p className="text-2xl font-semibold text-gray-900">{userGrowth.summary?.totalUsers || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Active Users</p>
                      <p className="text-2xl font-semibold text-gray-900">{userGrowth.summary?.activeUsers || 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Inactive Users</p>
                      <p className="text-2xl font-semibold text-gray-900">{userGrowth.summary?.inactiveUsers || 0}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Growth Rate</p>
                      <p className="text-2xl font-semibold text-gray-900">{userGrowth.summary?.growthRate || 0}%</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={userGrowth.registrations || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Meeting Stats */}
              {meetingStats && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Meeting Statistics</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Meetings</p>
                      <p className="text-2xl font-semibold text-gray-900">{meetingStats.summary?.totalMeetings || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">With Participants</p>
                      <p className="text-2xl font-semibold text-gray-900">{meetingStats.summary?.meetingsWithParticipants || 0}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Participants</p>
                      <p className="text-2xl font-semibold text-gray-900">{meetingStats.summary?.totalParticipants || 0}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Avg Duration</p>
                      <p className="text-2xl font-semibold text-gray-900">{meetingStats.summary?.averageDuration || "0m"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Peak Times */}
              {peakTimes && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Peak Usage Times</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={peakTimes.hourly || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="meetings" fill="#2563eb" />
                      <Bar dataKey="participants" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Most Active Users */}
              {mostActiveUsers && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5" />
                    <span>Most Active Users</span>
                  </h3>
                  <div className="space-y-2">
                    {mostActiveUsers.topUsers?.slice(0, 10).map((user: any, index: number) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-500 font-medium w-6">{index + 1}.</span>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{user.meetingCount || 0}</p>
                          <p className="text-xs text-gray-500">meetings</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Stats */}
              {chatStats && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Chat Statistics</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                      <p className="text-2xl font-semibold text-gray-900">{chatStats.summary?.totalMessages || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Avg per Meeting</p>
                      <p className="text-2xl font-semibold text-gray-900">{chatStats.summary?.averagePerMeeting || 0}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Meetings with Chat</p>
                      <p className="text-2xl font-semibold text-gray-900">{chatStats.summary?.meetingsWithMessages || 0}</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chatStats.daily || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

