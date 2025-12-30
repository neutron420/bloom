"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Shield, Lock, Ban, AlertCircle, CheckCircle, X } from "lucide-react";

export default function SecurityPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState<any>(null);
  const [blockedIPs, setBlockedIPs] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"attempts" | "blocked" | "audit">("attempts");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [isAuthenticated, authLoading, router, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === "attempts") {
        const data = await adminApi.getLoginAttempts(1, 50);
        setLoginAttempts(data);
      } else if (activeTab === "blocked") {
        const data = await adminApi.getBlockedIPs();
        setBlockedIPs(data);
      } else if (activeTab === "audit") {
        const data = await adminApi.getAuditLog(1, 50);
        setAuditLog(data);
      }
    } catch (error) {
      console.error("Failed to fetch security data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    const ip = prompt("Enter IP address to block:");
    if (!ip) return;
    const reason = prompt("Enter reason (optional):");
    try {
      await adminApi.blockIP(ip, reason || undefined);
      fetchData();
    } catch (error) {
      alert("Failed to block IP");
    }
  };

  const handleUnblockIP = async (ip: string) => {
    if (confirm(`Unblock IP ${ip}?`)) {
      try {
        await adminApi.unblockIP(ip);
        fetchData();
      } catch (error) {
        alert("Failed to unblock IP");
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
            <h1 className="text-2xl font-semibold text-gray-900">Security</h1>
            <p className="text-sm text-gray-600 mt-1">Monitor security events and manage IP blocks</p>
          </div>
        </header>

        <main className="flex-1 p-8">
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("attempts")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "attempts"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Login Attempts
              </button>
              <button
                onClick={() => setActiveTab("blocked")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "blocked"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Blocked IPs
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "audit"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Audit Log
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === "attempts" && loginAttempts && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Login Attempts</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">IP Address</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {loginAttempts.data?.map((attempt: any) => (
                          <tr key={attempt.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm">{attempt.email || "N/A"}</td>
                            <td className="px-6 py-4 text-sm font-mono">{attempt.ipAddress}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                attempt.success
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-700"
                              }`}>
                                {attempt.success ? "Success" : "Failed"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(attempt.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "blocked" && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Blocked IP Addresses</h3>
                    <button
                      onClick={handleBlockIP}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Block IP
                    </button>
                  </div>
                  {blockedIPs?.data?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">IP Address</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Expires</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {blockedIPs.data.map((block: any) => (
                            <tr key={block.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-mono">{block.ipAddress}</td>
                              <td className="px-6 py-4 text-sm">{block.reason || "No reason"}</td>
                              <td className="px-6 py-4 text-sm">
                                {block.expiresAt ? new Date(block.expiresAt).toLocaleString() : "Never"}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleUnblockIP(block.ipAddress)}
                                  className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-medium"
                                >
                                  Unblock
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <Ban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No blocked IPs</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "audit" && auditLog && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Admin</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {auditLog.data?.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium">{log.action}</td>
                            <td className="px-6 py-4 text-sm">{log.adminId || "System"}</td>
                            <td className="px-6 py-4 text-sm">{log.targetType || "N/A"}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

