import { ExtensionSettings, FilterListMetadata, GlobalStats, RuleCategory } from './types';

export const STORAGE_KEYS = {
  SETTINGS: 'adblocker_settings',
  STATS: 'adblocker_stats',
  PAGE_STATS_PREFIX: 'adblocker_page_stats_',
  CUSTOM_RULES: 'adblocker_custom_rules',
  RULES_META: 'adblocker_rules_metadata',
  DYNAMIC_COSMETIC: 'adblocker_dynamic_cosmetic',
} as const;

export const RULESET_IDS: Record<RuleCategory, string> = {
  ads: 'rules_ads',
  privacy: 'rules_privacy',
  annoyances: 'rules_annoyances',
  malware: 'rules_malware',
  youtube: 'rules_youtube',
  custom: 'rules_custom',
};

export const DYNAMIC_RULE_RANGES = {
  WHITELIST_START: 100000,
  WHITELIST_MAX: 199999,
  CUSTOM_START: 200000,
  CUSTOM_MAX: 299999,
  UPDATED_START: 300000,
  UPDATED_MAX: 399999,
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  globalEnabled: true,
  categorySettings: {
    ads: true,
    privacy: true,
    annoyances: true,
    malware: true,
    youtube: true,
    custom: true,
  },
  siteSettings: {},
  customRules: [],
  youtubeSettings: {
    blockVideoAds: true,
    hideBanners: true,
    hideEndCards: true,
    hidePromotedPosts: true,
    hideCommentsAds: true,
  },
  malwareProtection: true,
  autoUpdate: true,
  updateIntervalHours: 24,
  lastUpdated: Date.now(),
  devMode: false,
};

export const DEFAULT_GLOBAL_STATS: GlobalStats = {
  totalAdsBlocked: 0,
  totalTrackersBlocked: 0,
  totalAnnoyancesBlocked: 0,
  totalMalwareBlocked: 0,
  totalCosmeticHidden: 0,
  estimatedDataSavedBytes: 0,
  siteStats: {},
};

export const DEFAULT_FILTER_LISTS: FilterListMetadata[] = [
  {
    id: 'easylist-base',
    name: 'EasyList (Core Ad-Blocking)',
    url: 'https://easylist.to/easylist/easylist.txt',
    category: 'ads',
    enabled: true,
    version: '2026.03.01',
    lastUpdated: Date.now(),
    ruleCount: 0,
  },
  {
    id: 'easyprivacy-base',
    name: 'EasyPrivacy (Trackers & Telemetry)',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    category: 'privacy',
    enabled: true,
    version: '2026.03.01',
    lastUpdated: Date.now(),
    ruleCount: 0,
  },
  {
    id: 'fanboy-annoyance-base',
    name: 'Fanboy Annoyances (Popups & Overlays)',
    url: 'https://easylist.to/easylist/fanboy-annoyance.txt',
    category: 'annoyances',
    enabled: true,
    version: '2026.03.01',
    lastUpdated: Date.now(),
    ruleCount: 0,
  },
  {
    id: 'malware-feed-base',
    name: 'URLHaus Malware Feed',
    url: 'https://urlhaus.abuse.ch/downloads/text_online/',
    category: 'malware',
    enabled: true,
    version: '2026.03.01',
    lastUpdated: Date.now(),
    ruleCount: 0,
  }
];

// Common high-accuracy cosmetic selectors for ad placeholders across the web
export const COMMON_COSMETIC_SELECTORS = [
  '.adsbygoogle',
  '[id*="google_ads_iframe"]',
  '[id*="google_ads"]',
  'div[data-ad-unit]',
  'div[data-ad-slot]',
  'div[data-ad-client]',
  '.ad-banner',
  '.ad-container',
  '.ad-box',
  '.ad-wrapper',
  '.ad-unit',
  '.advertisement-wrapper',
  '.ad_wrapper',
  '.sponsored-post',
  '.promoted-tweet',
  'div[data-testid="placementTracking"]',
  'amp-ad',
  'amp-embed[type="taboola"]',
  'amp-embed[type="outbrain"]',
  '.taboola-ad',
  '.outbrain-ad',
  '.criteo-ad',
  '.native-ad',
  '.trc_related_container',
  '.ad-slot',
  '#ad-header',
  '#ad-footer',
  '#ad-sidebar',
  '.pub_300x250',
  '.pub_728x90',
];

// YouTube-specific ad selectors for cosmetic element hiding
export const YOUTUBE_AD_SELECTORS = [
  '#masthead-ad',
  'ytd-banner-promo-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-ad-slot-renderer',
  '.ytp-ad-module',
  '.ytp-ad-overlay-container',
  '.ytp-ad-image-overlay',
  '.ytp-ad-text-overlay',
  '.ytp-ad-action-interstitial',
  '#player-ads',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-promoted-sparkles-text-search-renderer',
  'ytd-compact-promoted-video-renderer',
  'ytd-display-ad-renderer',
  'ytd-statement-banner-renderer',
  'ytd-action-companion-ad-renderer',
  '.ytd-merch-shelf-renderer',
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
];

