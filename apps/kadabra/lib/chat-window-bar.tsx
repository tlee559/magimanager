"use client";

import { Sparkles, Plus } from "lucide-react";
import { ChatWindowComponent } from "./chat-window";
import type { ChatWindow, Message } from "./chat-types";

// ============================================================================
// CHAT WINDOW BAR - CONTAINER FOR ALL STACKED WINDOWS
// ============================================================================

const MAX_VISIBLE_WINDOWS = 4;

export function ChatWindowBar({
  windows,
  onClose,
  onMinimize,
  onSendMessage,
  onUpdateWindow,
  onOpenGeneralChat,
}: {
  windows: ChatWindow[];
  onClose: (windowId: string) => void;
  onMinimize: (windowId: string) => void;
  onSendMessage: (windowId: string, message: string) => void;
  onUpdateWindow: (windowId: string, updates: Partial<ChatWindow>) => void;
  onOpenGeneralChat: () => void;
}) {
  // Only show last N windows, rest hidden behind "+" indicator
  const visibleWindows = windows.slice(-MAX_VISIBLE_WINDOWS);
  const hiddenCount = Math.max(0, windows.length - MAX_VISIBLE_WINDOWS);

  // If no windows, just show the floating button
  if (windows.length === 0) {
    return (
      <div className="fixed bottom-6 right-6 z-[70]">
        <button
          onClick={onOpenGeneralChat}
          className="p-4 rounded-full shadow-lg shadow-black/30 transition-all bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 hover:scale-105"
          title="Open AI Chat"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-6 flex items-end gap-2 z-[70]">
      {/* Hidden windows indicator */}
      {hiddenCount > 0 && (
        <button
          className="mb-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition flex items-center gap-1.5"
          title={`${hiddenCount} more chat${hiddenCount > 1 ? "s" : ""}`}
        >
          <Plus className="w-3.5 h-3.5" />
          {hiddenCount}
        </button>
      )}

      {/* Visible chat windows */}
      {visibleWindows.map((window) => (
        <ChatWindowComponent
          key={window.id}
          window={window}
          onClose={() => onClose(window.id)}
          onMinimize={() => onMinimize(window.id)}
          onSendMessage={(msg) => onSendMessage(window.id, msg)}
          onUpdateWindow={(updates) => onUpdateWindow(window.id, updates)}
        />
      ))}

      {/* Floating button for new general chat */}
      <div className="mb-1">
        <button
          onClick={onOpenGeneralChat}
          className="p-3 rounded-full shadow-lg shadow-black/30 transition-all bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 hover:scale-105"
          title="New Chat"
        >
          <Sparkles className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS FOR CHAT WINDOW MANAGEMENT
// ============================================================================

export function createChatWindow(
  accountId: string | null,
  accountName: string,
  initialContext?: string
): ChatWindow {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    accountId,
    accountName,
    messages: [],
    isMinimized: false,
    isLoading: false,
    createdAt: new Date(),
    initialContext: initialContext || null,
    contextSent: false,
  };
}

export function findExistingWindow(
  windows: ChatWindow[],
  accountId: string | null
): ChatWindow | undefined {
  return windows.find((w) => w.accountId === accountId);
}

export function bringWindowToFront(
  windows: ChatWindow[],
  windowId: string
): ChatWindow[] {
  const windowIndex = windows.findIndex((w) => w.id === windowId);
  if (windowIndex === -1) return windows;

  const window = windows[windowIndex];
  return [
    ...windows.filter((_, i) => i !== windowIndex),
    { ...window, isMinimized: false },
  ];
}

export function addMessage(
  window: ChatWindow,
  message: Message
): ChatWindow {
  return {
    ...window,
    messages: [...window.messages, message],
  };
}
