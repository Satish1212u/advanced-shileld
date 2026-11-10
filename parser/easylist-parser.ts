import { FilterParser } from './filter-parser';
import { RuleValidator } from './rule-validator';
import { RuleConverter, ChromeDNRRule } from './rule-converter';
import { CosmeticRule, RuleCategory } from '../extension/shared/types';

export interface CompilationResult {
  category: RuleCategory;
  dnrRules: ChromeDNRRule[];
  cosmeticRules: CosmeticRule[];
  invalidRulesCount: number;
  unsupportedRulesCount: number;
  totalParsed: number;
}

export class EasyListParser {
  private parser: FilterParser;
  private category: RuleCategory;

  constructor(category: RuleCategory = 'ads') {
    this.category = category;
    this.parser = new FilterParser(category);
  }

  public parseAndCompile(rawContent: string, baseIdOffset: number = 1): CompilationResult {
    const { rules, unsupported } = this.parser.parseFilterList(rawContent);
    const dnrRules: ChromeDNRRule[] = [];
    const cosmeticRules: CosmeticRule[] = [];
    let invalidCount = 0;
    let currentId = baseIdOffset;

    for (const rule of rules) {
      const validation = RuleValidator.validate(rule);
      if (!validation.valid) {
        invalidCount++;
        continue;
      }

      if (rule.type === 'network') {
        const dnr = RuleConverter.toDNRRule(rule, currentId++);
        if (dnr) {
          dnrRules.push(dnr);
        }
      } else if (rule.type === 'cosmetic') {
        const cosmetic = RuleConverter.toCosmeticRule(rule);
        if (cosmetic) {
          cosmeticRules.push(cosmetic);
        }
      }
    }

    return {
      category: this.category,
      dnrRules,
      cosmeticRules,
      invalidRulesCount: invalidCount,
      unsupportedRulesCount: unsupported.length,
      totalParsed: rules.length,
    };
  }
}

