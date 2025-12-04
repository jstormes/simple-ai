/**
 * Panel component - the main chat panel with push content support
 */

import type { PanelOptions } from '../types';
import { escapeHtml, createFocusTrap, isMobile, prefersReducedMotion, scrollToBottom } from '../services/dom';
import { InputComponent } from './input';

const MINIMIZE_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 14 10 14 10 20"></polyline>
  <polyline points="20 10 14 10 14 4"></polyline>
  <line x1="14" y1="10" x2="21" y2="3"></line>
  <line x1="3" y1="21" x2="10" y2="14"></line>
</svg>
`;

const CLOSE_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;

const CLEAR_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
</svg>
`;

export class PanelComponent {
  private element: HTMLDivElement;
  private messagesContainer: HTMLDivElement;
  private inputContainer: HTMLDivElement;
  private options: PanelOptions;
  private isOpen: boolean = false;
  private focusTrap: ReturnType<typeof createFocusTrap>;
  private originalBodyStyle: {
    marginLeft: string;
    marginRight: string;
    transition: string;
  } | null = null;

  constructor(options: PanelOptions) {
    this.options = options;
    this.element = this.render();
    this.messagesContainer = this.element.querySelector('.chat-widget-messages') as HTMLDivElement;
    this.inputContainer = this.element.querySelector('.chat-widget-panel__input') as HTMLDivElement;
    this.focusTrap = createFocusTrap(this.element);

    this.setupEventListeners();
  }

  private render(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `chat-widget-panel chat-widget-panel--${this.options.position}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', this.options.title);
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-hidden', 'true');

    // Apply dimensions
    panel.style.width = `${this.options.width}px`;
    if (this.options.height !== 'full') {
      panel.style.height = `${this.options.height}px`;
    }

    panel.innerHTML = `
      <div class="chat-widget-panel__header">
        <div class="chat-widget-panel__title">
          <h2>${escapeHtml(this.options.title)}</h2>
        </div>
        <div class="chat-widget-panel__actions">
          <button
            class="chat-widget-panel__btn chat-widget-panel__btn--clear"
            aria-label="Clear chat history"
            title="Clear History"
            type="button"
          >
            ${CLEAR_ICON}
          </button>
          <button
            class="chat-widget-panel__btn chat-widget-panel__btn--minimize"
            aria-label="Minimize chat"
            title="Minimize"
            type="button"
          >
            ${MINIMIZE_ICON}
          </button>
          <button
            class="chat-widget-panel__btn chat-widget-panel__btn--close"
            aria-label="Close chat"
            title="Close"
            type="button"
          >
            ${CLOSE_ICON}
          </button>
        </div>
      </div>
      <div class="chat-widget-messages" role="log" aria-live="polite" aria-atomic="false">
        <div class="chat-widget-messages__welcome"></div>
      </div>
      <div class="chat-widget-panel__input"></div>
    `;

    return panel;
  }

  private setupEventListeners(): void {
    // Close button
    const closeBtn = this.element.querySelector('.chat-widget-panel__btn--close');
    closeBtn?.addEventListener('click', () => this.options.onClose());

    // Minimize button
    const minimizeBtn = this.element.querySelector('.chat-widget-panel__btn--minimize');
    minimizeBtn?.addEventListener('click', () => this.options.onMinimize());

    // Clear history button
    const clearBtn = this.element.querySelector('.chat-widget-panel__btn--clear');
    clearBtn?.addEventListener('click', () => this.options.onClearHistory());

    // Escape key to close
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.options.onClose();
      }
    });

    // Handle window resize for mobile
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.updatePushContent();
      }
    });
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Get the messages container
   */
  getMessagesContainer(): HTMLDivElement {
    return this.messagesContainer;
  }

  /**
   * Get the input container for mounting InputComponent
   */
  getInputContainer(): HTMLDivElement {
    return this.inputContainer;
  }

  /**
   * Mount the input component
   */
  mountInput(input: InputComponent): void {
    this.inputContainer.appendChild(input.getElement());
  }

  /**
   * Open the panel
   */
  open(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.element.classList.add('chat-widget-panel--open');
    this.element.setAttribute('aria-hidden', 'false');

    // Apply push content if enabled
    if (this.options.pushContent) {
      this.applyPushContent(true);
    }

    // Activate focus trap after animation
    const animationDuration = prefersReducedMotion() ? 0 : 300;
    setTimeout(() => {
      this.focusTrap.activate();
    }, animationDuration);
  }

  /**
   * Close the panel
   */
  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.element.classList.remove('chat-widget-panel--open');
    this.element.setAttribute('aria-hidden', 'true');

    // Remove push content
    if (this.options.pushContent) {
      this.applyPushContent(false);
    }

    this.focusTrap.deactivate();
  }

  /**
   * Check if panel is open
   */
  isOpened(): boolean {
    return this.isOpen;
  }

  /**
   * Apply or remove push content effect
   */
  private applyPushContent(push: boolean): void {
    // On mobile, use full screen instead of push
    if (isMobile()) {
      return;
    }

    const isRight = this.options.position.includes('right');
    const property = isRight ? 'marginRight' : 'marginLeft';

    if (push) {
      // Store original styles
      this.originalBodyStyle = {
        marginLeft: document.body.style.marginLeft,
        marginRight: document.body.style.marginRight,
        transition: document.body.style.transition,
      };

      // Apply transition and margin
      if (!prefersReducedMotion()) {
        document.body.style.transition = 'margin 0.3s ease-in-out';
      }
      document.body.style[property] = `${this.options.width}px`;
    } else {
      // Restore original styles
      if (!prefersReducedMotion()) {
        document.body.style.transition = 'margin 0.3s ease-in-out';
      }
      document.body.style[property] = this.originalBodyStyle?.[property] || '';

      // Clean up transition after animation
      setTimeout(() => {
        if (this.originalBodyStyle) {
          document.body.style.transition = this.originalBodyStyle.transition;
        }
      }, 300);
    }
  }

  /**
   * Update push content on resize
   */
  private updatePushContent(): void {
    if (!this.options.pushContent) return;

    // On mobile, remove push content
    if (isMobile()) {
      if (this.originalBodyStyle) {
        document.body.style.marginLeft = this.originalBodyStyle.marginLeft;
        document.body.style.marginRight = this.originalBodyStyle.marginRight;
      }
    } else {
      // Re-apply push content
      this.applyPushContent(true);
    }
  }

  /**
   * Add a message element to the container
   */
  addMessage(messageElement: HTMLElement): void {
    // Remove welcome message if present
    const welcome = this.messagesContainer.querySelector('.chat-widget-messages__welcome');
    if (welcome && welcome.children.length === 0) {
      welcome.remove();
    }

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Set the welcome message
   */
  setWelcomeMessage(message: string): void {
    const welcome = this.messagesContainer.querySelector('.chat-widget-messages__welcome');
    if (welcome) {
      welcome.innerHTML = `
        <div class="chat-widget-welcome">
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.messagesContainer.innerHTML = '<div class="chat-widget-messages__welcome"></div>';
  }

