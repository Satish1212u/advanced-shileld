export type YouTubePageType = 'home' | 'video' | 'shorts' | 'search' | 'channel' | 'playlist' | 'unknown';

export class YouTubeDetector {
  public static isYouTube(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  }

  public static getPageType(): YouTubePageType {
    if (typeof window === 'undefined') return 'unknown';
    const path = window.location.pathname;

    if (path === '/' || path === '') return 'home';
    if (path.startsWith('/watch')) return 'video';
    if (path.startsWith('/shorts')) return 'shorts';
    if (path.startsWith('/results')) return 'search';
    if (path.startsWith('/playlist')) return 'playlist';
    if (path.startsWith('/@') || path.startsWith('/channel') || path.startsWith('/c/')) return 'channel';

    return 'unknown';
  }

  public static isAdPlaying(): boolean {
    if (typeof document === 'undefined') return false;
    const player = document.querySelector('.html5-video-player');
    if (!player) return false;

    // Check YouTube's built-in player ad state classes
    return player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
  }

  public static getSkipButton(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const selectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      'button.ytp-ad-skip-button-text',
      '.ytp-skip-ad-button',
      '.ytp-ad-overlay-close-button',
    ];

    for (const sel of selectors) {
      const btn = document.querySelector<HTMLElement>(sel);
      if (btn && btn.offsetParent !== null) {
        return btn;
      }
    }
    return null;
  }
}

