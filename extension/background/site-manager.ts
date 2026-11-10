import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { ExtensionSettings, SiteSetting } from '../shared/types';
import { ExtensionLogger } from '../shared/utils';
import { RuleManager } from './rule-manager';

export class SiteManager {
  private settings: ExtensionSettings;
  private ruleManager: RuleManager;
  private logger: ExtensionLogger;

  constructor(ruleManager: RuleManager, logger?: ExtensionLogger) {
    this.ruleManager = ruleManager;
    this.logger = logger || new ExtensionLogger('SiteManager');
    this.settings = { ...DEFAULT_SETTINGS };
  }

  public async initialize(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      this.logger.warn('chrome.storage not available, using in-memory defaults');
      return;
    }

    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
      if (result[STORAGE_KEYS.SETTINGS]) {
        this.settings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
      } else {
        await this.saveSettings();
      }
      this.logger.info('Settings initialized');
    } catch (err) {
      this.logger.error('Failed to load settings from storage:', err);
    }
  }

  public getSettings(): ExtensionSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();

    // Sync DNR rulesets if global or category settings changed
    if (newSettings.globalEnabled !== undefined || newSettings.categorySettings !== undefined) {
      await this.ruleManager.setGlobalProtection(
        this.settings.globalEnabled,
        this.settings.categorySettings
      );
    }

    // Sync custom rules if updated
    if (newSettings.customRules !== undefined) {
      await this.ruleManager.applyCustomRules(this.settings.customRules);
    }

    return this.settings;
  }

  public isSiteEnabled(domain: string): boolean {
    if (!this.settings.globalEnabled) return false;
    const siteSetting = this.settings.siteSettings[domain];
    if (siteSetting !== undefined) {
      return siteSetting.enabled;
    }
    return true; // Default enabled
  }

  public async toggleSite(domain: string, enabled: boolean): Promise<SiteSetting> {
    const existing = this.settings.siteSettings[domain] || {
      domain,
      enabled: true,
      customCosmeticRules: [],
    };

    const updated: SiteSetting = {
      ...existing,
      enabled,
      whitelistNetwork: !enabled,
      whitelistCosmetic: !enabled,
    };

    this.settings.siteSettings[domain] = updated;
    await this.saveSettings();

    // Whitelist in DNR if enabled is false (protection OFF for this site)
    await this.ruleManager.setSiteWhitelisted(domain, !enabled);

    return updated;
  }

  public async addCustomCosmeticRule(domain: string, selector: string): Promise<void> {
    const site = this.settings.siteSettings[domain] || {
      domain,
      enabled: true,
      customCosmeticRules: [],
    };

    const rules = site.customCosmeticRules || [];
    if (!rules.includes(selector)) {
      rules.push(selector);
      site.customCosmeticRules = rules;
      this.settings.siteSettings[domain] = site;
      await this.saveSettings();
    }
  }

  public async removeCustomCosmeticRule(domain: string, selector: string): Promise<void> {
    const site = this.settings.siteSettings[domain];
    if (site && site.customCosmeticRules) {
      site.customCosmeticRules = site.customCosmeticRules.filter(r => r !== selector);
      this.settings.siteSettings[domain] = site;
      await this.saveSettings();
    }
  }

  private async saveSettings(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: this.settings,
      });
    } catch (err) {
      this.logger.error('Failed to save settings:', err);
    }
  }
}

