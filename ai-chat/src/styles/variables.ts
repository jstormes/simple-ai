/**
 * CSS styles and variables for the chat widget
 */

import type { ChatWidgetConfig } from '../types';

/**
 * Generate CSS custom properties from config
 */
export function generateCSSVariables(config: ChatWidgetConfig): string {
  return `
    --chat-widget-primary: ${config.primaryColor};
    --chat-widget-bg: #ffffff;
    --chat-widget-text: #1a1a1a;
    --chat-widget-text-secondary: #6b7280;
    --chat-widget-user-bubble: ${config.primaryColor};
    --chat-widget-user-text: #ffffff;
    --chat-widget-agent-bubble: #f3f4f6;
    --chat-widget-agent-text: #1a1a1a;
    --chat-widget-border: #e5e7eb;
    --chat-widget-shadow: rgba(0, 0, 0, 0.15);
    --chat-widget-code-bg: #1e293b;
    --chat-widget-code-text: #e2e8f0;
    --chat-widget-radius: 12px;
    --chat-widget-avatar-size: ${config.avatarSize}px;
    --chat-widget-panel-width: ${config.chatWidth}px;
  `;
}

/**
 * Base CSS styles for the widget
 *
 * These styles are injected into the Shadow DOM for complete
 * CSS isolation from the host page.
 */
