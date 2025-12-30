"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, FileText, User, BarChart3, Shield, Settings, AlertTriangle, Bell, Activity, Database, UserCog, UserPlus } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useRouter } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAdminAuth();

  // Check if user is main admin - check both isMainAdmin and role
  // Also check localStorage directly in case user object hasn't updated
  let isMainAdmin = false;
  if (user) {
    isMainAdmin = (user as any).isMainAdmin === true || (user as any).role === "MAIN_ADMIN";
    
    // Fallback: Check localStorage directly
    if (!isMainAdmin && typeof window !== "undefined") {
      try {
        const userStr = localStorage.getItem("admin_user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          isMainAdmin = userData.isMainAdmin === true || userData.role === "MAIN_ADMIN";
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  // Debug logging (remove in production)
  if (typeof window !== "undefined" && user) {
    console.log("Sidebar - User:", user);
    console.log("Sidebar - isMainAdmin check:", isMainAdmin);
    console.log("Sidebar - user.isMainAdmin:", (user as any).isMainAdmin);
    console.log("Sidebar - user.role:", (user as any).role);
    const userStr = localStorage.getItem("admin_user");
    if (userStr) {
      console.log("Sidebar - localStorage user:", JSON.parse(userStr));
    }
  }

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/users", label: "Users", icon: Users },
    { href: "/meetings", label: "Meetings", icon: Calendar },
    { href: "/join-requests", label: "Join Requests", icon: FileText },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/moderation", label: "Moderation", icon: AlertTriangle },
    { href: "/security", label: "Security", icon: Shield },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/activity-logs", label: "Activity Logs", icon: Activity },
    { href: "/system", label: "System", icon: Database },
    { href: "/settings", label: "Settings", icon: Settings },
    // Main Admin only: Admin Management
    // Temporarily show for all authenticated users for testing - remove this later
    ...(isMainAdmin || (user && isAuthenticated) ? [
      { href: "/admins", label: "Admins", icon: UserCog },
      { href: "/admins/add", label: "Add Admin", icon: UserPlus }
    ] : []),
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 text-gray-900 h-screen flex flex-col shadow-sm fixed left-0 top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Bloom Admin</h1>
            <p className="text-xs text-gray-500">Control Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
