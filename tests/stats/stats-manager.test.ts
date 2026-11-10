import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsManager } from '../../extension/background/stats-manager';

describe('StatsManager', () => {
  let statsManager: StatsManager;

  beforeEach(() => {
    (global as any).chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
      },
    };

    statsManager = new StatsManager();
  });

  it('initializes with default zero stats', () => {
    const globalStats = statsManager.getGlobalStats();
    expect(globalStats.totalAdsBlocked).toBe(0);
    expect(globalStats.totalTrackersBlocked).toBe(0);
    expect(globalStats.estimatedDataSavedBytes).toBe(0);
  });

  it('records network ad blocks accurately', () => {
    statsManager.recordNetworkBlock('example.com', 'ads');
    statsManager.recordNetworkBlock('example.com', 'ads');
    statsManager.recordNetworkBlock('example.com', 'privacy');

    const pageStats = statsManager.getPageStats('example.com');
    expect(pageStats.adsBlocked).toBe(2);
    expect(pageStats.trackersBlocked).toBe(1);

    const globalStats = statsManager.getGlobalStats();
    expect(globalStats.totalAdsBlocked).toBe(2);
    expect(globalStats.totalTrackersBlocked).toBe(1);
    expect(globalStats.estimatedDataSavedBytes).toBeGreaterThan(0);
  });

  it('records cosmetic elements hidden', () => {
    statsManager.recordCosmeticBlock('news.com', 5);

    const pageStats = statsManager.getPageStats('news.com');
    expect(pageStats.cosmeticHidden).toBe(5);

    const globalStats = statsManager.getGlobalStats();
    expect(globalStats.totalCosmeticHidden).toBe(5);
  });

  it('updates tab badge text correctly', () => {
    statsManager.recordNetworkBlock('example.com', 'ads');
    statsManager.updateBadge(42, 'example.com');

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 42,
      text: '1',
    });
  });
});

