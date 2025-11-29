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

  const handleNotification = useCallback((data: { title: string; message: string }) => {
    // Show browser notification if permitted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(data.title, { body: data.message });
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
