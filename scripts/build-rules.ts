import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EasyListParser } from '../parser/easylist-parser';
import { ChromeDNRRule } from '../parser/rule-converter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Core well-known Ad Networks to block at network layer
const CORE_ADS_FILTER = `
! Core Advertising Filter List
||doubleclick.net^$third-party
||googleadservices.com^$third-party
||googlesyndication.com^$third-party
||adservice.google.com^$third-party
||pagead2.googlesyndication.com^$third-party
||taboola.com^$third-party
||outbrain.com^$third-party
||criteo.com^$third-party
||criteo.net^$third-party
||popads.net^$third-party
||adnxs.com^$third-party
||rubiconproject.com^$third-party
||openx.net^$third-party
||pubmatic.com^$third-party
||casalemedia.com^$third-party
||bidswitch.net^$third-party
||smartadserver.com^$third-party
||media.net^$third-party
||adcolony.com^$third-party
||amazon-adsystem.com^$third-party
||inmobi.com^$third-party
||advertising.com^$third-party
||moatads.com^$third-party
||serving-sys.com^$third-party
||adform.net^$third-party
||yieldmo.com^$third-party
||spotxchange.com^$third-party
||chartbeat.net^$third-party
||revcontent.com^$third-party
||buysellads.com^$third-party
`;

// Core Trackers & Telemetry
const CORE_PRIVACY_FILTER = `
! Core Privacy & Telemetry List
||google-analytics.com^$third-party
||analytics.google.com^$third-party
||googletagmanager.com/gtm.js$script
||facebook.net/*/fbevents.js$script
||connect.facebook.net/*/sdk.js$script
||hotjar.com^$third-party
||segment.io^$third-party
||segment.com^$third-party
||mixpanel.com^$third-party
||scorecardresearch.com^$third-party
||mc.yandex.ru^$third-party
||clarity.ms^$third-party
||amplitude.com^$third-party
||crazyegg.com^$third-party
||newrelic.com/nr-*.js$script
||quantserve.com^$third-party
||mouseflow.com^$third-party
||fullstory.com^$third-party
||inspectlet.com^$third-party
||optimizely.com^$third-party
`;

// Core Annoyances & Popups
const CORE_ANNOYANCES_FILTER = `
! Core Annoyances List
||onesignal.com^$third-party
||pushwoosh.com^$third-party
||pushcrew.com^$third-party
||pushengage.com^$third-party
||subscribers.com^$third-party
||wonderpush.com^$third-party
||izooto.com^$third-party
||braze.com^$third-party
||intercom.io/widget$script
`;

// Malware & Dangerous Domains (architecture hook for threat intelligence)
const CORE_MALWARE_FILTER = `
! Threat Intelligence Feed
||malware-traffic-analysis.net^$important
||coinhive.com^$important
||crypto-loot.com^$important
||jsecoin.com^$important
||webminepool.com^$important
||authedmine.com^$important
||miner.pr0gramm.com^$important
`;

// YouTube targeted ad requests (does not block legitimate media streaming)
const YOUTUBE_FILTER = `
! YouTube Specific Advertising Filters
||youtube.com/api/stats/ads^
||youtube.com/pagead/*
||youtube.com/ptracking^
||youtube.com/api/stats/qoe?*&adformat=*
||youtube.com/get_midroll_info^
||youtube.com/youtubei/v1/log_event?*&alt=json$xhr
||s.youtube.com/api/stats/ads^
`;

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function compileRuleset(_name: string, content: string, startId: number): ChromeDNRRule[] {
  const parser = new EasyListParser('ads');
  const result = parser.parseAndCompile(content, startId);
  return result.dnrRules;
}

export function buildAllRules(): void {
  const baseDir = path.resolve(__dirname, '../extension/rules');
  ensureDir(baseDir);

  const categories = [
    { name: 'ads', content: CORE_ADS_FILTER, startId: 1000 },
    { name: 'privacy', content: CORE_PRIVACY_FILTER, startId: 2000 },
    { name: 'annoyances', content: CORE_ANNOYANCES_FILTER, startId: 3000 },
    { name: 'malware', content: CORE_MALWARE_FILTER, startId: 4000 },
    { name: 'youtube', content: YOUTUBE_FILTER, startId: 5000 },
  ];

  for (const cat of categories) {
    const dir = path.join(baseDir, cat.name);
    ensureDir(dir);
    const dnrRules = compileRuleset(cat.name, cat.content, cat.startId);
    const outputPath = path.join(dir, 'rules.json');
    fs.writeFileSync(outputPath, JSON.stringify(dnrRules, null, 2), 'utf-8');
    console.log(`[build-rules] Built ${dnrRules.length} DNR rules for ${cat.name} -> ${outputPath}`);
  }
}

// Run if called directly
if (process.argv[1]?.includes('build-rules')) {
  buildAllRules();
}
