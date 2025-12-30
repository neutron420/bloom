"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Database, Activity, Server, Download, Trash2 } from "lucide-react";

export default function SystemPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"health" | "status" | "logs" | "maintenance">("health");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading, router, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === "health") {
        const data = await adminApi.getSystemHealth();
        setHealth(data);
      } else if (activeTab === "status") {
        const data = await adminApi.getSystemStatus();
        setStatus(data);
      } else if (activeTab === "logs") {
        const data = await adminApi.getErrorLogs(1, 50);
        setErrorLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch system data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: string) => {
    try {
      const data = await adminApi.exportData(type as any, "json");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${type}-${Date.now()}.json`;
      a.click();
    } catch (error) {
      alert("Failed to export data");
    }
  };

  const handleCleanup = async () => {
    const meetingDays = prompt("Delete meetings older than (days):");
    const messageDays = prompt("Delete messages older than (days):");
    if (meetingDays && messageDays) {
      try {
        await adminApi.cleanupData({
          deleteOldMeetings: true,
          deleteOldMessages: true,
          meetingRetentionDays: parseInt(meetingDays),
          messageRetentionDays: parseInt(messageDays),
        });
        alert("Cleanup completed");
      } catch (error) {
        alert("Failed to cleanup data");
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
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900">System</h1>
            <p className="text-sm text-gray-600 mt-1">Monitor system health and manage maintenance</p>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("health")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "health"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Health
              </button>
              <button
                onClick={() => setActiveTab("status")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "status"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Status
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "logs"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Error Logs
              </button>
              <button
                onClick={() => setActiveTab("maintenance")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "maintenance"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Maintenance
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === "health" && health && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        health.status === "healthy"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {health.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Database</h4>
                        <p className="text-sm text-gray-600">Status: {health.database?.status}</p>
                        <p className="text-sm text-gray-600">Latency: {health.database?.latency}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Socket.IO</h4>
                        <p className="text-sm text-gray-600">Status: {health.socketio?.status}</p>
                        <p className="text-sm text-gray-600">Connections: {health.socketio?.activeConnections}</p>
                        <p className="text-sm text-gray-600">Rooms: {health.socketio?.activeRooms}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Memory</h4>
                        <p className="text-sm text-gray-600">RSS: {health.memory?.rss} MB</p>
                        <p className="text-sm text-gray-600">Heap Used: {health.memory?.heapUsed} MB</p>
                        <p className="text-sm text-gray-600">Heap Total: {health.memory?.heapTotal} MB</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Uptime</h4>
                        <p className="text-sm text-gray-600">{health.uptime?.formatted}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "status" && status && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Server Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Server Info</h4>
                      <p className="text-sm text-gray-600">Node: {status.server?.nodeVersion}</p>
                      <p className="text-sm text-gray-600">Platform: {status.server?.platform}</p>
                      <p className="text-sm text-gray-600">Environment: {status.server?.environment}</p>
                      <p className="text-sm text-gray-600">Uptime: {status.server?.uptime}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Database</h4>
                      <p className="text-sm text-gray-600">Total Users: {status.database?.totalUsers}</p>
                      <p className="text-sm text-gray-600">Total Meetings: {status.database?.totalMeetings}</p>
                      <p className="text-sm text-gray-600">Active Meetings: {status.database?.activeMeetings}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "logs" && errorLogs && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Error Logs</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Level</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {errorLogs.data?.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.level === "error" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"
                              }`}>
                                {log.level}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">{log.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "maintenance" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Export</h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleExport("all")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export All</span>
                      </button>
                      <button
                        onClick={() => handleExport("users")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export Users</span>
                      </button>
                      <button
                        onClick={() => handleExport("meetings")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export Meetings</span>
                      </button>
                      <button
                        onClick={() => handleExport("messages")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export Messages</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Cleanup</h3>
                    <button
                      onClick={handleCleanup}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Run Cleanup</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

