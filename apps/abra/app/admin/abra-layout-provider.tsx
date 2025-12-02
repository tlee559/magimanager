"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRealtimeNotifications } from "@magimanager/realtime";

// ============================================================================
// TYPES
// ============================================================================

type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";

type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  unreadNotifications: number;
};

type Notification = {
  id: string;
  read: boolean;
};

type AbraLayoutContextType = {
  user: User | null;
  userRole: UserRole | null;
  isLoading: boolean;
  unreadCount: number;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  refreshUser: () => Promise<void>;
};

const AbraLayoutContext = createContext<AbraLayoutContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function AbraLayoutProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Calculate unread count from notifications
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Real-time notifications - triggers refetch when new notification arrives
  useRealtimeNotifications(user?.id ?? null, () => {
    fetchNotifications();
  });

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  // Fetch current user
  const fetchUser = useCallback(async () => {
    if (!session?.user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    fetchUser();
    fetchNotifications();
  }, [fetchUser, fetchNotifications]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
    await fetchNotifications();
  }, [fetchUser, fetchNotifications]);

  return (
    <AbraLayoutContext.Provider
      value={{
        user,
        userRole: user?.role || null,
        isLoading,
        unreadCount,
        showProfileModal,
        setShowProfileModal,
        refreshUser,
      }}
    >
      {children}
      {/* Profile Modal - we can add this later if needed */}
    </AbraLayoutContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAbraLayout() {
  const context = useContext(AbraLayoutContext);
  if (!context) {
    throw new Error("useAbraLayout must be used within AbraLayoutProvider");
  }
  return context;
}
