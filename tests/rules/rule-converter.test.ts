import { describe, it, expect } from 'vitest';
import { RuleConverter } from '../../parser/rule-converter';
import { IntermediateRule } from '../../extension/shared/types';

describe('RuleConverter', () => {
  it('converts network block rule to Chrome DeclarativeNetRequest rule', () => {
    const intermediate: IntermediateRule = {
      id: 'rule-1',
      raw: '||adservice.com^$third-party,script',
      type: 'network',
      isException: false,
      action: 'block',
      urlPattern: '||adservice.com^',
      resourceTypes: ['script'],
      category: 'ads',
    };

    const dnr = RuleConverter.toDNRRule(intermediate, 1001);
    expect(dnr).toBeDefined();
    expect(dnr?.id).toBe(1001);
    expect(dnr?.action.type).toBe('block');
    expect(dnr?.condition.urlFilter).toBe('||adservice.com^');
    expect(dnr?.condition.domainType).toBe('thirdParty');
    expect(dnr?.condition.resourceTypes).toEqual(['script']);
    expect(dnr?.priority).toBe(1);
  });

  it('assigns high priority to allow/exception rules', () => {
    const intermediate: IntermediateRule = {
      id: 'rule-2',
      raw: '@@||allowed.com^',
      type: 'network',
      isException: true,
      action: 'allow',
      urlPattern: '||allowed.com^',
      category: 'ads',
    };

    const dnr = RuleConverter.toDNRRule(intermediate, 1002);
    expect(dnr?.action.type).toBe('allow');
    expect(dnr?.priority).toBe(10);
  });

  it('converts cosmetic rule to CosmeticRule format', () => {
    const intermediate: IntermediateRule = {
      id: 'cosmetic-1',
      raw: 'news.com##.sponsor-banner',
      type: 'cosmetic',
      isException: false,
      action: 'block',
      domains: ['news.com'],
      selector: '.sponsor-banner',
      category: 'ads',
    };

    const cosmetic = RuleConverter.toCosmeticRule(intermediate);
    expect(cosmetic).toBeDefined();
    expect(cosmetic?.selector).toBe('.sponsor-banner');
    expect(cosmetic?.domains).toEqual(['news.com']);
    expect(cosmetic?.hideStyle).toContain('display: none !important');
  });
});

