"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  ChevronDown,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { isFeatureEnabled } from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

interface SuggestedPrompt {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
  accountName?: string;
  campaignId?: string;
  campaignName?: string;
}

// ============================================================================
// SUGGESTED PROMPTS
// ============================================================================

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "Performance Overview",
    prompt: "Give me a performance overview of my accounts. What's doing well and what needs attention?",
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    label: "Optimization Ideas",
    prompt: "What are some quick wins to improve my campaign performance?",
  },
  {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Check for Issues",
    prompt: "Are there any campaigns or ads that need immediate attention?",
  },
  {
    icon: <Sparkles className="w-4 h-4" />,
    label: "Budget Analysis",
    prompt: "Analyze my budget allocation. Am I spending efficiently across campaigns?",
  },
];

// ============================================================================
// MESSAGE COMPONENT
// ============================================================================

interface MessageProps {
  message: ChatMessage;
  onCopy: () => void;
}

function Message({ message, onCopy }: MessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy();
  };

  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-violet-500/20 text-violet-400"
            : "bg-emerald-500/20 text-emerald-400"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-2 rounded-xl text-sm ${
            isUser
              ? "bg-violet-500/20 text-violet-100 rounded-tr-none"
              : "bg-slate-800 text-slate-100 rounded-tl-none"
          }`}
        >
          {message.isStreaming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking...
            </span>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((call, idx) => (
              <div
                key={idx}
                className="text-xs px-3 py-1.5 bg-slate-800/50 rounded-lg text-slate-400 inline-block"
              >
                Called: {call.name}
              </div>
            ))}
          </div>
        )}

        {/* Message Actions */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-slate-800 rounded transition text-slate-500 hover:text-slate-300"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] text-slate-600 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN AI CHAT PANEL
// ============================================================================

export function AIChatPanel({
  isOpen,
  onClose,
  accountId,
  accountName,
  campaignId,
  campaignName,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canUseChat = isFeatureEnabled("ai.chat");

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Generate unique ID
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !canUseChat) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Add streaming placeholder
    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      // Build context for the AI
      const context: Record<string, unknown> = {};
      if (accountId) context.accountId = accountId;
      if (accountName) context.accountName = accountName;
      if (campaignId) context.campaignId = campaignId;
      if (campaignName) context.campaignName = campaignName;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          context,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      // Update the assistant message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: data.message,
                toolCalls: data.toolCalls,
                isStreaming: false,
              }
            : m
        )
      );
    } catch (error) {
      // Update with error message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "Sorry, I encountered an error. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, canUseChat, accountId, accountName, campaignId, campaignName, messages]);

  // Handle suggested prompt click
  const handleSuggestedPrompt = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  // Handle clear conversation
  const handleClear = () => {
    setMessages([]);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed right-0 top-0 h-full bg-slate-900 border-l border-slate-800 flex flex-col z-50 transition-all duration-300 ${
        isExpanded ? "w-full md:w-[600px]" : "w-full md:w-[400px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">AI Assistant</h3>
            <p className="text-xs text-slate-500">
              {accountName ? `Viewing: ${accountName}` : "Ask me anything about your accounts"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-slate-200"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClear}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-slate-200"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Hi! I'm your AI Assistant
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">
              I can help you analyze campaigns, find optimization opportunities, and answer questions about your accounts.
            </p>

            {/* Suggested Prompts */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                Try asking:
              </p>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedPrompt(prompt.prompt)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-left transition group"
                >
                  <div className="p-2 bg-slate-700/50 group-hover:bg-violet-500/20 rounded-lg transition text-slate-400 group-hover:text-violet-400">
                    {prompt.icon}
                  </div>
                  <span className="text-sm text-slate-300">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <Message key={message.id} message={message} onCopy={() => {}} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Feature disabled notice */}
      {!canUseChat && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            AI chat is currently disabled
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={canUseChat ? "Ask me anything..." : "AI chat is disabled"}
              disabled={!canUseChat || isLoading}
              rows={1}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: "48px", maxHeight: "120px" }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !canUseChat}
            className="p-3 bg-violet-500 hover:bg-violet-400 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AI CHAT BUTTON (Floating button to open panel)
// ============================================================================

interface AIChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function AIChatButton({ onClick, hasUnread }: AIChatButtonProps) {
  const canUseChat = isFeatureEnabled("ai.chat");

  return (
    <button
      onClick={onClick}
      disabled={!canUseChat}
      className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-lg transition-all z-40 ${
        canUseChat
          ? "bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white"
          : "bg-slate-800 text-slate-500 cursor-not-allowed"
      }`}
      title={canUseChat ? "Open AI Assistant" : "AI chat is disabled"}
    >
      <Sparkles className="w-6 h-6" />
      {hasUnread && (
        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900" />
      )}
    </button>
  );
}
