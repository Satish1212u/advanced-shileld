import { DEFAULT_GLOBAL_STATS, STORAGE_KEYS } from '../shared/constants';
import { GlobalStats, PageStats, RuleCategory } from '../shared/types';
import { debounce, ExtensionLogger } from '../shared/utils';

export class StatsManager {
  private globalStats: GlobalStats;
  private pageStatsMap: Map<string, PageStats> = new Map();
  private pendingChanges = false;
  private logger: ExtensionLogger;
  private debouncedSave: () => void;

  // Average ad/tracker resource size estimate: ~45 KB
  private static readonly ESTIMATED_BYTES_PER_BLOCKED_REQUEST = 46080;

  constructor(logger?: ExtensionLogger) {
    this.logger = logger || new ExtensionLogger('StatsManager');
    this.globalStats = { ...DEFAULT_GLOBAL_STATS };

    this.debouncedSave = debounce(() => {
      this.flushToStorage();
    }, 2000);
  }

  public async initialize(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.STATS]);
      if (result[STORAGE_KEYS.STATS]) {
        this.globalStats = { ...DEFAULT_GLOBAL_STATS, ...result[STORAGE_KEYS.STATS] };
      }
      this.logger.info('StatsManager initialized');
    } catch (err) {
      this.logger.error('Failed to load stats from storage:', err);
    }
  }

  public getGlobalStats(): GlobalStats {
    return { ...this.globalStats };
  }

  public getPageStats(domain: string): PageStats {
    const existing = this.pageStatsMap.get(domain);
    if (existing) {
      return { ...existing };
    }
    const fresh: PageStats = {
      domain,
      adsBlocked: 0,
      trackersBlocked: 0,
      annoyancesBlocked: 0,
      malwareBlocked: 0,
      cosmeticHidden: 0,
      lastUpdated: Date.now(),
    };
    this.pageStatsMap.set(domain, fresh);
    return fresh;
  }

  /**
   * Record a blocked network request by category
   */
  public recordNetworkBlock(domain: string, category: RuleCategory): void {
    const pageStats = this.getPageStats(domain);

    switch (category) {
      case 'ads':
        pageStats.adsBlocked++;
        this.globalStats.totalAdsBlocked++;
        break;
      case 'privacy':
        pageStats.trackersBlocked++;
        this.globalStats.totalTrackersBlocked++;
        break;
      case 'annoyances':
        pageStats.annoyancesBlocked++;
        this.globalStats.totalAnnoyancesBlocked++;
        break;
      case 'malware':
        pageStats.malwareBlocked++;
        this.globalStats.totalMalwareBlocked++;
        break;
    }

    this.globalStats.estimatedDataSavedBytes += StatsManager.ESTIMATED_BYTES_PER_BLOCKED_REQUEST;
    pageStats.lastUpdated = Date.now();
    this.pageStatsMap.set(domain, pageStats);

    // Update site-level aggregate stats
    if (!this.globalStats.siteStats[domain]) {
      this.globalStats.siteStats[domain] = { ads: 0, trackers: 0, cosmetic: 0 };
    }
    if (category === 'ads') this.globalStats.siteStats[domain].ads++;
    if (category === 'privacy') this.globalStats.siteStats[domain].trackers++;

    this.pendingChanges = true;
    this.debouncedSave();
  }

  /**
   * Record cosmetic elements hidden on a page
   */
  public recordCosmeticBlock(domain: string, count: number): void {
    if (count <= 0) return;
    const pageStats = this.getPageStats(domain);
    pageStats.cosmeticHidden += count;
    pageStats.lastUpdated = Date.now();
    this.pageStatsMap.set(domain, pageStats);

    this.globalStats.totalCosmeticHidden += count;

    if (!this.globalStats.siteStats[domain]) {
      this.globalStats.siteStats[domain] = { ads: 0, trackers: 0, cosmetic: 0 };
    }
    this.globalStats.siteStats[domain].cosmetic += count;

    this.pendingChanges = true;
    this.debouncedSave();
  }

  /**
   * Update extension icon badge for a tab with total blocked items
   */
  public updateBadge(tabId: number, domain: string): void {
    if (typeof chrome === 'undefined' || !chrome.action) return;

    const stats = this.getPageStats(domain);
    const totalBlocked = stats.adsBlocked + stats.trackersBlocked + stats.annoyancesBlocked + stats.cosmeticHidden;

    const badgeText = totalBlocked > 0 ? (totalBlocked > 999 ? '999+' : totalBlocked.toString()) : '';

    try {
      chrome.action.setBadgeText({ text: badgeText, tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId });
    } catch {
      // Ignored if tab closed
    }
  }

  public async flushToStorage(): Promise<void> {
    if (!this.pendingChanges) return;
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.STATS]: this.globalStats,
      });
      this.pendingChanges = false;
    } catch (err) {
      this.logger.error('Failed to flush stats to storage:', err);
    }
  }
}

