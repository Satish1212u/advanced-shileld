import React, { useEffect, useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Crop,
  Power,
  ExternalLink,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import { DEFAULT_SETTINGS, DEFAULT_GLOBAL_STATS } from '../shared/constants';
import { ExtensionSettings, GlobalStats, PageStats } from '../shared/types';
import { extractDomain } from '../shared/utils';

export const App: React.FC = () => {
  const [currentDomain, setCurrentDomain] = useState<string>('example.com');
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [pageStats, setPageStats] = useState<PageStats>({
    domain: '',
    adsBlocked: 0,
    trackersBlocked: 0,
    annoyancesBlocked: 0,
    malwareBlocked: 0,
    cosmeticHidden: 0,
    lastUpdated: Date.now(),
  });
  const [globalStats, setGlobalStats] = useState<GlobalStats>(DEFAULT_GLOBAL_STATS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      // 1. Get active tab domain
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.url) {
            const domain = extractDomain(activeTab.url);
            if (domain) setCurrentDomain(domain);
          }
        } catch (e) {
          console.error('Failed to get active tab:', e);
        }
      }

      // 2. Fetch settings
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
          if (settingsRes && settingsRes.success) {
            setSettings(settingsRes.data);
          }

          // 3. Fetch stats
          const statsRes = await chrome.runtime.sendMessage({
            type: 'GET_PAGE_STATS',
            domain: currentDomain,
          });
          if (statsRes && statsRes.success) {
            setPageStats(statsRes.data.pageStats);
            setGlobalStats(statsRes.data.globalStats);
          }
        } catch (e) {
          console.error('Failed to fetch data from service worker:', e);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [currentDomain]);

  const isGlobalEnabled = settings.globalEnabled;
  const siteConfig = settings.siteSettings[currentDomain];
  const isSiteEnabled = siteConfig !== undefined ? siteConfig.enabled : true;
  const isProtectionActive = isGlobalEnabled && isSiteEnabled;

  const toggleGlobal = async () => {
    const updated = !isGlobalEnabled;
    const newSettings = { ...settings, globalEnabled: updated };
    setSettings(newSettings);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { globalEnabled: updated },
      });
    }
  };

  const toggleSite = async () => {
    const updated = !isSiteEnabled;
    const newSiteSettings = {
      ...settings.siteSettings,
      [currentDomain]: {
        domain: currentDomain,
        enabled: updated,
        customCosmeticRules: siteConfig?.customCosmeticRules || [],
      },
    };
    setSettings({ ...settings, siteSettings: newSiteSettings });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        domain: currentDomain,
        enabled: updated,
      });
    }
  };

  const startElementPicker = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({ type: 'START_ELEMENT_PICKER' });
      window.close(); // Close popup so user can click elements
    }
  };

  const openOptionsPage = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.openOptionsPage();
    }
  };

  const formatDataSaved = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[480px] bg-zinc-950 text-zinc-400 text-xs">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mr-2" />
        <span>Loading Shield...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isProtectionActive ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight leading-none text-zinc-100">Advanced Shield</h1>
            <span className="text-[10px] text-zinc-400 font-medium">Manifest V3 Production</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={openOptionsPage}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Status Hero */}
      <div className="px-4 py-5 flex flex-col items-center border-b border-zinc-800/60 bg-gradient-to-b from-zinc-900/40 to-transparent">
        <button
          onClick={toggleGlobal}
          className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            isProtectionActive
              ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25 ring-4 ring-blue-500/20'
              : !isGlobalEnabled
              ? 'bg-zinc-800 hover:bg-zinc-700 shadow-zinc-900 ring-4 ring-zinc-700/20'
              : 'bg-amber-600/80 hover:bg-amber-500 shadow-amber-500/20 ring-4 ring-amber-500/20'
          }`}
          title={isGlobalEnabled ? 'Turn Off Protection Globally' : 'Turn On Protection Globally'}
        >
          {isProtectionActive ? (
            <ShieldCheck className="w-10 h-10 text-white" />
          ) : !isGlobalEnabled ? (
            <Power className="w-9 h-9 text-zinc-400" />
          ) : (
            <ShieldAlert className="w-9 h-9 text-white" />
          )}
        </button>

        <div className="mt-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isProtectionActive ? 'bg-emerald-500 animate-pulse' : !isGlobalEnabled ? 'bg-zinc-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              {isProtectionActive
                ? 'Protection Active'
                : !isGlobalEnabled
                ? 'Protection Paused'
                : 'Disabled on this Site'}
            </span>
          </div>

          <p className="text-xs text-zinc-400 mt-0.5 max-w-[260px] truncate font-mono">
            {currentDomain}
          </p>
        </div>
      </div>

      {/* Per-Site Control Toggle */}
      <div className="px-4 py-3 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-zinc-200">Filtering on this site</span>
          <p className="text-[11px] text-zinc-500">Allow or block ads on {currentDomain}</p>
        </div>

        <button
          onClick={toggleSite}
          disabled={!isGlobalEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            !isGlobalEnabled ? 'opacity-40 cursor-not-allowed bg-zinc-800' : isSiteEnabled ? 'bg-blue-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isSiteEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Page Statistics Grid */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-zinc-800/60">
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 flex flex-col items-center">
          <span className="text-[11px] text-zinc-400">Ads Blocked</span>
          <span className="text-base font-bold text-blue-400 mt-0.5">
            {pageStats.adsBlocked}
          </span>
        </div>

        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 flex flex-col items-center">
          <span className="text-[11px] text-zinc-400">Trackers</span>
          <span className="text-base font-bold text-emerald-400 mt-0.5">
            {pageStats.trackersBlocked}
          </span>
        </div>

        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 flex flex-col items-center">
          <span className="text-[11px] text-zinc-400">Hidden DOM</span>
          <span className="text-base font-bold text-amber-400 mt-0.5">
            {pageStats.cosmeticHidden}
          </span>
        </div>
      </div>

      {/* All-Time Statistics Summary */}
      <div className="px-4 py-3 flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-zinc-500" />
          <span>All-time total:</span>
          <strong className="text-zinc-200">
            {globalStats.totalAdsBlocked + globalStats.totalTrackersBlocked + globalStats.totalCosmeticHidden}
          </strong>
        </div>

        <div className="flex items-center gap-1.5" title="Estimated savings based on average ad bundle payloads">
          <Database className="w-3.5 h-3.5 text-zinc-500" />
          <span>Est. saved:</span>
          <strong className="text-blue-400">
            {formatDataSaved(globalStats.estimatedDataSavedBytes)}
          </strong>
        </div>
      </div>

      {/* Quick Action Tools */}
      <div className="p-4 mt-auto flex flex-col gap-2">
        <button
          onClick={startElementPicker}
          disabled={!isProtectionActive}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
            isProtectionActive
              ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200'
              : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          <Crop className="w-3.5 h-3.5 text-zinc-400" />
          <span>Block Element on This Page</span>
        </button>

        <button
          onClick={openOptionsPage}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Manage Filter Lists & Rules</span>
          <ExternalLink className="w-3 h-3 ml-auto text-zinc-500" />
        </button>
      </div>
    </div>
  );
};
