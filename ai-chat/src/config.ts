/**
 * Configuration defaults and validation
 */

import type { ChatWidgetConfig, PartialConfig } from './types';

/**
 * Default configuration values
 */
export const defaultConfig: Omit<ChatWidgetConfig, 'agentEndpoint'> = {
  // Positioning
  position: 'bottom-right',
  avatarSize: 60,
  primaryColor: '#0066cc',
  chatWidth: 400,
  chatHeight: 600,

  // Branding
  headerTitle: 'Chat with Us',
  welcomeMessage: 'Hello! How can I help you today?',
  placeholder: 'Type your message...',

  // Behavior
  openOnLoad: false,
  persistSession: true,
  sessionStorageKey: 'chat-widget-session',
  pushContent: true,
  includePageContext: false,
  pageContextSelector: null,

  // Markdown
  enableMarkdown: true,
  syntaxHighlighting: true,
  syntaxTheme: 'github-dark',

  // Authentication
  authToken: null,
  authHeader: 'Authorization',
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: PartialConfig): ChatWidgetConfig {
  return {
    ...defaultConfig,
    ...userConfig,
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: PartialConfig): string[] {
  const errors: string[] = [];

  if (!config.agentEndpoint) {
    errors.push('agentEndpoint is required');
  } else {
    try {
      new URL(config.agentEndpoint);
    } catch {
      errors.push('agentEndpoint must be a valid URL');
    }
  }

  if (config.avatarSize !== undefined && (config.avatarSize < 30 || config.avatarSize > 120)) {
    errors.push('avatarSize must be between 30 and 120');
  }

  if (config.chatWidth !== undefined && (config.chatWidth < 280 || config.chatWidth > 800)) {
    errors.push('chatWidth must be between 280 and 800');
  }

  if (config.chatHeight !== undefined && config.chatHeight !== 'full') {
    if (typeof config.chatHeight === 'number' && (config.chatHeight < 300 || config.chatHeight > 1200)) {
      errors.push('chatHeight must be between 300 and 1200, or "full"');
    }
  }

  if (config.position !== undefined && !['bottom-right', 'bottom-left'].includes(config.position)) {
    errors.push('position must be "bottom-right" or "bottom-left"');
  }

  if (config.syntaxTheme !== undefined && !['github-dark', 'github-light', 'monokai'].includes(config.syntaxTheme)) {
    errors.push('syntaxTheme must be "github-dark", "github-light", or "monokai"');
  }

  return errors;
}

/**
 * Parse color to ensure it's valid
 */
export function parseColor(color: string): string {
  // Simple validation - just return the color if it looks valid
  if (/^#[0-9A-Fa-f]{3,8}$/.test(color) || /^(rgb|hsl)a?\(/.test(color)) {
    return color;
  }
  // Return default if invalid
  return defaultConfig.primaryColor;
}
