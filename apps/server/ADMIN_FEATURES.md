# Admin Backend - Additional Features & Functionalities

This document outlines additional features that can be added to the admin backend to enhance functionality and provide better control over the Bloom application.

## 🎯 Priority Features (High Value)

### 1. **User Management Enhancements**

#### Delete User
- **Endpoint**: `DELETE /api/admin/users/:id`
- **Description**: Permanently delete a user and all their associated data
- **Features**:
  - Cascade delete (meetings, messages, join requests)
  - Prevent deletion of admin users
  - Log deletion action

#### Update User Details
- **Endpoint**: `PATCH /api/admin/users/:id`
- **Description**: Update user information (name, email, profile picture)
- **Features**:
  - Validate email uniqueness
  - Update profile information
  - Log changes

#### Suspend/Unsuspend User
- **Endpoint**: `PATCH /api/admin/users/:id/suspend`
- **Description**: Temporarily disable user access (better than ban)
- **Schema Change**: Add `suspended: Boolean` and `suspendedAt: DateTime?` to User model
- **Features**:
  - Prevent suspended users from joining meetings
  - Set suspension reason and duration
  - Auto-unsuspend after duration

#### Reset User Password
- **Endpoint**: `POST /api/admin/users/:id/reset-password`
- **Description**: Generate and send password reset link
- **Features**:
  - Generate secure reset token
  - Send email notification
  - Log password reset action

#### User Activity Log
- **Endpoint**: `GET /api/admin/users/:id/activity`
- **Description**: View user's activity history
- **Features**:
  - Last login time
  - Meeting participation history
  - Chat message count
  - Join requests made
  - Screen shares initiated

---

### 2. **Meeting Management Enhancements**

#### End Meeting (Force Close)
- **Endpoint**: `POST /api/admin/meetings/:id/end`
- **Description**: Forcefully end a meeting and disconnect all participants
- **Features**:
  - Disconnect all socket connections
  - Update participant `leftAt` timestamps
  - Emit event to notify participants
  - Log admin action

#### Join Meeting as Admin (Monitor Mode)
- **Endpoint**: `POST /api/admin/meetings/:id/join`
- **Description**: Allow admin to join meeting in read-only/monitor mode
- **Features**:
  - Admin can view but not participate
  - Special admin badge/indicator
  - Can view chat and participants
  - Cannot send messages or share screen

#### Meeting Analytics
- **Endpoint**: `GET /api/admin/meetings/:id/analytics`
- **Description**: Get detailed analytics for a meeting
- **Features**:
  - Duration (start to end)
  - Peak participant count
  - Total messages sent
  - Screen shares count
  - Join/leave timeline
  - Average session duration per participant

#### Update Meeting Settings
- **Endpoint**: `PATCH /api/admin/meetings/:id/settings`
- **Description**: Update meeting configuration
- **Features**:
  - Toggle `requiresApproval`
  - Change meeting title
  - Set meeting as private/public

---

### 3. **Join Request Management**

#### Approve/Decline Join Request
- **Endpoint**: `PATCH /api/admin/join-requests/:id/approve` or `/decline`
- **Description**: Admin can approve or decline join requests
- **Features**:
  - Update request status
  - Notify user via socket
  - Auto-join user if approved
  - Log admin action

#### Bulk Approve/Decline
- **Endpoint**: `POST /api/admin/join-requests/bulk-action`
- **Description**: Approve or decline multiple requests at once
- **Features**:
  - Accept array of request IDs
  - Batch update status
  - Return success/failure for each

---

### 4. **Analytics & Reporting**

#### User Growth Analytics
- **Endpoint**: `GET /api/admin/analytics/users/growth`
- **Description**: User registration trends over time
- **Features**:
  - Daily/weekly/monthly registration counts
  - Growth rate percentage
  - Active vs inactive users
  - Query params: `period` (day/week/month), `startDate`, `endDate`

#### Meeting Statistics
- **Endpoint**: `GET /api/admin/analytics/meetings/stats`
- **Description**: Comprehensive meeting statistics
- **Features**:
  - Total meetings created
  - Average meeting duration
  - Most active time periods
  - Meetings by day/week/month
  - Average participants per meeting

#### Peak Usage Times
- **Endpoint**: `GET /api/admin/analytics/usage/peak-times`
- **Description**: Identify peak usage periods
- **Features**:
  - Hourly distribution of meetings
  - Day of week patterns
  - Concurrent users over time
  - Peak concurrent meetings

#### Most Active Users
- **Endpoint**: `GET /api/admin/analytics/users/most-active`
- **Description**: Top users by activity
- **Features**:
  - Sort by: meetings joined, messages sent, screen shares
  - Top N users (configurable)
  - Activity scores

