/**
 * Chat Widget Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ChatWidgetConfig {
  // Required
  agentEndpoint: string;

  // Positioning
  position: 'bottom-right' | 'bottom-left';
  avatarImage?: string;
  avatarSize: number;
  primaryColor: string;
  chatWidth: number;
  chatHeight: number | 'full';

  // Branding
  headerTitle: string;
  welcomeMessage: string;
  placeholder: string;

  // Behavior
  openOnLoad: boolean;
  persistSession: boolean;
  sessionStorageKey: string;
  pushContent: boolean;
  includePageContext: boolean;
  pageContextSelector: string | null;

  // Markdown
  enableMarkdown: boolean;
  syntaxHighlighting: boolean;
  syntaxTheme: 'github-dark' | 'github-light' | 'monokai';

  // Authentication
  authToken: string | null;
  authHeader: string;

  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onMessageSent?: (message: Message) => void;
  onMessageReceived?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export type PartialConfig = Partial<ChatWidgetConfig> & { agentEndpoint: string };

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: 'pending' | 'complete' | 'error';
}

// ============================================================================
// SSE Event Types (matching backend format)
// ============================================================================

export interface SSEEvent {
  type: 'start' | 'text' | 'tool-call' | 'tool-result' | 'error' | 'done' | 'finish';
  content?: unknown;
  traceId?: string;
}

export interface SSETextEvent extends SSEEvent {
  type: 'text';
  content: string;
}

export interface SSEToolCallEvent extends SSEEvent {
  type: 'tool-call';
  content: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  };
}

export interface SSEToolResultEvent extends SSEEvent {
  type: 'tool-result';
  content: {
    toolCallId: string;
    result: unknown;
  };
}

export interface SSEErrorEvent extends SSEEvent {
  type: 'error';
  content: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// Session Types
// ============================================================================

export interface ChatSession {
  id: string;
  conversationId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface ChatRequest {
  message: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  success: boolean;
  data: {
    text: string;
    toolCalls?: ToolCall[];
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
  };
  traceId: string;
}

// ============================================================================
// Component Types
// ============================================================================

export interface AvatarOptions {
  imageUrl?: string;
  size: number;
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;
  onClick: () => void;
}

export interface PanelOptions {
  title: string;
  width: number;
  height: number | 'full';
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;
  pushContent: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onClearHistory: () => void;
}

export interface InputOptions {
  placeholder: string;
  primaryColor: string;
  onSend: (message: string) => void;
}

export interface MessageOptions {
  message: Message;
  enableMarkdown: boolean;
}

// ============================================================================
// Public API
// ============================================================================

export interface ChatWidgetAPI {
  open(): void;
  close(): void;
  toggle(): void;
  sendMessage(text: string): void;
  clearHistory(): void;
  destroy(): void;
}

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeColors {
  primary: string;
  background: string;
  text: string;
  userBubble: string;
  agentBubble: string;
  border: string;
  codeBackground: string;
  codeText: string;
}

// ============================================================================
// Global Window Declaration
// ============================================================================

declare global {
  interface Window {
    ChatWidget: ChatWidgetAPI;
    ChatWidgetConfig: PartialConfig;
  }
}
