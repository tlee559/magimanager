"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { user, refreshUser } = useAbraLayout();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || data);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      refreshUser();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshUser();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 text-violet-400 hover:text-violet-300 transition"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Notifications</h2>
          <p className="text-slate-400">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-slate-900 border rounded-xl p-4 transition ${
                notification.read
                  ? "border-slate-800/50 opacity-60"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-violet-500" />
                    )}
                    <h3 className="font-medium text-white">{notification.title}</h3>
                    {notification.priority === "high" && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-400 rounded">
                        High Priority
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="p-2 text-slate-400 hover:text-violet-400 transition"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
