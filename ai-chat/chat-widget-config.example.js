/**
 * AI Chat Widget Configuration Example
 *
 * Copy this file to your project and customize the settings.
 * Include this script BEFORE chat-widget.js
 */
window.ChatWidgetConfig = {
  // Required: Your agent endpoint URL
  agentEndpoint: 'https://api.example.com/agents/support',

  // Positioning
  position: 'bottom-right', // 'bottom-right' | 'bottom-left'

  // Avatar appearance
  avatarImage: null, // URL to custom avatar image, or null for default icon
  avatarSize: 60, // Avatar diameter in pixels (30-120)

  // Theme
  primaryColor: '#0066cc', // Main theme color

  // Panel dimensions
  chatWidth: 400, // Panel width in pixels (280-800)
  chatHeight: 'full', // Panel height: number or 'full' for viewport height

  // Branding
  headerTitle: 'Chat with Us',
  welcomeMessage: 'Hello! How can I help you today?',
  placeholder: 'Type your message...',

  // Behavior
  openOnLoad: false, // Auto-open chat on page load
  persistSession: true, // Save conversation to localStorage
  pushContent: true, // Push page content (true) or overlay (false)

  // Markdown rendering
  enableMarkdown: true, // Enable markdown in agent responses
  syntaxHighlighting: true, // Enable code syntax highlighting
  syntaxTheme: 'github-dark', // 'github-dark' | 'github-light' | 'monokai'

  // Authentication (optional)
  authToken: null, // Bearer token or API key
  authHeader: 'Authorization', // Header name for auth token

  // Event callbacks (optional)
  onOpen: function () {
    console.log('Chat opened');
  },
  onClose: function () {
    console.log('Chat closed');
  },
  onMessageSent: function (message) {
    console.log('User sent:', message.content);
  },
  onMessageReceived: function (message) {
    console.log('Agent replied:', message.content);
  },
  onError: function (error) {
    console.error('Chat error:', error);
  },
};
