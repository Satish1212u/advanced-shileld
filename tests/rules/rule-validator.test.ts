import { describe, it, expect } from 'vitest';
import { RuleValidator } from '../../parser/rule-validator';
import { IntermediateRule } from '../../extension/shared/types';

describe('RuleValidator', () => {
  it('flags dangerous overly broad patterns like * or http* as invalid', () => {
    const dangerousRule: IntermediateRule = {
      id: 'bad-1',
      raw: '*',
      type: 'network',
      isException: false,
      action: 'block',
      urlPattern: '*',
      category: 'ads',
    };

    const res = RuleValidator.validate(dangerousRule);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('too broad');
  });

  it('validates safe domain and pattern network rules', () => {
    const safeRule: IntermediateRule = {
      id: 'good-1',
      raw: '||adserver.com^',
      type: 'network',
      isException: false,
      action: 'block',
      urlPattern: '||adserver.com^',
      domains: ['valid-site.com'],
      category: 'ads',
    };

    const res = RuleValidator.validate(safeRule);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('rejects cosmetic rules with unbalanced brackets or dangerous scripts', () => {
    const badCosmetic: IntermediateRule = {
      id: 'bad-cos-1',
      raw: 'example.com##div[data-ad="test',
      type: 'cosmetic',
      isException: false,
      action: 'block',
      selector: 'div[data-ad="test',
      category: 'ads',
    };

    const res = RuleValidator.validate(badCosmetic);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('unbalanced');
  });
});

