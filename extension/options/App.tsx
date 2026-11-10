import React, { useEffect, useState } from 'react';
import {
  Shield,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Globe,
  Tv,
  FileCode,
  Terminal
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { ExtensionSettings, FilterListMetadata, RuleCategory } from '../shared/types';
import { extractDomain } from '../shared/utils';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'youtube' | 'whitelist' | 'custom' | 'filters' | 'debug'>('categories');
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [filterLists, setFilterLists] = useState<FilterListMetadata[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [newWhitelistDomain, setNewWhitelistDomain] = useState('');
  const [newCustomRule, setNewCustomRule] = useState('');
  const [isUpdatingFilters, setIsUpdatingFilters] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (res && res.success) {
          setSettings(res.data);
        }
        const debugRes = await chrome.runtime.sendMessage({ type: 'GET_DEBUG_INFO' });
        if (debugRes && debugRes.success) {
          setDebugInfo(debugRes.data);
          setFilterLists(debugRes.data.filterLists || []);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
  };

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const updateSettingCategory = async (cat: RuleCategory, val: boolean) => {
    const updatedCategories = {
      ...settings.categorySettings,
      [cat]: val,
    };
    const newSettings = { ...settings, categorySettings: updatedCategories };
    setSettings(newSettings);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { categorySettings: updatedCategories },
      });
      notify(`Updated ${cat} protection status`);
    }
  };

  const updateYouTubeSetting = async (key: keyof ExtensionSettings['youtubeSettings'], val: boolean) => {
    const updatedYT = {
      ...settings.youtubeSettings,
      [key]: val,
    };
    const newSettings = { ...settings, youtubeSettings: updatedYT };
    setSettings(newSettings);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { youtubeSettings: updatedYT },
      });
      notify('Updated YouTube preferences');
    }
  };

  const addWhitelistedDomain = async () => {
    const clean = extractDomain(newWhitelistDomain);
    if (!clean) {
      notify('Please enter a valid domain (e.g. example.com)', 'error');
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        domain: clean,
        enabled: false, // Whitelist = protection OFF
      });
      setNewWhitelistDomain('');
      await loadSettings();
      notify(`Added ${clean} to whitelist`);
    }
  };

  const removeWhitelistedDomain = async (domain: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        domain,
        enabled: true, // Protection ON
      });
      await loadSettings();
      notify(`Removed ${domain} from whitelist`);
    }
  };

  const addCustomRule = async () => {
    const rule = newCustomRule.trim();
    if (!rule) return;

    const updatedRules = [...(settings.customRules || []), rule];
    setSettings({ ...settings, customRules: updatedRules });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { customRules: updatedRules },
      });
      setNewCustomRule('');
      notify('Custom rule added');
    }
  };

  const removeCustomRule = async (index: number) => {
    const updatedRules = (settings.customRules || []).filter((_, i) => i !== index);
    setSettings({ ...settings, customRules: updatedRules });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { customRules: updatedRules },
      });
      notify('Custom rule removed');
    }
  };

  const triggerFilterUpdate = async () => {
    setIsUpdatingFilters(true);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'TRIGGER_FILTER_UPDATE' });
        if (res && res.success) {
          notify('Filter lists successfully updated!');
          await loadSettings();
        } else {
          notify('Filter list update encountered errors', 'error');
        }
      } catch (e) {
        notify('Network error updating filter lists', 'error');
      } finally {
        setIsUpdatingFilters(false);
      }
    } else {
      setIsUpdatingFilters(false);
    }
  };

  const whitelistedSites = Object.values(settings.siteSettings).filter(s => !s.enabled);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <header className="flex items-center justify-between pb-6 mb-8 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Advanced Shield Settings</h1>
            <p className="text-sm text-zinc-400">DeclarativeNetRequest Ad Blocker & Privacy Engine</p>
          </div>
        </div>

        {statusMessage && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            statusMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-red-950/80 text-red-400 border border-red-800'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav className="flex space-x-1 border-b border-zinc-800 mb-8 pb-px">
        {[
          { id: 'categories', label: 'Protection Layers', icon: Sliders },
          { id: 'youtube', label: 'YouTube Engine', icon: Tv },
          { id: 'whitelist', label: 'Whitelisted Sites', icon: Globe },
          { id: 'custom', label: 'Custom Rules', icon: FileCode },
          { id: 'filters', label: 'Filter Lists', icon: RefreshCw },
          { id: 'debug', label: 'Diagnostics', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-zinc-900/40'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab 1: Protection Layers */}
      {activeTab === 'categories' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-200 mb-1">Filter Categories</h2>
            <p className="text-xs text-zinc-400 mb-6">Manage separate network and cosmetic filtering layers.</p>

            <div className="space-y-4">
              {[
                { id: 'ads', title: 'Advertising Requests & Banners', desc: 'Blocks banner ads, video ad networks, and popups' },
                { id: 'privacy', title: 'Trackers & Behavioral Telemetry', desc: 'Blocks analytics scripts, third-party cookies, and fingerprinting' },
                { id: 'annoyances', title: 'Annoyances & Overlays', desc: 'Hides push notification prompts and floating overlays' },
                { id: 'malware', title: 'Dangerous & Phishing Domains', desc: 'Blocks requests to recognized malware and cryptomining hosts' },
              ].map((cat) => {
                const isEnabled = !!settings.categorySettings[cat.id as RuleCategory];
                return (
                  <div key={cat.id} className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">{cat.title}</h3>
                      <p className="text-xs text-zinc-500">{cat.desc}</p>
                    </div>
                    <button
                      onClick={() => updateSettingCategory(cat.id as RuleCategory, !isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? 'bg-blue-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: YouTube Engine */}
      {activeTab === 'youtube' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Tv className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-semibold text-zinc-200">YouTube Experience Enhancement</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-6">
              Tailored event-driven ad suppression engineered for YouTube's SPA architecture. Never degrades stream fidelity or interferes with DRM.
            </p>

            <div className="space-y-4">
              {[
                { key: 'blockVideoAds', title: 'Video Ad Suppression', desc: 'Fast-forwards unskippable prerolls and auto-clicks skip buttons' },
                { key: 'hideBanners', title: 'Hide In-Video Banners & Overlays', desc: 'Removes lower-third banners, companion ads, and teaser cards' },
                { key: 'hidePromotedPosts', title: 'Hide Feed Promoted Videos', desc: 'Removes sponsored search results and feed promotions' },
                { key: 'hideEndCards', title: 'Suppress End-Screen Video Overlays', desc: 'Prevents video suggestion cards from blocking the video end' },
              ].map((opt) => {
                const isChecked = !!settings.youtubeSettings[opt.key as keyof ExtensionSettings['youtubeSettings']];
                return (
                  <div key={opt.key} className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">{opt.title}</h3>
                      <p className="text-xs text-zinc-500">{opt.desc}</p>
                    </div>
                    <button
                      onClick={() => updateYouTubeSetting(opt.key as keyof ExtensionSettings['youtubeSettings'], !isChecked)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isChecked ? 'bg-blue-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isChecked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Whitelist */}
      {activeTab === 'whitelist' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-200 mb-1">Whitelisted Websites</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Websites in this list will bypass both network filtering and cosmetic element hiding.
            </p>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="e.g. news-site.com"
                value={newWhitelistDomain}
                onChange={(e) => setNewWhitelistDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWhitelistedDomain()}
                className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={addWhitelistedDomain}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Whitelist</span>
              </button>
            </div>

            {whitelistedSites.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-4 text-center">No sites currently whitelisted.</p>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {whitelistedSites.map((site) => (
                  <div key={site.domain} className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-mono text-zinc-300">{site.domain}</span>
                    <button
                      onClick={() => removeWhitelistedDomain(site.domain)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                      title="Remove from whitelist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 4: Custom Rules */}
      {activeTab === 'custom' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-200 mb-1">Custom User Rules</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Add custom URL filters (e.g. <code className="text-blue-400">||adserver.net^</code> or <code className="text-blue-400">@@||partner.com^</code>).
            </p>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="||custom-tracker.com^"
                value={newCustomRule}
                onChange={(e) => setNewCustomRule(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomRule()}
                className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={addCustomRule}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Rule</span>
              </button>
            </div>

            {(!settings.customRules || settings.customRules.length === 0) ? (
              <p className="text-xs text-zinc-500 italic py-4 text-center">No custom rules added yet.</p>
            ) : (
              <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
                {settings.customRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-xs font-mono text-zinc-300">{rule}</span>
                    <button
                      onClick={() => removeCustomRule(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 5: Filter Lists */}
      {activeTab === 'filters' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-200">Installed Filter Feeds</h2>
                <p className="text-xs text-zinc-400">Automatic updates and integrity checking via DeclarativeNetRequest.</p>
              </div>

              <button
                onClick={triggerFilterUpdate}
                disabled={isUpdatingFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingFilters ? 'animate-spin' : ''}`} />
                <span>{isUpdatingFilters ? 'Updating...' : 'Check for Updates'}</span>
              </button>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {filterLists.map((list) => (
                <div key={list.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-medium text-zinc-200">{list.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-mono">
                      <span>Version: {list.version}</span>
                      <span>•</span>
                      <span>Rules: {list.ruleCount}</span>
                      <span>•</span>
                      <span>Last checked: {new Date(list.lastUpdated).toLocaleDateString()}</span>
                    </div>
                    {list.error && <p className="text-[11px] text-red-400 mt-1">{list.error}</p>}
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    list.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {list.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tab 6: Diagnostics */}
      {activeTab === 'debug' && (
        <section className="space-y-4">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-200 mb-1">System Diagnostics</h2>
            <p className="text-xs text-zinc-400 mb-6">Inspect current declarativeNetRequest status and internal state.</p>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-zinc-300 overflow-x-auto">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