  /**
   * Scroll messages to bottom
   */
  scrollToBottom(): void {
    scrollToBottom(this.messagesContainer);
  }

  /**
   * Update panel title
   */
  setTitle(title: string): void {
    const titleElement = this.element.querySelector('.chat-widget-panel__title h2');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    this.element.classList.add('chat-widget-panel--loading');
  }

  /**
   * Hide loading state
   */
  hideLoading(): void {
    this.element.classList.remove('chat-widget-panel--loading');
  }

  /**
   * Show error state
   */
  showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-widget-panel__error';
    errorDiv.innerHTML = `
      <p>${escapeHtml(message)}</p>
      <button type="button" class="chat-widget-panel__error-dismiss">Dismiss</button>
    `;

    errorDiv.querySelector('button')?.addEventListener('click', () => {
      errorDiv.remove();
    });

    this.element.insertBefore(errorDiv, this.messagesContainer);
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<PanelOptions>): void {
    if (options.width !== undefined) {
      this.options.width = options.width;
      this.element.style.width = `${options.width}px`;

      // Update push content if open
      if (this.isOpen && this.options.pushContent) {
        this.applyPushContent(true);
      }
    }

    if (options.height !== undefined) {
      this.options.height = options.height;
      if (options.height !== 'full') {
        this.element.style.height = `${options.height}px`;
      } else {
        this.element.style.height = '';
      }
    }

    if (options.title !== undefined) {
      this.setTitle(options.title);
    }
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.isOpen) {
      this.close();
    }
    this.element.remove();
  }
}
