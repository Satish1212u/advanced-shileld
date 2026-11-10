import { DYNAMIC_RULE_RANGES, RULESET_IDS } from '../shared/constants';
import { RuleCategory } from '../shared/types';
import { ExtensionLogger } from '../shared/utils';

export class RuleManager {
  private logger: ExtensionLogger;

  constructor(logger?: ExtensionLogger) {
    this.logger = logger || new ExtensionLogger('RuleManager');
  }

  /**
   * Check if DeclarativeNetRequest API is available in current context
   */
  private isDnrAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.declarativeNetRequest;
  }

  /**
   * Enable a static ruleset by ID (e.g. 'rules_ads', 'rules_privacy')
   */
  public async enableRuleset(rulesetId: string): Promise<void> {
    if (!this.isDnrAvailable()) {
      this.logger.warn('DNR not available; skipping enableRuleset', rulesetId);
      return;
    }

    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [rulesetId],
      });
      this.logger.debug(`Ruleset enabled: ${rulesetId}`);
    } catch (err) {
      this.logger.error(`Failed to enable ruleset ${rulesetId}:`, err);
    }
  }

  /**
   * Disable a static ruleset by ID
   */
  public async disableRuleset(rulesetId: string): Promise<void> {
    if (!this.isDnrAvailable()) return;

    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: [rulesetId],
      });
      this.logger.debug(`Ruleset disabled: ${rulesetId}`);
    } catch (err) {
      this.logger.error(`Failed to disable ruleset ${rulesetId}:`, err);
    }
  }

  /**
   * Update category rulesets based on enabled state
   */
  public async setCategoryEnabled(category: RuleCategory, enabled: boolean): Promise<void> {
    const rulesetId = RULESET_IDS[category];
    if (!rulesetId) return;

    if (enabled) {
      await this.enableRuleset(rulesetId);
    } else {
      await this.disableRuleset(rulesetId);
    }
  }

  /**
   * Toggle global protection
   */
  public async setGlobalProtection(enabled: boolean, categorySettings: Record<RuleCategory, boolean>): Promise<void> {
    if (!this.isDnrAvailable()) return;

    const enableIds: string[] = [];
    const disableIds: string[] = [];

    for (const [cat, rulesetId] of Object.entries(RULESET_IDS)) {
      const isCatEnabled = enabled && !!categorySettings[cat as RuleCategory];
      if (isCatEnabled) {
        enableIds.push(rulesetId);
      } else {
        disableIds.push(rulesetId);
      }
    }

    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enableIds,
        disableRulesetIds: disableIds,
      });
      this.logger.info(`Updated rulesets for global state ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (err) {
      this.logger.error('Failed to update enabled rulesets:', err);
    }
  }

  /**
   * Add or remove a site-level bypass/whitelist rule.
   * If whitelisted (protection disabled on domain), an 'allowAllRequests' or 'allow' rule is added.
   */
  public async setSiteWhitelisted(domain: string, isWhitelisted: boolean): Promise<void> {
    if (!this.isDnrAvailable() || !domain) return;

    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const baseRuleId = this.generateSiteRuleId(domain);
      const subRuleId = baseRuleId + 1;

      const removeRuleIds = existingRules
        .filter(r => r.id === baseRuleId || r.id === subRuleId)
        .map(r => r.id);

      const addRules: chrome.declarativeNetRequest.Rule[] = [];

      if (isWhitelisted) {
        // 1. allowAllRequests rule for document and subframe requests initiated by this site
        addRules.push({
          id: baseRuleId,
          priority: 100,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS,
          },
          condition: {
            initiatorDomains: [domain],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            ],
          },
        });

        // 2. High-priority allow rule for all sub-resources (scripts, xhr, images) initiated by whitelisted site
        addRules.push({
          id: subRuleId,
          priority: 100,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.ALLOW,
          },
          condition: {
            initiatorDomains: [domain],
          },
        });
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules,
      });

      this.logger.info(`Site whitelist updated for ${domain}: ${isWhitelisted ? 'Whitelisted' : 'Protected'}`);
    } catch (err) {
      this.logger.error(`Error updating site whitelist for ${domain}:`, err);
    }
  }

  /**
   * Apply user custom network blocking rules as dynamic rules
   */
  public async applyCustomRules(customRulePatterns: string[]): Promise<void> {
    if (!this.isDnrAvailable()) return;

    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingCustomIds = existingRules
        .filter(r => r.id >= DYNAMIC_RULE_RANGES.CUSTOM_START && r.id <= DYNAMIC_RULE_RANGES.CUSTOM_MAX)
        .map(r => r.id);

      const newRules: chrome.declarativeNetRequest.Rule[] = [];
      let currentId = DYNAMIC_RULE_RANGES.CUSTOM_START;

      for (const pattern of customRulePatterns) {
        if (!pattern.trim() || currentId > DYNAMIC_RULE_RANGES.CUSTOM_MAX) break;

        const isAllow = pattern.startsWith('@@');
        const cleanPattern = isAllow ? pattern.substring(2) : pattern;

        newRules.push({
          id: currentId++,
          priority: isAllow ? 50 : 20,
          action: {
            type: isAllow
              ? chrome.declarativeNetRequest.RuleActionType.ALLOW
              : chrome.declarativeNetRequest.RuleActionType.BLOCK,
          },
          condition: {
            urlFilter: cleanPattern,
          },
        });
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingCustomIds,
        addRules: newRules,
      });

      this.logger.info(`Applied ${newRules.length} custom user dynamic rules`);
    } catch (err) {
      this.logger.error('Failed to apply custom dynamic rules:', err);
    }
  }

  /**
   * Get all currently active static ruleset IDs
   */
  public async getEnabledRulesetIds(): Promise<string[]> {
    if (!this.isDnrAvailable()) return [];
    try {
      return await chrome.declarativeNetRequest.getEnabledRulesets();
    } catch (err) {
      this.logger.error('Failed to get enabled rulesets:', err);
      return [];
    }
  }

  /**
   * Deterministic ID generation for site domain whitelist rules
   */
  private generateSiteRuleId(domain: string): number {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = (hash << 5) - hash + domain.charCodeAt(i);
      hash |= 0;
    }
    const range = DYNAMIC_RULE_RANGES.WHITELIST_MAX - DYNAMIC_RULE_RANGES.WHITELIST_START;
    return DYNAMIC_RULE_RANGES.WHITELIST_START + (Math.abs(hash) % range);
  }
}

