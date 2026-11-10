export function extractDomain(url: string): string {
  try {
    if (!url || typeof url !== 'string') return '';
    // If it doesn't have a protocol, prepend https:// for parsing
    const urlToParse = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome-extension://')
      ? url
      : `https://${url}`;
    const parsed = new URL(urlToParse);
    let hostname = parsed.hostname.toLowerCase();
    // Strip leading www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    // Fallback regex for dirty URLs
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^/:?#]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  }) as T;
}

export function throttle<T extends (...args: unknown[]) => void>(fn: T, limitMs: number): T {
  let inThrottle = false;
  return ((...args: unknown[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  }) as T;
}

/**
 * Generates a stable, non-fragile CSS selector for a target DOM element.
 * Intentionally ignores volatile/obfuscated class names and random numeric IDs.
 */
export function generateStableSelector(element: HTMLElement): string {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

  const tagName = element.tagName.toLowerCase();
  if (tagName === 'body' || tagName === 'html') return tagName;

  // 1. Check for stable semantic ID (avoid random/dynamically generated IDs)
  if (element.id && isStableIdentifier(element.id)) {
    return `#${CSS.escape(element.id)}`;
  }

  // 2. Check for unique semantic attributes
  const semanticAttributes = [
    'data-ad-unit',
    'data-ad-slot',
    'data-ad-client',
    'data-testid',
    'aria-label',
    'role',
    'name'
  ];

  for (const attr of semanticAttributes) {
    const val = element.getAttribute(attr);
    if (val && isStableIdentifier(val)) {
      const selector = `${tagName}[${attr}="${CSS.escape(val)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  // 3. Check for stable classes
  const stableClasses = Array.from(element.classList).filter(isStableIdentifier);
  if (stableClasses.length > 0) {
    const classSelector = `${tagName}.${stableClasses.map(c => CSS.escape(c)).join('.')}`;
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }

  // 4. Hierarchical path generation up to 3 levels
  const path: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && current.tagName.toLowerCase() !== 'body' && depth < 4) {
    const tag = current.tagName.toLowerCase();
    const currentClasses = Array.from(current.classList).filter(isStableIdentifier);

    let step = tag;
    if (current.id && isStableIdentifier(current.id)) {
      step = `#${CSS.escape(current.id)}`;
      path.unshift(step);
      break;
    } else if (currentClasses.length > 0) {
      step += `.${CSS.escape(currentClasses[0])}`;
    } else if (current.parentElement) {
      // Add nth-of-type for specificity
      const siblings = Array.from(current.parentElement.children).filter(
        c => c.tagName.toLowerCase() === tag
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        step += `:nth-of-type(${index})`;
      }
    }

    path.unshift(step);
    current = current.parentElement;
    depth++;
  }

  return path.join(' > ');
}

/**
 * Filter out random dynamic identifiers like 'ember1234', 'css-19v82a', 'ad_837264', or minified hashes.
 */
function isStableIdentifier(str: string): boolean {
  if (!str || str.length < 2 || str.length > 50) return false;
  // If it contains a large string of digits, hex hashes, or starts with colon (:r1:)
  if (/:\w+:/.test(str)) return false;
  if (/\b[a-f0-9]{8,}\b/i.test(str)) return false;
  if (/\d{4,}/.test(str)) return false;
  // If it starts with common dynamic framework prefixes like css-, sc-, jsx-, styled-
  if (/^(?:css|sc|jsx|styled)-[a-zA-Z0-9]+$/.test(str)) return false;
  return true;
}

/**
 * Structured Logger with Dev/Prod mode awareness
 */
export class ExtensionLogger {
  private prefix: string;
  private isDev: boolean;

  constructor(prefix: string, isDev: boolean = false) {
    this.prefix = `[AdvancedAdBlocker:${prefix}]`;
    this.isDev = isDev;
  }

  setDevMode(isDev: boolean) {
    this.isDev = isDev;
  }

  debug(...args: unknown[]) {
    if (this.isDev) {
      console.debug(this.prefix, ...args);
    }
  }

  info(...args: unknown[]) {
    console.info(this.prefix, ...args);
  }

  warn(...args: unknown[]) {
    console.warn(this.prefix, ...args);
  }

  error(...args: unknown[]) {
    console.error(this.prefix, ...args);
  }
}

