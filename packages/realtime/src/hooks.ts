// ============================================================================
// REALTIME HOOKS - React hooks for subscribing to Pusher events
// ============================================================================

"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClientPusher, CHANNELS, type RealtimeEvent } from "./index";

/**
 * Subscribe to account updates and invalidate React Query cache
 */
export function useRealtimeAccounts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pusher = getClientPusher();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.ACCOUNTS);

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
      channel.unbind("account:created", handleAccountUpdate);
      channel.unbind("account:updated", handleAccountUpdate);
      channel.unbind("account:deleted", handleAccountUpdate);
      channel.unbind("account:handed-off");
      pusher.unsubscribe(CHANNELS.ACCOUNTS);
    };
  }, [queryClient]);
}

/**
 * Subscribe to identity updates and invalidate React Query cache
 */
export function useRealtimeIdentities() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pusher = getClientPusher();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.IDENTITIES);

    const handleIdentityUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["identities"] });
    };

    channel.bind("identity:created", handleIdentityUpdate);
    channel.bind("identity:updated", handleIdentityUpdate);

    return () => {
      channel.unbind("identity:created", handleIdentityUpdate);
      channel.unbind("identity:updated", handleIdentityUpdate);
      pusher.unsubscribe(CHANNELS.IDENTITIES);
    };
  }, [queryClient]);
}

/**
 * Subscribe to notifications for a specific user
 */
export function useRealtimeNotifications(
  userId: string | null,
  onNotification?: (data: { title: string; message: string }) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const pusher = getClientPusher();
    if (!pusher) return;

    const channelName = CHANNELS.NOTIFICATIONS(userId);
    const channel = pusher.subscribe(channelName);

    const handleNewNotification = (data: { title: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onNotification?.(data);
    };

    channel.bind("notification:new", handleNewNotification);

    return () => {
      channel.unbind("notification:new", handleNewNotification);
      pusher.unsubscribe(channelName);
    };
  }, [userId, queryClient, onNotification]);
}

/**
 * Subscribe to thread messages for a specific account
 */
export function useRealtimeThread(accountId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accountId) return;

    const pusher = getClientPusher();
    if (!pusher) return;

    const channelName = CHANNELS.THREAD(accountId);
    const channel = pusher.subscribe(channelName);

    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", "thread", accountId] });
    };

    channel.bind("thread:new-message", handleNewMessage);

    return () => {
      channel.unbind("thread:new-message", handleNewMessage);
      pusher.unsubscribe(channelName);
    };
  }, [accountId, queryClient]);
}

/**
 * Subscribe to system alerts (suspensions, billing issues, etc.)
 */
export function useRealtimeAlerts(onAlert?: (data: { type: string; accountId: string; message: string }) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pusher = getClientPusher();
    if (!pusher) return;

    const channel = pusher.subscribe(CHANNELS.ALERTS);

    const handleAlert = (data: { type: string; accountId: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["accounts", "needs-attention"] });
      onAlert?.(data);
    };

    channel.bind("alert:suspension", handleAlert);

    return () => {
      channel.unbind("alert:suspension", handleAlert);
      pusher.unsubscribe(CHANNELS.ALERTS);
    };
  }, [queryClient, onAlert]);
}

/**
 * Combined hook for subscribing to all relevant channels
 * Use this in the app's root layout for comprehensive real-time updates
 */
export function useRealtimeSync(
  userId: string | null,
  options?: {
    onNotification?: (data: { title: string; message: string }) => void;
    onAlert?: (data: { type: string; accountId: string; message: string }) => void;
  }
) {
  useRealtimeAccounts();
  useRealtimeIdentities();
  useRealtimeNotifications(userId, options?.onNotification);
  useRealtimeAlerts(options?.onAlert);
}
