import { extractDomain, ExtensionLogger } from '../shared/utils';
import { RuleManager } from './rule-manager';
import { SiteManager } from './site-manager';
import { StatsManager } from './stats-manager';
import { FilterUpdateManager } from './filter-update-manager';
import { MessagePayload } from '../shared/types';

const logger = new ExtensionLogger('ServiceWorker');
const ruleManager = new RuleManager(logger);
const siteManager = new SiteManager(ruleManager, logger);
const statsManager = new StatsManager(logger);
const filterUpdateManager = new FilterUpdateManager(logger);

// Initialize all managers on worker launch
async function initExtension(): Promise<void> {
  logger.info('Initializing Advanced AdBlocker background service worker...');
  await siteManager.initialize();
  await statsManager.initialize();
  await filterUpdateManager.initialize();

  const settings = siteManager.getSettings();
  logger.setDevMode(settings.devMode);

  // Sync initial DNR ruleset state
  await ruleManager.setGlobalProtection(settings.globalEnabled, settings.categorySettings);

  // Monitor blocked requests via DNR debug listener if available
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
    try {
      chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        if (!info || !info.request) return;
        const initiatorDomain = extractDomain(info.request.initiator || info.request.url);
        if (!initiatorDomain) return;

        // Categorize based on matched ruleset ID
        const rulesetId = info.rule?.rulesetId || '';
        let category: 'ads' | 'privacy' | 'annoyances' | 'malware' = 'ads';
        if (rulesetId.includes('privacy')) category = 'privacy';
        else if (rulesetId.includes('annoyances')) category = 'annoyances';
        else if (rulesetId.includes('malware')) category = 'malware';

        statsManager.recordNetworkBlock(initiatorDomain, category);

        if (info.request.tabId && info.request.tabId > 0) {
          statsManager.updateBadge(info.request.tabId, initiatorDomain);
        }
      });
      logger.info('DNR Rule matched listener registered');
    } catch {
      logger.debug('onRuleMatchedDebug only supported in unpacked developer mode');
    }
  }

  // Monitor active tab changes to refresh badge
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url) {
          const domain = extractDomain(tab.url);
          if (domain) {
            statsManager.updateBadge(activeInfo.tabId, domain);
          }
        }
      } catch {
        // Tab may have closed
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        const domain = extractDomain(tab.url);
        if (domain) {
          statsManager.updateBadge(tabId, domain);
        }
      }
    });
  }

  logger.info('Service worker initialization complete');
}

initExtension().catch(err => {
  logger.error('Service worker failed to initialize:', err);
});

// Central message handling router
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message: MessagePayload, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));

    // Keep message channel open for async response
    return true;
  });
}

async function handleMessage(message: MessagePayload, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'GET_SETTINGS':
      return siteManager.getSettings();

    case 'UPDATE_SETTINGS':
      return await siteManager.updateSettings(message.settings);

    case 'TOGGLE_SITE':
      return await siteManager.toggleSite(message.domain, message.enabled);

    case 'GET_PAGE_STATS': {
      const pageStats = statsManager.getPageStats(message.domain);
      const globalStats = statsManager.getGlobalStats();
      return { pageStats, globalStats };
    }

    case 'RECORD_COSMETIC_BLOCK': {
      statsManager.recordCosmeticBlock(message.domain, message.count);
      if (sender.tab && sender.tab.id) {
        statsManager.updateBadge(sender.tab.id, message.domain);
      }
      return { recorded: true };
    }

    case 'START_ELEMENT_PICKER': {
      // Find current active tab and execute element picker
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'START_ELEMENT_PICKER' });
        return { started: true };
      }
      throw new Error('No active tab found');
    }

    case 'ELEMENT_PICKED': {
      await siteManager.addCustomCosmeticRule(message.domain, message.selector);
      return { added: true };
    }

    case 'REMOVE_CUSTOM_RULE': {
      await siteManager.removeCustomCosmeticRule(message.domain, message.selector);
      return { removed: true };
    }

    case 'TRIGGER_FILTER_UPDATE': {
      const result = await filterUpdateManager.updateAllFilters();
      return { updated: result, lists: filterUpdateManager.getFilterLists() };
    }

    case 'GET_DEBUG_INFO': {
      const enabledRulesets = await ruleManager.getEnabledRulesetIds();
      return {
        enabledRulesets,
        settings: siteManager.getSettings(),
        globalStats: statsManager.getGlobalStats(),
        filterLists: filterUpdateManager.getFilterLists(),
      };
    }

    default:
      throw new Error(`Unhandled message type`);
  }
}

