/**
 * Avatar button component - the floating chat trigger
 */

import type { AvatarOptions } from '../types';
import { prefersReducedMotion } from '../services/dom';

const DEFAULT_CHAT_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
</svg>
`;

const CLOSE_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;

export class AvatarComponent {
  private element: HTMLButtonElement;
  private options: AvatarOptions;
  private _isOpen: boolean = false;
  private badgeElement: HTMLSpanElement | null = null;

  constructor(options: AvatarOptions) {
    this.options = options;
    this.element = this.render();
  }

  private render(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'chat-widget-avatar';
    button.setAttribute('aria-label', 'Open chat');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('type', 'button');

    // Apply positioning
    button.classList.add(`chat-widget-avatar--${this.options.position}`);

    // Apply size
    button.style.width = `${this.options.size}px`;
    button.style.height = `${this.options.size}px`;

    // Apply primary color
    button.style.setProperty('--chat-widget-primary', this.options.primaryColor);

    // Set content (image or icon)
    if (this.options.imageUrl) {
      const img = document.createElement('img');
      img.src = this.options.imageUrl;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.className = 'chat-widget-avatar__image';
      button.appendChild(img);
    } else {
      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'chat-widget-avatar__icon';
      iconWrapper.innerHTML = DEFAULT_CHAT_ICON;
      iconWrapper.setAttribute('aria-hidden', 'true');
      button.appendChild(iconWrapper);
    }

    // Create unread badge
    this.badgeElement = document.createElement('span');
    this.badgeElement.className = 'chat-widget-avatar__badge';
    this.badgeElement.setAttribute('aria-hidden', 'true');
    this.badgeElement.style.display = 'none';
    button.appendChild(this.badgeElement);

    // Event handlers
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onClick();
    });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.options.onClick();
      }
    });

    // Hover animation (unless reduced motion)
    if (!prefersReducedMotion()) {
      button.classList.add('chat-widget-avatar--animated');
    }

    return button;
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLButtonElement {
    return this.element;
  }

  /**
   * Check if avatar shows open state
   */
  isOpenState(): boolean {
    return this._isOpen;
  }

  /**
   * Show the avatar button
   */
  show(): void {
    this.element.style.display = 'flex';
    this.element.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide the avatar button
   */
  hide(): void {
    this.element.style.display = 'none';
    this.element.setAttribute('aria-hidden', 'true');
  }

  /**
   * Set the open/closed state (changes icon)
   */
  setOpen(isOpen: boolean): void {
    this._isOpen = isOpen;
    this.element.setAttribute('aria-expanded', String(isOpen));

    // Update icon if no custom image
    if (!this.options.imageUrl) {
      const iconWrapper = this.element.querySelector('.chat-widget-avatar__icon');
      if (iconWrapper) {
        iconWrapper.innerHTML = isOpen ? CLOSE_ICON : DEFAULT_CHAT_ICON;
      }
    }

    // Update aria-label
    this.element.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');
  }

  /**
   * Enable pulse animation
   */
  setPulse(enabled: boolean): void {
    if (enabled && !prefersReducedMotion()) {
      this.element.classList.add('chat-widget-avatar--pulse');
    } else {
      this.element.classList.remove('chat-widget-avatar--pulse');
    }
  }

  /**
   * Show unread indicator
   */
  showBadge(count?: number): void {
    if (this.badgeElement) {
      this.badgeElement.style.display = 'flex';
      if (count !== undefined && count > 0) {
        this.badgeElement.textContent = count > 9 ? '9+' : String(count);
      }
    }
  }

  /**
   * Hide unread indicator
   */
  hideBadge(): void {
    if (this.badgeElement) {
      this.badgeElement.style.display = 'none';
      this.badgeElement.textContent = '';
    }
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<AvatarOptions>): void {
    if (options.primaryColor) {
      this.options.primaryColor = options.primaryColor;
      this.element.style.setProperty('--chat-widget-primary', options.primaryColor);
    }

    if (options.size) {
      this.options.size = options.size;
      this.element.style.width = `${options.size}px`;
      this.element.style.height = `${options.size}px`;
    }
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.element.remove();
  }
}
