import { IntermediateRule } from '../extension/shared/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class RuleValidator {
  private static DANGEROUS_PATTERNS = [
    /^\*+$/,
    /^https?:\/\/$/,
    /^https?:\/\/\*+$/,
    /^\^$/,
    /^\.\*$/
  ];

  public static validate(rule: IntermediateRule): ValidationResult {
    const errors: string[] = [];

    if (!rule) {
      return { valid: false, errors: ['Rule is null or undefined'] };
    }

    if (rule.type === 'network') {
      this.validateNetworkRule(rule, errors);
    } else if (rule.type === 'cosmetic') {
      this.validateCosmeticRule(rule, errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static validateNetworkRule(rule: IntermediateRule, errors: string[]): void {
    const pattern = rule.urlPattern?.trim();
    if (!pattern) {
      errors.push('Network rule pattern cannot be empty');
      return;
    }

    // Check for dangerous / overly broad patterns
    for (const dangerous of this.DANGEROUS_PATTERNS) {
      if (dangerous.test(pattern)) {
        errors.push(`Pattern '${pattern}' is too broad and could block normal web traffic.`);
        break;
      }
    }

    // Validate domain characters if domains specified
    if (rule.domains) {
      for (const domain of rule.domains) {
        if (!this.isValidDomain(domain)) {
          errors.push(`Invalid domain filter '${domain}' in rule: ${rule.raw}`);
        }
      }
    }

    if (rule.excludedDomains) {
      for (const domain of rule.excludedDomains) {
        if (!this.isValidDomain(domain)) {
          errors.push(`Invalid excluded domain '${domain}' in rule: ${rule.raw}`);
        }
      }
    }
  }

  private static validateCosmeticRule(rule: IntermediateRule, errors: string[]): void {
    const selector = rule.selector?.trim();
    if (!selector) {
      errors.push('Cosmetic rule selector cannot be empty');
      return;
    }

    // Basic CSS syntax check: balanced parentheses, brackets, quotes
    if (!this.hasBalancedPairs(selector)) {
      errors.push(`Cosmetic selector has unbalanced quotes or brackets: ${selector}`);
    }

    // Ensure selector doesn't contain forbidden execution patterns
    if (selector.toLowerCase().includes('javascript:') || selector.includes('<script')) {
      errors.push(`Cosmetic selector contains dangerous script payload: ${selector}`);
    }
  }

  private static isValidDomain(domain: string): boolean {
    if (!domain || domain.length > 253) return false;
    // Allow wildcards like *.example.com or standard domain names
    const cleaned = domain.startsWith('*.') ? domain.substring(2) : domain;
    return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(cleaned) || cleaned === 'localhost';
  }

  private static hasBalancedPairs(str: string): boolean {
    const stack: string[] = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const prevChar = i > 0 ? str[i - 1] : '';

      if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (inSingleQuote || inDoubleQuote) continue;

      if (char === '[' || char === '(') {
        stack.push(char);
      } else if (char === ']') {
        if (stack.pop() !== '[') return false;
      } else if (char === ')') {
        if (stack.pop() !== '(') return false;
      }
    }

    return stack.length === 0 && !inSingleQuote && !inDoubleQuote;
  }
}

