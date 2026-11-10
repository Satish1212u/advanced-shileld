import { DEFAULT_FILTER_LISTS, DYNAMIC_RULE_RANGES, STORAGE_KEYS } from '../shared/constants';
import { FilterListMetadata } from '../shared/types';
import { ExtensionLogger } from '../shared/utils';
import { EasyListParser } from '../../parser/easylist-parser';

export class FilterUpdateManager {
  private lists: FilterListMetadata[];
  private isUpdating = false;
  private logger: ExtensionLogger;

  constructor(logger?: ExtensionLogger) {
    this.logger = logger || new ExtensionLogger('FilterUpdateManager');
    this.lists = [...DEFAULT_FILTER_LISTS];
  }

  public async initialize(): Promise<void> {
    if (typeof chrome === 'undefined') return;

    try {
      if (chrome.storage) {
        const result = await chrome.storage.local.get([STORAGE_KEYS.RULES_META]);
        if (result[STORAGE_KEYS.RULES_META]) {
          this.lists = result[STORAGE_KEYS.RULES_META];
        } else {
          await this.saveMetadata();
        }
      }

      // Schedule periodic background alarm
      if (chrome.alarms) {
        chrome.alarms.create('check_filter_updates', {
          periodInMinutes: 1440, // 24 hours
        });

        chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'check_filter_updates') {
            this.updateAllFilters().catch(err => {
              this.logger.error('Background filter update failed:', err);
            });
          }
        });
      }

      this.logger.info('FilterUpdateManager initialized');
    } catch (err) {
      this.logger.error('Failed to initialize FilterUpdateManager:', err);
    }
  }

  public getFilterLists(): FilterListMetadata[] {
    return [...this.lists];
  }

  /**
   * Update all enabled filter lists atomically
   */
  public async updateAllFilters(): Promise<boolean> {
    if (this.isUpdating) {
      this.logger.warn('Filter update already in progress');
      return false;
    }

    this.isUpdating = true;
    this.logger.info('Starting filter updates check...');
    let overallSuccess = true;

    try {
      for (const list of this.lists) {
        if (!list.enabled) continue;

        try {
          await this.updateSingleFilter(list);
        } catch (err) {
          this.logger.error(`Failed to update filter ${list.name}:`, err);
          list.error = err instanceof Error ? err.message : String(err);
          overallSuccess = false;
        }
      }

      await this.saveMetadata();
    } finally {
      this.isUpdating = false;
    }

    return overallSuccess;
  }

  /**
   * Fetch, parse, validate, and atomically apply a filter list
   */
  private async updateSingleFilter(list: FilterListMetadata): Promise<void> {
    this.logger.info(`Fetching filter list: ${list.name} from ${list.url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let rawText = '';
    try {
      const response = await fetch(list.url, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      rawText = await response.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      throw new Error(`Download failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }

    if (!rawText || rawText.length < 50) {
      throw new Error('Downloaded filter list is empty or invalid');
    }

    // Parse and compile rules
    const parser = new EasyListParser(list.category);
    const result = parser.parseAndCompile(rawText, DYNAMIC_RULE_RANGES.UPDATED_START);

    // Strict validation requirement: must have generated valid rules and not be corrupted
    if (result.dnrRules.length === 0 && result.cosmeticRules.length === 0) {
      throw new Error('No valid rules could be compiled from filter source');
    }

    // Atomic update in Chrome DeclarativeNetRequest
    if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
      try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingUpdatedIds = existingRules
          .filter(r => r.id >= DYNAMIC_RULE_RANGES.UPDATED_START && r.id <= DYNAMIC_RULE_RANGES.UPDATED_MAX)
          .map(r => r.id);

        // Limit DNR rules to standard dynamic limit (e.g. 5,000 dynamic rules maximum allowed by Chrome)
        const dnrRulesToApply: chrome.declarativeNetRequest.Rule[] = result.dnrRules.slice(0, 4500).map(r => ({
          ...r,
          action: {
            type: r.action.type === 'allow'
              ? chrome.declarativeNetRequest.RuleActionType.ALLOW
              : chrome.declarativeNetRequest.RuleActionType.BLOCK,
          },
          condition: {
            ...r.condition,
            domainType: r.condition.domainType
              ? (r.condition.domainType === 'thirdParty'
                  ? chrome.declarativeNetRequest.DomainType.THIRD_PARTY
                  : chrome.declarativeNetRequest.DomainType.FIRST_PARTY)
              : undefined,
            resourceTypes: r.condition.resourceTypes as chrome.declarativeNetRequest.ResourceType[] | undefined,
          }
        }));

        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingUpdatedIds,
          addRules: dnrRulesToApply,
        });

        this.logger.info(`Atomically applied ${dnrRulesToApply.length} updated DNR rules for ${list.name}`);
      } catch (dnrErr) {
        // Rollback / Safe failure: do not overwrite metadata if DNR rejected rule update
        throw new Error(`DNR rejected updated rules: ${dnrErr instanceof Error ? dnrErr.message : String(dnrErr)}`);
      }
    }

    // Persist parsed dynamic cosmetic rules so content scripts can apply them
    if (result.cosmeticRules.length > 0 && typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const stored = await chrome.storage.local.get([STORAGE_KEYS.DYNAMIC_COSMETIC]);
        const existingCosmetic = stored[STORAGE_KEYS.DYNAMIC_COSMETIC] || {};
        existingCosmetic[list.id] = result.cosmeticRules.slice(0, 5000); // Guard max rules
        await chrome.storage.local.set({ [STORAGE_KEYS.DYNAMIC_COSMETIC]: existingCosmetic });
        this.logger.info(`Saved ${result.cosmeticRules.length} dynamic cosmetic rules for ${list.name}`);
      } catch (cosmeticErr) {
        this.logger.warn(`Could not save cosmetic rules for ${list.name}:`, cosmeticErr);
      }
    }

    // Update list metadata on verified success
    list.lastUpdated = Date.now();
    list.ruleCount = result.dnrRules.length + result.cosmeticRules.length;
    list.error = undefined;
    list.version = new Date().toISOString().split('T')[0];
  }

  private async saveMetadata(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.RULES_META]: this.lists,
      });
    } catch (err) {
      this.logger.error('Failed to save rules metadata:', err);
    }
  }
}
