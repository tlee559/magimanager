"use client";

import { useState, useRef, useEffect } from "react";
import { Minus, X, Sparkles, Send } from "lucide-react";
import type { ChatWindow, Message } from "./chat-types";

// Re-export types for convenience
export type { ChatWindow, Message } from "./chat-types";

// ============================================================================
// SINGLE CHAT WINDOW COMPONENT
// ============================================================================

export function ChatWindowComponent({
  window,
  onClose,
  onMinimize,
  onSendMessage,
  onUpdateWindow,
}: {
  window: ChatWindow;
  onClose: () => void;
  onMinimize: () => void;
  onSendMessage: (message: string) => void;
  onUpdateWindow: (updates: Partial<ChatWindow>) => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [window.messages]);

  // Auto-send initial context when window opens
  useEffect(() => {
    if (window.initialContext && !window.contextSent && !window.isLoading) {
      onSendMessage(window.initialContext);
      onUpdateWindow({ contextSent: true, initialContext: null });
    }
  }, [window.initialContext, window.contextSent, window.isLoading]);

  const handleSend = () => {
    if (!input.trim() || window.isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Minimized state - just the header bar
  if (window.isMinimized) {
    return (
      <div
        className="w-64 bg-slate-900 border border-slate-700 rounded-t-xl cursor-pointer hover:border-violet-500/50 transition shadow-lg"
        onClick={onMinimize}
      >
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-violet-500/20 rounded">
              <Sparkles className="w-3 h-3 text-violet-400" />
            </div>
            <span className="text-sm font-medium text-slate-100 truncate max-w-32">
              {window.accountName}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded window
  return (
    <div className="w-80 bg-slate-900 border border-slate-700 rounded-t-xl flex flex-col shadow-2xl shadow-black/50 max-h-[450px]">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-violet-500/20 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="text-sm font-medium text-slate-100">
            {window.accountName}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onMinimize}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[300px]">
        {window.messages.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="w-6 h-6 text-violet-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400 mb-1">
              {window.accountId ? `Ask about ${window.accountName}` : "Ask me anything"}
            </p>
            <p className="text-[10px] text-slate-500">
              I can analyze performance and suggest optimizations
            </p>
          </div>
        ) : (
          window.messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-violet-500 text-white"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {window.isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-3 py-2 rounded-xl">
              <div className="flex gap-1">
                <div
                  className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={window.isLoading}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 disabled:opacity-50 transition"
          />
          <button
            onClick={handleSend}
            disabled={window.isLoading || !input.trim()}
            className="px-3 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
