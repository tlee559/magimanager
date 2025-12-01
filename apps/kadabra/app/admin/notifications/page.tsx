"use client";

import { NotificationsView } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../kadabra-layout-provider";

export default function NotificationsPage() {
  const { notifications, loading, handleMarkNotificationRead } = useKadabraLayout();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Stay updated with account activities and alerts
        </p>
      </div>

      <NotificationsView
        notifications={notifications}
        loading={loading}
        onMarkRead={handleMarkNotificationRead}
      />
    </>
  );
}
