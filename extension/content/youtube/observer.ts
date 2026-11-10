import { YouTubeDetector, YouTubePageType } from './detector';
import { ExtensionLogger } from '../../shared/utils';

export type NavigationCallback = (pageType: YouTubePageType, url: string) => void;

export class YouTubeObserver {
  private listeners: NavigationCallback[] = [];
  private lastUrl = '';
  private logger: ExtensionLogger;
  private isListening = false;

  constructor(logger?: ExtensionLogger) {
    this.logger = logger || new ExtensionLogger('YouTubeObserver');
  }

  public start(): void {
    if (this.isListening || typeof window === 'undefined') return;

    this.lastUrl = window.location.href;
    this.isListening = true;

    // Listen to YouTube's native CustomEvents fired during SPA navigation
    window.addEventListener('yt-navigate-finish', this.handleNavigation);
    window.addEventListener('yt-page-data-updated', this.handleNavigation);
    window.addEventListener('popstate', this.handleNavigation);

    this.logger.debug('YouTube SPA navigation observer registered');
  }

  public stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;

    window.removeEventListener('yt-navigate-finish', this.handleNavigation);
    window.removeEventListener('yt-page-data-updated', this.handleNavigation);
    window.removeEventListener('popstate', this.handleNavigation);

    this.listeners = [];
    this.isListening = false;
  }

  public onNavigation(cb: NavigationCallback): () => void {
    this.listeners.push(cb);
    // Immediately notify with current page
    cb(YouTubeDetector.getPageType(), window.location.href);

    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private handleNavigation = (): void => {
    const currentUrl = window.location.href;
    if (this.lastUrl === currentUrl) return;
    this.lastUrl = currentUrl;
    const pageType = YouTubeDetector.getPageType();

    this.logger.debug(`YouTube SPA route changed: [${pageType}] -> ${currentUrl}`);

    for (const listener of this.listeners) {
      try {
        listener(pageType, currentUrl);
      } catch (err) {
        this.logger.error('Error in YouTube navigation listener:', err);
      }
    }
  };
}
