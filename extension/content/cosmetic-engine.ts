import { COMMON_COSMETIC_SELECTORS } from '../shared/constants';
import { debounce, ExtensionLogger } from '../shared/utils';

export interface CosmeticEngineOptions {
  domain: string;
  customSelectors?: string[];
  onElementsHidden?: (count: number) => void;
  logger?: ExtensionLogger;
}

export class CosmeticEngine {
  private domain: string;
  private customSelectors: string[];
  private styleElement: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private visitedNodes = new WeakSet<Node>();
  private hiddenCount = 0;
  private onElementsHidden?: (count: number) => void;
  private logger: ExtensionLogger;

  // Circuit breaker to protect against infinite MutationObserver loops
  private mutationCountInWindow = 0;
  private windowStartTime = Date.now();
  private isThrottled = false;
  private static readonly MAX_MUTATIONS_PER_SECOND = 400;

  private debouncedReport: () => void;

  constructor(options: CosmeticEngineOptions) {
    this.domain = options.domain;
    this.customSelectors = options.customSelectors || [];
    this.onElementsHidden = options.onElementsHidden;
    this.logger = options.logger || new ExtensionLogger('CosmeticEngine');

    this.debouncedReport = debounce(() => {
      if (this.hiddenCount > 0 && this.onElementsHidden) {
        this.onElementsHidden(this.hiddenCount);
        this.hiddenCount = 0;
      }
    }, 1500);

    this.logger.debug(`CosmeticEngine constructed for ${this.domain}`);
  }

  /**
   * Start the cosmetic engine: injects styling rules and starts targeted mutation observer
   */
  public start(): void {
    this.injectStyles();
    this.scanInitialDOM();
    this.startObserver();
  }

  /**
   * Stop the cosmetic engine and clean up DOM listeners
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
      this.styleElement = null;
    }
  }

  /**
   * Add a custom user selector at runtime
   */
  public addSelector(selector: string): void {
    if (!this.customSelectors.includes(selector)) {
      this.customSelectors.push(selector);
      this.injectStyles();
      this.processSelector(selector);
    }
  }

  /**
   * Fast, zero-overhead CSS injection. The browser's native C++ rendering engine
   * immediately hides and collapses matched ad elements without JavaScript loops.
   */
  private injectStyles(): void {
    const allSelectors = [...COMMON_COSMETIC_SELECTORS, ...this.customSelectors];
    if (allSelectors.length === 0) return;

    const cssRules = `${allSelectors.join(',\n')} {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }`;

    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'advanced-adblocker-cosmetic-styles';
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(this.styleElement);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (document.head || document.documentElement).appendChild(this.styleElement!);
        }, { once: true });
      }
    }

    this.styleElement.textContent = cssRules;
  }

  /**
   * Targeted scan of existing DOM elements matching cosmetic selectors
   */
  private scanInitialDOM(): void {
    if (typeof document === 'undefined') return;

    const allSelectors = [...COMMON_COSMETIC_SELECTORS, ...this.customSelectors];
    for (const sel of allSelectors) {
      try {
        const matches = document.querySelectorAll(sel);
        if (matches.length > 0) {
          matches.forEach(el => this.visitedNodes.add(el));
          this.hiddenCount += matches.length;
        }
      } catch {
        // Ignore invalid vendor-specific selector queries safely
      }
    }

    if (this.hiddenCount > 0) {
      this.debouncedReport();
    }
  }

  /**
   * Targeted MutationObserver looking only at newly added nodes (no attribute/characterData)
   */
  private startObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    const target = document.body || document.documentElement;
    if (!target) {
      document.addEventListener('DOMContentLoaded', () => this.startObserver(), { once: true });
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
    });
  }

  private handleMutations(mutations: MutationRecord[]): void {
    // Check circuit breaker
    const now = Date.now();
    if (now - this.windowStartTime > 1000) {
      this.mutationCountInWindow = 0;
      this.windowStartTime = now;
      this.isThrottled = false;
    }

    this.mutationCountInWindow += mutations.length;
    if (this.mutationCountInWindow > CosmeticEngine.MAX_MUTATIONS_PER_SECOND) {
      if (!this.isThrottled) {
        this.logger.warn('Circuit breaker tripped: high mutation rate detected. Throttling cosmetic DOM checks.');
        this.isThrottled = true;
      }
      return;
    }

    let newlyHidden = 0;
    const allSelectors = [...COMMON_COSMETIC_SELECTORS, ...this.customSelectors];

    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i];
        if (node.nodeType !== Node.ELEMENT_NODE || this.visitedNodes.has(node)) {
          continue;
        }

        const el = node as HTMLElement;
        this.visitedNodes.add(el);

        // Check if the element itself matches any selector
        for (const sel of allSelectors) {
          try {
            if (el.matches && el.matches(sel)) {
              newlyHidden++;
              break;
            }
          } catch {
            // Ignore malformed selector matches safely
          }
        }
      }
    }

    if (newlyHidden > 0) {
      this.hiddenCount += newlyHidden;
      this.debouncedReport();
    }
  }

  private processSelector(selector: string): void {
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length > 0) {
        this.hiddenCount += matches.length;
        this.debouncedReport();
      }
    } catch {
      // Ignored
    }
  }
}
