import { CosmeticRule, IntermediateRule, ResourceType } from '../extension/shared/types';

export interface ChromeDNRRule {
  id: number;
  priority: number;
  action: {
    type: 'block' | 'allow' | 'upgradeScheme';
  };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    isUrlFilterCaseSensitive?: boolean;
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
    requestDomains?: string[];
    excludedRequestDomains?: string[];
    resourceTypes?: ResourceType[];
    domainType?: 'firstParty' | 'thirdParty';
  };
}

export class RuleConverter {
  /**
   * Convert an IntermediateRule to a Chrome Declarative Net Request (DNR) rule
   */
  public static toDNRRule(rule: IntermediateRule, numericId: number): ChromeDNRRule | null {
    if (rule.type !== 'network' || !rule.urlPattern) {
      return null;
    }

    // Determine priority
    let priority = 1;
    if (rule.isException) {
      priority = 10; // Exception / Allow rules override block rules
    } else if (rule.important) {
      priority = 5;
    } else if (rule.domains && rule.domains.length > 0) {
      priority = 2; // Domain-scoped rules have higher specificity than global rules
    }

    // Parse options from raw if third-party is present
    let domainType: 'firstParty' | 'thirdParty' | undefined;
    if (rule.raw.includes('third-party') && !rule.raw.includes('~third-party')) {
      domainType = 'thirdParty';
    } else if (rule.raw.includes('~third-party')) {
      domainType = 'firstParty';
    }

    const dnrRule: ChromeDNRRule = {
      id: numericId,
      priority,
      action: {
        type: rule.isException ? 'allow' : 'block',
      },
      condition: {
        urlFilter: rule.urlPattern,
        domainType,
        initiatorDomains: rule.domains && rule.domains.length > 0 ? rule.domains : undefined,
        excludedInitiatorDomains: rule.excludedDomains && rule.excludedDomains.length > 0 ? rule.excludedDomains : undefined,
        resourceTypes: rule.resourceTypes && rule.resourceTypes.length > 0 ? rule.resourceTypes : undefined,
        isUrlFilterCaseSensitive: rule.raw.includes('match-case'),
      },
    };

    return dnrRule;
  }

  /**
   * Convert an IntermediateRule to a CosmeticRule
   */
  public static toCosmeticRule(rule: IntermediateRule): CosmeticRule | null {
    if (rule.type !== 'cosmetic' || !rule.selector) {
      return null;
    }

    return {
      id: rule.id,
      selector: rule.selector,
      domains: rule.domains,
      excludedDomains: rule.excludedDomains,
      isException: rule.isException,
      category: rule.category,
      hideStyle: 'display: none !important; height: 0 !important; min-height: 0 !important; visibility: hidden !important;',
    };
  }
}

