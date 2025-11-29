// ============================================================================
// CHAT WINDOW TYPES
// ============================================================================

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ChatWindow = {
  id: string;
  accountId: string | null; // null for general chat
  accountName: string;
  messages: Message[];
  isMinimized: boolean;
  isLoading: boolean;
  createdAt: Date;
  initialContext?: string | null;
  contextSent?: boolean;
};
