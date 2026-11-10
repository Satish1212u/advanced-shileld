import React, { useEffect, useState } from 'react';
import { ShieldAlert, ArrowLeft, AlertTriangle } from 'lucide-react';
import { extractDomain } from '../shared/utils';

export const BlockedApp: React.FC = () => {
  const [blockedUrl, setBlockedUrl] = useState('');
  const [blockedDomain, setBlockedDomain] = useState('');
  const [reason, setReason] = useState('Known Malicious / Cryptomining Destination');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || 'https://malicious-example.com';
    const reasonParam = params.get('reason');

    setBlockedUrl(url);
    setBlockedDomain(extractDomain(url));
    if (reasonParam) {
      setReason(reasonParam);
    }
  }, []);

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'about:blank';
    }
  };

  const proceedAnyway = async () => {
    if (blockedDomain && typeof chrome !== 'undefined' && chrome.runtime) {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        domain: blockedDomain,
        enabled: false,
      });
    }
    window.location.href = blockedUrl;
  };

  return (
    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-950/80 text-red-500 border border-red-800/80 mb-5 mx-auto">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-zinc-100 mb-1">Warning: Dangerous Site Blocked</h1>
        <p className="text-xs text-zinc-400">
          Advanced AdBlocker & Privacy Shield prevented an unsafe connection.
        </p>
      </div>

      <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 mb-6 text-xs space-y-2 font-mono">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Target Destination:</span>
          <strong className="text-red-400 truncate max-w-[200px]">{blockedDomain}</strong>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span>Threat Reason:</span>
          <span className="text-zinc-200">{reason}</span>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
        Visiting this site may expose your device to unwanted software, crypto-mining scripts, or phishing attempts. We recommend returning to the previous page.
      </p>

      <div className="space-y-3">
        <button
          onClick={goBack}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Safety (Recommended)</span>
        </button>

        <div className="pt-2 text-center">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showAdvanced ? 'Hide advanced details' : 'Advanced details'}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs space-y-3 text-red-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400">
                Bypassing this protection will allow network connections to this domain.
              </p>
            </div>
            <button
              onClick={proceedAnyway}
              className="text-[11px] text-zinc-400 hover:text-red-400 underline"
            >
              Proceed to {blockedDomain} (Unsafe)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

