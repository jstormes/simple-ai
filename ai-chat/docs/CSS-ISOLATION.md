# CSS Isolation in AI Chat Widget

The AI Chat Widget uses **Shadow DOM** for complete CSS isolation from your host page. This means the widget's styles won't interfere with your page, and your page's styles won't break the widget.

## How It Works

### Shadow DOM Encapsulation

When the widget initializes, it creates a structure like this:

```html
<body>
  <!-- Your page content -->
  <div class="your-app">...</div>

  <!-- Chat Widget (host element in light DOM) -->
  <div id="chat-widget-container" style="position: fixed; z-index: 99999; ...">
    #shadow-root (open)
      <style>/* Widget styles */</style>
      <div class="chat-widget-root">
        <!-- Avatar button -->
        <button class="chat-widget-avatar">...</button>
        <!-- Chat panel -->
        <div class="chat-widget-panel">...</div>
      </div>
  </div>
</body>
```

### What This Means

1. **Your CSS cannot affect the widget** - Even global selectors like `* { color: red }` or `button { background: blue }` won't penetrate the Shadow DOM boundary.

2. **Widget CSS cannot leak out** - The widget's styles are completely contained. Classes like `.chat-widget-panel` won't accidentally style elements on your page.

3. **No naming conflicts** - You can safely use class names that might match widget internals without any issues.

## The Two Layers

### 1. Host Element (Light DOM)

The host element (`#chat-widget-container`) lives in the regular DOM. It has inline styles applied directly:

```css
position: fixed !important;
z-index: 99999 !important;
top: 0 !important;
left: 0 !important;
pointer-events: none !important;
```

These use `!important` to ensure they work regardless of your page's CSS specificity.

### 2. Shadow Root (Shadow DOM)

Everything else lives inside the Shadow DOM:
- All widget styles
- The avatar button
- The chat panel
- Messages, input, etc.

## Testing CSS Isolation

You can verify the isolation is working by inspecting the widget in browser DevTools:

1. Right-click the chat button and select "Inspect"
2. In Elements panel, look for `#chat-widget-container`
3. Expand it and you'll see `#shadow-root (open)`
4. Styles inside the shadow root are isolated

## Customization

### Via Configuration

The recommended way to customize the widget is through configuration options:

```javascript
window.ChatWidgetConfig = {
  primaryColor: '#your-brand-color',
  chatWidth: 400,
  chatHeight: 600,
  // ... other options
};
```

### Via CSS Custom Properties (Theming)

The widget uses CSS custom properties that can be set on the host element. Since `mode: 'open'` is used, you can access the shadow root:

```javascript
const host = document.getElementById('chat-widget-container');
const shadow = host.shadowRoot;
const root = shadow.querySelector('.chat-widget-root');
root.style.setProperty('--chat-widget-primary', '#ff6600');
```

Available CSS custom properties:
- `--chat-widget-primary` - Primary brand color
- `--chat-widget-bg` - Background color
- `--chat-widget-text` - Text color
- `--chat-widget-text-secondary` - Secondary text color
- `--chat-widget-user-bubble` - User message bubble color
- `--chat-widget-user-text` - User message text color
- `--chat-widget-agent-bubble` - Agent message bubble color
- `--chat-widget-agent-text` - Agent message text color
- `--chat-widget-border` - Border color
- `--chat-widget-radius` - Border radius
- `--chat-widget-avatar-size` - Avatar button size
- `--chat-widget-panel-width` - Chat panel width

## Common Questions

### Will my CSS reset affect the widget?

No. CSS resets like Normalize.css, Reset.css, or `* { margin: 0; padding: 0; }` will not affect elements inside the Shadow DOM.

### Will Bootstrap/Tailwind/Material UI conflict?

No. These frameworks cannot style elements inside the Shadow DOM, and the widget's styles cannot affect your framework components.

### Can I use `!important` to override widget styles?

No. Due to Shadow DOM encapsulation, even `!important` rules in your page CSS cannot cross the shadow boundary. Use the CSS custom properties or configuration options instead.

### Why `mode: 'open'` instead of `mode: 'closed'`?

We use `open` mode to allow:
- DevTools inspection for debugging
- JavaScript access for advanced customization
- Screen reader compatibility

### Does this work in all browsers?

Shadow DOM is supported in all modern browsers:
- Chrome 53+
- Firefox 63+
- Safari 10+
- Edge 79+

For older browsers, consider using a polyfill or falling back to the non-shadow DOM version.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Document (Light DOM)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Your Page Content                      │ │
│  │  <div class="app">                                  │ │
│  │    <header>...</header>                             │ │
│  │    <main>...</main>                                 │ │
│  │  </div>                                             │ │
│  │                                                     │ │
│  │  Your CSS rules apply here                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  #chat-widget-container (host)                      │ │
│  │  inline styles: position:fixed; z-index:99999       │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │           Shadow DOM Boundary                 │  │ │
│  │  │  ════════════════════════════════════════    │  │ │
│  │  │                                               │  │ │
│  │  │  <style>/* Widget CSS */</style>              │  │ │
│  │  │                                               │  │ │
│  │  │  <div class="chat-widget-root">               │  │ │
│  │  │    <button class="chat-widget-avatar"/>       │  │ │
│  │  │    <div class="chat-widget-panel">            │  │ │
│  │  │      ...                                      │  │ │
│  │  │    </div>                                     │  │ │
│  │  │  </div>                                       │  │ │
│  │  │                                               │  │ │
│  │  │  Widget CSS rules apply only here             │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Technical Implementation

The Shadow DOM implementation is in `src/services/dom.ts`:

```typescript
// Create host element
const host = document.createElement('div');
host.id = WIDGET_CONTAINER_ID;

// Apply host styles inline (for fixed positioning)
host.style.cssText = `
  position: fixed !important;
  z-index: 99999 !important;
  ...
`;

// Attach shadow root
shadowRoot = host.attachShadow({ mode: 'open' });

// Create widget root inside shadow
widgetRoot = document.createElement('div');
widgetRoot.className = 'chat-widget-root';
shadowRoot.appendChild(widgetRoot);
```

Styles are injected directly into the shadow root:

```typescript
export function injectStyles(css: string): void {
  const styleElement = document.createElement('style');
  shadowRoot.insertBefore(styleElement, shadowRoot.firstChild);
  styleElement.textContent = css;
}
```

This architecture ensures complete CSS isolation while maintaining full functionality and accessibility.
