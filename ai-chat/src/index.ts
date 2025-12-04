/**
 * AI Chat Widget - Main Entry Point
 *
 * A lightweight, embeddable chat widget with SSE streaming support.
 */

import type {
  ChatWidgetConfig,
  PartialConfig,
  Message,
  SSEEvent,
  SSETextEvent,
  SSEToolCallEvent,
  SSEToolResultEvent,
  ChatWidgetAPI,
  ToolCall,
} from './types';
import { mergeConfig, validateConfig } from './config';
import { ApiService } from './services/api';
import { MarkdownService } from './services/markdown';
import { SessionService } from './services/session';
import { PageContextService } from './services/page-context';
import {
  createContainer,
  injectStyles,
  destroyWidget,
  generateId,
  announceToScreenReader,
} from './services/dom';
import { AvatarComponent } from './components/avatar';
import { PanelComponent } from './components/panel';
import { MessageComponent } from './components/message';
import { InputComponent } from './components/input';
import { generateStyles } from './styles/variables';

export class ChatWidget implements ChatWidgetAPI {
  private config: ChatWidgetConfig;
  private apiService: ApiService;
  private markdownService: MarkdownService;
  private sessionService: SessionService;
  private pageContextService: PageContextService;

  private container: HTMLElement | null = null;
  private avatar: AvatarComponent | null = null;
  private panel: PanelComponent | null = null;
  private input: InputComponent | null = null;

  private messageComponents: Map<string, MessageComponent> = new Map();
  private isOpen: boolean = false;
  private isStreaming: boolean = false;
  private currentStreamingMessage: Message | null = null;

  constructor(userConfig: PartialConfig) {
    // Validate configuration
    const errors = validateConfig(userConfig);
    if (errors.length > 0) {
      console.error('[ChatWidget] Configuration errors:', errors);
      throw new Error(`ChatWidget configuration invalid: ${errors.join(', ')}`);
    }

    // Merge with defaults
    this.config = mergeConfig(userConfig);

    // Initialize services
    this.apiService = new ApiService(this.config);
    this.markdownService = new MarkdownService(this.config);
    this.sessionService = new SessionService(this.config);
    this.pageContextService = new PageContextService(this.config);
  }

  /**
   * Initialize and mount the widget
   */
  init(): void {
    // Create container and inject styles
    this.container = createContainer();
    injectStyles(generateStyles(this.config));

    // Initialize session
    const session = this.sessionService.initialize();

    // Create avatar component
    this.avatar = new AvatarComponent({
      imageUrl: this.config.avatarImage,
      size: this.config.avatarSize,
      position: this.config.position,
      primaryColor: this.config.primaryColor,
      onClick: () => this.toggle(),
    });

    // Create panel component
    this.panel = new PanelComponent({
      title: this.config.headerTitle,
      width: this.config.chatWidth,
      height: this.config.chatHeight,
      position: this.config.position,
      primaryColor: this.config.primaryColor,
      pushContent: this.config.pushContent,
      onClose: () => this.close(),
      onMinimize: () => this.close(),
      onClearHistory: () => this.clearHistory(),
    });

    // Create input component
    this.input = new InputComponent({
      placeholder: this.config.placeholder,
      primaryColor: this.config.primaryColor,
      onSend: (message) => this.sendMessage(message),
    });

    // Mount components
    this.container.appendChild(this.avatar.getElement());
    this.container.appendChild(this.panel.getElement());
    this.panel.mountInput(this.input);

    // Set welcome message
    if (this.config.welcomeMessage) {
      this.panel.setWelcomeMessage(this.config.welcomeMessage);
    }

    // Restore messages from session
    session.messages.forEach((msg) => this.renderMessage(msg));

    // Open on load if configured
    if (this.config.openOnLoad) {
      this.open();
    }

    // Expose public API
    this.exposePublicAPI();

    console.log('[ChatWidget] Initialized successfully');
  }

  /**
   * Open the chat panel
   */
  open(): void {
    if (this.isOpen || !this.panel || !this.avatar) return;

    this.isOpen = true;
    this.avatar.hide();
    this.avatar.setOpen(true);
    this.panel.open();

    // Focus input after animation
    setTimeout(() => {
      this.input?.focus();
    }, 300);

    // Call callback
    this.config.onOpen?.();

    announceToScreenReader('Chat opened');
  }

  /**
   * Close the chat panel
   */
  close(): void {
    if (!this.isOpen || !this.panel || !this.avatar) return;

    this.isOpen = false;
    this.panel.close();
    this.avatar.show();
    this.avatar.setOpen(false);

    // Call callback
    this.config.onClose?.();

    announceToScreenReader('Chat closed');
  }

  /**
   * Toggle the chat panel
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Send a message
   */
  async sendMessage(content: string): Promise<void> {
    if (this.isStreaming || !content.trim()) return;

    // Create and render user message
    const userMessage = this.sessionService.createUserMessage(content);
    this.sessionService.addMessage(userMessage);
    this.renderMessage(userMessage);

    // Call callback
    this.config.onMessageSent?.(userMessage);

    // Create assistant message placeholder
    const assistantMessage = this.sessionService.createAssistantMessage();
    this.sessionService.addMessage(assistantMessage);
    this.renderMessage(assistantMessage);

    this.currentStreamingMessage = assistantMessage;

    // Start streaming
    this.isStreaming = true;
    this.input?.disable();
    this.input?.showTyping();

    // Extract page context if enabled
    const pageContext = this.pageContextService.extractContext();

    try {
      await this.apiService.streamMessage(
        content,
        this.sessionService.getConversationId(),
        (event) => this.handleSSEEvent(event),
        () => this.handleStreamComplete(),
        (error) => this.handleStreamError(error),
        pageContext
      );
    } catch (error) {
      this.handleStreamError(error as Error);
    }
  }

