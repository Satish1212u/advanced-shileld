import { YOUTUBE_AD_SELECTORS } from '../../shared/constants';
import { ExtensionLogger } from '../../shared/utils';
import { YouTubeDetector } from './detector';
import { YouTubeObserver } from './observer';

export class YouTubeCompatibility {
  private observer: YouTubeObserver;
  private playerObserver: MutationObserver | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private logger: ExtensionLogger;
  private originalVolume = 1;
  private originalMuted = false;
  private isHandlingAd = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private findTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logger?: ExtensionLogger) {
    this.logger = logger || new ExtensionLogger('YouTubeCompatibility');
    this.observer = new YouTubeObserver(this.logger);
  }

  public start(): void {
    if (!YouTubeDetector.isYouTube()) return;

    this.logger.info('Starting YouTube Compatibility & Ad Suppression Engine');
    this.injectYouTubeStyles();
    this.observer.start();

    // Listen to SPA navigations
    this.observer.onNavigation((pageType) => {
      this.logger.debug(`YouTube navigated to: ${pageType}`);
      if (pageType === 'video' || pageType === 'shorts') {
        this.attachPlayerWatcher();
      } else {
        this.detachPlayerWatcher();
      }
    });

    // Initial check for video player
    this.attachPlayerWatcher();
  }

  public stop(): void {
    this.observer.stop();
    this.detachPlayerWatcher();
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
      this.styleElement = null;
    }
  }

  /**
   * Injects YouTube-specific ad-hiding CSS to collapse banners, promoted reels, and mastheads
   */
  private injectYouTubeStyles(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'advanced-adblocker-youtube-cosmetic';
    this.styleElement.textContent = `
      ${YOUTUBE_AD_SELECTORS.join(',\n')} {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .ytp-ad-module, .ytp-ad-player-overlay {
        display: none !important;
      }
    `;

    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(this.styleElement);
    }
  }

  /**
   * Observe video player element mutations for ad state changes
   */
  private attachPlayerWatcher(): void {
    this.detachPlayerWatcher();

    const player = document.querySelector('.html5-video-player');
    if (!player) {
      // Retry when player mounts (up to 15 attempts = 7.5 seconds)
      let attempts = 0;
      this.findTimer = setInterval(() => {
        attempts++;
        const p = document.querySelector('.html5-video-player');
        if (p) {
          if (this.findTimer) {
            clearInterval(this.findTimer);
            this.findTimer = null;
          }
          this.attachToPlayer(p as HTMLElement);
        } else if (attempts > 15) {
          if (this.findTimer) {
            clearInterval(this.findTimer);
            this.findTimer = null;
          }
        }
      }, 500);
      return;
    }

    this.attachToPlayer(player as HTMLElement);
  }

  private attachToPlayer(player: HTMLElement): void {
    this.playerObserver = new MutationObserver(() => {
      this.checkPlayerAdState();
    });

    this.playerObserver.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Low-frequency fallback safety check while in video mode (3s interval, low CPU)
    this.checkInterval = setInterval(() => {
      this.checkPlayerAdState();
    }, 3000);

    // Initial check
    this.checkPlayerAdState();
  }

  private detachPlayerWatcher(): void {
    if (this.findTimer) {
      clearInterval(this.findTimer);
      this.findTimer = null;
    }
    if (this.playerObserver) {
      this.playerObserver.disconnect();
      this.playerObserver = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check and safely handle YouTube ad interruption
   */
  private checkPlayerAdState(): void {
    const isAdPlaying = YouTubeDetector.isAdPlaying();

    if (isAdPlaying) {
      this.handleAdPlaying();
    } else if (this.isHandlingAd) {
      this.handleAdFinished();
    }
  }

  private handleAdPlaying(): void {
    const video = document.querySelector<HTMLVideoElement>('video.html5-main-video');
    if (!video) return;

    if (!this.isHandlingAd) {
      this.isHandlingAd = true;
      this.originalVolume = video.volume;
      this.originalMuted = video.muted;
      this.logger.debug('Ad detected on video player. Suppressing audio and fast-forwarding...');
    }

    // Auto-click skip button if visible
    const skipBtn = YouTubeDetector.getSkipButton();
    if (skipBtn) {
      this.logger.debug('Skip button present, clicking...');
      skipBtn.click();
      return;
    }

    // Mute ad audio and fast-forward unskippable ad safely
    try {
      video.muted = true;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      } else {
        video.playbackRate = 16.0;
      }
    } catch {
      // Safe fallback
    }
  }

  private handleAdFinished(): void {
    this.isHandlingAd = false;
    this.logger.debug('Ad finished, restoring normal playback state');

    const video = document.querySelector<HTMLVideoElement>('video.html5-main-video');
    if (video) {
      try {
        video.playbackRate = 1.0;
        video.muted = this.originalMuted;
        video.volume = this.originalVolume;
      } catch {
        // Safe fallback
      }
    }
  }
}