#### Popular Meeting Rooms
- **Endpoint**: `GET /api/admin/analytics/meetings/popular`
- **Description**: Most frequently used meeting rooms
- **Features**:
  - Rooms by participant count
  - Rooms by message count
  - Rooms by duration
  - Recurring meetings

#### Chat Message Statistics
- **Endpoint**: `GET /api/admin/analytics/chat/stats`
- **Description**: Chat usage statistics
- **Features**:
  - Total messages sent
  - Average messages per meeting
  - Messages per day/week/month
  - Most active chatters

#### Export Reports
- **Endpoint**: `GET /api/admin/analytics/export`
- **Description**: Export analytics data as CSV/JSON
- **Features**:
  - Export user data
  - Export meeting data
  - Export join requests
  - Custom date ranges
  - Format: CSV or JSON

---

### 5. **Content Moderation**

#### View All Chat Messages
- **Endpoint**: `GET /api/admin/chat/messages`
- **Description**: List all chat messages with filtering
- **Features**:
  - Pagination
  - Filter by meeting, user, date range
  - Search by message content
  - Sort by date, user, meeting

#### Delete Chat Message
- **Endpoint**: `DELETE /api/admin/chat/messages/:id`
- **Description**: Delete inappropriate messages
- **Features**:
  - Soft delete or hard delete
  - Notify meeting participants
  - Log moderation action
  - Reason for deletion

#### Flag User for Review
- **Endpoint**: `POST /api/admin/users/:id/flag`
- **Description**: Flag a user for manual review
- **Schema Change**: Add `flagged: Boolean`, `flaggedAt: DateTime?`, `flagReason: String?` to User
- **Features**:
  - Add flag reason
  - Review queue
  - Auto-unflag after review

#### Content Moderation Queue
- **Endpoint**: `GET /api/admin/moderation/queue`
- **Description**: Get list of flagged content/users
- **Features**:
  - Flagged messages
  - Flagged users
  - Priority sorting
  - Review status

---

### 6. **System Health & Monitoring**

#### System Health Check
- **Endpoint**: `GET /api/admin/system/health`
- **Description**: Overall system health status
- **Features**:
  - Database connection status
  - Socket.io server status
  - Memory usage
  - CPU usage
  - Active connections count
  - Uptime

#### Server Status
- **Endpoint**: `GET /api/admin/system/status`
- **Description**: Detailed server information
- **Features**:
  - Node.js version
  - Environment (dev/prod)
  - Server start time
  - Request count
  - Error rate

#### Database Statistics
- **Endpoint**: `GET /api/admin/system/database/stats`
- **Description**: Database performance and statistics
- **Features**:
  - Table sizes
  - Index usage
  - Query performance
  - Connection pool status
  - Slow queries

#### Error Logs
- **Endpoint**: `GET /api/admin/system/logs/errors`
- **Description**: View recent error logs
- **Features**:
  - Recent errors
  - Filter by severity
  - Search by message
  - Pagination
  - Export logs

#### Activity Logs
- **Endpoint**: `GET /api/admin/system/logs/activity`
- **Description**: Admin action audit trail
- **Schema Change**: Create `AdminActivityLog` model
- **Features**:
  - All admin actions logged
  - User who performed action
  - Timestamp
  - Action details
  - IP address

---

### 7. **Notifications & Announcements**

#### Send System Announcement
- **Endpoint**: `POST /api/admin/notifications/announcement`
- **Description**: Send announcement to all active users
- **Features**:
  - Broadcast to all socket connections
  - Store announcement in database
  - Target specific users or all users
  - Scheduled announcements

#### Notify Specific User
- **Endpoint**: `POST /api/admin/notifications/user/:id`
- **Description**: Send notification to specific user
- **Features**:
  - In-app notification
  - Email notification (optional)
  - Notification history

---

### 8. **Settings & Configuration**

#### System Settings
- **Endpoint**: `GET /api/admin/settings` and `PATCH /api/admin/settings`
- **Description**: Manage system-wide settings
- **Schema Change**: Create `SystemSettings` model
- **Features**:
  - Max meeting duration
  - Max participants per meeting
  - Message rate limits
  - Feature flags
  - Maintenance mode

#### Feature Flags
- **Endpoint**: `GET /api/admin/features` and `PATCH /api/admin/features/:key`
- **Description**: Toggle features on/off
- **Features**:
  - Enable/disable features
  - A/B testing
  - Gradual rollout

---

### 9. **Security Features**

#### View Login Attempts
- **Endpoint**: `GET /api/admin/security/login-attempts`
- **Description**: Monitor login attempts
- **Schema Change**: Create `LoginAttempt` model
- **Features**:
  - Failed login attempts
  - IP addresses
  - Timestamps
  - Success/failure status