  /**
   * Handle SSE events
   */
  private handleSSEEvent(event: SSEEvent): void {
    if (!this.currentStreamingMessage) return;

    const component = this.messageComponents.get(this.currentStreamingMessage.id);
    if (!component) return;

    switch (event.type) {
      case 'start':
        // Stream started
        break;

      case 'text': {
        const textEvent = event as SSETextEvent;
        const newContent = this.currentStreamingMessage.content + (textEvent.content || '');
        this.currentStreamingMessage.content = newContent;
        component.updateContent(newContent, false);
        this.panel?.scrollToBottom();
        break;
      }

      case 'tool-call': {
        const toolEvent = event as SSEToolCallEvent;
        const toolCall: ToolCall = {
          id: toolEvent.content?.toolCallId || generateId(),
          toolName: toolEvent.content?.toolName || 'unknown',
          args: toolEvent.content?.args,
          status: 'pending',
        };
        component.addToolCall(toolCall);
        break;
      }

      case 'tool-result': {
        const resultEvent = event as SSEToolResultEvent;
        if (resultEvent.content?.toolCallId) {
          component.updateToolCall(resultEvent.content.toolCallId, {
            result: resultEvent.content.result,
            status: 'complete',
          });
        }
        break;
      }

      case 'error': {
        this.currentStreamingMessage.status = 'error';
        component.setStatus('error');
        const errorContent = (event.content as { message?: string })?.message || 'An error occurred';
        component.showError(errorContent);
        break;
      }

      case 'done':
      case 'finish':
        // Will be handled by handleStreamComplete
        break;
    }
  }

  /**
   * Handle stream completion
   */
  private handleStreamComplete(): void {
    if (this.currentStreamingMessage) {
      this.currentStreamingMessage.status = 'complete';

      const component = this.messageComponents.get(this.currentStreamingMessage.id);
      if (component) {
        component.updateContent(this.currentStreamingMessage.content, true);
        component.setStatus('complete');
      }

      // Update session
      this.sessionService.updateMessage(this.currentStreamingMessage.id, {
        content: this.currentStreamingMessage.content,
        status: 'complete',
      });

      // Call callback
      this.config.onMessageReceived?.(this.currentStreamingMessage);

      announceToScreenReader('New message received');
    }

    this.cleanupStreaming();
  }

  /**
   * Handle stream error
   */
  private handleStreamError(error: Error): void {
    console.error('[ChatWidget] Stream error:', error);

    if (this.currentStreamingMessage) {
      this.currentStreamingMessage.status = 'error';
      this.currentStreamingMessage.content = 'Sorry, something went wrong. Please try again.';

      const component = this.messageComponents.get(this.currentStreamingMessage.id);
      if (component) {
        component.updateContent(this.currentStreamingMessage.content, true);
        component.setStatus('error');
      }

      this.sessionService.updateMessage(this.currentStreamingMessage.id, {
        content: this.currentStreamingMessage.content,
        status: 'error',
      });
    }

    // Call callback
    this.config.onError?.(error);

    this.cleanupStreaming();
  }

  /**
   * Clean up after streaming
   */
  private cleanupStreaming(): void {
    this.isStreaming = false;
    this.currentStreamingMessage = null;
    this.input?.hideTyping();
    this.input?.enable();
    this.input?.focus();
  }

  /**
   * Render a message
   */
  private renderMessage(message: Message): void {
    const component = new MessageComponent(message, this.markdownService);
    this.messageComponents.set(message.id, component);
    this.panel?.addMessage(component.getElement());
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.sessionService.clear();
    this.messageComponents.clear();
    this.panel?.clearMessages();

    if (this.config.welcomeMessage) {
      this.panel?.setWelcomeMessage(this.config.welcomeMessage);
    }
  }

  /**
   * Destroy the widget
   */
  destroy(): void {
    // Abort any pending requests
    this.apiService.abort();

    // Close panel
    if (this.isOpen) {
      this.close();
    }

    // Destroy components
    this.avatar?.destroy();
    this.panel?.destroy();
    this.input?.destroy();
    this.messageComponents.clear();

    // Remove from DOM
    destroyWidget();

    // Clean up global API
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).ChatWidget;
    }

    console.log('[ChatWidget] Destroyed');
  }

  /**
   * Expose public API on window
   */
  private exposePublicAPI(): void {
    if (typeof window !== 'undefined') {
      window.ChatWidget = {
        open: () => this.open(),
        close: () => this.close(),
        toggle: () => this.toggle(),
        sendMessage: (text: string) => this.sendMessage(text),
        clearHistory: () => this.clearHistory(),
        destroy: () => this.destroy(),
      };
    }
  }
}

// Auto-initialize if config is present
if (typeof window !== 'undefined') {
  // Export class for manual initialization
  (window as unknown as Record<string, unknown>).ChatWidget = ChatWidget;

  // Auto-init when DOM is ready if config exists
  const autoInit = (): void => {
    if (window.ChatWidgetConfig) {
      try {
        const widget = new ChatWidget(window.ChatWidgetConfig);
        widget.init();
      } catch (error) {
        console.error('[ChatWidget] Auto-initialization failed:', error);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM already loaded, but use setTimeout to allow config script to execute
    setTimeout(autoInit, 0);
  }
}

// Export types and classes for module usage
export type { ChatWidgetConfig, PartialConfig, Message, ChatWidgetAPI } from './types';
export { mergeConfig, validateConfig } from './config';
