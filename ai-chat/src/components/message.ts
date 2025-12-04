/**
 * Message component - renders individual chat messages
 */

import type { Message, ToolCall } from '../types';
import { MarkdownService, initCodeCopyButtons } from '../services/markdown';
import { setTextDirection, escapeHtml } from '../services/dom';

export class MessageComponent {
  private element: HTMLDivElement;
  private contentElement: HTMLDivElement;
  private message: Message;
  private markdownService: MarkdownService;

  constructor(message: Message, markdownService: MarkdownService) {
    this.message = message;
    this.markdownService = markdownService;
    this.element = this.render();
    this.contentElement = this.element.querySelector('.chat-widget-message__content') as HTMLDivElement;
  }

  private render(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = `chat-widget-message chat-widget-message--${this.message.role}`;
    div.setAttribute('data-message-id', this.message.id);
    div.setAttribute('data-status', this.message.status);

    // Set text direction based on content
    if (this.message.content) {
      setTextDirection(div, this.message.content);
    }

    const isAssistant = this.message.role === 'assistant';

    div.innerHTML = `
      ${isAssistant ? '<div class="chat-widget-message__avatar" aria-hidden="true"></div>' : ''}
      <div class="chat-widget-message__body">
        <div class="chat-widget-message__content"></div>
        <div class="chat-widget-message__meta">
          <time datetime="${new Date(this.message.timestamp).toISOString()}">
            ${this.formatTime(this.message.timestamp)}
          </time>
        </div>
      </div>
    `;

    // Render content
    const contentDiv = div.querySelector('.chat-widget-message__content') as HTMLDivElement;
    this.renderContent(contentDiv);

    // Render tool calls if present (skip hidden internal tools)
    if (this.message.toolCalls && this.message.toolCalls.length > 0) {
      const toolsContainer = document.createElement('div');
      toolsContainer.className = 'chat-widget-message__tools';
      let hasVisibleTools = false;
      this.message.toolCalls.forEach((tool) => {
        const toolElement = this.renderToolCall(tool);
        if (toolElement) {
          toolsContainer.appendChild(toolElement);
          hasVisibleTools = true;
        }
      });
      if (hasVisibleTools) {
        div.querySelector('.chat-widget-message__body')?.appendChild(toolsContainer);
      }
    }

    // Add streaming indicator if streaming
    if (this.message.status === 'streaming') {
      div.classList.add('chat-widget-message--streaming');
    }

    return div;
  }

  private renderContent(container: HTMLDivElement): void {
    const isStreaming = this.message.status === 'streaming';

    if (this.message.role === 'user') {
      // User messages are plain text
      container.innerHTML = this.markdownService.renderUserMessage(this.message.content);
    } else {
      // Assistant messages get markdown rendering
      container.innerHTML = this.markdownService.renderProgressive(
        this.message.content,
        !isStreaming
      );

      // Initialize copy buttons for code blocks
      initCodeCopyButtons(container);
    }
  }

  // Internal tools that should be hidden from the user
  private static readonly HIDDEN_TOOLS = ['getPageContent'];

  private renderToolCall(toolCall: ToolCall): HTMLElement | null {
    // Hide internal system tools
    if (MessageComponent.HIDDEN_TOOLS.includes(toolCall.toolName)) {
      return null;
    }

    const div = document.createElement('div');
    div.className = `chat-widget-tool chat-widget-tool--${toolCall.status}`;
    div.setAttribute('data-tool-id', toolCall.id);

    const statusIcon = this.getToolStatusIcon(toolCall.status);

    div.innerHTML = `
      <div class="chat-widget-tool__header">
        <span class="chat-widget-tool__icon">${statusIcon}</span>
        <span class="chat-widget-tool__name">${escapeHtml(toolCall.toolName)}</span>
        <span class="chat-widget-tool__status">${toolCall.status}</span>
      </div>
    `;

    return div;
  }

  private getToolStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chat-widget-tool__spinner">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>`;
      case 'complete':
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
      case 'error':
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`;
      default:
        return '';
    }
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Get the message data
   */
  getMessage(): Message {
    return this.message;
  }

  /**
   * Update message content
   */
  updateContent(content: string, isComplete: boolean = false): void {
    this.message.content = content;

    // Update text direction
    setTextDirection(this.element, content);

    // Re-render content
    if (this.message.role === 'user') {
      this.contentElement.innerHTML = this.markdownService.renderUserMessage(content);
    } else {
      this.contentElement.innerHTML = this.markdownService.renderProgressive(content, isComplete);
      initCodeCopyButtons(this.contentElement);
    }
  }

  /**
   * Set message status
   */
  setStatus(status: Message['status']): void {
    this.message.status = status;
    this.element.setAttribute('data-status', status);

    if (status === 'streaming') {
      this.element.classList.add('chat-widget-message--streaming');
    } else {
      this.element.classList.remove('chat-widget-message--streaming');
    }

    if (status === 'error') {
      this.element.classList.add('chat-widget-message--error');
    } else {
      this.element.classList.remove('chat-widget-message--error');
    }
  }

  /**
   * Add a tool call to the message
   */
  addToolCall(toolCall: ToolCall): void {
    if (!this.message.toolCalls) {
      this.message.toolCalls = [];
    }
    this.message.toolCalls.push(toolCall);

    let toolsContainer = this.element.querySelector('.chat-widget-message__tools');
    if (!toolsContainer) {
      toolsContainer = document.createElement('div');
      toolsContainer.className = 'chat-widget-message__tools';
      this.element.querySelector('.chat-widget-message__body')?.appendChild(toolsContainer);
    }

    const toolElement = this.renderToolCall(toolCall);
    if (toolElement) {
      toolsContainer.appendChild(toolElement);
    }
  }

  /**
   * Update a tool call status
   */
  updateToolCall(toolCallId: string, updates: Partial<ToolCall>): void {
    const toolCall = this.message.toolCalls?.find((t) => t.id === toolCallId);
    if (toolCall) {
      Object.assign(toolCall, updates);

      // Update DOM
      const toolElement = this.element.querySelector(`[data-tool-id="${toolCallId}"]`);
      if (toolElement && updates.status) {
        toolElement.className = `chat-widget-tool chat-widget-tool--${updates.status}`;

        const statusSpan = toolElement.querySelector('.chat-widget-tool__status');
        if (statusSpan) {
          statusSpan.textContent = updates.status;
        }

        const iconSpan = toolElement.querySelector('.chat-widget-tool__icon');
        if (iconSpan) {
          iconSpan.innerHTML = this.getToolStatusIcon(updates.status);
        }
      }
    }
  }

  /**
   * Show error state
   */
  showError(errorMessage: string): void {
    this.setStatus('error');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-widget-message__error';
    errorDiv.innerHTML = `
      <span class="chat-widget-message__error-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </span>
      <span class="chat-widget-message__error-text">${escapeHtml(errorMessage)}</span>
    `;

    this.element.querySelector('.chat-widget-message__body')?.appendChild(errorDiv);
  }

  /**
   * Scroll the message into view
   */
  scrollIntoView(): void {
    this.element.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.element.remove();
  }
}
