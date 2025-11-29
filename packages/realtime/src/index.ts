import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher client (for sending events)
let serverPusher: Pusher | null = null;

export function getServerPusher(): Pusher | null {
  if (typeof window !== 'undefined') {
    console.warn('getServerPusher should only be called on the server');
    return null;
  }

  if (!serverPusher && process.env.PUSHER_APP_ID) {
    serverPusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
      useTLS: true,
    });
  }

  return serverPusher;
}

// Client-side Pusher client (for subscribing to events)
let clientPusher: PusherClient | null = null;

export function getClientPusher(): PusherClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!clientPusher && process.env.NEXT_PUBLIC_PUSHER_KEY) {
    clientPusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
    });
  }

  return clientPusher;
}

// Event types for cross-app communication
export type RealtimeEvent =
  | 'account:created'
  | 'account:updated'
  | 'account:deleted'
  | 'account:handed-off'
  | 'identity:created'
  | 'identity:updated'
  | 'thread:new-message'
  | 'notification:new'
  | 'sync:google-ads'
  | 'alert:suspension';

// Channels
export const CHANNELS = {
  ACCOUNTS: 'accounts',
  IDENTITIES: 'identities',
  NOTIFICATIONS: (userId: string) => `private-user-${userId}`,
  THREAD: (accountId: string) => `private-thread-${accountId}`,
  ALERTS: 'alerts',
} as const;

// Helper to broadcast events (server-side)
export async function broadcastEvent(
  channel: string,
  event: RealtimeEvent,
  data: Record<string, any>
): Promise<void> {
  const pusher = getServerPusher();
  if (!pusher) {
    console.warn('Pusher not configured, skipping broadcast');
    return;
  }

  try {
    await pusher.trigger(channel, event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to broadcast event:', error);
  }
}

// Re-export Pusher classes
export { PusherClient };
export { Pusher };

// Re-export React hooks for subscribing to realtime events
export {
  useRealtimeAccounts,
  useRealtimeIdentities,
  useRealtimeNotifications,
  useRealtimeThread,
  useRealtimeAlerts,
  useRealtimeSync,
} from "./hooks";

// Re-export RealtimeProvider and connection hooks
export {
  RealtimeProvider,
  useRealtime,
  useConnectionStatus,
  useIsConnected,
  type RealtimeProviderProps,
  type RealtimeContextValue,
  type ConnectionStatus,
} from "./provider";

// Re-export ConnectionIndicator components
export {
  ConnectionIndicator,
  InlineConnectionIndicator,
  type ConnectionIndicatorProps,
  type InlineConnectionIndicatorProps,
} from "./connection-indicator";

// Re-export notification service
export {
  notifyPipelineBlocked,
  notifyPipelineEnabled,
  notifyPipelineProgress,
  notifyReadyForHandoff,
  notifyWarmupMilestone,
  type PipelineStage,
  type PipelineBlocker,
  type PipelineEnabler,
  type NotificationPriority,
  type PipelineNotification,
} from "./notifications";
