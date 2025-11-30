"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ReactQueryProvider } from "@/lib/react-query";
import { ModalProvider } from "@magimanager/features/admin";
import { RealtimeProvider, ConnectionIndicator } from "@magimanager/realtime";
import { useCallback } from "react";

// Inner component that has access to session
function RealtimeWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Cast to extended user type that includes id from our auth config
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const handleNotification = useCallback((data: {
    title: string;
    message: string;
    type?: string;
    entityId?: string;
    entityType?: string;
  }) => {
    // Show browser notification if permitted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(data.title, { body: data.message });
    }

    // Handle video clip completion notifications
    if (data.type === "VIDEO_CLIP_COMPLETED" && data.entityId) {
      // Store job ID for navigation
      sessionStorage.setItem("pendingVideoClipJobId", data.entityId);

      // Dispatch custom event for toast notification
      window.dispatchEvent(new CustomEvent("videoClipComplete", {
        detail: {
          jobId: data.entityId,
          title: data.title,
          message: data.message,
        }
      }));
    }
  }, []);

  const handleAlert = useCallback((data: { type: string; accountId: string; message: string }) => {
    // Show browser notification for alerts
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Alert", { body: data.message });
    }
    console.log("[Realtime Alert]", data);
  }, []);

  return (
    <RealtimeProvider
      userId={userId}
      onNotification={handleNotification}
      onAlert={handleAlert}
    >
      {children}
      <ConnectionIndicator position="bottom-right" size="sm" />
    </RealtimeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReactQueryProvider>
        <ModalProvider>
          <RealtimeWrapper>
            {children}
          </RealtimeWrapper>
        </ModalProvider>
      </ReactQueryProvider>
    </SessionProvider>
  );
}