export const baseStyles = `
  /* ============================================
     Shadow DOM Reset and Container
     ============================================
     All styles are scoped to .chat-widget-root which lives
     inside the Shadow DOM boundary. This provides complete
     isolation from host page CSS.
     ============================================ */

  /* Apply to all elements within shadow DOM */
  :host {
    all: initial;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .chat-widget-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Noto Sans', 'Helvetica Neue', Arial, sans-serif,
                 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji';
    font-size: 14px;
    line-height: 1.5;
    color: var(--chat-widget-text, #1a1a1a);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .chat-widget-root > * {
    pointer-events: auto;
  }

  /* Screen reader only */
  .chat-widget-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ============================================
     Avatar Button
     ============================================ */
  .chat-widget-avatar {
    position: fixed;
    width: var(--chat-widget-avatar-size, 60px);
    height: var(--chat-widget-avatar-size, 60px);
    border-radius: 50%;
    border: none;
    background: var(--chat-widget-primary, #0066cc);
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 20px var(--chat-widget-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99998;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .chat-widget-avatar--bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .chat-widget-avatar--bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .chat-widget-avatar:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 25px var(--chat-widget-shadow);
  }

  .chat-widget-avatar:focus {
    outline: 2px solid var(--chat-widget-primary);
    outline-offset: 3px;
  }

  .chat-widget-avatar:focus:not(:focus-visible) {
    outline: none;
  }

  .chat-widget-avatar--animated.chat-widget-avatar--pulse {
    animation: chat-widget-pulse 2s infinite;
  }

  @keyframes chat-widget-pulse {
    0%, 100% {
      box-shadow: 0 4px 20px var(--chat-widget-shadow);
    }
    50% {
      box-shadow: 0 4px 30px var(--chat-widget-primary);
    }
  }

  .chat-widget-avatar__image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .chat-widget-avatar__icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chat-widget-avatar__badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: #ef4444;
    color: white;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ============================================
     Panel
     ============================================ */
  .chat-widget-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    width: var(--chat-widget-panel-width, 400px);
    max-width: 100vw;
    background: var(--chat-widget-bg);
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 30px var(--chat-widget-shadow);
    z-index: 99999;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
  }

  .chat-widget-panel--bottom-right {
    right: 0;
    transform: translateX(100%);
    box-shadow: -4px 0 30px var(--chat-widget-shadow);
  }

  .chat-widget-panel--bottom-left {
    left: 0;
    transform: translateX(-100%);
    box-shadow: 4px 0 30px var(--chat-widget-shadow);
  }

  .chat-widget-panel--open {
    transform: translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-widget-panel {
      transition: none;
    }
    .chat-widget-avatar--animated.chat-widget-avatar--pulse {
      animation: none;
    }
  }

  /* Mobile: full screen */
  @media (max-width: 768px) {
    .chat-widget-panel {
      width: 100%;
      max-width: 100%;
    }
  }

  /* ============================================
     Panel Header
     ============================================ */
  .chat-widget-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--chat-widget-primary);
    color: white;
    flex-shrink: 0;
  }

  .chat-widget-panel__title h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .chat-widget-panel__actions {
    display: flex;
    gap: 8px;
  }

  .chat-widget-panel__btn {
    background: transparent;
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .chat-widget-panel__btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .chat-widget-panel__btn:focus {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .chat-widget-panel__btn:focus:not(:focus-visible) {
    outline: none;
  }

  /* ============================================
     Messages Area
     ============================================ */
  .chat-widget-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chat-widget-welcome {
    text-align: center;
    padding: 24px 16px;
    color: var(--chat-widget-text-secondary);
  }

  .chat-widget-welcome p {
    font-size: 15px;
    line-height: 1.5;
  }

  /* ============================================
     Message
     ============================================ */
  .chat-widget-message {
    display: flex;
    gap: 12px;
    max-width: 85%;
    animation: chat-widget-message-in 0.2s ease-out;
  }

  @keyframes chat-widget-message-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-widget-message {
      animation: none;
    }
  }

  .chat-widget-message--user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .chat-widget-message--assistant {
    align-self: flex-start;
  }

  .chat-widget-message__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--chat-widget-primary);
    flex-shrink: 0;
  }

  .chat-widget-message__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .chat-widget-message__content {
    padding: 12px 16px;
    border-radius: var(--chat-widget-radius);
    line-height: 1.5;
    font-size: 15px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .chat-widget-message--user .chat-widget-message__content {
    background: var(--chat-widget-user-bubble);
    color: var(--chat-widget-user-text);
    border-bottom-right-radius: 4px;
  }

  .chat-widget-message--assistant .chat-widget-message__content {
    background: var(--chat-widget-agent-bubble);
    color: var(--chat-widget-agent-text);
    border-bottom-left-radius: 4px;
  }

  .chat-widget-message__meta {
    font-size: 11px;
    color: var(--chat-widget-text-secondary);
    padding: 0 4px;
  }

  /* Streaming cursor */
  .chat-widget-message--streaming .chat-widget-message__content::after {
    content: '';
    display: inline-block;
    width: 8px;
    height: 16px;
    background: var(--chat-widget-primary);
    animation: chat-widget-blink 1s infinite;
    margin-left: 4px;
    vertical-align: middle;
  }

  @keyframes chat-widget-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Error state */
  .chat-widget-message--error .chat-widget-message__content {
    background: #fef2f2;
    color: #991b1b;
  }

  .chat-widget-message__error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fef2f2;
    border-radius: 8px;
    color: #991b1b;
    font-size: 13px;
    margin-top: 8px;
  }

  /* ============================================
     Tool Calls
     ============================================ */
  .chat-widget-message__tools {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chat-widget-tool {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fef3c7;
    border-radius: 8px;
    font-size: 13px;
  }

  .chat-widget-tool--complete {
    background: #d1fae5;
  }

  .chat-widget-tool--error {
    background: #fee2e2;
  }

  .chat-widget-tool__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chat-widget-tool__name {
    font-weight: 500;
  }

  .chat-widget-tool__status {
    font-size: 11px;
    color: var(--chat-widget-text-secondary);
    text-transform: capitalize;
  }

  .chat-widget-tool__spinner {
    animation: chat-widget-spin 1s linear infinite;
  }

  @keyframes chat-widget-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ============================================
     Input Area
     ============================================ */
  .chat-widget-input {
    padding: 16px 20px;
    border-top: 1px solid var(--chat-widget-border);
    background: var(--chat-widget-bg);
    flex-shrink: 0;
  }

  .chat-widget-input__row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .chat-widget-input__field {
    flex: 1;
    border: 1px solid var(--chat-widget-border);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 15px;
    resize: none;
    line-height: 1.4;
    max-height: 120px;
    overflow-y: hidden;
    font-family: inherit;
    background: var(--chat-widget-bg);
    color: var(--chat-widget-text);
  }

  .chat-widget-input__field:focus {
    outline: none;
    border-color: var(--chat-widget-primary);
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  .chat-widget-input__field::placeholder {
    color: var(--chat-widget-text-secondary);
  }

  .chat-widget-input__send {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border: none;
    border-radius: 50%;
    background: var(--chat-widget-primary);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease, opacity 0.2s ease;
    flex-shrink: 0;
  }

  .chat-widget-input__send:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .chat-widget-input__send:focus {
    outline: 2px solid var(--chat-widget-primary);
    outline-offset: 2px;
  }

  .chat-widget-input__send:focus:not(:focus-visible) {
    outline: none;
  }

  .chat-widget-input__send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-widget-input--disabled .chat-widget-input__field {
    background: #f9fafb;
    cursor: not-allowed;
  }

  /* ============================================
     Typing Indicator
     ============================================ */
  .chat-widget-typing {
    display: none;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--chat-widget-text-secondary);
    font-size: 13px;
  }

  .chat-widget-typing--visible {
    display: flex;
  }

  .chat-widget-typing__dot {
    width: 6px;
    height: 6px;
    background: var(--chat-widget-primary);
    border-radius: 50%;
    animation: chat-widget-bounce 1.4s infinite ease-in-out;
  }

  .chat-widget-typing__dot:nth-child(1) { animation-delay: 0s; }
  .chat-widget-typing__dot:nth-child(2) { animation-delay: 0.2s; }
  .chat-widget-typing__dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes chat-widget-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  /* ============================================
     Markdown Styles
     ============================================
     Markdown renders inline within the message bubble.
     No card or container styling - just formatted text.
     ============================================ */
  .chat-widget-markdown {
    line-height: 1.6;
  }

  .chat-widget-markdown > :first-child {
    margin-top: 0;
  }

  .chat-widget-markdown > :last-child {
    margin-bottom: 0;
  }

  .chat-widget-markdown p {
    margin: 0 0 8px;
  }

  .chat-widget-markdown p:last-child {
    margin-bottom: 0;
  }

  .chat-widget-markdown h1,
  .chat-widget-markdown h2,
  .chat-widget-markdown h3,
  .chat-widget-markdown h4,
  .chat-widget-markdown h5,
  .chat-widget-markdown h6 {
    margin: 16px 0 8px;
    font-weight: 600;
    line-height: 1.3;
  }

  .chat-widget-markdown h1 { font-size: 1.5em; }
  .chat-widget-markdown h2 { font-size: 1.3em; }
  .chat-widget-markdown h3 { font-size: 1.15em; }
  .chat-widget-markdown h4,
  .chat-widget-markdown h5,
  .chat-widget-markdown h6 { font-size: 1em; }

  .chat-widget-markdown ul,
  .chat-widget-markdown ol {
    margin: 8px 0;
    padding-left: 24px;
  }

  .chat-widget-markdown li {
    margin: 4px 0;
  }

  .chat-widget-markdown blockquote {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 4px solid var(--chat-widget-primary);
    background: rgba(0, 0, 0, 0.03);
    border-radius: 0 8px 8px 0;
  }

  .chat-widget-markdown hr {
    border: none;
    border-top: 1px solid var(--chat-widget-border);
    margin: 16px 0;
  }

  .chat-widget-markdown a {
    color: var(--chat-widget-primary);
    text-decoration: underline;
  }

  .chat-widget-markdown a:hover {
    text-decoration: none;
  }

  .chat-widget-markdown table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 14px;
  }

  .chat-widget-markdown th,
  .chat-widget-markdown td {
    border: 1px solid var(--chat-widget-border);
    padding: 8px 12px;
    text-align: left;
  }

  .chat-widget-markdown th {
    background: rgba(0, 0, 0, 0.03);
    font-weight: 600;
  }

  .chat-widget-markdown img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }

  /* Inline code */
  .chat-widget-inline-code {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    font-size: 0.9em;
  }

  /* Code blocks */
  .chat-widget-code-block {
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;
    background: var(--chat-widget-code-bg);
  }

  .chat-widget-code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .chat-widget-code-lang {
    font-size: 12px;
    color: var(--chat-widget-code-text);
    opacity: 0.7;
    text-transform: uppercase;
  }

  .chat-widget-code-copy {
    background: transparent;
    border: none;
    color: var(--chat-widget-code-text);
    opacity: 0.7;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: opacity 0.2s ease, background 0.2s ease;
  }

  .chat-widget-code-copy:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .chat-widget-code-copy--success {
    color: #10b981;
    opacity: 1;
  }

  .chat-widget-code-block pre {
    margin: 0;
    padding: 12px;
    overflow-x: auto;
  }

  .chat-widget-code-block code {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--chat-widget-code-text);
  }

  /* Syntax highlighting */
  .chat-widget-hl-keyword { color: #c678dd; }
  .chat-widget-hl-string { color: #98c379; }
  .chat-widget-hl-number { color: #d19a66; }
  .chat-widget-hl-comment { color: #5c6370; font-style: italic; }
  .chat-widget-hl-type { color: #e5c07b; }
  .chat-widget-hl-builtin { color: #61afef; }

  /* Task lists */
  .chat-widget-task-item {
    list-style: none;
    margin-left: -20px;
  }

  .chat-widget-checkbox {
    margin-right: 8px;
    font-size: 1.1em;
  }

  .chat-widget-checkbox--checked {
    color: var(--chat-widget-primary);
  }

  /* Plain text */
  .chat-widget-plaintext {
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* ============================================
     Panel Error
     ============================================ */
  .chat-widget-panel__error {
    padding: 12px 20px;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chat-widget-panel__error p {
    color: #991b1b;
    font-size: 14px;
    margin: 0;
  }

  .chat-widget-panel__error-dismiss {
    background: transparent;
    border: 1px solid #fca5a5;
    color: #991b1b;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .chat-widget-panel__error-dismiss:hover {
    background: #fee2e2;
  }
`;

/**
 * Generate complete CSS with config values
 *
 * Variables are applied to .chat-widget-root (not :root) because
 * we're inside a Shadow DOM where :root refers to the document,
 * not the shadow root.
 */
export function generateStyles(config: ChatWidgetConfig): string {
  const variables = generateCSSVariables(config);
  return `
    .chat-widget-root {
      ${variables}
    }
    ${baseStyles}
  `;
}
