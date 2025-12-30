"use client";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useEffect } from "react";

export default function DebugUserPage() {
  const { user, isAuthenticated } = useAdminAuth();

  useEffect(() => {
    console.log("User object:", user);
    console.log("Is Main Admin:", (user as any)?.isMainAdmin);
    console.log("Role:", (user as any)?.role);
    console.log("LocalStorage admin_user:", localStorage.getItem("admin_user"));
  }, [user]);

  if (!isAuthenticated) {
    return <div className="p-8">Please log in first</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">User Debug Info</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
        <div className="mt-4 space-y-2">
          <p><strong>Is Main Admin:</strong> {(user as any)?.isMainAdmin ? "Yes" : "No"}</p>
          <p><strong>Role:</strong> {(user as any)?.role || "Not set"}</p>
          <p><strong>Is Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}</p>
        </div>
      </div>
    </div>
  );
}

