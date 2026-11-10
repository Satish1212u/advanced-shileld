import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractDomain } from '../../extension/shared/utils';
import { RuleManager } from '../../extension/background/rule-manager';

describe('Site Whitelisting & Domain Extraction', () => {
  it('correctly extracts domains from various URL formats', () => {
    expect(extractDomain('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
    expect(extractDomain('http://subdomain.example.org:8080/path')).toBe('subdomain.example.org');
    expect(extractDomain('nytimes.com/section/technology')).toBe('nytimes.com');
    expect(extractDomain('https://localhost:3000')).toBe('localhost');
  });

  describe('RuleManager dynamic whitelist rules', () => {
    let ruleManager: RuleManager;
    let mockUpdateDynamicRules: any;
    let mockGetDynamicRules: any;

    beforeEach(() => {
      mockUpdateDynamicRules = vi.fn().mockResolvedValue(undefined);
      mockGetDynamicRules = vi.fn().mockResolvedValue([]);

      (global as any).chrome = {
        declarativeNetRequest: {
          updateDynamicRules: mockUpdateDynamicRules,
          getDynamicRules: mockGetDynamicRules,
          RuleActionType: {
            ALLOW_ALL_REQUESTS: 'allowAllRequests',
            ALLOW: 'allow',
            BLOCK: 'block',
          },
          ResourceType: {
            MAIN_FRAME: 'main_frame',
            SUB_FRAME: 'sub_frame',
          },
        },
      };

      ruleManager = new RuleManager();
    });

    it('creates an ALLOW_ALL_REQUESTS dynamic rule when a site is whitelisted', async () => {
      await ruleManager.setSiteWhitelisted('news.com', true);

      expect(mockUpdateDynamicRules).toHaveBeenCalled();
      const callArgs = mockUpdateDynamicRules.mock.calls[0][0];

      expect(callArgs.addRules.length).toBe(2);
      const frameRule = callArgs.addRules[0];
      expect(frameRule.action.type).toBe('allowAllRequests');
      expect(frameRule.condition.initiatorDomains).toEqual(['news.com']);
      expect(frameRule.priority).toBe(100);

      const subResourceRule = callArgs.addRules[1];
      expect(subResourceRule.action.type).toBe('allow');
      expect(subResourceRule.condition.initiatorDomains).toEqual(['news.com']);
      expect(subResourceRule.priority).toBe(100);
    });

    it('removes dynamic whitelist rule when protection is re-enabled', async () => {
      await ruleManager.setSiteWhitelisted('news.com', false);

      expect(mockUpdateDynamicRules).toHaveBeenCalled();
      const callArgs = mockUpdateDynamicRules.mock.calls[0][0];
      expect(callArgs.addRules.length).toBe(0);
    });
  });
});