#### IP Blocking
- **Endpoint**: `POST /api/admin/security/block-ip` and `DELETE /api/admin/security/block-ip/:ip`
- **Description**: Block specific IP addresses
- **Schema Change**: Create `BlockedIP` model
- **Features**:
  - Block/unblock IPs
  - Temporary blocks (with expiry)
  - Reason for blocking
  - Auto-block after N failed attempts

#### Session Management
- **Endpoint**: `GET /api/admin/security/sessions` and `DELETE /api/admin/security/sessions/:id`
- **Description**: View and manage user sessions
- **Features**:
  - List active sessions
  - Revoke sessions
  - Session details (IP, device, last activity)

#### Security Audit Log
- **Endpoint**: `GET /api/admin/security/audit-log`
- **Description**: Security-related events
- **Features**:
  - Failed authentication attempts
  - Permission changes
  - Admin actions
  - Suspicious activity

---

### 10. **Backup & Maintenance**

#### Database Backup
- **Endpoint**: `POST /api/admin/maintenance/backup`
- **Description**: Trigger database backup
- **Features**:
  - Create backup file
  - Download backup
  - Scheduled backups
  - Backup history

#### Data Export
- **Endpoint**: `GET /api/admin/maintenance/export`
- **Description**: Export data for migration/backup
- **Features**:
  - Export users
  - Export meetings
  - Export messages
  - Custom date ranges
  - Format: JSON, CSV

#### Cleanup Old Data
- **Endpoint**: `POST /api/admin/maintenance/cleanup`
- **Description**: Remove old/inactive data
- **Features**:
  - Delete old meetings (older than X days)
  - Delete old messages
  - Archive inactive users
  - Configurable retention period

---

## 📊 Database Schema Changes Needed

### User Model Additions
```prisma
model User {
  // ... existing fields ...
  suspended      Boolean   @default(false)
  suspendedAt    DateTime?
  suspendedBy    String?   // Admin ID who suspended
  suspensionReason String?
  flagged       Boolean   @default(false)
  flaggedAt     DateTime?
  flagReason    String?
  lastLoginAt   DateTime?
  // ... existing relations ...
}
```

### New Models
```prisma
model AdminActivityLog {
  id        String   @id @default(cuid())
  adminId   String   // Admin who performed action
  action    String   // Action type (e.g., "user_deleted", "meeting_ended")
  targetType String? // Type of target (user, meeting, etc.)
  targetId  String? // ID of target
  details   Json?    // Additional details
  ipAddress String?
  createdAt DateTime @default(now())
  
  @@index([adminId])
  @@index([createdAt])
  @@map("admin_activity_logs")
}

model SystemSettings {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String   // JSON string for complex values
  updatedAt DateTime @updatedAt
  updatedBy String?  // Admin ID
  
  @@map("system_settings")
}

model LoginAttempt {
  id        String   @id @default(cuid())
  email     String?
  ipAddress String
  success   Boolean
  userAgent String?
  createdAt DateTime @default(now())
  
  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
  @@map("login_attempts")
}

model BlockedIP {
  id        String   @id @default(cuid())
  ipAddress String   @unique
  reason    String?
  expiresAt DateTime?
  blockedBy String?  // Admin ID
  createdAt DateTime @default(now())
  
  @@index([ipAddress])
  @@map("blocked_ips")
}
```

---

## 🔌 Socket.io Events to Add

### Admin-Specific Events
- `admin:meeting-ended` - When admin ends a meeting
- `admin:user-suspended` - When user is suspended
- `admin:message-deleted` - When message is deleted
- `admin:announcement` - System announcement
- `admin:user-flagged` - When user is flagged
- `admin:join-request-updated` - When join request is approved/declined

---

## 🚀 Implementation Priority

### Phase 1 (Essential)
1. Delete User
2. End Meeting
3. Approve/Decline Join Requests
4. User Activity Log
5. Meeting Analytics

### Phase 2 (Important)
6. Analytics & Reporting endpoints
7. Content Moderation (chat messages)
8. System Health Check
9. Suspend/Unsuspend User

### Phase 3 (Nice to Have)
10. Admin Activity Log
11. Security Features (IP blocking, login attempts)
12. Notifications & Announcements
13. Settings & Configuration
14. Backup & Maintenance

---

## 📝 Notes

- All endpoints should use `requireAdmin` middleware
- All admin actions should be logged
- Consider rate limiting for admin endpoints
- Add proper error handling and validation
- Use Prisma transactions for complex operations
- Consider adding caching for analytics endpoints
- Add pagination for list endpoints
- Use proper TypeScript types throughout

