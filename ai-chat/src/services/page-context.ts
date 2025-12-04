/**
 * Page Context Service - Extracts readable content from the current page
 */

import type { ChatWidgetConfig } from '../types';

export class PageContextService {
  private config: ChatWidgetConfig;

  constructor(config: ChatWidgetConfig) {
    this.config = config;
  }

  /**
   * Extract page context as a readable text summary
   */
  extractContext(): string | null {
    if (!this.config.includePageContext) {
      return null;
    }

    try {
      // Determine what element to extract from
      let rootElement: Element | null = document.body;

      if (this.config.pageContextSelector) {
        rootElement = document.querySelector(this.config.pageContextSelector);
        if (!rootElement) {
          console.warn(`[ChatWidget] pageContextSelector "${this.config.pageContextSelector}" not found`);
          rootElement = document.body;
        }
      }

      // Extract structured content
      const context = this.extractFromElement(rootElement);

      // Truncate if too long (keep under ~8000 chars to leave room for conversation)
      const maxLength = 8000;
      if (context.length > maxLength) {
        return context.substring(0, maxLength) + '\n\n[Content truncated...]';
      }

      return context;
    } catch (error) {
      console.error('[ChatWidget] Error extracting page context:', error);
      return null;
    }
  }

  /**
   * Extract readable content from an element
   */
  private extractFromElement(element: Element): string {
    const parts: string[] = [];

    // Page title
    const title = document.title;
    if (title) {
      parts.push(`Page Title: ${title}`);
    }

    // Current URL (without query params for privacy)
    const url = window.location.origin + window.location.pathname;
    parts.push(`URL: ${url}`);

    parts.push('');
    parts.push('--- Page Content ---');
    parts.push('');

    // Extract content recursively
    const content = this.extractTextContent(element);
    parts.push(content);

    // Extract any data tables
    const tables = this.extractTables(element);
    if (tables) {
      parts.push('');
      parts.push('--- Data Tables ---');
      parts.push(tables);
    }

    // Extract form fields and their values
    const forms = this.extractForms(element);
    if (forms) {
      parts.push('');
      parts.push('--- Form Fields ---');
      parts.push(forms);
    }

    return parts.join('\n');
  }

  /**
   * Extract text content, preserving structure
   */
  private extractTextContent(element: Element): string {
    const lines: string[] = [];
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'IFRAME', 'TEMPLATE']);
    const skipClasses = ['chat-widget', 'chatwidget'];

    const walk = (node: Node, depth: number = 0) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;

        // Skip chat widget elements
        if (skipTags.has(el.tagName)) return;
        if (el.id?.toLowerCase().includes('chat-widget')) return;
        if (skipClasses.some(cls => el.className?.toString().toLowerCase().includes(cls))) return;

        // Handle specific elements
        const tag = el.tagName;

        // Headings
        if (/^H[1-6]$/.test(tag)) {
          const level = parseInt(tag[1]);
          const prefix = '#'.repeat(level);
          const text = el.textContent?.trim();
          if (text) {
            lines.push('');
            lines.push(`${prefix} ${text}`);
          }
          return; // Don't recurse into headings
        }

        // Lists
        if (tag === 'LI') {
          const text = this.getDirectText(el);
          if (text) {
            lines.push(`  • ${text}`);
          }
        }

        // Links
        if (tag === 'A') {
          const text = el.textContent?.trim();
          const href = el.getAttribute('href');
          if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            lines.push(`[${text}]`);
          }
          return;
        }

        // Paragraphs and divs with direct text
        if (tag === 'P' || tag === 'DIV' || tag === 'SPAN') {
          const text = this.getDirectText(el);
          if (text && text.length > 10) {
            lines.push(text);
          }
        }

        // Recurse into children
        for (const child of el.childNodes) {
          walk(child, depth + 1);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Text nodes are handled by their parent elements
      }
    };

    walk(element);

    // Clean up and dedupe
    return lines
      .filter(line => line.trim().length > 0)
      .filter((line, idx, arr) => arr.indexOf(line) === idx) // Remove exact duplicates
      .join('\n');
  }

  /**
   * Get direct text content (not from children)
   */
  private getDirectText(element: Element): string {
    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    return text.trim();
  }

  /**
   * Extract tables as markdown
   */
  private extractTables(element: Element): string | null {
    const tables = element.querySelectorAll('table');
    if (tables.length === 0) return null;

    const parts: string[] = [];

    tables.forEach((table, tableIdx) => {
      // Skip tables inside chat widget
      if (table.closest('#chat-widget-container')) return;

      const rows = table.querySelectorAll('tr');
      if (rows.length === 0) return;

      parts.push(`\nTable ${tableIdx + 1}:`);

      rows.forEach((row, rowIdx) => {
        const cells = row.querySelectorAll('th, td');
        const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
        parts.push(`| ${cellTexts.join(' | ')} |`);

        // Add separator after header row
        if (rowIdx === 0 && row.querySelector('th')) {
          parts.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
        }
      });
    });

    return parts.length > 0 ? parts.join('\n') : null;
  }

  /**
   * Extract form information
   */
  private extractForms(element: Element): string | null {
    const inputs = element.querySelectorAll('input, select, textarea');
    if (inputs.length === 0) return null;

    const parts: string[] = [];

    inputs.forEach(input => {
      // Skip inputs inside chat widget
      if (input.closest('#chat-widget-container')) return;

      const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const label = this.findLabelFor(el);
      const type = el.tagName === 'INPUT' ? (el as HTMLInputElement).type : el.tagName.toLowerCase();
      const name = el.name || el.id || 'unnamed';
      const value = el.value || '';

      // Don't include password values
      if (type === 'password') {
        parts.push(`- ${label || name} (${type}): [hidden]`);
      } else if (type === 'hidden') {
        // Skip hidden fields
      } else if (el.tagName === 'SELECT') {
        const select = el as HTMLSelectElement;
        const selectedOption = select.options[select.selectedIndex];
        parts.push(`- ${label || name} (select): ${selectedOption?.text || 'none'}`);
      } else {
        parts.push(`- ${label || name} (${type}): ${value || '[empty]'}`);
      }
    });

    return parts.length > 0 ? parts.join('\n') : null;
  }

  /**
   * Find label text for a form element
   */
  private findLabelFor(element: HTMLElement): string | null {
    // Check for associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || null;
      }
    }

    // Check for wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const text = this.getDirectText(parentLabel);
      if (text) return text;
    }

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    return null;
  }
}
