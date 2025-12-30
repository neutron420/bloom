const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class AdminApi {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log("Making request to:", url, { method: options.method || "GET" });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log("Response status:", response.status, response.statusText);

      if (!response.ok) {
        let error: any;
        try {
          error = await response.json();
        } catch {
          error = { 
            error: `Request failed with status ${response.status}: ${response.statusText}` 
          };
        }
        const errorMessage = error.error || error.message || `HTTP error! status: ${response.status}`;
        const customError = new Error(errorMessage) as any;
        customError.status = response.status;
        customError.error = error;
        throw customError;
      }

      const data = await response.json();
      console.log("Response data:", data);
      return data;
    } catch (error: any) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(`Network error: Cannot connect to ${API_BASE_URL}. Make sure the backend server is running.`);
      }
      throw error;
    }
  }

  // Auth
  async adminLogin(email: string, password: string) {
    console.log("AdminApi.adminLogin called with:", { email, apiUrl: API_BASE_URL });
    try {
      const result = await this.request<{ user: any; token: string; message: string }>(
        "/api/auth/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      console.log("AdminApi.adminLogin success:", result);
      return result;
    } catch (error: any) {
      console.error("AdminApi.adminLogin error:", error);
      throw error;
    }
  }

  // Stats
  async getStats() {
    return this.request<any>("/api/admin/stats");
  }

  // Users
  async getUsers(page = 1, limit = 20, search?: string, isAdmin?: boolean) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append("search", search);
    if (isAdmin !== undefined) params.append("isAdmin", isAdmin.toString());

    return this.request<any>(`/api/admin/users?${params.toString()}`);
  }

  async getUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}`);
  }

  async makeAdmin(userId: string) {
    return this.request<any>(`/api/admin/users/${userId}/make-admin`, {
      method: "PATCH",
    });
  }

  async removeAdmin(userId: string) {
    return this.request<any>(`/api/admin/users/${userId}/remove-admin`, {
      method: "PATCH",
    });
  }

  // Meetings
  async getMeetings(page = 1, limit = 20, active?: boolean) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (active !== undefined) params.append("active", active.toString());

    return this.request<any>(`/api/admin/meetings?${params.toString()}`);
  }

  async getMeeting(id: string) {
    return this.request<any>(`/api/admin/meetings/${id}`);
  }

  async deleteMeeting(id: string) {
    return this.request<any>(`/api/admin/meetings/${id}`, {
      method: "DELETE",
    });
  }

  // Join Requests
  async getJoinRequests(page = 1, limit = 20, status?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status) params.append("status", status);

    return this.request<any>(`/api/admin/join-requests?${params.toString()}`);
  }

  async approveJoinRequest(id: string) {
    return this.request<any>(`/api/admin/join-requests/${id}/approve`, {
      method: "PATCH",
    });
  }

  async declineJoinRequest(id: string) {
    return this.request<any>(`/api/admin/join-requests/${id}/decline`, {
      method: "PATCH",
    });
  }

  async bulkJoinRequestAction(requestIds: string[], action: "approve" | "decline") {
    return this.request<any>(`/api/admin/join-requests/bulk-action`, {
      method: "POST",
      body: JSON.stringify({ requestIds, action }),
    });
  }

  // User Management - Extended
  async banUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}/ban`, {
      method: "PATCH",
    });
  }

  async suspendUser(id: string, reason?: string) {
    return this.request<any>(`/api/admin/users/${id}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
  }

  async unsuspendUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}/unsuspend`, {
      method: "PATCH",
    });
  }

  async flagUser(id: string, reason?: string) {
    return this.request<any>(`/api/admin/users/${id}/flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async unflagUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}/unflag`, {
      method: "POST",
    });
  }

  async updateUser(id: string, data: { name?: string; email?: string; profilePicture?: string }) {
    return this.request<any>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}`, {
      method: "DELETE",
    });
  }

  async getUserActivity(id: string) {
    return this.request<any>(`/api/admin/users/${id}/activity`);
  }

  // Meeting Management - Extended
  async endMeeting(id: string) {
    return this.request<any>(`/api/admin/meetings/${id}/end`, {
      method: "POST",
    });
  }

  async getMeetingAnalytics(id: string) {
    return this.request<any>(`/api/admin/meetings/${id}/analytics`);
  }

  async updateMeetingSettings(id: string, settings: { title?: string; requiresApproval?: boolean }) {
    return this.request<any>(`/api/admin/meetings/${id}/settings`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // Analytics
  async getUserGrowth(period: "day" | "week" | "month" = "day", startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ period });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<any>(`/api/admin/analytics/users/growth?${params.toString()}`);
  }

  async getMeetingStats(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<any>(`/api/admin/analytics/meetings/stats?${params.toString()}`);
  }

  async getPeakTimes(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<any>(`/api/admin/analytics/usage/peak-times?${params.toString()}`);
  }

  async getMostActiveUsers(limit = 10) {
    return this.request<any>(`/api/admin/analytics/users/most-active?limit=${limit}`);
  }

  async getPopularMeetings(limit = 10) {
    return this.request<any>(`/api/admin/analytics/meetings/popular?limit=${limit}`);
  }

  async getChatStats(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<any>(`/api/admin/analytics/chat/stats?${params.toString()}`);
  }

  // Chat Management
  async getChatMessages(page = 1, limit = 20, filters?: {
    meetingId?: string;
    userId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.meetingId) params.append("meetingId", filters.meetingId);
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return this.request<any>(`/api/admin/chat/messages?${params.toString()}`);
  }

  async deleteChatMessage(id: string) {
    return this.request<any>(`/api/admin/chat/messages/${id}`, {
      method: "DELETE",
    });
  }

  // System
  async getSystemHealth() {
    return this.request<any>(`/api/admin/system/health`);
  }

  async getSystemStatus() {
    return this.request<any>(`/api/admin/system/status`);
  }

  async getErrorLogs(page = 1, limit = 50) {
    return this.request<any>(`/api/admin/system/logs/errors?page=${page}&limit=${limit}`);
  }

  // Security
  async getLoginAttempts(page = 1, limit = 50, filters?: { email?: string; ipAddress?: string; success?: boolean }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.email) params.append("email", filters.email);
    if (filters?.ipAddress) params.append("ipAddress", filters.ipAddress);
    if (filters?.success !== undefined) params.append("success", filters.success.toString());
    return this.request<any>(`/api/admin/security/login-attempts?${params.toString()}`);
  }

  async blockIP(ipAddress: string, reason?: string, expiresAt?: string) {
    return this.request<any>(`/api/admin/security/block-ip`, {
      method: "POST",
      body: JSON.stringify({ ipAddress, reason, expiresAt }),
    });
  }

  async unblockIP(ipAddress: string) {
    return this.request<any>(`/api/admin/security/block-ip/${ipAddress}`, {
      method: "DELETE",
    });
  }

  async getBlockedIPs() {
    return this.request<any>(`/api/admin/security/blocked-ips`);
  }

  async getAuditLog(page = 1, limit = 50, filters?: { action?: string; adminId?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.action) params.append("action", filters.action);
    if (filters?.adminId) params.append("adminId", filters.adminId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return this.request<any>(`/api/admin/security/audit-log?${params.toString()}`);
  }

  // Notifications
  async createAnnouncement(data: {
    title: string;
    message: string;
    targetType?: string;
    targetUserIds?: string[];
    expiresAt?: string;
  }) {
    return this.request<any>(`/api/admin/notifications/announcement`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAnnouncements() {
    return this.request<any>(`/api/admin/notifications/announcements`);
  }

  async updateAnnouncement(id: string, data: { title?: string; message?: string; isActive?: boolean; expiresAt?: string }) {
    return this.request<any>(`/api/admin/notifications/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id: string) {
    return this.request<any>(`/api/admin/notifications/announcements/${id}`, {
      method: "DELETE",
    });
  }

  async notifyUser(userId: string, data: { title: string; message: string }) {
    return this.request<any>(`/api/admin/notifications/user/${userId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Settings
  async getSettings() {
    return this.request<any>(`/api/admin/settings`);
  }

  async getSetting(key: string) {
    return this.request<any>(`/api/admin/settings/${key}`);
  }

  async updateSetting(key: string, value: any) {
    return this.request<any>(`/api/admin/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
  }

  // Maintenance
  async exportData(type: "all" | "users" | "meetings" | "messages" = "all", format: "json" | "csv" = "json", startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ type, format });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<any>(`/api/admin/maintenance/export?${params.toString()}`);
  }

  async cleanupData(options: {
    deleteOldMeetings?: boolean;
    deleteOldMessages?: boolean;
    meetingRetentionDays?: number;
    messageRetentionDays?: number;
  }) {
    return this.request<any>(`/api/admin/maintenance/cleanup`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  // Activity Logs
  async getActivityLogs(page = 1, limit = 50, filters?: { adminId?: string; action?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.adminId) params.append("adminId", filters.adminId);
    if (filters?.action) params.append("action", filters.action);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return this.request<any>(`/api/admin/activity-logs?${params.toString()}`);
  }

  // Moderation
  async getModerationQueue(page = 1, limit = 20, type?: "users" | "messages" | "all") {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (type) params.append("type", type);
    return this.request<any>(`/api/admin/moderation/queue?${params.toString()}`);
  }
}

export const adminApi = new AdminApi();
