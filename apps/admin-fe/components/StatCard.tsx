"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: "blue" | "green" | "purple" | "orange" | "gray";
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, trend, color = "blue", subtitle }: StatCardProps) {
  const colorConfig = {
    blue: {
      bg: "bg-blue-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      text: "text-blue-600",
    },
    green: {
      bg: "bg-green-50",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      text: "text-green-600",
    },
    purple: {
      bg: "bg-purple-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      text: "text-purple-600",
    },
    orange: {
      bg: "bg-orange-50",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      text: "text-orange-600",
    },
    gray: {
      bg: "bg-gray-50",
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
      text: "text-gray-600",
    },
  };

  const config = colorConfig[color];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center space-x-1 mt-2">
              <span className={`text-sm font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        
        <div className={`${config.iconBg} p-3 rounded-lg`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
      </div>
    </div>
  );
}
