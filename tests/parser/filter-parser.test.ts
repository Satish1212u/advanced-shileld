import { describe, it, expect } from 'vitest';
import { FilterParser } from '../../parser/filter-parser';

describe('FilterParser', () => {
  const parser = new FilterParser('ads');

  it('correctly handles comments and blank lines', () => {
    const res1 = parser.parseLine('! This is a comment');
    expect(res1.rule?.type).toBe('comment');

    const res2 = parser.parseLine('[Adblock Plus 2.0]');
    expect(res2.rule?.type).toBe('comment');

    const res3 = parser.parseLine('   ');
    expect(res3.rule?.type).toBe('comment');
  });

  it('correctly parses network blocking rules with options', () => {
    const line = '||adserver.com^$third-party,script,image';
    const res = parser.parseLine(line);

    expect(res.rule).toBeDefined();
    expect(res.rule?.type).toBe('network');
    expect(res.rule?.isException).toBe(false);
    expect(res.rule?.urlPattern).toBe('||adserver.com^');
    expect(res.rule?.resourceTypes).toContain('script');
    expect(res.rule?.resourceTypes).toContain('image');
  });

  it('correctly parses allow/exception rules', () => {
    const line = '@@||legit-ad.com^$image';
    const res = parser.parseLine(line);

    expect(res.rule).toBeDefined();
    expect(res.rule?.type).toBe('network');
    expect(res.rule?.isException).toBe(true);
    expect(res.rule?.action).toBe('allow');
    expect(res.rule?.urlPattern).toBe('||legit-ad.com^');
  });

  it('correctly parses cosmetic element hiding rules', () => {
    const line = 'example.com##.ad-banner';
    const res = parser.parseLine(line);

    expect(res.rule).toBeDefined();
    expect(res.rule?.type).toBe('cosmetic');
    expect(res.rule?.domains).toEqual(['example.com']);
    expect(res.rule?.selector).toBe('.ad-banner');
    expect(res.rule?.isException).toBe(false);
  });

  it('correctly parses cosmetic exception rules', () => {
    const line = 'example.com#@#.ad-banner';
    const res = parser.parseLine(line);

    expect(res.rule).toBeDefined();
    expect(res.rule?.type).toBe('cosmetic');
    expect(res.rule?.domains).toEqual(['example.com']);
    expect(res.rule?.selector).toBe('.ad-banner');
    expect(res.rule?.isException).toBe(true);
  });

  it('safely rejects unsupported procedural scriptlet rules', () => {
    const line = 'example.com##+js(set, test, true)';
    const res = parser.parseLine(line);

    expect(res.rule).toBeUndefined();
    expect(res.unsupportedReason).toBeDefined();
    expect(res.unsupportedReason).toContain('Procedural scriptlet');
  });

  it('parses full filter list text block', () => {
    const text = `
      ! Sample List
      ||doubleclick.net^$third-party
      @@||google.com^
      ##.ad-container
      example.com##.sponsor
    `;

    const { rules, unsupported } = parser.parseFilterList(text);
    expect(rules.length).toBe(4);
    expect(unsupported.length).toBe(0);
  });
});

