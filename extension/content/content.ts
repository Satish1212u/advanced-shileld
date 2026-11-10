import { extractDomain, ExtensionLogger } from '../shared/utils';
import { CosmeticEngine } from './cosmetic-engine';
import { YouTubeCompatibility } from './youtube/compatibility';
import { CosmeticRule, ExtensionSettings } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import './element-picker'; // Register element picker listeners

const logger = new ExtensionLogger('ContentScript');
let cosmeticEngine: CosmeticEngine | null = null;
let youtubeEngine: YouTubeCompatibility | null = null;

async function initContentScript(): Promise<void> {
  const domain = extractDomain(window.location.href);
  if (!domain) return;

  logger.debug(`Initializing content script for ${domain}`);

  // Fetch current settings from background service worker
  let settings: ExtensionSettings | null = null;
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) {
        settings = response.data as ExtensionSettings;
      }
    } catch {
      logger.debug('Could not communicate with background worker yet');
    }
  }

  // Check if protection is enabled for this domain
  const isGlobalEnabled = settings ? settings.globalEnabled : true;
  const siteConfig = settings?.siteSettings[domain];
  const isSiteEnabled = siteConfig !== undefined ? siteConfig.enabled : true;

  if (!isGlobalEnabled || !isSiteEnabled) {
    logger.info(`Protection disabled for ${domain}`);
    return;
  }

  // Initialize Cosmetic Engine
  const customSelectors = [...(siteConfig?.customCosmeticRules || [])];

  // Fetch updated dynamic cosmetic rules from storage if available
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const storageData = await chrome.storage.local.get([STORAGE_KEYS.DYNAMIC_COSMETIC]);
      const dynamicRulesObj: Record<string, CosmeticRule[]> = storageData[STORAGE_KEYS.DYNAMIC_COSMETIC] || {};
      for (const listRules of Object.values(dynamicRulesObj)) {
        if (!Array.isArray(listRules)) continue;
        for (const r of listRules) {
          if (!r || !r.selector) continue;
          if (!r.domains || r.domains.length === 0 || r.domains.includes(domain)) {
            customSelectors.push(r.selector);
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  cosmeticEngine = new CosmeticEngine({
    domain,
    customSelectors,
    logger,
    onElementsHidden: (count) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'RECORD_COSMETIC_BLOCK',
          domain,
          count,
        }).catch(() => {
          // Worker might be idle
        });
      }
    },
  });

  cosmeticEngine.start();

  // If YouTube, start YouTube compatibility & ad suppression
  if (domain === 'youtube.com' || domain.endsWith('.youtube.com')) {
    youtubeEngine = new YouTubeCompatibility(logger);
    youtubeEngine.start();
  }
}

// Start immediately at document_start
initContentScript().catch(err => {
  logger.error('Failed to initialize content script:', err);
});

