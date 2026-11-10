import { IntermediateRule, ResourceType, RuleCategory } from '../extension/shared/types';

// Map Adblock Plus resource type options to standard DNR resource types
const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  script: 'script',
  image: 'image',
  imageset: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  font: 'font',
  object: 'object',
  object_subrequest: 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  sub_frame: 'sub_frame',
  ping: 'ping',
  websocket: 'websocket',
  media: 'media',
  other: 'other',
};

export interface ParseResult {
  rule?: IntermediateRule;
  unsupportedReason?: string;
}

export class FilterParser {
  private category: RuleCategory;

  constructor(category: RuleCategory = 'ads') {
    this.category = category;
  }

  /**
   * Parse a single line from an Adblock / EasyList filter file.
   */
  public parseLine(line: string, index: number = 0): ParseResult {
    const trimmed = line.trim();

    // 1. Comments and Empty lines
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[Adblock')) {
      return {
        rule: {
          id: `comment-${index}`,
          raw: trimmed,
          type: 'comment',
          isException: false,
          action: 'allow',
          category: this.category,
          comment: trimmed,
        },
      };
    }

    // 2. Cosmetic Rules (## or #@#)
    if (trimmed.includes('##') || trimmed.includes('#@#')) {
      return this.parseCosmeticRule(trimmed, index);
    }

    // 3. Network Rules
    return this.parseNetworkRule(trimmed, index);
  }

  /**
   * Parse cosmetic element-hiding rule
   */
  private parseCosmeticRule(line: string, index: number): ParseResult {
    const isException = line.includes('#@#');
    const separator = isException ? '#@#' : '##';
    const parts = line.split(separator);

    if (parts.length !== 2) {
      return { unsupportedReason: `Malformed cosmetic separator count: ${line}` };
    }

    const domainPart = parts[0].trim();
    const selectorPart = parts[1].trim();

    // Skip advanced uBlock procedural cosmetics like :has-text, +js, :xpath for basic CSS engine safety
    if (selectorPart.startsWith('+js(') || selectorPart.includes(':xpath(')) {
      return { unsupportedReason: `Procedural scriptlet/xpath cosmetic rule unsupported: ${line}` };
    }

    let domains: string[] | undefined;
    let excludedDomains: string[] | undefined;

    if (domainPart) {
      const splitDomains = domainPart.split(',');
      domains = [];
      excludedDomains = [];
      for (const d of splitDomains) {
        const dTrim = d.trim();
        if (dTrim.startsWith('~')) {
          excludedDomains.push(dTrim.substring(1));
        } else if (dTrim) {
          domains.push(dTrim);
        }
      }
      if (domains.length === 0) domains = undefined;
      if (excludedDomains.length === 0) excludedDomains = undefined;
    }

    return {
      rule: {
        id: `cosmetic-${this.category}-${index}`,
        raw: line,
        type: 'cosmetic',
        isException,
        action: isException ? 'allow' : 'block',
        domains,
        excludedDomains,
        selector: selectorPart,
        category: this.category,
      },
    };
  }

  /**
   * Parse network rule (e.g. ||ad.doubleclick.net^$third-party,script)
   */
  private parseNetworkRule(line: string, index: number): ParseResult {
    let ruleStr = line;
    let isException = false;

    // Check for allow rule @@
    if (ruleStr.startsWith('@@')) {
      isException = true;
      ruleStr = ruleStr.substring(2);
    }

    // Split options suffix ($option1,option2)
    let optionsStr = '';
    const dollarIndex = ruleStr.lastIndexOf('$');
    if (dollarIndex !== -1 && !ruleStr.includes('/', dollarIndex)) {
      optionsStr = ruleStr.substring(dollarIndex + 1);
      ruleStr = ruleStr.substring(0, dollarIndex);
    }

    // Parse options
    const resourceTypes: ResourceType[] = [];
    let domains: string[] | undefined;
    let excludedDomains: string[] | undefined;
    let important = false;

    if (optionsStr) {
      const options = optionsStr.split(',');
      for (const opt of options) {
        const trimmedOpt = opt.trim();
        if (!trimmedOpt) continue;

        if (trimmedOpt === 'important') {
          important = true;
          continue;
        }

        if (trimmedOpt.startsWith('domain=')) {
          const domList = trimmedOpt.substring(7).split('|');
          domains = [];
          excludedDomains = [];
          for (const d of domList) {
            const dTrim = d.trim();
            if (dTrim.startsWith('~')) {
              excludedDomains.push(dTrim.substring(1));
            } else if (dTrim) {
              domains.push(dTrim);
            }
          }
          if (domains.length === 0) domains = undefined;
          if (excludedDomains.length === 0) excludedDomains = undefined;
          continue;
        }

        // Check resource type options
        const mappedType = RESOURCE_TYPE_MAP[trimmedOpt.toLowerCase()];
        if (mappedType) {
          if (!resourceTypes.includes(mappedType)) {
            resourceTypes.push(mappedType);
          }
          continue;
        }

        // If an option starts with ~, check if it's an excluded resource or generic option
        if (trimmedOpt === 'third-party' || trimmedOpt === '~third-party' || trimmedOpt === 'match-case') {
          // Handled during DNR conversion
          continue;
        }

        // Unsupported options (like badfilter, cname, redirect)
        // We log and safely ignore unknown options while still blocking the network request if valid
      }
    }

    return {
      rule: {
        id: `network-${this.category}-${index}`,
        raw: line,
        type: 'network',
        isException,
        action: isException ? 'allow' : 'block',
        urlPattern: ruleStr,
        domains,
        excludedDomains,
        resourceTypes: resourceTypes.length > 0 ? resourceTypes : undefined,
        important,
        category: this.category,
      },
    };
  }

  /**
   * Parse a full filter list text buffer into IntermediateRules
   */
  public parseFilterList(content: string): { rules: IntermediateRule[]; unsupported: string[] } {
    const lines = content.split(/\r?\n/);
    const rules: IntermediateRule[] = [];
    const unsupported: string[] = [];

    lines.forEach((line, index) => {
      const result = this.parseLine(line, index);
      if (result.rule) {
        if (result.rule.type !== 'comment') {
          rules.push(result.rule);
        }
      } else if (result.unsupportedReason) {
        unsupported.push(result.unsupportedReason);
      }
    });

    return { rules, unsupported };
  }
}

