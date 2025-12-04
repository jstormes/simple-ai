/**
 * DOM utilities and RTL detection
 *
 * This module uses Shadow DOM for complete CSS isolation from the host page.
 */

const WIDGET_CONTAINER_ID = 'chat-widget-container';

// Store reference to shadow root for internal access
let shadowRoot: ShadowRoot | null = null;
let widgetRoot: HTMLElement | null = null;

/**
 * Create the main widget container with Shadow DOM
 *
 * Shadow DOM provides complete CSS encapsulation:
 * - Host page CSS cannot affect widget styles
 * - Widget CSS cannot leak out to the host page
 * - No class name conflicts possible
 */
export function createContainer(): HTMLElement {
  // Remove existing container if present
  const existing = document.getElementById(WIDGET_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }

  // Create host element (this is what the page sees)
  const host = document.createElement('div');
  host.id = WIDGET_CONTAINER_ID;
  host.setAttribute('role', 'complementary');
  host.setAttribute('aria-label', 'AI Chat Widget');

  // Apply host styles directly (these must be on the light DOM element)
  // Using inline styles to avoid any host page CSS conflicts
  host.style.cssText = `
    position: fixed !important;
    z-index: 99999 !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    overflow: visible !important;
    pointer-events: none !important;
  `;

  // Create shadow root for style encapsulation
  shadowRoot = host.attachShadow({ mode: 'open' });

  // Create inner container for widget content
  widgetRoot = document.createElement('div');
  widgetRoot.className = 'chat-widget-root';
  shadowRoot.appendChild(widgetRoot);

  document.body.appendChild(host);
  return widgetRoot;
}

/**
 * Inject widget styles into the Shadow DOM
 *
 * Styles are injected directly into the shadow root, ensuring
 * they only affect elements within the widget.
 */
export function injectStyles(css: string): void {
  if (!shadowRoot) {
    console.warn('[ChatWidget] Cannot inject styles: Shadow root not initialized');
    return;
  }

  // Check for existing style element
  let styleElement = shadowRoot.querySelector('style');

  if (!styleElement) {
    styleElement = document.createElement('style');
    // Insert styles before content
    shadowRoot.insertBefore(styleElement, shadowRoot.firstChild);
  }

  styleElement.textContent = css;
}

/**
 * Get the shadow root for advanced operations
 */
export function getShadowRoot(): ShadowRoot | null {
  return shadowRoot;
}

/**
 * Get the widget root element inside shadow DOM
 */
export function getWidgetRoot(): HTMLElement | null {
  return widgetRoot;
}

/**
 * Remove widget from DOM
 */
export function destroyWidget(): void {
  const container = document.getElementById(WIDGET_CONTAINER_ID);
  container?.remove();
  shadowRoot = null;
  widgetRoot = null;
}

/**
 * RTL Unicode ranges for detection
 */
const RTL_REGEX = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;

/**
 * Detect if text contains RTL characters
 */
export function detectRTL(text: string): boolean {
  return RTL_REGEX.test(text);
}

/**
 * Set text direction on an element based on content
 */
export function setTextDirection(element: HTMLElement, text: string): void {
  if (detectRTL(text)) {
    element.setAttribute('dir', 'rtl');
  } else {
    element.setAttribute('dir', 'ltr');
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if the device is mobile
 */
export function isMobile(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Scroll element to bottom
 */
export function scrollToBottom(element: HTMLElement): void {
  requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
  });
}

/**
 * Focus trap for accessibility
 * Works within Shadow DOM context
 */
export function createFocusTrap(container: HTMLElement): {
  activate: () => void;
  deactivate: () => void;
} {
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let previousActiveElement: HTMLElement | null = null;

  function getFocusableElements(): HTMLElement[] {
    return Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Get active element - check shadow root first
    const activeElement = shadowRoot?.activeElement || document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate() {
      previousActiveElement = document.activeElement as HTMLElement;
      container.addEventListener('keydown', handleKeyDown);
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    },
    deactivate() {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    },
  };
}

/**
 * Announce message for screen readers
 * Creates element in light DOM for better screen reader compatibility
 */
export function announceToScreenReader(message: string): void {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'chat-widget-sr-only';
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;

  // Append to body (light DOM) for screen reader compatibility
  document.body.appendChild(announcer);

  // Delay to ensure screen reader picks up the change
  setTimeout(() => {
    announcer.textContent = message;
  }, 100);

  // Clean up after announcement
  setTimeout(() => {
    announcer.remove();
  }, 1000);
}
