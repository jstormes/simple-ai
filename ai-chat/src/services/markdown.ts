/**
 * Markdown rendering with syntax highlighting
 */

import { marked, type MarkedOptions } from 'marked';
import type { ChatWidgetConfig } from '../types';
import { escapeHtml } from './dom';

// Simple syntax highlighting without external dependencies
const HIGHLIGHT_KEYWORDS: Record<string, string[]> = {
  keyword: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
    'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'from', 'as',
    'default', 'async', 'await', 'yield', 'static', 'get', 'set', 'typeof', 'instanceof',
    'in', 'of', 'delete', 'void', 'null', 'undefined', 'true', 'false',
    'def', 'print', 'elif', 'except', 'pass', 'with', 'lambda', 'global', 'nonlocal',
    'raise', 'assert', 'and', 'or', 'not', 'is', 'None', 'True', 'False',
  ],
  type: [
    'string', 'number', 'boolean', 'object', 'array', 'any', 'void', 'never',
    'int', 'float', 'str', 'list', 'dict', 'tuple', 'set', 'bool',
    'String', 'Number', 'Boolean', 'Object', 'Array', 'Promise', 'Map', 'Set',
  ],
  builtin: [
    'console', 'window', 'document', 'Math', 'JSON', 'Date', 'Error',
    'setTimeout', 'setInterval', 'fetch', 'require', 'module', 'exports',
    'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
    'input', 'open', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
  ],
};

/**
 * Simple syntax highlighter
 */
function highlightCode(code: string, language: string): string {
  const escaped = escapeHtml(code);

  if (!language || language === 'text' || language === 'plaintext') {
    return escaped;
  }

  let result = escaped;

  // Highlight strings (single and double quotes)
  result = result.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    '<span class="chat-widget-hl-string">$&</span>'
  );

  // Highlight comments (single line // and #, and multi-line /* */)
  result = result.replace(
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g,
    '<span class="chat-widget-hl-comment">$&</span>'
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="chat-widget-hl-number">$1</span>'
  );

  // Highlight keywords
  const keywordPattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.keyword.join('|')})\\b`, 'g');
  result = result.replace(keywordPattern, '<span class="chat-widget-hl-keyword">$1</span>');

  // Highlight types
  const typePattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.type.join('|')})\\b`, 'g');
  result = result.replace(typePattern, '<span class="chat-widget-hl-type">$1</span>');

  // Highlight builtins
  const builtinPattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.builtin.join('|')})\\b`, 'g');
  result = result.replace(builtinPattern, '<span class="chat-widget-hl-builtin">$1</span>');

  return result;
}

export class MarkdownService {
  private config: ChatWidgetConfig;
  private markedInstance: typeof marked;

  constructor(config: ChatWidgetConfig) {
    this.config = config;
    this.markedInstance = marked;
    this.initializeMarked();
  }

  private initializeMarked(): void {
    const options: MarkedOptions = {
      gfm: true,
      breaks: true,
      async: false,
    };

    this.markedInstance.setOptions(options);

    // Custom renderer for code blocks and security
    const renderer = new marked.Renderer();

    // Code blocks with syntax highlighting and copy button
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const language = lang || 'text';
      const highlighted = this.config.syntaxHighlighting
        ? highlightCode(text, language)
        : escapeHtml(text);

      const langLabel = language !== 'text' ? `<span class="chat-widget-code-lang">${escapeHtml(language)}</span>` : '';
      const copyBtn = `<button class="chat-widget-code-copy" aria-label="Copy code" title="Copy code">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>`;

      return `<div class="chat-widget-code-block">
        <div class="chat-widget-code-header">${langLabel}${copyBtn}</div>
        <pre><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>
      </div>`;
    };

    // Inline code
    renderer.codespan = ({ text }: { text: string }) => {
      return `<code class="chat-widget-inline-code">${escapeHtml(text)}</code>`;
    };

    // Links - open in new tab with security attributes
    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      // Only allow safe protocols
      const safeProtocols = ['http:', 'https:', 'mailto:'];
      let safeHref = '#';

      try {
        const url = new URL(href, window.location.origin);
        if (safeProtocols.includes(url.protocol)) {
          safeHref = href;
        }
      } catch {
        // Invalid URL, keep as #
      }

      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    };

    // Images with max-width
    renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} class="chat-widget-image" loading="lazy">`;
    };

    // Task list items
    renderer.listitem = ({ text, task, checked }: { text: string; task: boolean; checked?: boolean }) => {
      if (task) {
        const checkbox = checked
          ? '<span class="chat-widget-checkbox chat-widget-checkbox--checked">&#x2611;</span>'
          : '<span class="chat-widget-checkbox">&#x2610;</span>';
        return `<li class="chat-widget-task-item">${checkbox}${text}</li>`;
      }
      return `<li>${text}</li>`;
    };

    this.markedInstance.use({ renderer });
  }

  /**
   * Render markdown content
   */
  render(content: string): string {
    if (!this.config.enableMarkdown) {
      return this.renderPlainText(content);
    }

    try {
      const html = this.markedInstance.parse(content) as string;
      return `<div class="chat-widget-markdown">${html}</div>`;
    } catch (error) {
      console.warn('[ChatWidget] Markdown parsing failed:', error);
      return this.renderPlainText(content);
    }
  }

  /**
   * Render markdown progressively for streaming
   * Handles incomplete code blocks and other edge cases
   */
  renderProgressive(content: string, isComplete: boolean): string {
    if (!this.config.enableMarkdown) {
      return this.renderPlainText(content);
    }

    let processedContent = content;

    // Check for incomplete code blocks
    const codeBlockCount = (content.match(/```/g) || []).length;
    const isIncompleteCodeBlock = codeBlockCount % 2 !== 0;

    if (isIncompleteCodeBlock && !isComplete) {
      // Find the last incomplete code block and temporarily close it
      const lastCodeBlockStart = content.lastIndexOf('```');
      const afterCodeFence = content.substring(lastCodeBlockStart);

      // Check if there's content after the opening fence
      if (!afterCodeFence.includes('\n```')) {
        // Add a temporary closing fence for rendering
        processedContent = content + '\n```';
      }
    }

    try {
      const html = this.markedInstance.parse(processedContent) as string;
      return `<div class="chat-widget-markdown">${html}</div>`;
    } catch (error) {
      return this.renderPlainText(content);
    }
  }

  /**
   * Render plain text with line breaks preserved
   */
  private renderPlainText(content: string): string {
    return `<div class="chat-widget-plaintext">${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
  }

  /**
   * Render user message (plain text, no markdown)
   */
  renderUserMessage(content: string): string {
    return this.renderPlainText(content);
  }
}

/**
 * Initialize copy functionality for code blocks
 * Should be called after rendering messages
 */
export function initCodeCopyButtons(container: HTMLElement): void {
  container.querySelectorAll('.chat-widget-code-copy').forEach((button) => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const codeBlock = button.closest('.chat-widget-code-block');
      const code = codeBlock?.querySelector('code')?.textContent;

      if (code) {
        try {
          await navigator.clipboard.writeText(code);

          // Visual feedback
          button.classList.add('chat-widget-code-copy--success');
          setTimeout(() => {
            button.classList.remove('chat-widget-code-copy--success');
          }, 2000);
        } catch (err) {
          console.warn('[ChatWidget] Failed to copy code:', err);
        }
      }
    });
  });
}
