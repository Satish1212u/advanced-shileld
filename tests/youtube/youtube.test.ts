import { describe, it, expect, beforeEach } from 'vitest';
import { YouTubeDetector } from '../../extension/content/youtube/detector';
import { YouTubeObserver } from '../../extension/content/youtube/observer';

describe('YouTube Detector & Observer', () => {
  beforeEach(() => {
    // Reset window and document mocks
    delete (global as any).window;
    delete (global as any).document;

    (global as any).window = {
      location: {
        hostname: 'www.youtube.com',
        pathname: '/watch',
        href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    (global as any).document = {
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  });

  it('correctly detects YouTube domain', () => {
    expect(YouTubeDetector.isYouTube()).toBe(true);

    window.location.hostname = 'google.com';
    expect(YouTubeDetector.isYouTube()).toBe(false);

    window.location.hostname = 'm.youtube.com';
    expect(YouTubeDetector.isYouTube()).toBe(true);
  });

  it('correctly classifies SPA route types', () => {
    window.location.pathname = '/watch';
    expect(YouTubeDetector.getPageType()).toBe('video');

    window.location.pathname = '/shorts/xyz123';
    expect(YouTubeDetector.getPageType()).toBe('shorts');

    window.location.pathname = '/results';
    expect(YouTubeDetector.getPageType()).toBe('search');

    window.location.pathname = '/playlist';
    expect(YouTubeDetector.getPageType()).toBe('playlist');

    window.location.pathname = '/@veritasium';
    expect(YouTubeDetector.getPageType()).toBe('channel');

    window.location.pathname = '/';
    expect(YouTubeDetector.getPageType()).toBe('home');
  });

  it('detects when ad player state is active', () => {
    // When player does not have ad-showing class
    document.querySelector = (sel: string) => {
      if (sel === '.html5-video-player') {
        return {
          classList: {
            contains: () => false,
          },
        } as any;
      }
      return null;
    };
    expect(YouTubeDetector.isAdPlaying()).toBe(false);

    // When ad is showing
    document.querySelector = (sel: string) => {
      if (sel === '.html5-video-player') {
        return {
          classList: {
            contains: (c: string) => c === 'ad-showing',
          },
        } as any;
      }
      return null;
    };
    expect(YouTubeDetector.isAdPlaying()).toBe(true);
  });

  it('detects skip button when present', () => {
    const fakeButton = { offsetParent: {} };
    document.querySelector = (sel: string) => {
      if (sel === '.ytp-ad-skip-button') {
        return fakeButton as any;
      }
      return null;
    };

    expect(YouTubeDetector.getSkipButton()).toBe(fakeButton as any);
  });

  it('notifies observer listeners immediately upon subscription', () => {
    const observer = new YouTubeObserver();
    let receivedType = '';

    observer.onNavigation((type) => {
      receivedType = type;
    });

    expect(receivedType).toBe('video');
  });
});
