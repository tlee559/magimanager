"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClientPusher, CHANNELS, type RealtimeEvent } from "./index";
import type PusherClient from "pusher-js";
import type { Channel } from "pusher-js";

// ============================================================================
// CONNECTION STATUS TYPES
// ============================================================================

export type ConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "unavailable"
  | "failed";

export interface RealtimeContextValue {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Whether we're currently connected */
  isConnected: boolean;
  /** Last successful connection timestamp */
  lastConnectedAt: Date | null;
  /** Reconnection attempt count */
  reconnectAttempts: number;
  /** Manually trigger a reconnection */
  reconnect: () => void;
  /** Subscribe to custom events */
  subscribe: (channel: string, event: string, callback: (data: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export interface RealtimeProviderProps {
  children: ReactNode;
  /** User ID for private channels */
  userId?: string | null;
  /** Callback when notification is received */
  onNotification?: (data: { title: string; message: string; type?: string }) => void;
  /** Callback when alert is received */
  onAlert?: (data: { type: string; accountId: string; message: string }) => void;
  /** Callback when connection status changes */
  onConnectionChange?: (status: ConnectionStatus) => void;
}

export function RealtimeProvider({
  children,
  userId,
  onNotification,
  onAlert,
  onConnectionChange,
}: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const pusherRef = useRef<PusherClient | null>(null);
  const channelsRef = useRef<Map<string, Channel>>(new Map());

  // Update connection status and notify
  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    if (status === "connected") {
      setLastConnectedAt(new Date());
      setReconnectAttempts(0);
    }
    onConnectionChange?.(status);
  }, [onConnectionChange]);

  // Initialize Pusher and set up connection monitoring
  useEffect(() => {
    const pusher = getClientPusher();
    if (!pusher) {
      updateStatus("unavailable");
      return;
    }

    pusherRef.current = pusher;

    // Connection state handlers
    pusher.connection.bind("connected", () => {
      console.log("[Realtime] Connected");
      updateStatus("connected");
    });

    pusher.connection.bind("connecting", () => {
      console.log("[Realtime] Connecting...");
      updateStatus("connecting");
    });

    pusher.connection.bind("disconnected", () => {
      console.log("[Realtime] Disconnected");
      updateStatus("disconnected");
    });

    pusher.connection.bind("unavailable", () => {
      console.log("[Realtime] Unavailable");
      updateStatus("unavailable");
    });

    pusher.connection.bind("failed", () => {
      console.log("[Realtime] Failed");
      updateStatus("failed");
    });

    pusher.connection.bind("state_change", (states: { previous: string; current: string }) => {
      console.log(`[Realtime] State changed: ${states.previous} -> ${states.current}`);
      if (states.current === "connecting" && states.previous === "unavailable") {
        setReconnectAttempts((prev) => prev + 1);
      }
    });

    // Check initial state
    const currentState = pusher.connection.state;
    if (currentState === "connected") {
      updateStatus("connected");
    } else if (currentState === "connecting") {
      updateStatus("connecting");
    }

    return () => {
      pusher.connection.unbind_all();
    };
  }, [updateStatus]);

  // Subscribe to accounts channel
  useEffect(() => {
    const pusher = pusherRef.current;
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.ACCOUNTS);
    channelsRef.current.set(CHANNELS.ACCOUNTS, channel);

    const handleAccountUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    };

    const handleNeedsAttentionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", "needs-attention"] });
    };

    channel.bind("account:created", handleAccountUpdate);
    channel.bind("account:updated", handleAccountUpdate);
    channel.bind("account:deleted", handleAccountUpdate);
    channel.bind("account:handed-off", () => {
      handleAccountUpdate();
      handleNeedsAttentionUpdate();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.ACCOUNTS);
      channelsRef.current.delete(CHANNELS.ACCOUNTS);
    };
  }, [queryClient]);

  // Subscribe to identities channel
  useEffect(() => {
    const pusher = pusherRef.current;
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.IDENTITIES);
    channelsRef.current.set(CHANNELS.IDENTITIES, channel);

    const handleIdentityUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["identities"] });
    };

    channel.bind("identity:created", handleIdentityUpdate);
    channel.bind("identity:updated", handleIdentityUpdate);

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.IDENTITIES);
      channelsRef.current.delete(CHANNELS.IDENTITIES);
    };
  }, [queryClient]);

  // Subscribe to alerts channel
  useEffect(() => {
    const pusher = pusherRef.current;
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.ALERTS);
    channelsRef.current.set(CHANNELS.ALERTS, channel);

    const handleAlert = (data: { type: string; accountId: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["accounts", "needs-attention"] });
      onAlert?.(data);
    };

    channel.bind("alert:suspension", handleAlert);
    channel.bind("alert:billing-failed", handleAlert);
    channel.bind("alert:cert-error", handleAlert);

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.ALERTS);
      channelsRef.current.delete(CHANNELS.ALERTS);
    };
  }, [queryClient, onAlert]);

  // Subscribe to user-specific notifications
  useEffect(() => {
    if (!userId) return;

    const pusher = pusherRef.current;
    if (!pusher) return;

    const channelName = CHANNELS.NOTIFICATIONS(userId);
    const channel = pusher.subscribe(channelName);
    channelsRef.current.set(channelName, channel);

    const handleNewNotification = (data: { title: string; message: string; type?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onNotification?.(data);
    };

    channel.bind("notification:new", handleNewNotification);

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      channelsRef.current.delete(channelName);
    };
  }, [userId, queryClient, onNotification]);

  // Reconnect function
  const reconnect = useCallback(() => {
    const pusher = pusherRef.current;
    if (!pusher) return;

    console.log("[Realtime] Manual reconnect triggered");
    pusher.connect();
  }, []);

  // Custom subscription function
  const subscribe = useCallback(
    (channel: string, event: string, callback: (data: any) => void) => {
      const pusher = pusherRef.current;
      if (!pusher) return () => {};

      let ch = channelsRef.current.get(channel);
      if (!ch) {
        ch = pusher.subscribe(channel);
        channelsRef.current.set(channel, ch);
      }

      ch.bind(event, callback);

      return () => {
        ch?.unbind(event, callback);
      };
    },
    []
  );

  const value: RealtimeContextValue = {
    connectionStatus,
    isConnected: connectionStatus === "connected",
    lastConnectedAt,
    reconnectAttempts,
    reconnect,
    subscribe,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Access the realtime context
 * Must be used within a RealtimeProvider
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}

/**
 * Get just the connection status (lightweight)
 */
export function useConnectionStatus(): ConnectionStatus {
  const { connectionStatus } = useRealtime();
  return connectionStatus;
}

/**
 * Check if connected (most common use case)
 */
export function useIsConnected(): boolean {
  const { isConnected } = useRealtime();
  return isConnected;
}
