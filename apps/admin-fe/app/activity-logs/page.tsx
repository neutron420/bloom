"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Activity, Filter } from "lucide-react";

export default function ActivityLogsPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchLogs();
  }, [isAuthenticated, authLoading, router, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getActivityLogs(page, 50);
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
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
            <h1 className="text-2xl font-semibold text-gray-900">Activity Logs</h1>
            <p className="text-sm text-gray-600 mt-1">View all admin activities</p>
          </div>
        </header>

        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : logs ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.data?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">{log.adminId}</td>
                        <td className="px-6 py-4 text-sm font-medium">{log.action}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.targetType} {log.targetId ? `(${log.targetId.substring(0, 8)}...)` : ""}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.details ? (
                            <details>
                              <summary className="cursor-pointer text-blue-600">View</summary>
                              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">
                                {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          ) : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logs.pagination && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Page {logs.pagination.page} of {logs.pagination.totalPages}
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!logs.pagination.hasPrev}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!logs.pagination.hasNext}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-red-600 font-medium">Failed to load activity logs</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

