"use strict";
var ChatWidget = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    ChatWidget: () => ChatWidget,
    mergeConfig: () => mergeConfig,
    validateConfig: () => validateConfig
  });

  // src/config.ts
  var defaultConfig = {
    // Positioning
    position: "bottom-right",
    avatarSize: 60,
    primaryColor: "#0066cc",
    chatWidth: 400,
    chatHeight: 600,
    // Branding
    headerTitle: "Chat with Us",
    welcomeMessage: "Hello! How can I help you today?",
    placeholder: "Type your message...",
    // Behavior
    openOnLoad: false,
    persistSession: true,
    sessionStorageKey: "chat-widget-session",
    pushContent: true,
    includePageContext: false,
    pageContextSelector: null,
    // Markdown
    enableMarkdown: true,
    syntaxHighlighting: true,
    syntaxTheme: "github-dark",
    // Authentication
    authToken: null,
    authHeader: "Authorization"
  };
  function mergeConfig(userConfig) {
    return {
      ...defaultConfig,
      ...userConfig
    };
  }
  function validateConfig(config) {
    const errors = [];
    if (!config.agentEndpoint) {
      errors.push("agentEndpoint is required");
    } else {
      try {
        new URL(config.agentEndpoint);
      } catch {
        errors.push("agentEndpoint must be a valid URL");
      }
    }
    if (config.avatarSize !== void 0 && (config.avatarSize < 30 || config.avatarSize > 120)) {
      errors.push("avatarSize must be between 30 and 120");
    }
    if (config.chatWidth !== void 0 && (config.chatWidth < 280 || config.chatWidth > 800)) {
      errors.push("chatWidth must be between 280 and 800");
    }
    if (config.chatHeight !== void 0 && config.chatHeight !== "full") {
      if (typeof config.chatHeight === "number" && (config.chatHeight < 300 || config.chatHeight > 1200)) {
        errors.push('chatHeight must be between 300 and 1200, or "full"');
      }
    }
    if (config.position !== void 0 && !["bottom-right", "bottom-left"].includes(config.position)) {
      errors.push('position must be "bottom-right" or "bottom-left"');
    }
    if (config.syntaxTheme !== void 0 && !["github-dark", "github-light", "monokai"].includes(config.syntaxTheme)) {
      errors.push('syntaxTheme must be "github-dark", "github-light", or "monokai"');
    }
    return errors;
  }

  // src/services/api.ts
  var ApiService = class {
    constructor(config) {
      this.abortController = null;
      this.config = config;
    }
    /**
     * Stream a message to the agent and receive SSE events
     */
    async streamMessage(message, conversationId, onChunk, onComplete, onError, pageContext) {
      this.abortController = new AbortController();
      const url = this.buildStreamUrl();
      const headers = this.buildHeaders();
      const body = {
        message,
        conversationId,
        metadata: pageContext ? { pageContext } : {}
      };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: this.abortController.signal
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              this.processSSELines(buffer, onChunk);
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          const completeData = lines.join("\n");
          this.processSSELines(completeData, onChunk);
        }
        onComplete();
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        onError(error);
      } finally {
        this.abortController = null;
      }
    }
    /**
     * Process SSE lines and emit events
     */
    processSSELines(data, onChunk) {
      const lines = data.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith(":")) {
          continue;
        }
        if (trimmedLine.startsWith("data: ")) {
          const jsonStr = trimmedLine.slice(6);
          if (jsonStr === "[DONE]") {
            continue;
          }
          try {
            const event = JSON.parse(jsonStr);
            onChunk(event);
          } catch (e) {
            console.warn("[ChatWidget] Failed to parse SSE event:", jsonStr, e);
          }
        }
      }
    }
    /**
     * Abort the current streaming request
     */
    abort() {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
    }
    /**
     * Check if a request is currently in progress
     */
    isStreaming() {
      return this.abortController !== null;
    }
    /**
     * Build the streaming endpoint URL
     */
    buildStreamUrl() {
      const baseUrl = this.config.agentEndpoint;
      if (baseUrl.endsWith("/stream")) {
        return baseUrl;
      }
      return baseUrl.endsWith("/") ? `${baseUrl}stream` : `${baseUrl}/stream`;
    }
    /**
     * Build request headers
     */
    buildHeaders() {
      const headers = {
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      };
      if (this.config.authToken) {
        if (this.config.authHeader === "Authorization") {
          headers["Authorization"] = `Bearer ${this.config.authToken}`;
        } else {
          headers[this.config.authHeader] = this.config.authToken;
        }
      }
      return headers;
    }
    /**
     * Send a non-streaming message (fallback)
     */
    async sendMessage(message, conversationId) {
      const url = this.config.agentEndpoint.replace(/\/stream$/, "/chat");
      const headers = this.buildHeaders();
      headers["Accept"] = "application/json";
      const body = {
        message,
        conversationId,
        metadata: {}
      };
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      const result = await response.json();
      const events = [
        { type: "start" },
        { type: "text", content: result.data?.text || result.text || "" },
        { type: "finish" }
      ];
      return events;
    }
  };

  // node_modules/marked/lib/marked.esm.js
  function _getDefaults() {
    return {
      async: false,
      breaks: false,
      extensions: null,
      gfm: true,
      hooks: null,
      pedantic: false,
      renderer: null,
      silent: false,
      tokenizer: null,
      walkTokens: null
    };
  }
  var _defaults = _getDefaults();
  function changeDefaults(newDefaults) {
    _defaults = newDefaults;
  }
  var noopTest = { exec: () => null };
  function edit(regex, opt = "") {
    let source = typeof regex === "string" ? regex : regex.source;
    const obj = {
      replace: (name, val) => {
        let valSource = typeof val === "string" ? val : val.source;
        valSource = valSource.replace(other.caret, "$1");
        source = source.replace(name, valSource);
        return obj;
      },
      getRegex: () => {
        return new RegExp(source, opt);
      }
    };
    return obj;
  }
  var other = {
    codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
    outputLinkReplace: /\\([\[\]])/g,
    indentCodeCompensation: /^(\s+)(?:```)/,
    beginningSpace: /^\s+/,
    endingHash: /#$/,
    startingSpaceChar: /^ /,
    endingSpaceChar: / $/,
    nonSpaceChar: /[^ ]/,
    newLineCharGlobal: /\n/g,
    tabCharGlobal: /\t/g,
    multipleSpaceGlobal: /\s+/g,
    blankLine: /^[ \t]*$/,
    doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
    blockquoteStart: /^ {0,3}>/,
    blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
    blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
    listReplaceTabs: /^\t+/,
    listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
    listIsTask: /^\[[ xX]\] /,
    listReplaceTask: /^\[[ xX]\] +/,
    anyLine: /\n.*\n/,
    hrefBrackets: /^<(.*)>$/,
    tableDelimiter: /[:|]/,
    tableAlignChars: /^\||\| *$/g,
    tableRowBlankLine: /\n[ \t]*$/,
    tableAlignRight: /^ *-+: *$/,
    tableAlignCenter: /^ *:-+: *$/,
    tableAlignLeft: /^ *:-+ *$/,
    startATag: /^<a /i,
    endATag: /^<\/a>/i,
    startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
    endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
    startAngleBracket: /^</,
    endAngleBracket: />$/,
    pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
    unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
    escapeTest: /[&<>"']/,
    escapeReplace: /[&<>"']/g,
    escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
    escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
    unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
    caret: /(^|[^\[])\^/g,
    percentDecode: /%25/g,
    findPipe: /\|/g,
    splitPipe: / \|/,
    slashPipe: /\\\|/g,
    carriageReturn: /\r\n|\r/g,
    spaceLine: /^ +$/gm,
    notSpaceStart: /^\S*/,
    endingNewline: /\n$/,
    listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
    nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
    hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
    fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
    headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
    htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
  };
  var newline = /^(?:[ \t]*(?:\n|$))+/;
  var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
  var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
  var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
  var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
  var bullet = /(?:[*+-]|\d{1,9}[.)])/;
  var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
  var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
  var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
  var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
  var blockText = /^[^\n]+/;
  var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
  var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
  var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
  var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
  var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
  var html = edit(
    "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
    "i"
  ).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
  var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
  var blockNormal = {
    blockquote,
    code: blockCode,
    def,
    fences,
    heading,
    hr,
    html,
    lheading,
    list,
    newline,
    paragraph,
    table: noopTest,
    text: blockText
  };
  var gfmTable = edit(
    "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
  ).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockGfm = {
    ...blockNormal,
    lheading: lheadingGfm,
    table: gfmTable,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
  };
  var blockPedantic = {
    ...blockNormal,
    html: edit(
      `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
    ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: noopTest,
    // fences not supported
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
  };
  var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
  var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
  var br = /^( {2,}|\\)\n(?!\s*$)/;
  var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
  var _punctuation = /[\p{P}\p{S}]/u;
  var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
  var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
  var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
  var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
  var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
  var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
  var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
  var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
  var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
  var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
  var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
  var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
  var emStrongRDelimUnd = edit(
    "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
    "gu"
  ).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
  var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
  var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
  var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
  var tag = edit(
    "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
  ).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
  var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
  var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
  var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
  var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
  var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
  var inlineNormal = {
    _backpedal: noopTest,
    // only used for GFM url
    anyPunctuation,
    autolink,
    blockSkip,
    br,
    code: inlineCode,
    del: noopTest,
    emStrongLDelim,
    emStrongRDelimAst,
    emStrongRDelimUnd,
    escape,
    link,
    nolink,
    punctuation,
    reflink,
    reflinkSearch,
    tag,
    text: inlineText,
    url: noopTest
  };
  var inlinePedantic = {
    ...inlineNormal,
    link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
    reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
  };
  var inlineGfm = {
    ...inlineNormal,
    emStrongRDelimAst: emStrongRDelimAstGfm,
    emStrongLDelim: emStrongLDelimGfm,
    url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
  };
  var inlineBreaks = {
    ...inlineGfm,
    br: edit(br).replace("{2,}", "*").getRegex(),
    text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
  };
  var block = {
    normal: blockNormal,
    gfm: blockGfm,
    pedantic: blockPedantic
  };
  var inline = {
    normal: inlineNormal,
    gfm: inlineGfm,
    breaks: inlineBreaks,
    pedantic: inlinePedantic
  };
  var escapeReplacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  var getEscapeReplacement = (ch) => escapeReplacements[ch];
  function escape2(html2, encode) {
    if (encode) {
      if (other.escapeTest.test(html2)) {
        return html2.replace(other.escapeReplace, getEscapeReplacement);
      }
    } else {
      if (other.escapeTestNoEncode.test(html2)) {
        return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html2;
  }
  function cleanUrl(href) {
    try {
      href = encodeURI(href).replace(other.percentDecode, "%");
    } catch {
      return null;
    }
    return href;
  }
  function splitCells(tableRow, count) {
    const row = tableRow.replace(other.findPipe, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
      if (escaped) {
        return "|";
      } else {
        return " |";
      }
    }), cells = row.split(other.splitPipe);
    let i = 0;
    if (!cells[0].trim()) {
      cells.shift();
    }
    if (cells.length > 0 && !cells.at(-1)?.trim()) {
      cells.pop();
    }
    if (count) {
      if (cells.length > count) {
        cells.splice(count);
      } else {
        while (cells.length < count) cells.push("");
      }
    }
    for (; i < cells.length; i++) {
      cells[i] = cells[i].trim().replace(other.slashPipe, "|");
    }
    return cells;
  }
  function rtrim(str, c, invert) {
    const l = str.length;
    if (l === 0) {
      return "";
    }
    let suffLen = 0;
    while (suffLen < l) {
      const currChar = str.charAt(l - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }
    return str.slice(0, l - suffLen);
  }
  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    let level = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    if (level > 0) {
      return -2;
    }
    return -1;
  }
  function outputLink(cap, link2, raw, lexer2, rules) {
    const href = link2.href;
    const title = link2.title || null;
    const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
    lexer2.state.inLink = true;
    const token = {
      type: cap[0].charAt(0) === "!" ? "image" : "link",
      raw,
      href,
      title,
      text,
      tokens: lexer2.inlineTokens(text)
    };
    lexer2.state.inLink = false;
    return token;
  }
  function indentCodeCompensation(raw, text, rules) {
    const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
    if (matchIndentToCode === null) {
      return text;
    }
    const indentToCode = matchIndentToCode[1];
    return text.split("\n").map((node) => {
      const matchIndentInNode = node.match(rules.other.beginningSpace);
      if (matchIndentInNode === null) {
        return node;
      }
      const [indentInNode] = matchIndentInNode;
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length);
      }
      return node;
    }).join("\n");
  }
  var _Tokenizer = class {
    options;
    rules;
    // set by the lexer
    lexer;
    // set by the lexer
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(src) {
      const cap = this.rules.block.newline.exec(src);
      if (cap && cap[0].length > 0) {
        return {
          type: "space",
          raw: cap[0]
        };
      }
    }
    code(src) {
      const cap = this.rules.block.code.exec(src);
      if (cap) {
        const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
        return {
          type: "code",
          raw: cap[0],
          codeBlockStyle: "indented",
          text: !this.options.pedantic ? rtrim(text, "\n") : text
        };
      }
    }
    fences(src) {
      const cap = this.rules.block.fences.exec(src);
      if (cap) {
        const raw = cap[0];
        const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
        return {
          type: "code",
          raw,
          lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
          text
        };
      }
    }
    heading(src) {
      const cap = this.rules.block.heading.exec(src);
      if (cap) {
        let text = cap[2].trim();
        if (this.rules.other.endingHash.test(text)) {
          const trimmed = rtrim(text, "#");
          if (this.options.pedantic) {
            text = trimmed.trim();
          } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
            text = trimmed.trim();
          }
        }
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[1].length,
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    hr(src) {
      const cap = this.rules.block.hr.exec(src);
      if (cap) {
        return {
          type: "hr",
          raw: rtrim(cap[0], "\n")
        };
      }
    }
    blockquote(src) {
      const cap = this.rules.block.blockquote.exec(src);
      if (cap) {
        let lines = rtrim(cap[0], "\n").split("\n");
        let raw = "";
        let text = "";
        const tokens = [];
        while (lines.length > 0) {
          let inBlockquote = false;
          const currentLines = [];
          let i;
          for (i = 0; i < lines.length; i++) {
            if (this.rules.other.blockquoteStart.test(lines[i])) {
              currentLines.push(lines[i]);
              inBlockquote = true;
            } else if (!inBlockquote) {
              currentLines.push(lines[i]);
            } else {
              break;
            }
          }
          lines = lines.slice(i);
          const currentRaw = currentLines.join("\n");
          const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
          raw = raw ? `${raw}
${currentRaw}` : currentRaw;
          text = text ? `${text}
${currentText}` : currentText;
          const top = this.lexer.state.top;
          this.lexer.state.top = true;
          this.lexer.blockTokens(currentText, tokens, true);
          this.lexer.state.top = top;
          if (lines.length === 0) {
            break;
          }
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "code") {
            break;
          } else if (lastToken?.type === "blockquote") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.blockquote(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
            text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
            break;
          } else if (lastToken?.type === "list") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.list(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
            text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
            lines = newText.substring(tokens.at(-1).raw.length).split("\n");
            continue;
          }
        }
        return {
          type: "blockquote",
          raw,
          tokens,
          text
        };
      }
    }
    list(src) {
      let cap = this.rules.block.list.exec(src);
      if (cap) {
        let bull = cap[1].trim();
        const isordered = bull.length > 1;
        const list2 = {
          type: "list",
          raw: "",
          ordered: isordered,
          start: isordered ? +bull.slice(0, -1) : "",
          loose: false,
          items: []
        };
        bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
        if (this.options.pedantic) {
          bull = isordered ? bull : "[*+-]";
        }
        const itemRegex = this.rules.other.listItemRegex(bull);
        let endsWithBlankLine = false;
        while (src) {
          let endEarly = false;
          let raw = "";
          let itemContents = "";
          if (!(cap = itemRegex.exec(src))) {
            break;
          }
          if (this.rules.block.hr.test(src)) {
            break;
          }
          raw = cap[0];
          src = src.substring(raw.length);
          let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
          let nextLine = src.split("\n", 1)[0];
          let blankLine = !line.trim();
          let indent = 0;
          if (this.options.pedantic) {
            indent = 2;
            itemContents = line.trimStart();
          } else if (blankLine) {
            indent = cap[1].length + 1;
          } else {
            indent = cap[2].search(this.rules.other.nonSpaceChar);
            indent = indent > 4 ? 1 : indent;
            itemContents = line.slice(indent);
            indent += cap[1].length;
          }
          if (blankLine && this.rules.other.blankLine.test(nextLine)) {
            raw += nextLine + "\n";
            src = src.substring(nextLine.length + 1);
            endEarly = true;
          }
          if (!endEarly) {
            const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
            const hrRegex = this.rules.other.hrRegex(indent);
            const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
            const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
            const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
            while (src) {
              const rawLine = src.split("\n", 1)[0];
              let nextLineWithoutTabs;
              nextLine = rawLine;
              if (this.options.pedantic) {
                nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
                nextLineWithoutTabs = nextLine;
              } else {
                nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
              }
              if (fencesBeginRegex.test(nextLine)) {
                break;
              }
              if (headingBeginRegex.test(nextLine)) {
                break;
              }
              if (htmlBeginRegex.test(nextLine)) {
                break;
              }
              if (nextBulletRegex.test(nextLine)) {
                break;
              }
              if (hrRegex.test(nextLine)) {
                break;
              }
              if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
                itemContents += "\n" + nextLineWithoutTabs.slice(indent);
              } else {
                if (blankLine) {
                  break;
                }
                if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                  break;
                }
                if (fencesBeginRegex.test(line)) {
                  break;
                }
                if (headingBeginRegex.test(line)) {
                  break;
                }
                if (hrRegex.test(line)) {
                  break;
                }
                itemContents += "\n" + nextLine;
              }
              if (!blankLine && !nextLine.trim()) {
                blankLine = true;
              }
              raw += rawLine + "\n";
              src = src.substring(rawLine.length + 1);
              line = nextLineWithoutTabs.slice(indent);
            }
          }
          if (!list2.loose) {
            if (endsWithBlankLine) {
              list2.loose = true;
            } else if (this.rules.other.doubleBlankLine.test(raw)) {
              endsWithBlankLine = true;
            }
          }
          let istask = null;
          let ischecked;
          if (this.options.gfm) {
            istask = this.rules.other.listIsTask.exec(itemContents);
            if (istask) {
              ischecked = istask[0] !== "[ ] ";
              itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
            }
          }
          list2.items.push({
            type: "list_item",
            raw,
            task: !!istask,
            checked: ischecked,
            loose: false,
            text: itemContents,
            tokens: []
          });
          list2.raw += raw;
        }
        const lastItem = list2.items.at(-1);
        if (lastItem) {
          lastItem.raw = lastItem.raw.trimEnd();
          lastItem.text = lastItem.text.trimEnd();
        } else {
          return;
        }
        list2.raw = list2.raw.trimEnd();
        for (let i = 0; i < list2.items.length; i++) {
          this.lexer.state.top = false;
          list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
          if (!list2.loose) {
            const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
            const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
            list2.loose = hasMultipleLineBreaks;
          }
        }
        if (list2.loose) {
          for (let i = 0; i < list2.items.length; i++) {
            list2.items[i].loose = true;
          }
        }
        return list2;
      }
    }
    html(src) {
      const cap = this.rules.block.html.exec(src);
      if (cap) {
        const token = {
          type: "html",
          block: true,
          raw: cap[0],
          pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
          text: cap[0]
        };
        return token;
      }
    }
    def(src) {
      const cap = this.rules.block.def.exec(src);
      if (cap) {
        const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
        const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
        const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
        return {
          type: "def",
          tag: tag2,
          raw: cap[0],
          href,
          title
        };
      }
    }
    table(src) {
      const cap = this.rules.block.table.exec(src);
      if (!cap) {
        return;
      }
      if (!this.rules.other.tableDelimiter.test(cap[2])) {
        return;
      }
      const headers = splitCells(cap[1]);
      const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
      const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
      const item = {
        type: "table",
        raw: cap[0],
        header: [],
        align: [],
        rows: []
      };
      if (headers.length !== aligns.length) {
        return;
      }
      for (const align of aligns) {
        if (this.rules.other.tableAlignRight.test(align)) {
          item.align.push("right");
        } else if (this.rules.other.tableAlignCenter.test(align)) {
          item.align.push("center");
        } else if (this.rules.other.tableAlignLeft.test(align)) {
          item.align.push("left");
        } else {
          item.align.push(null);
        }
      }
      for (let i = 0; i < headers.length; i++) {
        item.header.push({
          text: headers[i],
          tokens: this.lexer.inline(headers[i]),
          header: true,
          align: item.align[i]
        });
      }
      for (const row of rows) {
        item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
          return {
            text: cell,
            tokens: this.lexer.inline(cell),
            header: false,
            align: item.align[i]
          };
        }));
      }
      return item;
    }
    lheading(src) {
      const cap = this.rules.block.lheading.exec(src);
      if (cap) {
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[2].charAt(0) === "=" ? 1 : 2,
          text: cap[1],
          tokens: this.lexer.inline(cap[1])
        };
      }
    }
    paragraph(src) {
      const cap = this.rules.block.paragraph.exec(src);
      if (cap) {
        const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
        return {
          type: "paragraph",
          raw: cap[0],
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    text(src) {
      const cap = this.rules.block.text.exec(src);
      if (cap) {
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          tokens: this.lexer.inline(cap[0])
        };
      }
    }
    escape(src) {
      const cap = this.rules.inline.escape.exec(src);
      if (cap) {
        return {
          type: "escape",
          raw: cap[0],
          text: cap[1]
        };
      }
    }
    tag(src) {
      const cap = this.rules.inline.tag.exec(src);
      if (cap) {
        if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
          this.lexer.state.inLink = true;
        } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
          this.lexer.state.inLink = false;
        }
        if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
          this.lexer.state.inRawBlock = true;
        } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
          this.lexer.state.inRawBlock = false;
        }
        return {
          type: "html",
          raw: cap[0],
          inLink: this.lexer.state.inLink,
          inRawBlock: this.lexer.state.inRawBlock,
          block: false,
          text: cap[0]
        };
      }
    }
    link(src) {
      const cap = this.rules.inline.link.exec(src);
      if (cap) {
        const trimmedUrl = cap[2].trim();
        if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
          if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
            return;
          }
          const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
          if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
            return;
          }
        } else {
          const lastParenIndex = findClosingBracket(cap[2], "()");
          if (lastParenIndex === -2) {
            return;
          }
          if (lastParenIndex > -1) {
            const start = cap[0].indexOf("!") === 0 ? 5 : 4;
            const linkLen = start + cap[1].length + lastParenIndex;
            cap[2] = cap[2].substring(0, lastParenIndex);
            cap[0] = cap[0].substring(0, linkLen).trim();
            cap[3] = "";
          }
        }
        let href = cap[2];
        let title = "";
        if (this.options.pedantic) {
          const link2 = this.rules.other.pedanticHrefTitle.exec(href);
          if (link2) {
            href = link2[1];
            title = link2[3];
          }
        } else {
          title = cap[3] ? cap[3].slice(1, -1) : "";
        }
        href = href.trim();
        if (this.rules.other.startAngleBracket.test(href)) {
          if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
            href = href.slice(1);
          } else {
            href = href.slice(1, -1);
          }
        }
        return outputLink(cap, {
          href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
          title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
        }, cap[0], this.lexer, this.rules);
      }
    }
    reflink(src, links) {
      let cap;
      if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
        const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
        const link2 = links[linkString.toLowerCase()];
        if (!link2) {
          const text = cap[0].charAt(0);
          return {
            type: "text",
            raw: text,
            text
          };
        }
        return outputLink(cap, link2, cap[0], this.lexer, this.rules);
      }
    }
    emStrong(src, maskedSrc, prevChar = "") {
      let match = this.rules.inline.emStrongLDelim.exec(src);
      if (!match) return;
      if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
      const nextChar = match[1] || match[2] || "";
      if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
        const lLength = [...match[0]].length - 1;
        let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
        const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
        endReg.lastIndex = 0;
        maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
        while ((match = endReg.exec(maskedSrc)) != null) {
          rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
          if (!rDelim) continue;
          rLength = [...rDelim].length;
          if (match[3] || match[4]) {
            delimTotal += rLength;
            continue;
          } else if (match[5] || match[6]) {
            if (lLength % 3 && !((lLength + rLength) % 3)) {
              midDelimTotal += rLength;
              continue;
            }
          }
          delimTotal -= rLength;
          if (delimTotal > 0) continue;
          rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
          const lastCharLength = [...match[0]][0].length;
          const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
          if (Math.min(lLength, rLength) % 2) {
            const text2 = raw.slice(1, -1);
            return {
              type: "em",
              raw,
              text: text2,
              tokens: this.lexer.inlineTokens(text2)
            };
          }
          const text = raw.slice(2, -2);
          return {
            type: "strong",
            raw,
            text,
            tokens: this.lexer.inlineTokens(text)
          };
        }
      }
    }
    codespan(src) {
      const cap = this.rules.inline.code.exec(src);
      if (cap) {
        let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
        const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
        const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
        if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
          text = text.substring(1, text.length - 1);
        }
        return {
          type: "codespan",
          raw: cap[0],
          text
        };
      }
    }
    br(src) {
      const cap = this.rules.inline.br.exec(src);
      if (cap) {
        return {
          type: "br",
          raw: cap[0]
        };
      }
    }
    del(src) {
      const cap = this.rules.inline.del.exec(src);
      if (cap) {
        return {
          type: "del",
          raw: cap[0],
          text: cap[2],
          tokens: this.lexer.inlineTokens(cap[2])
        };
      }
    }
    autolink(src) {
      const cap = this.rules.inline.autolink.exec(src);
      if (cap) {
        let text, href;
        if (cap[2] === "@") {
          text = cap[1];
          href = "mailto:" + text;
        } else {
          text = cap[1];
          href = text;
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    url(src) {
      let cap;
      if (cap = this.rules.inline.url.exec(src)) {
        let text, href;
        if (cap[2] === "@") {
          text = cap[0];
          href = "mailto:" + text;
        } else {
          let prevCapZero;
          do {
            prevCapZero = cap[0];
            cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
          } while (prevCapZero !== cap[0]);
          text = cap[0];
          if (cap[1] === "www.") {
            href = "http://" + cap[0];
          } else {
            href = cap[0];
          }
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    inlineText(src) {
      const cap = this.rules.inline.text.exec(src);
      if (cap) {
        const escaped = this.lexer.state.inRawBlock;
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          escaped
        };
      }
    }
  };
  var _Lexer = class __Lexer {
    tokens;
    options;
    state;
    tokenizer;
    inlineQueue;
    constructor(options2) {
      this.tokens = [];
      this.tokens.links = /* @__PURE__ */ Object.create(null);
      this.options = options2 || _defaults;
      this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
      this.tokenizer = this.options.tokenizer;
      this.tokenizer.options = this.options;
      this.tokenizer.lexer = this;
      this.inlineQueue = [];
      this.state = {
        inLink: false,
        inRawBlock: false,
        top: true
      };
      const rules = {
        other,
        block: block.normal,
        inline: inline.normal
      };
      if (this.options.pedantic) {
        rules.block = block.pedantic;
        rules.inline = inline.pedantic;
      } else if (this.options.gfm) {
        rules.block = block.gfm;
        if (this.options.breaks) {
          rules.inline = inline.breaks;
        } else {
          rules.inline = inline.gfm;
        }
      }
      this.tokenizer.rules = rules;
    }
    /**
     * Expose Rules
     */
    static get rules() {
      return {
        block,
        inline
      };
    }
    /**
     * Static Lex Method
     */
    static lex(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.lex(src);
    }
    /**
     * Static Lex Inline Method
     */
    static lexInline(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.inlineTokens(src);
    }
    /**
     * Preprocessing
     */
    lex(src) {
      src = src.replace(other.carriageReturn, "\n");
      this.blockTokens(src, this.tokens);
      for (let i = 0; i < this.inlineQueue.length; i++) {
        const next = this.inlineQueue[i];
        this.inlineTokens(next.src, next.tokens);
      }
      this.inlineQueue = [];
      return this.tokens;
    }
    blockTokens(src, tokens = [], lastParagraphClipped = false) {
      if (this.options.pedantic) {
        src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
      }
      while (src) {
        let token;
        if (this.options.extensions?.block?.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.space(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (token.raw.length === 1 && lastToken !== void 0) {
            lastToken.raw += "\n";
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.code(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.fences(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.heading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.hr(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.blockquote(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.list(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.html(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.def(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.raw;
            this.inlineQueue.at(-1).src = lastToken.text;
          } else if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title
            };
          }
          continue;
        }
        if (token = this.tokenizer.table(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.lheading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        let cutSrc = src;
        if (this.options.extensions?.startBlock) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startBlock.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
          const lastToken = tokens.at(-1);
          if (lastParagraphClipped && lastToken?.type === "paragraph") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          lastParagraphClipped = cutSrc.length !== src.length;
          src = src.substring(token.raw.length);
          continue;
        }
        if (token = this.tokenizer.text(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      this.state.top = true;
      return tokens;
    }
    inline(src, tokens = []) {
      this.inlineQueue.push({ src, tokens });
      return tokens;
    }
    /**
     * Lexing/Compiling
     */
    inlineTokens(src, tokens = []) {
      let maskedSrc = src;
      let match = null;
      if (this.tokens.links) {
        const links = Object.keys(this.tokens.links);
        if (links.length > 0) {
          while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
            if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
              maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
            }
          }
        }
      }
      while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      }
      while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
      }
      let keepPrevChar = false;
      let prevChar = "";
      while (src) {
        if (!keepPrevChar) {
          prevChar = "";
        }
        keepPrevChar = false;
        let token;
        if (this.options.extensions?.inline?.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.escape(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.tag(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.link(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.reflink(src, this.tokens.links)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (token.type === "text" && lastToken?.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.codespan(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.del(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.autolink(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (!this.state.inLink && (token = this.tokenizer.url(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        let cutSrc = src;
        if (this.options.extensions?.startInline) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startInline.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (token = this.tokenizer.inlineText(cutSrc)) {
          src = src.substring(token.raw.length);
          if (token.raw.slice(-1) !== "_") {
            prevChar = token.raw.slice(-1);
          }
          keepPrevChar = true;
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      return tokens;
    }
  };
  var _Renderer = class {
    options;
    parser;
    // set by the parser
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(token) {
      return "";
    }
    code({ text, lang, escaped }) {
      const langString = (lang || "").match(other.notSpaceStart)?.[0];
      const code = text.replace(other.endingNewline, "") + "\n";
      if (!langString) {
        return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
      }
      return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      return `<blockquote>
${body}</blockquote>
`;
    }
    html({ text }) {
      return text;
    }
    heading({ tokens, depth }) {
      return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
    }
    hr(token) {
      return "<hr>\n";
    }
    list(token) {
      const ordered = token.ordered;
      const start = token.start;
      let body = "";
      for (let j = 0; j < token.items.length; j++) {
        const item = token.items[j];
        body += this.listitem(item);
      }
      const type = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
      return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
    }
    listitem(item) {
      let itemBody = "";
      if (item.task) {
        const checkbox = this.checkbox({ checked: !!item.checked });
        if (item.loose) {
          if (item.tokens[0]?.type === "paragraph") {
            item.tokens[0].text = checkbox + " " + item.tokens[0].text;
            if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
              item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
              item.tokens[0].tokens[0].escaped = true;
            }
          } else {
            item.tokens.unshift({
              type: "text",
              raw: checkbox + " ",
              text: checkbox + " ",
              escaped: true
            });
          }
        } else {
          itemBody += checkbox + " ";
        }
      }
      itemBody += this.parser.parse(item.tokens, !!item.loose);
      return `<li>${itemBody}</li>
`;
    }
    checkbox({ checked }) {
      return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
    }
    paragraph({ tokens }) {
      return `<p>${this.parser.parseInline(tokens)}</p>
`;
    }
    table(token) {
      let header = "";
      let cell = "";
      for (let j = 0; j < token.header.length; j++) {
        cell += this.tablecell(token.header[j]);
      }
      header += this.tablerow({ text: cell });
      let body = "";
      for (let j = 0; j < token.rows.length; j++) {
        const row = token.rows[j];
        cell = "";
        for (let k = 0; k < row.length; k++) {
          cell += this.tablecell(row[k]);
        }
        body += this.tablerow({ text: cell });
      }
      if (body) body = `<tbody>${body}</tbody>`;
      return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
    }
    tablerow({ text }) {
      return `<tr>
${text}</tr>
`;
    }
    tablecell(token) {
      const content = this.parser.parseInline(token.tokens);
      const type = token.header ? "th" : "td";
      const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
      return tag2 + content + `</${type}>
`;
    }
    /**
     * span level renderer
     */
    strong({ tokens }) {
      return `<strong>${this.parser.parseInline(tokens)}</strong>`;
    }
    em({ tokens }) {
      return `<em>${this.parser.parseInline(tokens)}</em>`;
    }
    codespan({ text }) {
      return `<code>${escape2(text, true)}</code>`;
    }
    br(token) {
      return "<br>";
    }
    del({ tokens }) {
      return `<del>${this.parser.parseInline(tokens)}</del>`;
    }
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text;
      }
      href = cleanHref;
      let out = '<a href="' + href + '"';
      if (title) {
        out += ' title="' + escape2(title) + '"';
      }
      out += ">" + text + "</a>";
      return out;
    }
    image({ href, title, text, tokens }) {
      if (tokens) {
        text = this.parser.parseInline(tokens, this.parser.textRenderer);
      }
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return escape2(text);
      }
      href = cleanHref;
      let out = `<img src="${href}" alt="${text}"`;
      if (title) {
        out += ` title="${escape2(title)}"`;
      }
      out += ">";
      return out;
    }
    text(token) {
      return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
    }
  };
  var _TextRenderer = class {
    // no need for block level renderers
    strong({ text }) {
      return text;
    }
    em({ text }) {
      return text;
    }
    codespan({ text }) {
      return text;
    }
    del({ text }) {
      return text;
    }
    html({ text }) {
      return text;
    }
    text({ text }) {
      return text;
    }
    link({ text }) {
      return "" + text;
    }
    image({ text }) {
      return "" + text;
    }
    br() {
      return "";
    }
  };
  var _Parser = class __Parser {
    options;
    renderer;
    textRenderer;
    constructor(options2) {
      this.options = options2 || _defaults;
      this.options.renderer = this.options.renderer || new _Renderer();
      this.renderer = this.options.renderer;
      this.renderer.options = this.options;
      this.renderer.parser = this;
      this.textRenderer = new _TextRenderer();
    }
    /**
     * Static Parse Method
     */
    static parse(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parse(tokens);
    }
    /**
     * Static Parse Inline Method
     */
    static parseInline(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parseInline(tokens);
    }
    /**
     * Parse Loop
     */
    parse(tokens, top = true) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions?.renderers?.[anyToken.type]) {
          const genericToken = anyToken;
          const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
          if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "space": {
            out += this.renderer.space(token);
            continue;
          }
          case "hr": {
            out += this.renderer.hr(token);
            continue;
          }
          case "heading": {
            out += this.renderer.heading(token);
            continue;
          }
          case "code": {
            out += this.renderer.code(token);
            continue;
          }
          case "table": {
            out += this.renderer.table(token);
            continue;
          }
          case "blockquote": {
            out += this.renderer.blockquote(token);
            continue;
          }
          case "list": {
            out += this.renderer.list(token);
            continue;
          }
          case "html": {
            out += this.renderer.html(token);
            continue;
          }
          case "paragraph": {
            out += this.renderer.paragraph(token);
            continue;
          }
          case "text": {
            let textToken = token;
            let body = this.renderer.text(textToken);
            while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
              textToken = tokens[++i];
              body += "\n" + this.renderer.text(textToken);
            }
            if (top) {
              out += this.renderer.paragraph({
                type: "paragraph",
                raw: body,
                text: body,
                tokens: [{ type: "text", raw: body, text: body, escaped: true }]
              });
            } else {
              out += body;
            }
            continue;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
    /**
     * Parse Inline Tokens
     */
    parseInline(tokens, renderer = this.renderer) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions?.renderers?.[anyToken.type]) {
          const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
          if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "escape": {
            out += renderer.text(token);
            break;
          }
          case "html": {
            out += renderer.html(token);
            break;
          }
          case "link": {
            out += renderer.link(token);
            break;
          }
          case "image": {
            out += renderer.image(token);
            break;
          }
          case "strong": {
            out += renderer.strong(token);
            break;
          }
          case "em": {
            out += renderer.em(token);
            break;
          }
          case "codespan": {
            out += renderer.codespan(token);
            break;
          }
          case "br": {
            out += renderer.br(token);
            break;
          }
          case "del": {
            out += renderer.del(token);
            break;
          }
          case "text": {
            out += renderer.text(token);
            break;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
  };
  var _Hooks = class {
    options;
    block;
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    static passThroughHooks = /* @__PURE__ */ new Set([
      "preprocess",
      "postprocess",
      "processAllTokens"
    ]);
    /**
     * Process markdown before marked
     */
    preprocess(markdown) {
      return markdown;
    }
    /**
     * Process HTML after marked is finished
     */
    postprocess(html2) {
      return html2;
    }
    /**
     * Process all tokens before walk tokens
     */
    processAllTokens(tokens) {
      return tokens;
    }
    /**
     * Provide function to tokenize markdown
     */
    provideLexer() {
      return this.block ? _Lexer.lex : _Lexer.lexInline;
    }
    /**
     * Provide function to parse tokens
     */
    provideParser() {
      return this.block ? _Parser.parse : _Parser.parseInline;
    }
  };
  var Marked = class {
    defaults = _getDefaults();
    options = this.setOptions;
    parse = this.parseMarkdown(true);
    parseInline = this.parseMarkdown(false);
    Parser = _Parser;
    Renderer = _Renderer;
    TextRenderer = _TextRenderer;
    Lexer = _Lexer;
    Tokenizer = _Tokenizer;
    Hooks = _Hooks;
    constructor(...args) {
      this.use(...args);
    }
    /**
     * Run callback for every token
     */
    walkTokens(tokens, callback) {
      let values = [];
      for (const token of tokens) {
        values = values.concat(callback.call(this, token));
        switch (token.type) {
          case "table": {
            const tableToken = token;
            for (const cell of tableToken.header) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
            for (const row of tableToken.rows) {
              for (const cell of row) {
                values = values.concat(this.walkTokens(cell.tokens, callback));
              }
            }
            break;
          }
          case "list": {
            const listToken = token;
            values = values.concat(this.walkTokens(listToken.items, callback));
            break;
          }
          default: {
            const genericToken = token;
            if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
              this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
                const tokens2 = genericToken[childTokens].flat(Infinity);
                values = values.concat(this.walkTokens(tokens2, callback));
              });
            } else if (genericToken.tokens) {
              values = values.concat(this.walkTokens(genericToken.tokens, callback));
            }
          }
        }
      }
      return values;
    }
    use(...args) {
      const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
      args.forEach((pack) => {
        const opts = { ...pack };
        opts.async = this.defaults.async || opts.async || false;
        if (pack.extensions) {
          pack.extensions.forEach((ext) => {
            if (!ext.name) {
              throw new Error("extension name required");
            }
            if ("renderer" in ext) {
              const prevRenderer = extensions.renderers[ext.name];
              if (prevRenderer) {
                extensions.renderers[ext.name] = function(...args2) {
                  let ret = ext.renderer.apply(this, args2);
                  if (ret === false) {
                    ret = prevRenderer.apply(this, args2);
                  }
                  return ret;
                };
              } else {
                extensions.renderers[ext.name] = ext.renderer;
              }
            }
            if ("tokenizer" in ext) {
              if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
                throw new Error("extension level must be 'block' or 'inline'");
              }
              const extLevel = extensions[ext.level];
              if (extLevel) {
                extLevel.unshift(ext.tokenizer);
              } else {
                extensions[ext.level] = [ext.tokenizer];
              }
              if (ext.start) {
                if (ext.level === "block") {
                  if (extensions.startBlock) {
                    extensions.startBlock.push(ext.start);
                  } else {
                    extensions.startBlock = [ext.start];
                  }
                } else if (ext.level === "inline") {
                  if (extensions.startInline) {
                    extensions.startInline.push(ext.start);
                  } else {
                    extensions.startInline = [ext.start];
                  }
                }
              }
            }
            if ("childTokens" in ext && ext.childTokens) {
              extensions.childTokens[ext.name] = ext.childTokens;
            }
          });
          opts.extensions = extensions;
        }
        if (pack.renderer) {
          const renderer = this.defaults.renderer || new _Renderer(this.defaults);
          for (const prop in pack.renderer) {
            if (!(prop in renderer)) {
              throw new Error(`renderer '${prop}' does not exist`);
            }
            if (["options", "parser"].includes(prop)) {
              continue;
            }
            const rendererProp = prop;
            const rendererFunc = pack.renderer[rendererProp];
            const prevRenderer = renderer[rendererProp];
            renderer[rendererProp] = (...args2) => {
              let ret = rendererFunc.apply(renderer, args2);
              if (ret === false) {
                ret = prevRenderer.apply(renderer, args2);
              }
              return ret || "";
            };
          }
          opts.renderer = renderer;
        }
        if (pack.tokenizer) {
          const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
          for (const prop in pack.tokenizer) {
            if (!(prop in tokenizer)) {
              throw new Error(`tokenizer '${prop}' does not exist`);
            }
            if (["options", "rules", "lexer"].includes(prop)) {
              continue;
            }
            const tokenizerProp = prop;
            const tokenizerFunc = pack.tokenizer[tokenizerProp];
            const prevTokenizer = tokenizer[tokenizerProp];
            tokenizer[tokenizerProp] = (...args2) => {
              let ret = tokenizerFunc.apply(tokenizer, args2);
              if (ret === false) {
                ret = prevTokenizer.apply(tokenizer, args2);
              }
              return ret;
            };
          }
          opts.tokenizer = tokenizer;
        }
        if (pack.hooks) {
          const hooks = this.defaults.hooks || new _Hooks();
          for (const prop in pack.hooks) {
            if (!(prop in hooks)) {
              throw new Error(`hook '${prop}' does not exist`);
            }
            if (["options", "block"].includes(prop)) {
              continue;
            }
            const hooksProp = prop;
            const hooksFunc = pack.hooks[hooksProp];
            const prevHook = hooks[hooksProp];
            if (_Hooks.passThroughHooks.has(prop)) {
              hooks[hooksProp] = (arg) => {
                if (this.defaults.async) {
                  return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                    return prevHook.call(hooks, ret2);
                  });
                }
                const ret = hooksFunc.call(hooks, arg);
                return prevHook.call(hooks, ret);
              };
            } else {
              hooks[hooksProp] = (...args2) => {
                let ret = hooksFunc.apply(hooks, args2);
                if (ret === false) {
                  ret = prevHook.apply(hooks, args2);
                }
                return ret;
              };
            }
          }
          opts.hooks = hooks;
        }
        if (pack.walkTokens) {
          const walkTokens2 = this.defaults.walkTokens;
          const packWalktokens = pack.walkTokens;
          opts.walkTokens = function(token) {
            let values = [];
            values.push(packWalktokens.call(this, token));
            if (walkTokens2) {
              values = values.concat(walkTokens2.call(this, token));
            }
            return values;
          };
        }
        this.defaults = { ...this.defaults, ...opts };
      });
      return this;
    }
    setOptions(opt) {
      this.defaults = { ...this.defaults, ...opt };
      return this;
    }
    lexer(src, options2) {
      return _Lexer.lex(src, options2 ?? this.defaults);
    }
    parser(tokens, options2) {
      return _Parser.parse(tokens, options2 ?? this.defaults);
    }
    parseMarkdown(blockType) {
      const parse2 = (src, options2) => {
        const origOpt = { ...options2 };
        const opt = { ...this.defaults, ...origOpt };
        const throwError = this.onError(!!opt.silent, !!opt.async);
        if (this.defaults.async === true && origOpt.async === false) {
          return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
        }
        if (typeof src === "undefined" || src === null) {
          return throwError(new Error("marked(): input parameter is undefined or null"));
        }
        if (typeof src !== "string") {
          return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
        }
        if (opt.hooks) {
          opt.hooks.options = opt;
          opt.hooks.block = blockType;
        }
        const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
        const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
        if (opt.async) {
          return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
        }
        try {
          if (opt.hooks) {
            src = opt.hooks.preprocess(src);
          }
          let tokens = lexer2(src, opt);
          if (opt.hooks) {
            tokens = opt.hooks.processAllTokens(tokens);
          }
          if (opt.walkTokens) {
            this.walkTokens(tokens, opt.walkTokens);
          }
          let html2 = parser2(tokens, opt);
          if (opt.hooks) {
            html2 = opt.hooks.postprocess(html2);
          }
          return html2;
        } catch (e) {
          return throwError(e);
        }
      };
      return parse2;
    }
    onError(silent, async) {
      return (e) => {
        e.message += "\nPlease report this to https://github.com/markedjs/marked.";
        if (silent) {
          const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
          if (async) {
            return Promise.resolve(msg);
          }
          return msg;
        }
        if (async) {
          return Promise.reject(e);
        }
        throw e;
      };
    }
  };
  var markedInstance = new Marked();
  function marked(src, opt) {
    return markedInstance.parse(src, opt);
  }
  marked.options = marked.setOptions = function(options2) {
    markedInstance.setOptions(options2);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.getDefaults = _getDefaults;
  marked.defaults = _defaults;
  marked.use = function(...args) {
    markedInstance.use(...args);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.walkTokens = function(tokens, callback) {
    return markedInstance.walkTokens(tokens, callback);
  };
  marked.parseInline = markedInstance.parseInline;
  marked.Parser = _Parser;
  marked.parser = _Parser.parse;
  marked.Renderer = _Renderer;
  marked.TextRenderer = _TextRenderer;
  marked.Lexer = _Lexer;
  marked.lexer = _Lexer.lex;
  marked.Tokenizer = _Tokenizer;
  marked.Hooks = _Hooks;
  marked.parse = marked;
  var options = marked.options;
  var setOptions = marked.setOptions;
  var use = marked.use;
  var walkTokens = marked.walkTokens;
  var parseInline = marked.parseInline;
  var parser = _Parser.parse;
  var lexer = _Lexer.lex;

  // src/services/dom.ts
  var WIDGET_CONTAINER_ID = "chat-widget-container";
  var shadowRoot = null;
  var widgetRoot = null;
  function createContainer() {
    const existing = document.getElementById(WIDGET_CONTAINER_ID);
    if (existing) {
      existing.remove();
    }
    const host = document.createElement("div");
    host.id = WIDGET_CONTAINER_ID;
    host.setAttribute("role", "complementary");
    host.setAttribute("aria-label", "AI Chat Widget");
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
    shadowRoot = host.attachShadow({ mode: "open" });
    widgetRoot = document.createElement("div");
    widgetRoot.className = "chat-widget-root";
    shadowRoot.appendChild(widgetRoot);
    document.body.appendChild(host);
    return widgetRoot;
  }
  function injectStyles(css) {
    if (!shadowRoot) {
      console.warn("[ChatWidget] Cannot inject styles: Shadow root not initialized");
      return;
    }
    let styleElement = shadowRoot.querySelector("style");
    if (!styleElement) {
      styleElement = document.createElement("style");
      shadowRoot.insertBefore(styleElement, shadowRoot.firstChild);
    }
    styleElement.textContent = css;
  }
  function destroyWidget() {
    const container = document.getElementById(WIDGET_CONTAINER_ID);
    container?.remove();
    shadowRoot = null;
    widgetRoot = null;
  }
  var RTL_REGEX = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  function detectRTL(text) {
    return RTL_REGEX.test(text);
  }
  function setTextDirection(element, text) {
    if (detectRTL(text)) {
      element.setAttribute("dir", "rtl");
    } else {
      element.setAttribute("dir", "ltr");
    }
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }
  function scrollToBottom(element) {
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }
  function createFocusTrap(container) {
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    let previousActiveElement = null;
    function getFocusableElements() {
      return Array.from(container.querySelectorAll(focusableSelector));
    }
    function handleKeyDown(event) {
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
        previousActiveElement = document.activeElement;
        container.addEventListener("keydown", handleKeyDown);
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      },
      deactivate() {
        container.removeEventListener("keydown", handleKeyDown);
        if (previousActiveElement) {
          previousActiveElement.focus();
        }
      }
    };
  }
  function announceToScreenReader(message) {
    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    announcer.className = "chat-widget-sr-only";
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
    document.body.appendChild(announcer);
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
    setTimeout(() => {
      announcer.remove();
    }, 1e3);
  }

  // src/services/markdown.ts
  var HIGHLIGHT_KEYWORDS = {
    keyword: [
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "do",
      "switch",
      "case",
      "break",
      "continue",
      "try",
      "catch",
      "finally",
      "throw",
      "class",
      "extends",
      "new",
      "this",
      "super",
      "import",
      "export",
      "from",
      "as",
      "default",
      "async",
      "await",
      "yield",
      "static",
      "get",
      "set",
      "typeof",
      "instanceof",
      "in",
      "of",
      "delete",
      "void",
      "null",
      "undefined",
      "true",
      "false",
      "def",
      "print",
      "elif",
      "except",
      "pass",
      "with",
      "lambda",
      "global",
      "nonlocal",
      "raise",
      "assert",
      "and",
      "or",
      "not",
      "is",
      "None",
      "True",
      "False"
    ],
    type: [
      "string",
      "number",
      "boolean",
      "object",
      "array",
      "any",
      "void",
      "never",
      "int",
      "float",
      "str",
      "list",
      "dict",
      "tuple",
      "set",
      "bool",
      "String",
      "Number",
      "Boolean",
      "Object",
      "Array",
      "Promise",
      "Map",
      "Set"
    ],
    builtin: [
      "console",
      "window",
      "document",
      "Math",
      "JSON",
      "Date",
      "Error",
      "setTimeout",
      "setInterval",
      "fetch",
      "require",
      "module",
      "exports",
      "len",
      "range",
      "enumerate",
      "zip",
      "map",
      "filter",
      "sorted",
      "reversed",
      "input",
      "open",
      "type",
      "isinstance",
      "hasattr",
      "getattr",
      "setattr"
    ]
  };
  function highlightCode(code, language) {
    const escaped = escapeHtml(code);
    if (!language || language === "text" || language === "plaintext") {
      return escaped;
    }
    let result = escaped;
    result = result.replace(
      /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
      '<span class="chat-widget-hl-string">$&</span>'
    );
    result = result.replace(
      /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g,
      '<span class="chat-widget-hl-comment">$&</span>'
    );
    result = result.replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="chat-widget-hl-number">$1</span>'
    );
    const keywordPattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.keyword.join("|")})\\b`, "g");
    result = result.replace(keywordPattern, '<span class="chat-widget-hl-keyword">$1</span>');
    const typePattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.type.join("|")})\\b`, "g");
    result = result.replace(typePattern, '<span class="chat-widget-hl-type">$1</span>');
    const builtinPattern = new RegExp(`\\b(${HIGHLIGHT_KEYWORDS.builtin.join("|")})\\b`, "g");
    result = result.replace(builtinPattern, '<span class="chat-widget-hl-builtin">$1</span>');
    return result;
  }
  var MarkdownService = class {
    constructor(config) {
      this.config = config;
      this.markedInstance = marked;
      this.initializeMarked();
    }
    initializeMarked() {
      const options2 = {
        gfm: true,
        breaks: true,
        async: false
      };
      this.markedInstance.setOptions(options2);
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }) => {
        const language = lang || "text";
        const highlighted = this.config.syntaxHighlighting ? highlightCode(text, language) : escapeHtml(text);
        const langLabel = language !== "text" ? `<span class="chat-widget-code-lang">${escapeHtml(language)}</span>` : "";
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
      renderer.codespan = ({ text }) => {
        return `<code class="chat-widget-inline-code">${escapeHtml(text)}</code>`;
      };
      renderer.link = ({ href, title, text }) => {
        const safeProtocols = ["http:", "https:", "mailto:"];
        let safeHref = "#";
        try {
          const url = new URL(href, window.location.origin);
          if (safeProtocols.includes(url.protocol)) {
            safeHref = href;
          }
        } catch {
        }
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
      };
      renderer.image = ({ href, title, text }) => {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} class="chat-widget-image" loading="lazy">`;
      };
      renderer.listitem = ({ text, task, checked }) => {
        if (task) {
          const checkbox = checked ? '<span class="chat-widget-checkbox chat-widget-checkbox--checked">&#x2611;</span>' : '<span class="chat-widget-checkbox">&#x2610;</span>';
          return `<li class="chat-widget-task-item">${checkbox}${text}</li>`;
        }
        return `<li>${text}</li>`;
      };
      this.markedInstance.use({ renderer });
    }
    /**
     * Render markdown content
     */
    render(content) {
      if (!this.config.enableMarkdown) {
        return this.renderPlainText(content);
      }
      try {
        const html2 = this.markedInstance.parse(content);
        return `<div class="chat-widget-markdown">${html2}</div>`;
      } catch (error) {
        console.warn("[ChatWidget] Markdown parsing failed:", error);
        return this.renderPlainText(content);
      }
    }
    /**
     * Render markdown progressively for streaming
     * Handles incomplete code blocks and other edge cases
     */
    renderProgressive(content, isComplete) {
      if (!this.config.enableMarkdown) {
        return this.renderPlainText(content);
      }
      let processedContent = content;
      const codeBlockCount = (content.match(/```/g) || []).length;
      const isIncompleteCodeBlock = codeBlockCount % 2 !== 0;
      if (isIncompleteCodeBlock && !isComplete) {
        const lastCodeBlockStart = content.lastIndexOf("```");
        const afterCodeFence = content.substring(lastCodeBlockStart);
        if (!afterCodeFence.includes("\n```")) {
          processedContent = content + "\n```";
        }
      }
      try {
        const html2 = this.markedInstance.parse(processedContent);
        return `<div class="chat-widget-markdown">${html2}</div>`;
      } catch (error) {
        return this.renderPlainText(content);
      }
    }
    /**
     * Render plain text with line breaks preserved
     */
    renderPlainText(content) {
      return `<div class="chat-widget-plaintext">${escapeHtml(content).replace(/\n/g, "<br>")}</div>`;
    }
    /**
     * Render user message (plain text, no markdown)
     */
    renderUserMessage(content) {
      return this.renderPlainText(content);
    }
  };
  function initCodeCopyButtons(container) {
    container.querySelectorAll(".chat-widget-code-copy").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const codeBlock = button.closest(".chat-widget-code-block");
        const code = codeBlock?.querySelector("code")?.textContent;
        if (code) {
          try {
            await navigator.clipboard.writeText(code);
            button.classList.add("chat-widget-code-copy--success");
            setTimeout(() => {
              button.classList.remove("chat-widget-code-copy--success");
            }, 2e3);
          } catch (err) {
            console.warn("[ChatWidget] Failed to copy code:", err);
          }
        }
      });
    });
  }

  // src/services/session.ts
  var SessionService = class {
    constructor(config) {
      this.session = null;
      this.config = config;
    }
    /**
     * Initialize or restore session
     */
    initialize() {
      if (this.config.persistSession) {
        const stored = this.loadFromStorage();
        if (stored) {
          this.session = stored;
          return stored;
        }
      }
      this.session = this.createNew();
      this.save();
      return this.session;
    }
    /**
     * Get current session
     */
    getSession() {
      if (!this.session) {
        return this.initialize();
      }
      return this.session;
    }
    /**
     * Get conversation ID for API calls
     */
    getConversationId() {
      return this.getSession().conversationId;
    }
    /**
     * Get all messages
     */
    getMessages() {
      return this.getSession().messages;
    }
    /**
     * Add a new message
     */
    addMessage(message) {
      if (!this.session) {
        this.initialize();
      }
      this.session.messages.push(message);
      this.session.updatedAt = Date.now();
      this.save();
    }
    /**
     * Update an existing message
     */
    updateMessage(id, updates) {
      if (!this.session) return;
      const index = this.session.messages.findIndex((m) => m.id === id);
      if (index !== -1) {
        this.session.messages[index] = {
          ...this.session.messages[index],
          ...updates
        };
        this.session.updatedAt = Date.now();
        this.save();
      }
    }
    /**
     * Get a message by ID
     */
    getMessage(id) {
      return this.session?.messages.find((m) => m.id === id);
    }
    /**
     * Clear all messages and start fresh
     */
    clear() {
      this.session = this.createNew();
      this.save();
    }
    /**
     * Create a new session
     */
    createNew() {
      return {
        id: generateId(),
        conversationId: generateId(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    /**
     * Save session to localStorage
     */
    save() {
      if (!this.config.persistSession || !this.session) return;
      try {
        localStorage.setItem(this.config.sessionStorageKey, JSON.stringify(this.session));
      } catch (e) {
        console.warn("[ChatWidget] Failed to save session:", e);
      }
    }
    /**
     * Load session from localStorage
     */
    loadFromStorage() {
      try {
        const data = localStorage.getItem(this.config.sessionStorageKey);
        if (data) {
          const session = JSON.parse(data);
          if (this.isValidSession(session)) {
            return session;
          }
        }
      } catch (e) {
        console.warn("[ChatWidget] Failed to load session:", e);
      }
      return null;
    }
    /**
     * Validate session structure
     */
    isValidSession(obj) {
      if (!obj || typeof obj !== "object") return false;
      const session = obj;
      return typeof session.id === "string" && typeof session.conversationId === "string" && Array.isArray(session.messages) && typeof session.createdAt === "number" && typeof session.updatedAt === "number";
    }
    /**
     * Create a new user message
     */
    createUserMessage(content) {
      return {
        id: generateId(),
        role: "user",
        content,
        timestamp: Date.now(),
        status: "complete"
      };
    }
    /**
     * Create a new assistant message placeholder
     */
    createAssistantMessage() {
      return {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "streaming"
      };
    }
  };

  // src/services/page-context.ts
  var PageContextService = class {
    constructor(config) {
      this.config = config;
    }
    /**
     * Extract page context as a readable text summary
     */
    extractContext() {
      if (!this.config.includePageContext) {
        return null;
      }
      try {
        let rootElement = document.body;
        if (this.config.pageContextSelector) {
          rootElement = document.querySelector(this.config.pageContextSelector);
          if (!rootElement) {
            console.warn(`[ChatWidget] pageContextSelector "${this.config.pageContextSelector}" not found`);
            rootElement = document.body;
          }
        }
        const context = this.extractFromElement(rootElement);
        const maxLength = 8e3;
        if (context.length > maxLength) {
          return context.substring(0, maxLength) + "\n\n[Content truncated...]";
        }
        return context;
      } catch (error) {
        console.error("[ChatWidget] Error extracting page context:", error);
        return null;
      }
    }
    /**
     * Extract readable content from an element
     */
    extractFromElement(element) {
      const parts = [];
      const title = document.title;
      if (title) {
        parts.push(`Page Title: ${title}`);
      }
      const url = window.location.origin + window.location.pathname;
      parts.push(`URL: ${url}`);
      parts.push("");
      parts.push("--- Page Content ---");
      parts.push("");
      const content = this.extractTextContent(element);
      parts.push(content);
      const tables = this.extractTables(element);
      if (tables) {
        parts.push("");
        parts.push("--- Data Tables ---");
        parts.push(tables);
      }
      const forms = this.extractForms(element);
      if (forms) {
        parts.push("");
        parts.push("--- Form Fields ---");
        parts.push(forms);
      }
      return parts.join("\n");
    }
    /**
     * Extract text content, preserving structure
     */
    extractTextContent(element) {
      const lines = [];
      const skipTags = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "IFRAME", "TEMPLATE"]);
      const skipClasses = ["chat-widget", "chatwidget"];
      const walk = (node, depth = 0) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          if (skipTags.has(el.tagName)) return;
          if (el.id?.toLowerCase().includes("chat-widget")) return;
          if (skipClasses.some((cls) => el.className?.toString().toLowerCase().includes(cls))) return;
          const tag2 = el.tagName;
          if (/^H[1-6]$/.test(tag2)) {
            const level = parseInt(tag2[1]);
            const prefix = "#".repeat(level);
            const text = el.textContent?.trim();
            if (text) {
              lines.push("");
              lines.push(`${prefix} ${text}`);
            }
            return;
          }
          if (tag2 === "LI") {
            const text = this.getDirectText(el);
            if (text) {
              lines.push(`  \u2022 ${text}`);
            }
          }
          if (tag2 === "A") {
            const text = el.textContent?.trim();
            const href = el.getAttribute("href");
            if (text && href && !href.startsWith("#") && !href.startsWith("javascript:")) {
              lines.push(`[${text}]`);
            }
            return;
          }
          if (tag2 === "P" || tag2 === "DIV" || tag2 === "SPAN") {
            const text = this.getDirectText(el);
            if (text && text.length > 10) {
              lines.push(text);
            }
          }
          for (const child of el.childNodes) {
            walk(child, depth + 1);
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
        }
      };
      walk(element);
      return lines.filter((line) => line.trim().length > 0).filter((line, idx, arr) => arr.indexOf(line) === idx).join("\n");
    }
    /**
     * Get direct text content (not from children)
     */
    getDirectText(element) {
      let text = "";
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
    extractTables(element) {
      const tables = element.querySelectorAll("table");
      if (tables.length === 0) return null;
      const parts = [];
      tables.forEach((table, tableIdx) => {
        if (table.closest("#chat-widget-container")) return;
        const rows = table.querySelectorAll("tr");
        if (rows.length === 0) return;
        parts.push(`
Table ${tableIdx + 1}:`);
        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll("th, td");
          const cellTexts = Array.from(cells).map((cell) => cell.textContent?.trim() || "");
          parts.push(`| ${cellTexts.join(" | ")} |`);
          if (rowIdx === 0 && row.querySelector("th")) {
            parts.push(`| ${cellTexts.map(() => "---").join(" | ")} |`);
          }
        });
      });
      return parts.length > 0 ? parts.join("\n") : null;
    }
    /**
     * Extract form information
     */
    extractForms(element) {
      const inputs = element.querySelectorAll("input, select, textarea");
      if (inputs.length === 0) return null;
      const parts = [];
      inputs.forEach((input) => {
        if (input.closest("#chat-widget-container")) return;
        const el = input;
        const label = this.findLabelFor(el);
        const type = el.tagName === "INPUT" ? el.type : el.tagName.toLowerCase();
        const name = el.name || el.id || "unnamed";
        const value = el.value || "";
        if (type === "password") {
          parts.push(`- ${label || name} (${type}): [hidden]`);
        } else if (type === "hidden") {
        } else if (el.tagName === "SELECT") {
          const select = el;
          const selectedOption = select.options[select.selectedIndex];
          parts.push(`- ${label || name} (select): ${selectedOption?.text || "none"}`);
        } else {
          parts.push(`- ${label || name} (${type}): ${value || "[empty]"}`);
        }
      });
      return parts.length > 0 ? parts.join("\n") : null;
    }
    /**
     * Find label text for a form element
     */
    findLabelFor(element) {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          return label.textContent?.trim() || null;
        }
      }
      const parentLabel = element.closest("label");
      if (parentLabel) {
        const text = this.getDirectText(parentLabel);
        if (text) return text;
      }
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
      const placeholder = element.getAttribute("placeholder");
      if (placeholder) return placeholder;
      return null;
    }
  };

  // src/components/avatar.ts
  var DEFAULT_CHAT_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
</svg>
`;
  var CLOSE_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;
  var AvatarComponent = class {
    constructor(options2) {
      this._isOpen = false;
      this.badgeElement = null;
      this.options = options2;
      this.element = this.render();
    }
    render() {
      const button = document.createElement("button");
      button.className = "chat-widget-avatar";
      button.setAttribute("aria-label", "Open chat");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("type", "button");
      button.classList.add(`chat-widget-avatar--${this.options.position}`);
      button.style.width = `${this.options.size}px`;
      button.style.height = `${this.options.size}px`;
      button.style.setProperty("--chat-widget-primary", this.options.primaryColor);
      if (this.options.imageUrl) {
        const img = document.createElement("img");
        img.src = this.options.imageUrl;
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        img.className = "chat-widget-avatar__image";
        button.appendChild(img);
      } else {
        const iconWrapper = document.createElement("span");
        iconWrapper.className = "chat-widget-avatar__icon";
        iconWrapper.innerHTML = DEFAULT_CHAT_ICON;
        iconWrapper.setAttribute("aria-hidden", "true");
        button.appendChild(iconWrapper);
      }
      this.badgeElement = document.createElement("span");
      this.badgeElement.className = "chat-widget-avatar__badge";
      this.badgeElement.setAttribute("aria-hidden", "true");
      this.badgeElement.style.display = "none";
      button.appendChild(this.badgeElement);
      button.addEventListener("click", (e) => {
        e.preventDefault();
        this.options.onClick();
      });
      button.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.options.onClick();
        }
      });
      if (!prefersReducedMotion()) {
        button.classList.add("chat-widget-avatar--animated");
      }
      return button;
    }
    /**
     * Get the DOM element
     */
    getElement() {
      return this.element;
    }
    /**
     * Check if avatar shows open state
     */
    isOpenState() {
      return this._isOpen;
    }
    /**
     * Show the avatar button
     */
    show() {
      this.element.style.display = "flex";
      this.element.setAttribute("aria-hidden", "false");
    }
    /**
     * Hide the avatar button
     */
    hide() {
      this.element.style.display = "none";
      this.element.setAttribute("aria-hidden", "true");
    }
    /**
     * Set the open/closed state (changes icon)
     */
    setOpen(isOpen) {
      this._isOpen = isOpen;
      this.element.setAttribute("aria-expanded", String(isOpen));
      if (!this.options.imageUrl) {
        const iconWrapper = this.element.querySelector(".chat-widget-avatar__icon");
        if (iconWrapper) {
          iconWrapper.innerHTML = isOpen ? CLOSE_ICON : DEFAULT_CHAT_ICON;
        }
      }
      this.element.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
    }
    /**
     * Enable pulse animation
     */
    setPulse(enabled) {
      if (enabled && !prefersReducedMotion()) {
        this.element.classList.add("chat-widget-avatar--pulse");
      } else {
        this.element.classList.remove("chat-widget-avatar--pulse");
      }
    }
    /**
     * Show unread indicator
     */
    showBadge(count) {
      if (this.badgeElement) {
        this.badgeElement.style.display = "flex";
        if (count !== void 0 && count > 0) {
          this.badgeElement.textContent = count > 9 ? "9+" : String(count);
        }
      }
    }
    /**
     * Hide unread indicator
     */
    hideBadge() {
      if (this.badgeElement) {
        this.badgeElement.style.display = "none";
        this.badgeElement.textContent = "";
      }
    }
    /**
     * Update options
     */
    updateOptions(options2) {
      if (options2.primaryColor) {
        this.options.primaryColor = options2.primaryColor;
        this.element.style.setProperty("--chat-widget-primary", options2.primaryColor);
      }
      if (options2.size) {
        this.options.size = options2.size;
        this.element.style.width = `${options2.size}px`;
        this.element.style.height = `${options2.size}px`;
      }
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.element.remove();
    }
  };

  // src/components/panel.ts
  var MINIMIZE_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 14 10 14 10 20"></polyline>
  <polyline points="20 10 14 10 14 4"></polyline>
  <line x1="14" y1="10" x2="21" y2="3"></line>
  <line x1="3" y1="21" x2="10" y2="14"></line>
</svg>
`;
  var CLOSE_ICON2 = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;
  var CLEAR_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
</svg>
`;
  var PanelComponent = class {
    constructor(options2) {
      this.isOpen = false;
      this.originalBodyStyle = null;
      this.options = options2;
      this.element = this.render();
      this.messagesContainer = this.element.querySelector(".chat-widget-messages");
      this.inputContainer = this.element.querySelector(".chat-widget-panel__input");
      this.focusTrap = createFocusTrap(this.element);
      this.setupEventListeners();
    }
    render() {
      const panel = document.createElement("div");
      panel.className = `chat-widget-panel chat-widget-panel--${this.options.position}`;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", this.options.title);
      panel.setAttribute("aria-modal", "false");
      panel.setAttribute("aria-hidden", "true");
      panel.style.width = `${this.options.width}px`;
      if (this.options.height !== "full") {
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
            ${CLOSE_ICON2}
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
    setupEventListeners() {
      const closeBtn = this.element.querySelector(".chat-widget-panel__btn--close");
      closeBtn?.addEventListener("click", () => this.options.onClose());
      const minimizeBtn = this.element.querySelector(".chat-widget-panel__btn--minimize");
      minimizeBtn?.addEventListener("click", () => this.options.onMinimize());
      const clearBtn = this.element.querySelector(".chat-widget-panel__btn--clear");
      clearBtn?.addEventListener("click", () => this.options.onClearHistory());
      this.element.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.options.onClose();
        }
      });
      window.addEventListener("resize", () => {
        if (this.isOpen) {
          this.updatePushContent();
        }
      });
    }
    /**
     * Get the DOM element
     */
    getElement() {
      return this.element;
    }
    /**
     * Get the messages container
     */
    getMessagesContainer() {
      return this.messagesContainer;
    }
    /**
     * Get the input container for mounting InputComponent
     */
    getInputContainer() {
      return this.inputContainer;
    }
    /**
     * Mount the input component
     */
    mountInput(input) {
      this.inputContainer.appendChild(input.getElement());
    }
    /**
     * Open the panel
     */
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this.element.classList.add("chat-widget-panel--open");
      this.element.setAttribute("aria-hidden", "false");
      if (this.options.pushContent) {
        this.applyPushContent(true);
      }
      const animationDuration = prefersReducedMotion() ? 0 : 300;
      setTimeout(() => {
        this.focusTrap.activate();
      }, animationDuration);
    }
    /**
     * Close the panel
     */
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.element.classList.remove("chat-widget-panel--open");
      this.element.setAttribute("aria-hidden", "true");
      if (this.options.pushContent) {
        this.applyPushContent(false);
      }
      this.focusTrap.deactivate();
    }
    /**
     * Check if panel is open
     */
    isOpened() {
      return this.isOpen;
    }
    /**
     * Apply or remove push content effect
     */
    applyPushContent(push) {
      if (isMobile()) {
        return;
      }
      const isRight = this.options.position.includes("right");
      const property = isRight ? "marginRight" : "marginLeft";
      if (push) {
        this.originalBodyStyle = {
          marginLeft: document.body.style.marginLeft,
          marginRight: document.body.style.marginRight,
          transition: document.body.style.transition
        };
        if (!prefersReducedMotion()) {
          document.body.style.transition = "margin 0.3s ease-in-out";
        }
        document.body.style[property] = `${this.options.width}px`;
      } else {
        if (!prefersReducedMotion()) {
          document.body.style.transition = "margin 0.3s ease-in-out";
        }
        document.body.style[property] = this.originalBodyStyle?.[property] || "";
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
    updatePushContent() {
      if (!this.options.pushContent) return;
      if (isMobile()) {
        if (this.originalBodyStyle) {
          document.body.style.marginLeft = this.originalBodyStyle.marginLeft;
          document.body.style.marginRight = this.originalBodyStyle.marginRight;
        }
      } else {
        this.applyPushContent(true);
      }
    }
    /**
     * Add a message element to the container
     */
    addMessage(messageElement) {
      const welcome = this.messagesContainer.querySelector(".chat-widget-messages__welcome");
      if (welcome && welcome.children.length === 0) {
        welcome.remove();
      }
      this.messagesContainer.appendChild(messageElement);
      this.scrollToBottom();
    }
    /**
     * Set the welcome message
     */
    setWelcomeMessage(message) {
      const welcome = this.messagesContainer.querySelector(".chat-widget-messages__welcome");
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
    clearMessages() {
      this.messagesContainer.innerHTML = '<div class="chat-widget-messages__welcome"></div>';
    }
    /**
     * Scroll messages to bottom
     */
    scrollToBottom() {
      scrollToBottom(this.messagesContainer);
    }
    /**
     * Update panel title
     */
    setTitle(title) {
      const titleElement = this.element.querySelector(".chat-widget-panel__title h2");
      if (titleElement) {
        titleElement.textContent = title;
      }
    }
    /**
     * Show loading state
     */
    showLoading() {
      this.element.classList.add("chat-widget-panel--loading");
    }
    /**
     * Hide loading state
     */
    hideLoading() {
      this.element.classList.remove("chat-widget-panel--loading");
    }
    /**
     * Show error state
     */
    showError(message) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "chat-widget-panel__error";
      errorDiv.innerHTML = `
      <p>${escapeHtml(message)}</p>
      <button type="button" class="chat-widget-panel__error-dismiss">Dismiss</button>
    `;
      errorDiv.querySelector("button")?.addEventListener("click", () => {
        errorDiv.remove();
      });
      this.element.insertBefore(errorDiv, this.messagesContainer);
    }
    /**
     * Update options
     */
    updateOptions(options2) {
      if (options2.width !== void 0) {
        this.options.width = options2.width;
        this.element.style.width = `${options2.width}px`;
        if (this.isOpen && this.options.pushContent) {
          this.applyPushContent(true);
        }
      }
      if (options2.height !== void 0) {
        this.options.height = options2.height;
        if (options2.height !== "full") {
          this.element.style.height = `${options2.height}px`;
        } else {
          this.element.style.height = "";
        }
      }
      if (options2.title !== void 0) {
        this.setTitle(options2.title);
      }
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.isOpen) {
        this.close();
      }
      this.element.remove();
    }
  };

  // src/components/message.ts
  var MessageComponent = class _MessageComponent {
    constructor(message, markdownService) {
      this.message = message;
      this.markdownService = markdownService;
      this.element = this.render();
      this.contentElement = this.element.querySelector(".chat-widget-message__content");
    }
    render() {
      const div = document.createElement("div");
      div.className = `chat-widget-message chat-widget-message--${this.message.role}`;
      div.setAttribute("data-message-id", this.message.id);
      div.setAttribute("data-status", this.message.status);
      if (this.message.content) {
        setTextDirection(div, this.message.content);
      }
      const isAssistant = this.message.role === "assistant";
      div.innerHTML = `
      ${isAssistant ? '<div class="chat-widget-message__avatar" aria-hidden="true"></div>' : ""}
      <div class="chat-widget-message__body">
        <div class="chat-widget-message__content"></div>
        <div class="chat-widget-message__meta">
          <time datetime="${new Date(this.message.timestamp).toISOString()}">
            ${this.formatTime(this.message.timestamp)}
          </time>
        </div>
      </div>
    `;
      const contentDiv = div.querySelector(".chat-widget-message__content");
      this.renderContent(contentDiv);
      if (this.message.toolCalls && this.message.toolCalls.length > 0) {
        const toolsContainer = document.createElement("div");
        toolsContainer.className = "chat-widget-message__tools";
        let hasVisibleTools = false;
        this.message.toolCalls.forEach((tool) => {
          const toolElement = this.renderToolCall(tool);
          if (toolElement) {
            toolsContainer.appendChild(toolElement);
            hasVisibleTools = true;
          }
        });
        if (hasVisibleTools) {
          div.querySelector(".chat-widget-message__body")?.appendChild(toolsContainer);
        }
      }
      if (this.message.status === "streaming") {
        div.classList.add("chat-widget-message--streaming");
      }
      return div;
    }
    renderContent(container) {
      const isStreaming = this.message.status === "streaming";
      if (this.message.role === "user") {
        container.innerHTML = this.markdownService.renderUserMessage(this.message.content);
      } else {
        container.innerHTML = this.markdownService.renderProgressive(
          this.message.content,
          !isStreaming
        );
        initCodeCopyButtons(container);
      }
    }
    static {
      // Internal tools that should be hidden from the user
      this.HIDDEN_TOOLS = ["getPageContent"];
    }
    renderToolCall(toolCall) {
      if (_MessageComponent.HIDDEN_TOOLS.includes(toolCall.toolName)) {
        return null;
      }
      const div = document.createElement("div");
      div.className = `chat-widget-tool chat-widget-tool--${toolCall.status}`;
      div.setAttribute("data-tool-id", toolCall.id);
      const statusIcon = this.getToolStatusIcon(toolCall.status);
      div.innerHTML = `
      <div class="chat-widget-tool__header">
        <span class="chat-widget-tool__icon">${statusIcon}</span>
        <span class="chat-widget-tool__name">${escapeHtml(toolCall.toolName)}</span>
        <span class="chat-widget-tool__status">${toolCall.status}</span>
      </div>
    `;
      return div;
    }
    getToolStatusIcon(status) {
      switch (status) {
        case "pending":
          return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chat-widget-tool__spinner">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>`;
        case "complete":
          return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;
        case "error":
          return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`;
        default:
          return "";
      }
    }
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString(void 0, {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    /**
     * Get the DOM element
     */
    getElement() {
      return this.element;
    }
    /**
     * Get the message data
     */
    getMessage() {
      return this.message;
    }
    /**
     * Update message content
     */
    updateContent(content, isComplete = false) {
      this.message.content = content;
      setTextDirection(this.element, content);
      if (this.message.role === "user") {
        this.contentElement.innerHTML = this.markdownService.renderUserMessage(content);
      } else {
        this.contentElement.innerHTML = this.markdownService.renderProgressive(content, isComplete);
        initCodeCopyButtons(this.contentElement);
      }
    }
    /**
     * Set message status
     */
    setStatus(status) {
      this.message.status = status;
      this.element.setAttribute("data-status", status);
      if (status === "streaming") {
        this.element.classList.add("chat-widget-message--streaming");
      } else {
        this.element.classList.remove("chat-widget-message--streaming");
      }
      if (status === "error") {
        this.element.classList.add("chat-widget-message--error");
      } else {
        this.element.classList.remove("chat-widget-message--error");
      }
    }
    /**
     * Add a tool call to the message
     */
    addToolCall(toolCall) {
      if (!this.message.toolCalls) {
        this.message.toolCalls = [];
      }
      this.message.toolCalls.push(toolCall);
      let toolsContainer = this.element.querySelector(".chat-widget-message__tools");
      if (!toolsContainer) {
        toolsContainer = document.createElement("div");
        toolsContainer.className = "chat-widget-message__tools";
        this.element.querySelector(".chat-widget-message__body")?.appendChild(toolsContainer);
      }
      const toolElement = this.renderToolCall(toolCall);
      if (toolElement) {
        toolsContainer.appendChild(toolElement);
      }
    }
    /**
     * Update a tool call status
     */
    updateToolCall(toolCallId, updates) {
      const toolCall = this.message.toolCalls?.find((t) => t.id === toolCallId);
      if (toolCall) {
        Object.assign(toolCall, updates);
        const toolElement = this.element.querySelector(`[data-tool-id="${toolCallId}"]`);
        if (toolElement && updates.status) {
          toolElement.className = `chat-widget-tool chat-widget-tool--${updates.status}`;
          const statusSpan = toolElement.querySelector(".chat-widget-tool__status");
          if (statusSpan) {
            statusSpan.textContent = updates.status;
          }
          const iconSpan = toolElement.querySelector(".chat-widget-tool__icon");
          if (iconSpan) {
            iconSpan.innerHTML = this.getToolStatusIcon(updates.status);
          }
        }
      }
    }
    /**
     * Show error state
     */
    showError(errorMessage) {
      this.setStatus("error");
      const errorDiv = document.createElement("div");
      errorDiv.className = "chat-widget-message__error";
      errorDiv.innerHTML = `
      <span class="chat-widget-message__error-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </span>
      <span class="chat-widget-message__error-text">${escapeHtml(errorMessage)}</span>
    `;
      this.element.querySelector(".chat-widget-message__body")?.appendChild(errorDiv);
    }
    /**
     * Scroll the message into view
     */
    scrollIntoView() {
      this.element.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.element.remove();
    }
  };

  // src/components/input.ts
  var SEND_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="22" y1="2" x2="11" y2="13"></line>
  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
</svg>
`;
  var InputComponent = class {
    constructor(options2) {
      this.isDisabled = false;
      this.options = options2;
      this.element = this.render();
      this.textarea = this.element.querySelector(".chat-widget-input__field");
      this.sendButton = this.element.querySelector(".chat-widget-input__send");
      this.typingIndicator = this.element.querySelector(".chat-widget-typing");
      this.setupEventListeners();
    }
    render() {
      const form = document.createElement("form");
      form.className = "chat-widget-input";
      form.setAttribute("autocomplete", "off");
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
    setupEventListeners() {
      this.element.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
      this.textarea.addEventListener("input", () => {
        this.autoResize();
        this.updateSendButtonState();
      });
      this.textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleSubmit();
        }
      });
      this.textarea.addEventListener("paste", () => {
        setTimeout(() => {
          this.autoResize();
          this.updateSendButtonState();
        }, 0);
      });
    }
    handleSubmit() {
      const message = this.textarea.value.trim();
      if (message && !this.isDisabled) {
        this.options.onSend(message);
        this.clear();
      }
    }
    autoResize() {
      this.textarea.style.height = "auto";
      const maxHeight = 120;
      const newHeight = Math.min(this.textarea.scrollHeight, maxHeight);
      this.textarea.style.height = `${newHeight}px`;
      this.textarea.style.overflowY = this.textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }
    updateSendButtonState() {
      const hasContent = this.textarea.value.trim().length > 0;
      this.sendButton.disabled = !hasContent || this.isDisabled;
    }
    escapeAttr(str) {
      return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    /**
     * Get the DOM element
     */
    getElement() {
      return this.element;
    }
    /**
     * Focus the input field
     */
    focus() {
      this.textarea.focus();
    }
    /**
     * Clear the input field
     */
    clear() {
      this.textarea.value = "";
      this.textarea.style.height = "auto";
      this.updateSendButtonState();
    }
    /**
     * Set the input value
     */
    setValue(value) {
      this.textarea.value = value;
      this.autoResize();
      this.updateSendButtonState();
    }
    /**
     * Get the current input value
     */
    getValue() {
      return this.textarea.value;
    }
    /**
     * Disable the input
     */
    disable() {
      this.isDisabled = true;
      this.textarea.disabled = true;
      this.sendButton.disabled = true;
      this.element.classList.add("chat-widget-input--disabled");
    }
    /**
     * Enable the input
     */
    enable() {
      this.isDisabled = false;
      this.textarea.disabled = false;
      this.updateSendButtonState();
      this.element.classList.remove("chat-widget-input--disabled");
    }
    /**
     * Show typing indicator
     */
    showTyping() {
      this.typingIndicator.classList.add("chat-widget-typing--visible");
      this.typingIndicator.setAttribute("aria-hidden", "false");
    }
    /**
     * Hide typing indicator
     */
    hideTyping() {
      this.typingIndicator.classList.remove("chat-widget-typing--visible");
      this.typingIndicator.setAttribute("aria-hidden", "true");
    }
    /**
     * Check if input is disabled
     */
    isInputDisabled() {
      return this.isDisabled;
    }
    /**
     * Update placeholder text
     */
    setPlaceholder(placeholder) {
      this.textarea.placeholder = placeholder;
      this.textarea.setAttribute("aria-label", placeholder);
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.element.remove();
    }
  };

  // src/styles/variables.ts
  function generateCSSVariables(config) {
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
  var baseStyles = `
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
  function generateStyles(config) {
    const variables = generateCSSVariables(config);
    return `
    .chat-widget-root {
      ${variables}
    }
    ${baseStyles}
  `;
  }

  // src/index.ts
  var ChatWidget = class {
    constructor(userConfig) {
      this.container = null;
      this.avatar = null;
      this.panel = null;
      this.input = null;
      this.messageComponents = /* @__PURE__ */ new Map();
      this.isOpen = false;
      this.isStreaming = false;
      this.currentStreamingMessage = null;
      const errors = validateConfig(userConfig);
      if (errors.length > 0) {
        console.error("[ChatWidget] Configuration errors:", errors);
        throw new Error(`ChatWidget configuration invalid: ${errors.join(", ")}`);
      }
      this.config = mergeConfig(userConfig);
      this.apiService = new ApiService(this.config);
      this.markdownService = new MarkdownService(this.config);
      this.sessionService = new SessionService(this.config);
      this.pageContextService = new PageContextService(this.config);
    }
    /**
     * Initialize and mount the widget
     */
    init() {
      this.container = createContainer();
      injectStyles(generateStyles(this.config));
      const session = this.sessionService.initialize();
      this.avatar = new AvatarComponent({
        imageUrl: this.config.avatarImage,
        size: this.config.avatarSize,
        position: this.config.position,
        primaryColor: this.config.primaryColor,
        onClick: () => this.toggle()
      });
      this.panel = new PanelComponent({
        title: this.config.headerTitle,
        width: this.config.chatWidth,
        height: this.config.chatHeight,
        position: this.config.position,
        primaryColor: this.config.primaryColor,
        pushContent: this.config.pushContent,
        onClose: () => this.close(),
        onMinimize: () => this.close(),
        onClearHistory: () => this.clearHistory()
      });
      this.input = new InputComponent({
        placeholder: this.config.placeholder,
        primaryColor: this.config.primaryColor,
        onSend: (message) => this.sendMessage(message)
      });
      this.container.appendChild(this.avatar.getElement());
      this.container.appendChild(this.panel.getElement());
      this.panel.mountInput(this.input);
      if (this.config.welcomeMessage) {
        this.panel.setWelcomeMessage(this.config.welcomeMessage);
      }
      session.messages.forEach((msg) => this.renderMessage(msg));
      if (this.config.openOnLoad) {
        this.open();
      }
      this.exposePublicAPI();
      console.log("[ChatWidget] Initialized successfully");
    }
    /**
     * Open the chat panel
     */
    open() {
      if (this.isOpen || !this.panel || !this.avatar) return;
      this.isOpen = true;
      this.avatar.hide();
      this.avatar.setOpen(true);
      this.panel.open();
      setTimeout(() => {
        this.input?.focus();
      }, 300);
      this.config.onOpen?.();
      announceToScreenReader("Chat opened");
    }
    /**
     * Close the chat panel
     */
    close() {
      if (!this.isOpen || !this.panel || !this.avatar) return;
      this.isOpen = false;
      this.panel.close();
      this.avatar.show();
      this.avatar.setOpen(false);
      this.config.onClose?.();
      announceToScreenReader("Chat closed");
    }
    /**
     * Toggle the chat panel
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
    /**
     * Send a message
     */
    async sendMessage(content) {
      if (this.isStreaming || !content.trim()) return;
      const userMessage = this.sessionService.createUserMessage(content);
      this.sessionService.addMessage(userMessage);
      this.renderMessage(userMessage);
      this.config.onMessageSent?.(userMessage);
      const assistantMessage = this.sessionService.createAssistantMessage();
      this.sessionService.addMessage(assistantMessage);
      this.renderMessage(assistantMessage);
      this.currentStreamingMessage = assistantMessage;
      this.isStreaming = true;
      this.input?.disable();
      this.input?.showTyping();
      const pageContext = this.pageContextService.extractContext();
      try {
        await this.apiService.streamMessage(
          content,
          this.sessionService.getConversationId(),
          (event) => this.handleSSEEvent(event),
          () => this.handleStreamComplete(),
          (error) => this.handleStreamError(error),
          pageContext
        );
      } catch (error) {
        this.handleStreamError(error);
      }
    }
    /**
     * Handle SSE events
     */
    handleSSEEvent(event) {
      if (!this.currentStreamingMessage) return;
      const component = this.messageComponents.get(this.currentStreamingMessage.id);
      if (!component) return;
      switch (event.type) {
        case "start":
          break;
        case "text": {
          const textEvent = event;
          const newContent = this.currentStreamingMessage.content + (textEvent.content || "");
          this.currentStreamingMessage.content = newContent;
          component.updateContent(newContent, false);
          this.panel?.scrollToBottom();
          break;
        }
        case "tool-call": {
          const toolEvent = event;
          const toolCall = {
            id: toolEvent.content?.toolCallId || generateId(),
            toolName: toolEvent.content?.toolName || "unknown",
            args: toolEvent.content?.args,
            status: "pending"
          };
          component.addToolCall(toolCall);
          break;
        }
        case "tool-result": {
          const resultEvent = event;
          if (resultEvent.content?.toolCallId) {
            component.updateToolCall(resultEvent.content.toolCallId, {
              result: resultEvent.content.result,
              status: "complete"
            });
          }
          break;
        }
        case "error": {
          this.currentStreamingMessage.status = "error";
          component.setStatus("error");
          const errorContent = event.content?.message || "An error occurred";
          component.showError(errorContent);
          break;
        }
        case "done":
        case "finish":
          break;
      }
    }
    /**
     * Handle stream completion
     */
    handleStreamComplete() {
      if (this.currentStreamingMessage) {
        this.currentStreamingMessage.status = "complete";
        const component = this.messageComponents.get(this.currentStreamingMessage.id);
        if (component) {
          component.updateContent(this.currentStreamingMessage.content, true);
          component.setStatus("complete");
        }
        this.sessionService.updateMessage(this.currentStreamingMessage.id, {
          content: this.currentStreamingMessage.content,
          status: "complete"
        });
        this.config.onMessageReceived?.(this.currentStreamingMessage);
        announceToScreenReader("New message received");
      }
      this.cleanupStreaming();
    }
    /**
     * Handle stream error
     */
    handleStreamError(error) {
      console.error("[ChatWidget] Stream error:", error);
      if (this.currentStreamingMessage) {
        this.currentStreamingMessage.status = "error";
        this.currentStreamingMessage.content = "Sorry, something went wrong. Please try again.";
        const component = this.messageComponents.get(this.currentStreamingMessage.id);
        if (component) {
          component.updateContent(this.currentStreamingMessage.content, true);
          component.setStatus("error");
        }
        this.sessionService.updateMessage(this.currentStreamingMessage.id, {
          content: this.currentStreamingMessage.content,
          status: "error"
        });
      }
      this.config.onError?.(error);
      this.cleanupStreaming();
    }
    /**
     * Clean up after streaming
     */
    cleanupStreaming() {
      this.isStreaming = false;
      this.currentStreamingMessage = null;
      this.input?.hideTyping();
      this.input?.enable();
      this.input?.focus();
    }
    /**
     * Render a message
     */
    renderMessage(message) {
      const component = new MessageComponent(message, this.markdownService);
      this.messageComponents.set(message.id, component);
      this.panel?.addMessage(component.getElement());
    }
    /**
     * Clear chat history
     */
    clearHistory() {
      this.sessionService.clear();
      this.messageComponents.clear();
      this.panel?.clearMessages();
      if (this.config.welcomeMessage) {
        this.panel?.setWelcomeMessage(this.config.welcomeMessage);
      }
    }
    /**
     * Destroy the widget
     */
    destroy() {
      this.apiService.abort();
      if (this.isOpen) {
        this.close();
      }
      this.avatar?.destroy();
      this.panel?.destroy();
      this.input?.destroy();
      this.messageComponents.clear();
      destroyWidget();
      if (typeof window !== "undefined") {
        delete window.ChatWidget;
      }
      console.log("[ChatWidget] Destroyed");
    }
    /**
     * Expose public API on window
     */
    exposePublicAPI() {
      if (typeof window !== "undefined") {
        window.ChatWidget = {
          open: () => this.open(),
          close: () => this.close(),
          toggle: () => this.toggle(),
          sendMessage: (text) => this.sendMessage(text),
          clearHistory: () => this.clearHistory(),
          destroy: () => this.destroy()
        };
      }
    }
  };
  if (typeof window !== "undefined") {
    window.ChatWidget = ChatWidget;
    const autoInit = () => {
      if (window.ChatWidgetConfig) {
        try {
          const widget = new ChatWidget(window.ChatWidgetConfig);
          widget.init();
        } catch (error) {
          console.error("[ChatWidget] Auto-initialization failed:", error);
        }
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      setTimeout(autoInit, 0);
    }
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=chat-widget.js.map
