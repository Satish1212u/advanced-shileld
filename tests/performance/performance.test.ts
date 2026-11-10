import { describe, it, expect } from 'vitest';
import { FilterParser } from '../../parser/filter-parser';
import { RuleValidator } from '../../parser/rule-validator';

describe('Performance Benchmarks', () => {
  it('parses and validates 1,000 filter rules in under 150ms', () => {
    const parser = new FilterParser('ads');

    // Generate 1,000 realistic ad/privacy filter rules
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
      lines.push(`||adserver${i}.network.com^$third-party,script,image`);
      lines.push(`site${i}.com##.ad-banner-${i}`);
    }
    const filterBlock = lines.join('\n');

    const start = performance.now();
    const { rules } = parser.parseFilterList(filterBlock);

    for (const rule of rules) {
      RuleValidator.validate(rule);
    }
    const elapsed = performance.now() - start;

    expect(rules.length).toBe(1000);
    expect(elapsed).toBeLessThan(150);
  });
});

