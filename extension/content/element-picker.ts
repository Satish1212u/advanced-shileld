import { extractDomain, generateStableSelector } from '../shared/utils';

export class ElementPicker {
  private active = false;
  private hoveredElement: HTMLElement | null = null;
  private originalOutline = '';
  private originalBackground = '';
  private dialog: HTMLElement | null = null;

  public start(): void {
    if (this.active) return;
    this.active = true;

    document.addEventListener('mouseover', this.handleMouseOver, true);
    document.addEventListener('mouseout', this.handleMouseOut, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;

    this.clearHoverHighlight();
    document.removeEventListener('mouseover', this.handleMouseOver, true);
    document.removeEventListener('mouseout', this.handleMouseOut, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);

    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
      this.dialog = null;
    }
  }

  private handleMouseOver = (e: MouseEvent): void => {
    if (!this.active || this.dialog) return;
    const target = e.target as HTMLElement;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.id === 'advanced-adblocker-picker-dialog' || target.closest('#advanced-adblocker-picker-dialog')) return;

    this.clearHoverHighlight();
    this.hoveredElement = target;
    this.originalOutline = target.style.outline;
    this.originalBackground = target.style.backgroundColor;

    target.style.outline = '2px solid #ef4444';
    target.style.cursor = 'crosshair';
  };

  private handleMouseOut = (e: MouseEvent): void => {
    if (!this.active || this.dialog) return;
    const target = e.target as HTMLElement;
    if (target === this.hoveredElement) {
      this.clearHoverHighlight();
    }
  };

  private clearHoverHighlight(): void {
    if (this.hoveredElement) {
      this.hoveredElement.style.outline = this.originalOutline;
      this.hoveredElement.style.backgroundColor = this.originalBackground;
      this.hoveredElement.style.cursor = '';
      this.hoveredElement = null;
    }
  }

  private handleClick = (e: MouseEvent): void => {
    if (!this.active) return;
    const target = e.target as HTMLElement;
    if (target.closest('#advanced-adblocker-picker-dialog')) return;

    e.preventDefault();
    e.stopPropagation();

    if (!this.hoveredElement) return;

    const selector = generateStableSelector(this.hoveredElement);
    this.showConfirmationDialog(this.hoveredElement, selector);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.stop();
    }
  };

  private showConfirmationDialog(targetEl: HTMLElement, selector: string): void {
    if (this.dialog) return;

    const domain = extractDomain(window.location.href);

    this.dialog = document.createElement('div');
    this.dialog.id = 'advanced-adblocker-picker-dialog';
    this.dialog.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #18181b;
      color: #fafafa;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 420px;
    `;

    this.dialog.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="font-size:16px;">🛡️</span>
        <strong style="font-size:15px;">Block Element</strong>
      </div>
      <p style="margin: 0 0 10px 0; color: #a1a1aa; font-size: 13px;">
        This element will be permanently hidden on <strong id="adv-picker-domain"></strong>.
      </p>
      <div id="adv-picker-selector" style="background:#27272a; padding:8px 10px; border-radius:6px; font-family:monospace; font-size:12px; word-break:break-all; margin-bottom:14px; color:#60a5fa; max-height:80px; overflow-y:auto;">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="adv-picker-cancel" style="background:#3f3f46; color:#f4f4f5; border:none; border-radius:6px; padding:6px 12px; font-weight:500; cursor:pointer;">
          Cancel
        </button>
        <button id="adv-picker-block" style="background:#ef4444; color:#ffffff; border:none; border-radius:6px; padding:6px 12px; font-weight:500; cursor:pointer;">
          Block Element
        </button>
      </div>
    `;

    const domainEl = this.dialog.querySelector<HTMLElement>('#adv-picker-domain');
    const selectorEl = this.dialog.querySelector<HTMLElement>('#adv-picker-selector');
    if (domainEl) domainEl.textContent = domain;
    if (selectorEl) selectorEl.textContent = selector;

    document.body.appendChild(this.dialog);

    const cancelBtn = this.dialog.querySelector('#adv-picker-cancel');
    const blockBtn = this.dialog.querySelector('#adv-picker-block');

    cancelBtn?.addEventListener('click', () => {
      this.stop();
    });

    blockBtn?.addEventListener('click', () => {
      // Hide element immediately
      targetEl.style.setProperty('display', 'none', 'important');

      // Send to background service worker
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'ELEMENT_PICKED',
          domain,
          selector,
        });
      }

      this.stop();
    });
  }
}

// Listen for START_ELEMENT_PICKER message from popup or background
const picker = new ElementPicker();
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'START_ELEMENT_PICKER') {
      picker.start();
    } else if (msg.type === 'CANCEL_ELEMENT_PICKER') {
      picker.stop();
    }
  });
}
