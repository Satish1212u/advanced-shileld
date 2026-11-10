export type RuleCategory = 'ads' | 'privacy' | 'annoyances' | 'malware' | 'youtube' | 'custom';

export type ResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'other';

export interface IntermediateRule {
  id: string;
  raw: string;
  type: 'network' | 'cosmetic' | 'comment' | 'unsupported';
  isException: boolean;
  action: 'block' | 'allow';
  urlPattern?: string;
  domainFilter?: string;
  domains?: string[];
  excludedDomains?: string[];
  resourceTypes?: ResourceType[];
  selector?: string;
  important?: boolean;
  category: RuleCategory;
  comment?: string;
}

export interface CosmeticRule {
  id: string;
  selector: string;
  domains?: string[];
  excludedDomains?: string[];
  isException?: boolean;
  hideStyle?: string;
  category?: RuleCategory;
}

export interface YouTubeSettings {
  blockVideoAds: boolean;
  hideBanners: boolean;
  hideEndCards: boolean;
  hidePromotedPosts: boolean;
  hideCommentsAds: boolean;
}

export interface SiteSetting {
  domain: string;
  enabled: boolean;
  customCosmeticRules?: string[];
  whitelistNetwork?: boolean;
  whitelistCosmetic?: boolean;
}

export interface ExtensionSettings {
  globalEnabled: boolean;
  categorySettings: Record<RuleCategory, boolean>;
  siteSettings: Record<string, SiteSetting>;
  customRules: string[];
  youtubeSettings: YouTubeSettings;
  malwareProtection: boolean;
  autoUpdate: boolean;
  updateIntervalHours: number;
  lastUpdated: number;
  devMode: boolean;
}

export interface PageStats {
  domain: string;
  adsBlocked: number;
  trackersBlocked: number;
  annoyancesBlocked: number;
  malwareBlocked: number;
  cosmeticHidden: number;
  lastUpdated: number;
}

export interface GlobalStats {
  totalAdsBlocked: number;
  totalTrackersBlocked: number;
  totalAnnoyancesBlocked: number;
  totalMalwareBlocked: number;
  totalCosmeticHidden: number;
  estimatedDataSavedBytes: number;
  siteStats: Record<string, { ads: number; trackers: number; cosmetic: number }>;
}

export interface FilterListMetadata {
  id: string;
  name: string;
  url: string;
  category: RuleCategory;
  enabled: boolean;
  version: string;
  lastUpdated: number;
  ruleCount: number;
  checksum?: string;
  error?: string;
}

// Inter-process messaging protocols
export type MessagePayload =
  | { type: 'GET_PAGE_STATS'; domain: string }
  | { type: 'PAGE_STATS_RESPONSE'; stats: PageStats }
  | { type: 'RECORD_COSMETIC_BLOCK'; domain: string; count: number }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_RESPONSE'; settings: ExtensionSettings }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ExtensionSettings> }
  | { type: 'TOGGLE_SITE'; domain: string; enabled: boolean }
  | { type: 'START_ELEMENT_PICKER' }
  | { type: 'CANCEL_ELEMENT_PICKER' }
  | { type: 'ELEMENT_PICKED'; domain: string; selector: string }
  | { type: 'REMOVE_CUSTOM_RULE'; domain: string; selector: string }
  | { type: 'CHECK_MALWARE'; domain: string }
  | { type: 'MALWARE_CHECK_RESULT'; isMalware: boolean; reason?: string }
  | { type: 'TRIGGER_FILTER_UPDATE' }
  | { type: 'GET_DEBUG_INFO' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

