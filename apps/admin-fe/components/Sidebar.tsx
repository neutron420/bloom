"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, FileText, User, LogOut, BarChart3, Shield, Settings, AlertTriangle, Bell, Activity, Database } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useRouter } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 text-gray-900 min-h-screen flex flex-col shadow-sm">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
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

      {/* Logout Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
