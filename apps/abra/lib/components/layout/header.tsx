"use client";

import { useState } from "react";
import type { AdminView, Notification } from "@magimanager/shared";
import { formatDateForDisplay } from "@/lib/validation";

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  currentView: AdminView;
  selectedIdentityName?: string;
  notifications: Notification[];
  unreadCount: number;
  alertsCount: number;
  criticalAlertsCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewChange: (view: AdminView) => void;
}

// View title mapping
const viewTitles: Partial<Record<AdminView, string>> = {
  dashboard: "Dashboard",
  identities: "Identity Profiles",
  "create-identity": "New Identity Profile",
  "ad-accounts": "Account Profiles",
  team: "Team Management",
  "my-accounts": "My Accounts",
  requests: "My Requests",
  "admin-requests": "Account Requests",
  settings: "Settings",
  system: "System Overview",
};

export function Header({
  currentView,
  selectedIdentityName,
  notifications,
  unreadCount,
  alertsCount,
  criticalAlertsCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewChange,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  // Determine title
  let title = viewTitles[currentView] || "";
  if (currentView === "identity-detail" && selectedIdentityName) {
    title = selectedIdentityName;
  } else if (currentView === "edit-identity" && selectedIdentityName) {
    title = `Edit ${selectedIdentityName}`;
  } else if (currentView === "sms-dashboard") {
    title = "SMS Verifications";
  }

  return (
    <header className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950">
      <div>
        {currentView === "sms-dashboard" ? (
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-400">{title}</h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 rounded uppercase">
              Coming Soon
            </span>
          </div>
        ) : (
          <h1 className="text-lg font-semibold text-slate-50">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-400 hover:text-slate-200 transition rounded-lg hover:bg-slate-800"
            title="Notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {(criticalAlertsCount > 0 || alertsCount > 0 || unreadCount > 0) && (
              <span
                className={`absolute -top-0.5 -right-0.5 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-semibold px-1 ${
                  criticalAlertsCount > 0
                    ? "bg-rose-500 animate-pulse"
                    : alertsCount > 0
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
              >
                {unreadCount + alertsCount > 9 ? "9+" : unreadCount + alertsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <NotificationsDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              alertsCount={alertsCount}
              criticalAlertsCount={criticalAlertsCount}
              onClose={() => setShowNotifications(false)}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onViewAlerts={() => {
                setShowNotifications(false);
                onViewChange("ad-accounts");
              }}
            />
          )}
        </div>

        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
        >
          Kadabra!
        </a>
      </div>
    </header>
  );
}

// ============================================================================
// NOTIFICATIONS DROPDOWN
// ============================================================================

interface NotificationsDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  alertsCount: number;
  criticalAlertsCount: number;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewAlerts: () => void;
}

function NotificationsDropdown({
  notifications,
  unreadCount,
  alertsCount,
  criticalAlertsCount,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAlerts,
}: NotificationsDropdownProps) {
  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Notifications</h3>
        {unreadCount > 0 && (
          <button onClick={onMarkAllAsRead} className="text-xs text-emerald-400 hover:text-emerald-300">
            Mark all as read
          </button>
        )}
      </div>

      {/* Needs Attention Alerts Summary */}
      {alertsCount > 0 && (
        <div
          className={`p-3 border-b cursor-pointer hover:bg-slate-800/50 transition ${
            criticalAlertsCount > 0 ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/30"
          }`}
          onClick={onViewAlerts}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                criticalAlertsCount > 0 ? "bg-rose-500/20" : "bg-amber-500/20"
              }`}
            >
              <svg
                className={`w-4 h-4 ${criticalAlertsCount > 0 ? "text-rose-400" : "text-amber-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${criticalAlertsCount > 0 ? "text-rose-300" : "text-amber-300"}`}>
                {alertsCount} Account{alertsCount !== 1 ? "s" : ""} Need Attention
              </div>
              <div className="text-xs text-slate-400">
                {criticalAlertsCount > 0 && `${criticalAlertsCount} critical · `}
                Click to view in Ad Accounts
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 && alertsCount === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No notifications yet</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No other notifications</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                if (!notif.isRead) onMarkAsRead(notif.id);
              }}
              className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition ${
                !notif.isRead ? "bg-indigo-500/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-slate-200">{notif.title}</h4>
                    {!notif.isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                  </div>
                  <p className="text-xs text-slate-400">{notif.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDateForDisplay(notif.createdAt)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
