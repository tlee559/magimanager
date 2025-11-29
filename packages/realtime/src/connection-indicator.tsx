"use client";

import React from "react";
import { useRealtime, type ConnectionStatus } from "./provider";

// ============================================================================
// CONNECTION INDICATOR COMPONENT
// ============================================================================

export interface ConnectionIndicatorProps {
  /** Position on screen */
  position?: "top-right" | "bottom-right" | "bottom-left" | "top-left";
  /** Show detailed status on hover */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to always show or only when disconnected */
  showWhenConnected?: boolean;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    animate: boolean;
  }
> = {
  connected: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500",
    borderColor: "border-emerald-500/30",
    label: "Connected",
    animate: false,
  },
  connecting: {
    color: "text-amber-400",
    bgColor: "bg-amber-500",
    borderColor: "border-amber-500/30",
    label: "Connecting...",
    animate: true,
  },
  disconnected: {
    color: "text-red-400",
    bgColor: "bg-red-500",
    borderColor: "border-red-500/30",
    label: "Disconnected",
    animate: false,
  },
  unavailable: {
    color: "text-slate-400",
    bgColor: "bg-slate-500",
    borderColor: "border-slate-500/30",
    label: "Unavailable",
    animate: false,
  },
  failed: {
    color: "text-red-500",
    bgColor: "bg-red-600",
    borderColor: "border-red-500/30",
    label: "Failed",
    animate: false,
  },
};

const POSITION_CLASSES: Record<ConnectionIndicatorProps["position"] & string, string> = {
  "top-right": "fixed top-4 right-4",
  "bottom-right": "fixed bottom-4 right-4",
  "bottom-left": "fixed bottom-4 left-4",
  "top-left": "fixed top-4 left-4",
};

const SIZE_CLASSES: Record<ConnectionIndicatorProps["size"] & string, { dot: string; text: string; padding: string }> = {
  sm: { dot: "w-2 h-2", text: "text-xs", padding: "px-2 py-1" },
  md: { dot: "w-2.5 h-2.5", text: "text-sm", padding: "px-3 py-1.5" },
  lg: { dot: "w-3 h-3", text: "text-base", padding: "px-4 py-2" },
};

export function ConnectionIndicator({
  position = "bottom-right",
  showDetails = true,
  className = "",
  size = "sm",
  showWhenConnected = true,
}: ConnectionIndicatorProps) {
  const { connectionStatus, lastConnectedAt, reconnectAttempts, reconnect } = useRealtime();

  const config = STATUS_CONFIG[connectionStatus];
  const sizeConfig = SIZE_CLASSES[size];

  // Hide if connected and showWhenConnected is false
  if (!showWhenConnected && connectionStatus === "connected") {
    return null;
  }

  // Format last connected time
  const formatLastConnected = () => {
    if (!lastConnectedAt) return "Never";
    const now = new Date();
    const diff = now.getTime() - lastConnectedAt.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return lastConnectedAt.toLocaleDateString();
  };

  return (
    <div
      className={`
        ${POSITION_CLASSES[position]}
        z-50
        ${className}
      `}
    >
      <div className="group relative">
        {/* Main indicator */}
        <div
          className={`
            flex items-center gap-2
            ${sizeConfig.padding}
            rounded-full
            bg-slate-900/90 backdrop-blur-sm
            border ${config.borderColor}
            shadow-lg
            transition-all duration-200
            cursor-pointer
            hover:scale-105
          `}
          onClick={connectionStatus !== "connected" ? reconnect : undefined}
        >
          {/* Status dot */}
          <div className="relative">
            <div
              className={`
                ${sizeConfig.dot}
                rounded-full
                ${config.bgColor}
                ${config.animate ? "animate-pulse" : ""}
              `}
            />
            {config.animate && (
              <div
                className={`
                  absolute inset-0
                  ${sizeConfig.dot}
                  rounded-full
                  ${config.bgColor}
                  animate-ping opacity-75
                `}
              />
            )}
          </div>

          {/* Status label */}
          <span className={`${config.color} ${sizeConfig.text} font-medium`}>
            {config.label}
          </span>
        </div>

        {/* Details tooltip */}
        {showDetails && (
          <div
            className={`
              absolute right-0 bottom-full mb-2
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
              pointer-events-none group-hover:pointer-events-auto
              z-50
            `}
          >
            <div
              className={`
                bg-slate-900 border border-slate-700
                rounded-lg shadow-xl
                p-3 min-w-[180px]
                text-sm
              `}
            >
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={config.color}>{config.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last connected:</span>
                  <span className="text-white">{formatLastConnected()}</span>
                </div>
                {reconnectAttempts > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reconnect attempts:</span>
                    <span className="text-amber-400">{reconnectAttempts}</span>
                  </div>
                )}
                {connectionStatus !== "connected" && (
                  <button
                    onClick={reconnect}
                    className={`
                      w-full mt-2 px-3 py-1.5
                      bg-emerald-600 hover:bg-emerald-500
                      text-white text-xs font-medium
                      rounded transition
                    `}
                  >
                    Reconnect Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INLINE INDICATOR (for headers/nav)
// ============================================================================

export interface InlineConnectionIndicatorProps {
  /** Show label text */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
}

export function InlineConnectionIndicator({
  showLabel = false,
  className = "",
}: InlineConnectionIndicatorProps) {
  const { connectionStatus, reconnect } = useRealtime();
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        ${className}
      `}
      title={`Real-time: ${config.label}`}
    >
      <div className="relative">
        <div
          className={`
            w-2 h-2
            rounded-full
            ${config.bgColor}
            ${config.animate ? "animate-pulse" : ""}
          `}
        />
        {config.animate && (
          <div
            className={`
              absolute inset-0
              w-2 h-2
              rounded-full
              ${config.bgColor}
              animate-ping opacity-75
            `}
          />
        )}
      </div>
      {showLabel && (
        <span className={`text-xs ${config.color}`}>{config.label}</span>
      )}
      {connectionStatus !== "connected" && (
        <button
          onClick={reconnect}
          className="ml-1 text-xs text-emerald-400 hover:text-emerald-300 underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
