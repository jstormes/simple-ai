/**
 * Input component - text input area with send button and typing indicator
 */

import type { InputOptions } from '../types';

const SEND_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="22" y1="2" x2="11" y2="13"></line>
  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
</svg>
`;

export class InputComponent {
  private element: HTMLFormElement;
  private textarea: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private typingIndicator: HTMLDivElement;
  private options: InputOptions;
  private isDisabled: boolean = false;

  constructor(options: InputOptions) {
    this.options = options;
    this.element = this.render();
    this.textarea = this.element.querySelector('.chat-widget-input__field') as HTMLTextAreaElement;
    this.sendButton = this.element.querySelector('.chat-widget-input__send') as HTMLButtonElement;
    this.typingIndicator = this.element.querySelector('.chat-widget-typing') as HTMLDivElement;

    this.setupEventListeners();
  }

  private render(): HTMLFormElement {
    const form = document.createElement('form');
    form.className = 'chat-widget-input';
    form.setAttribute('autocomplete', 'off');

    form.innerHTML = `
      <div class="chat-widget-typing" aria-live="polite" aria-hidden="true">
        <span class="chat-widget-typing__dot"></span>
        <span class="chat-widget-typing__dot"></span>
        <span class="chat-widget-typing__dot"></span>
        <span class="chat-widget-typing__text">AI is thinking...</span>
      </div>
      <div class="chat-widget-input__row">
        <textarea
          class="chat-widget-input__field"
          placeholder="${this.escapeAttr(this.options.placeholder)}"
          rows="1"
          aria-label="${this.escapeAttr(this.options.placeholder)}"
        ></textarea>
        <button
          type="submit"
          class="chat-widget-input__send"
          aria-label="Send message"
          title="Send message"
        >
          ${SEND_ICON}
        </button>
      </div>
    `;

    return form;
  }

  private setupEventListeners(): void {
    // Form submission
    this.element.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Auto-resize textarea
    this.textarea.addEventListener('input', () => {
      this.autoResize();
      this.updateSendButtonState();
    });

    // Enter to send (Shift+Enter for new line)
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    // Paste handling
    this.textarea.addEventListener('paste', () => {
      // Delay to get the pasted content
      setTimeout(() => {
        this.autoResize();
        this.updateSendButtonState();
      }, 0);
    });
  }

  private handleSubmit(): void {
    const message = this.textarea.value.trim();

    if (message && !this.isDisabled) {
      this.options.onSend(message);
      this.clear();
    }
  }

  private autoResize(): void {
    // Reset height to calculate new height
    this.textarea.style.height = 'auto';

    // Calculate new height (max 120px)
    const maxHeight = 120;
    const newHeight = Math.min(this.textarea.scrollHeight, maxHeight);
    this.textarea.style.height = `${newHeight}px`;

    // Toggle scroll if at max height
    this.textarea.style.overflowY = this.textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  private updateSendButtonState(): void {
    const hasContent = this.textarea.value.trim().length > 0;
    this.sendButton.disabled = !hasContent || this.isDisabled;
  }

  private escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLFormElement {
    return this.element;
  }

  /**
   * Focus the input field
   */
  focus(): void {
    this.textarea.focus();
  }

  /**
   * Clear the input field
   */
  clear(): void {
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.updateSendButtonState();
  }

  /**
   * Set the input value
   */
  setValue(value: string): void {
    this.textarea.value = value;
    this.autoResize();
    this.updateSendButtonState();
  }

  /**
   * Get the current input value
   */
  getValue(): string {
    return this.textarea.value;
  }

  /**
   * Disable the input
   */
  disable(): void {
    this.isDisabled = true;
    this.textarea.disabled = true;
    this.sendButton.disabled = true;
    this.element.classList.add('chat-widget-input--disabled');
  }

  /**
   * Enable the input
   */
  enable(): void {
    this.isDisabled = false;
    this.textarea.disabled = false;
    this.updateSendButtonState();
    this.element.classList.remove('chat-widget-input--disabled');
  }

  /**
   * Show typing indicator
   */
  showTyping(): void {
    this.typingIndicator.classList.add('chat-widget-typing--visible');
    this.typingIndicator.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide typing indicator
   */
  hideTyping(): void {
    this.typingIndicator.classList.remove('chat-widget-typing--visible');
    this.typingIndicator.setAttribute('aria-hidden', 'true');
  }

  /**
   * Check if input is disabled
   */
  isInputDisabled(): boolean {
    return this.isDisabled;
  }

  /**
   * Update placeholder text
   */
  setPlaceholder(placeholder: string): void {
    this.textarea.placeholder = placeholder;
    this.textarea.setAttribute('aria-label', placeholder);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.element.remove();
  }
}
