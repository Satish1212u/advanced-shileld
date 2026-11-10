# Advanced AdBlocker — Full Production Audit Report

**Audit Date:** 2026-11-10  
**Auditor:** Senior Chromium Extension Security & QA Engineer (Automated Audit)  
**Project:** `advanced-adblocker` v1.0.0  
**Location:** `c:\Users\ASUS\Desktop\add blocker\`  
**Method:** Source inspection + build execution + static analysis + schema validation

---

## 0. Executive Verdict

| Deployment Target      | Verdict          | Blocker Issues |
|------------------------|------------------|----------------|
| Local Unpacked Dev     | ✅ READY          | None — with caveats (stats = 0 in packed) |
| Internal Beta          | 🟡 READY AFTER FIXES | P1: `tabs` permission missing, P1: whitelist bypass bug |
| Chrome Web Store       | 🔴 NOT READY      | Multiple P1 issues, low rule count, XSS in picker |
| Production Release     | 🔴 NOT READY      | 7 static malware rules, real-world coverage too low |

**Overall Verdict: 🟡 READY AFTER FIXES**

The core declarative network blocking architecture is sound. All build steps pass cleanly. However, four P1 bugs prevent safe deployment to any packed extension channel. After resolving P1 issues, it becomes a solid beta.

---

## 1. Build Status

### Build Commands Executed

| Command | Exit Code | Result |
|---------|-----------|--------|
| `npm install` | 0 | 178 packages installed |
| `npm run typecheck` | 0 | Zero TypeScript errors |
| `npm run test` | 0 | 7 files, 26/26 tests pass |
| `npm run build` | 0 | Full `dist/` produced |

### Build Output Summary

```
dist/
├── manifest.json
├── assets/
│   ├── popup-KdQ_WGyc.js
│   ├── options-LJF3KuzX.js
│   ├── blocked-BMrxlk9r.js
│   ├── constants-ZFrEG4Zy.js
│   ├── utils-BKEj8kNH.js
│   ├── shield-exclamation-point-CB8KCb7R.js
│   └── utils-C7s4g3nl.css
├── background/service-worker.js
├── content/content.js, element-picker.js
├── popup/index.html
├── options/index.html
├── blocked/index.html
├── icons/icon16.png, icon48.png, icon128.png
└── rules/ads, privacy, annoyances, malware, youtube
```

**Build status: ✅ PASSES**

---

## 2. Network Ad Blocking

### DNR Rule Summary

| Ruleset      | Rule Count | Duplicate IDs | Invalid Schemas |
|--------------|-----------|---------------|-----------------|
| ads          | 30        | 0             | 0               |
| privacy      | 20        | 0             | 0               |
| annoyances   | 9         | 0             | 0               |
| malware      | 7         | 0             | 0               |
| youtube      | 7         | 0             | 0               |
| **TOTAL**    | **73**    | **0**         | **0**           |

Cross-ruleset ID uniqueness: ✅ CONFIRMED — all 73 IDs unique across all rulesets.

### Rule Schema Validation

- Action types: all `"block"` — ✅ valid DNR schema
- `domainType: "thirdParty"` string in JSON — ✅ correct for static ruleset JSON (Chrome parses strings for static rulesets)
- Resource types: `xmlhttprequest`, `script`, `image` — all in valid Chrome DNR `ResourceType` enum
- URL filters use `||domain.com^` pattern — ✅ valid DNR urlFilter syntax
- Priority: all `1` — ✅ valid (1 is minimum; no conflicts)

### Coverage Assessment

**CRITICALLY LOW: 73 total static rules.**

Real-world ad blockers ship 50,000–300,000+ rules (EasyList alone has ~80,000). With only 73 hand-crafted rules, this extension will miss the vast majority of advertising requests in the wild.

**Status: PARTIALLY IMPLEMENTED** — Architecture is correct; rule coverage is insufficient for real-world use.

### `allowAllRequests` Whitelist Rule

**BUG (P1):** In `rule-manager.ts`, the per-site whitelist rule uses:
```ts
condition: {
  initiatorDomains: [domain],
  resourceTypes: [MAIN_FRAME, SUB_FRAME],
}
```
`allowAllRequests` applies only to `MAIN_FRAME` and `SUB_FRAME` navigations per Chrome's DNR spec — sub-resources on the page (scripts, images, XHR) will still be blocked by other rules even when a site is "whitelisted." To whitelist a site correctly, the action should use a broad high-priority `ALLOW` rule without `resourceTypes` restriction against `initiatorDomains`.

---

## 3. Filter List Support

### Implementation

- `parser/filter-parser.ts` — Parses ABP/EasyList syntax (network + cosmetic rules)
- `parser/easylist-parser.ts` — Batch parser over entire filter file text
- `parser/rule-converter.ts` — Converts `IntermediateRule` → Chrome DNR `Rule`
- `parser/rule-validator.ts` — Validates rules; rejects dangerous overboards (`*`, `http*`)
- `extension/background/filter-update-manager.ts` — Fetches, parses, and applies DNR rules

### Filter Lists Configured

| List | URL | Category |
|------|-----|----------|
| EasyList | easylist.to/easylist/easylist.txt | ads |
| EasyPrivacy | easylist.to/easylist/easyprivacy.txt | privacy |
| Fanboy Annoyances | easylist.to/easylist/fanboy-annoyance.txt | annoyances |
| URLHaus Malware | urlhaus.abuse.ch/downloads/text_online/ | malware |

### Critical Bug: Cosmetic Rules Never Applied From Updates

**BUG (P2):** `FilterUpdateManager.updateSingleFilter()` correctly parses both `dnrRules` and `cosmeticRules` from the fetched filter list. However:

- Parsed `cosmeticRules` are **counted** in `list.ruleCount` but **never stored**, **never sent to content scripts**, and **never applied**.
- When a filter update runs, only `result.dnrRules` are pushed to `chrome.declarativeNetRequest.updateDynamicRules()`.
- Updated cosmetic selectors from EasyList/EasyPrivacy are silently dropped every time.

**Status: PARTIALLY IMPLEMENTED** — DNR network rule updates work; cosmetic rule updates are silently discarded.

### Filter Update Mechanism

- Chrome alarms correctly configured (`periodInMinutes: 1440`) ✅
- 15-second timeout with `AbortController` ✅
- Atomic rollback on DNR rejection ✅
- Respects 4,500-rule limit per update batch ✅
- **Missing:** Cosmetic rule delivery to content scripts

---

## 4. Cosmetic Filtering

### Implementation

- `extension/content/cosmetic-engine.ts` — MutationObserver + CSS injection
- `extension/shared/constants.ts` — `COMMON_COSMETIC_SELECTORS` (29 selectors), `YOUTUBE_AD_SELECTORS` (18 selectors)
- CSS injected via `<style>` element at `document_start`

### Accuracy of Element Counts

**BUG (P3):** `CosmeticEngine.scanInitialDOM()` counts all DOM elements that **match** the selectors, including elements already hidden by page CSS. The reported `cosmeticHidden` count is an overcount — it represents "elements matching selectors" rather than "elements we specifically hid."

**Status: PARTIALLY IMPLEMENTED** — Cosmetic hiding works; count accuracy is misleading.

---

## 5. YouTube Ad Blocking

### Strategy

The YouTube module uses a **three-layer approach**:

| Layer | Mechanism | Implemented |
|-------|-----------|-------------|
| Network | 7 DNR rules blocking ad stats/tracking endpoints | ✅ |
| Cosmetic | CSS injection hiding 18 YouTube-specific ad selectors | ✅ |
| Player | MutationObserver on `.html5-video-player` class changes | ✅ |

### Player Ad Handling

- Detects ads via `player.classList.contains('ad-showing')` ✅
- Auto-clicks skip button when visible ✅
- Mutes audio + seeks to `video.duration` for unskippable ads ✅
- Restores volume/playback rate when ad finishes ✅

### BUG: Player Discovery Timer Leak

**BUG (P2):** In `compatibility.ts`, `attachPlayerWatcher()` runs:
```ts
const findTimer = setInterval(() => { ... }, 500);
```
`findTimer` is a **local variable** — not stored in class state. If `detachPlayerWatcher()` is called while this timer is pending (e.g. during rapid SPA navigation), the interval is never cleared → **timer leak**.

### BUG: Redundant Polling Timer

**BUG (P2):** After attaching to the player, `attachToPlayer()` creates both a `MutationObserver` AND a `setInterval` at 800ms. The polling is redundant when the `MutationObserver` already fires on `class` attribute changes. This contradicts "event-driven" claim and wastes CPU on video pages.

### YouTube Network Blocking Limitation

The 7 YouTube DNR rules block stats/tracking endpoints but **do not block video ad streams** (`googlevideo.com/videoplayback?...`). YouTube serves both ad and content video streams from the same `googlevideo.com` domain — blocking ad video streams requires response-header or JavaScript interception not achievable via MV3 DNR.

**Status: PARTIALLY IMPLEMENTED** — Cosmetic hiding + skip-button automation works; video ad stream blocking is not achievable via MV3 DNR.

---

## 6. Popup UI

### Asset Path Analysis

`dist/popup/index.html` references `../../assets/popup-*.js` and `../../assets/*.css`.

The popup is served from `chrome-extension://{id}/popup/index.html`. The relative path `../../assets/` navigates up two levels from `/popup/`, arriving at `/assets/`. Since `dist/assets/` is at the extension root, this resolves to `chrome-extension://{id}/assets/` — which exists.

**Verdict: Paths resolve correctly in Chrome. ✅ Not a bug.**

### Popup Functionality

- Global enable/disable toggle — ✅ wired to `UPDATE_SETTINGS` message
- Per-site toggle — ✅ wired to `TOGGLE_SITE` message
- Stats display (adsBlocked, trackersBlocked, cosmeticHidden) — ✅ UI correct; **stats always = 0 in packed mode (see Section 7)**
- Element Picker button — ✅ sends `START_ELEMENT_PICKER`, closes popup
- Settings link → options page — ✅

**Status: ✅ IMPLEMENTED** — UI functional; statistics limited by platform (see Section 7).

---

## 7. Statistics System

### Implementation

`StatsManager` tracks:
- `globalStats` — persisted to `chrome.storage.local` ✅
- `pageStatsMap` — in-memory only (lost on service worker suspension — acceptable)

### CRITICAL: Stats Are Always Zero in Packed Extension

**BUG (P1 — CRITICAL):** The only source of network-level block counts is:
```ts
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(...)
```

Per Chrome documentation, `onRuleMatchedDebug` **is only available when the extension is loaded as an unpacked extension** (developer mode). In a packed `.crx` or Chrome Web Store installation, this event **never fires**.

The catch block confirms this awareness:
```ts
logger.debug('onRuleMatchedDebug only supported in unpacked developer mode');
```

**Result:** All network block statistics (`adsBlocked`, `trackersBlocked`, badge counter) always read **0** in any packed or CWS-distributed version.

Cosmetic stats DO work via `RECORD_COSMETIC_BLOCK` message from content script.

**Status: DEVELOPMENT ONLY** — Network statistics require unpacked developer mode.

---

## 8. Privacy & Tracker Protection

### Network Rules

20 privacy rules block known tracker domains (Google Analytics, Facebook Pixel, Hotjar, Mixpanel, Segment, etc.) — structurally correct but minimal coverage.

### Content Script Privacy

- No `eval()` usage found in content scripts ✅
- No `innerHTML` injection of untrusted data **except one instance** (see Section 9)
- No sensitive data exfiltration paths found ✅

---

## 9. Security Audit

### innerHTML XSS — Moderate Risk

**BUG (P2):** In `extension/content/element-picker.ts`, line 111:
```ts
this.dialog.innerHTML = `
  ...${domain}...${selector}...
`;
```

Both `domain` (from `URL.hostname` — cannot contain `<>` in valid URLs, low risk) and `selector` (from DOM element `id`/`class` attributes — can contain arbitrary characters if the page sets crafted IDs) are injected without sanitization.

This is a **stored XSS** vector: a malicious page could set `element.id = "<img src=x onerror=...>"` and have that script execute inside the extension's element picker dialog.

**Fix:** Use `textContent` for the selector display, or escape HTML entities before injecting.

### No `eval()` or `new Function()`

✅ Confirmed: no `eval()` or `new Function()` usage found in any source file.

### Content Security Policy

**MISSING (P2):** `dist/manifest.json` has no `content_security_policy` key. While MV3 applies a default restrictive CSP, best practice is to explicitly declare it.

### Permission Audit

| Permission | Declared | Actually Used | Verdict |
|------------|----------|---------------|---------|
| `declarativeNetRequest` | ✅ | ✅ | Required |
| `storage` | ✅ | ✅ | Required |
| `alarms` | ✅ | ✅ | Required |
| `activeTab` | ✅ | ✅ (popup tabs.query) | Required |
| `scripting` | ✅ | Messaging path | Required |
| `tabs` | ❌ MISSING | ✅ Used in SW | **P1 BUG** |
| `<all_urls>` host | ✅ | ✅ (content scripts) | Required |

### CRITICAL: Missing `tabs` Permission

**BUG (P1 — CRITICAL):** `service-worker.ts` uses:
```ts
chrome.tabs.onActivated.addListener(...)   // line 56
chrome.tabs.get(activeInfo.tabId)          // line 58
chrome.tabs.onUpdated.addListener(...)     // line 70
```

Manifest only declares `activeTab` and `scripting` — not `tabs`. `activeTab` does **not** grant `chrome.tabs.onActivated`, `chrome.tabs.get()`, or `chrome.tabs.onUpdated`.

**Impact:** Tab-switch badge refresh silently fails. Badge always stays blank in packed mode.

**Fix:** Add `"tabs"` to `permissions` array in `manifest.json`.

---

## 10. Malware Protection

**Status: NOT IMPLEMENTED** as a real malware feed.

- 7 static rules: `cryptomining.com`, `coinhive.com`, `jsecoin.com`, `minero.cc`, `cryptoloot.com`, `deepminer.cc`, `webmine.cz`
- These are legacy cryptominer domains from ~2018–2019; most have been inactive for years
- URLHaus feed is configured but requires manual trigger or 24h alarm wait
- No phishing, no active malware distribution, no current threat intelligence

---

## 11. Element Picker

### Implementation

- `element-picker.ts` — Hover highlight + click to select + confirmation dialog ✅
- Selector generated via `generateStableSelector()` ✅
- Selected rule stored via `ELEMENT_PICKED` → background → `SiteManager.addCustomCosmeticRule()` ✅
- Applied to future page visits via `CosmeticEngine` custom selectors ✅

### Bugs

- `innerHTML` injection of `selector` (see Section 9 — XSS risk) ❌
- Cannot handle shadow DOM elements ⚠️
- No preview of hidden result before confirming ⚠️

**Status: ✅ IMPLEMENTED** — Functional for basic use; has XSS concern and shadow DOM gap.

---

## 12. Options Page

### Verified Features

- Filter list management UI — ✅
- Category enable/disable toggles — ✅ wired to `UPDATE_SETTINGS`
- Custom rule textarea — ✅ wired to `applyCustomRules`
- Filter update trigger button — ✅ wired to `TRIGGER_FILTER_UPDATE`
- YouTube settings section — ✅ UI present

**Status: ✅ IMPLEMENTED**

---

## 13. Manifest V3 Compliance

| Check | Status |
|-------|--------|
| `manifest_version: 3` | ✅ |
| Service worker (not persistent background page) | ✅ |
| `declarativeNetRequest` (not `webRequest` blocking) | ✅ |
| No `eval` / no inline scripts | ✅ |
| `web_accessible_resources` properly scoped | ✅ |
| `options_page` (legacy key, still valid in MV3) | ⚠️ P4 — prefer `options_ui` |
| No obsolete MV2 APIs | ✅ |
| Missing `tabs` permission | ❌ **BUG P1** |
| No `content_security_policy` declared | ⚠️ P2 |

---

## 14. Service Worker Architecture

### Event Registration Pattern

```ts
initExtension().catch(...)               // Top-level async init ✅
chrome.runtime.onMessage.addListener()  // Synchronous registration ✅
chrome.tabs.onActivated.addListener()   // Registered after init ✅
chrome.alarms.onAlarm.addListener()     // Inside initialize() ✅
```

### Safe Suspension Handling

- No `setInterval` or `setTimeout` in service worker ✅
- `chrome.alarms` for periodic updates ✅
- `globalStats` reloaded from storage on each wake ✅
- Module-level singletons re-instantiate cleanly on each wake ✅
- No DOM/window API calls in service worker ✅

**Service Worker Status: ✅ CORRECTLY IMPLEMENTED**

---

## 15. Automated Test Coverage

| Test File | Tests | What Is Covered |
|-----------|-------|-----------------|
| `filter-parser.test.ts` | 7 | Comment lines, network rules, cosmetic rules, exceptions, options |
| `rule-converter.test.ts` | 3 | Block, allow, cosmetic conversion |
| `rule-validator.test.ts` | 3 | Dangerous patterns, valid rules, cosmetic pass-through |
| `performance.test.ts` | 1 | 1,000-rule parse/validate benchmark (<150ms) |
| `site-whitelist.test.ts` | 3 | Domain extraction, whitelist add/remove |
| `stats-manager.test.ts` | 4 | Record network/cosmetic blocks, storage save |
| `youtube.test.ts` | 5 | Detector static methods, observer navigation events |

**All 26 tests pass ✅**

### Coverage Gaps

- No test for `FilterUpdateManager` (fetch → parse → apply flow) ❌
- No test for `CosmeticEngine` DOM manipulation ❌
- No test for service worker message routing (`handleMessage` switch) ❌
- No real Chromium E2E test executed ❌
- No test for `allowAllRequests` whitelist correctness ❌

---

## 16. Real Chromium Test

**NOT EXECUTED** — Playwright E2E test (`tests/e2e/extension.spec.ts`) requires a headless Chrome binary and graphical display environment not available in this CI context.

**Therefore: YouTube blocking is NOT VERIFIED in real Chrome. All YouTube claims are based on source code analysis only.**

---

## 17. Dist / Source Consistency

| Source | Dist | Match |
|--------|------|-------|
| `extension/background/service-worker.ts` | `dist/background/service-worker.js` | ✅ |
| `extension/content/content.ts` | `dist/content/content.js` | ✅ |
| `extension/content/element-picker.ts` | `dist/content/element-picker.js` | ✅ |
| `extension/popup/App.tsx` | `dist/assets/popup-*.js` | ✅ |
| `extension/options/App.tsx` | `dist/assets/options-*.js` | ✅ |
| All 5 rulesets | `dist/rules/*/rules.json` | ✅ |
| `manifest.json` | `dist/manifest.json` | ✅ |

---

## 18. Critical Bugs (P1)

> P1 = Extension will silently malfunction or crash in packed/distributed mode.

### P1-001 — Statistics Always Zero in Packed Extension

**File:** `extension/background/service-worker.ts:31`  
**Issue:** `chrome.declarativeNetRequest.onRuleMatchedDebug` is developer mode only. All network block counts are always 0 in packed extension. Badge never updates on tab switch (see P1-002).  
**Impact:** Core user value proposition (seeing what was blocked) is completely non-functional for 100% of non-developer users.  
**Fix:** Implement content-script-side heuristic counter, or report cosmetic blocks only, or prominently label "Network stats: developer mode required."

### P1-002 — Missing `tabs` Permission

**File:** `dist/manifest.json`, `extension/background/service-worker.ts:56-72`  
**Issue:** `chrome.tabs.onActivated`, `chrome.tabs.get()`, and `chrome.tabs.onUpdated` require `"tabs"` permission. Only `activeTab` is declared.  
**Impact:** Tab-switch badge refresh silently fails. `chrome.tabs.get()` may throw in strict contexts.  
**Fix:** Add `"tabs"` to `permissions` array in `manifest.json`.

### P1-003 — Insufficient Rule Coverage (73 vs. 50,000+ needed)

**File:** `dist/rules/*/rules.json`  
**Issue:** 73 total static rules vs. 50,000–300,000+ in production ad blockers.  
**Impact:** Extension misses the vast majority of real-world advertising requests.  
**Fix:** Integrate real EasyList/EasyPrivacy rule compilation into the build process.

### P1-004 — `allowAllRequests` Whitelist Doesn't Bypass Sub-Resources

**File:** `extension/background/rule-manager.ts:122-134`  
**Issue:** Whitelist uses `ALLOW_ALL_REQUESTS` with `resourceTypes: [MAIN_FRAME, SUB_FRAME]` only. Sub-resources on whitelisted sites remain blocked by other rules.  
**Impact:** "Disable on this site" toggle appears to work but ads are still blocked.  
**Fix:** Add a companion high-priority `ALLOW` rule with `initiatorDomains: [domain]` and no `resourceTypes` restriction.

---

## 19. High Priority Bugs (P2)

### P2-001 — Cosmetic Rules From Filter Updates Silently Discarded

**File:** `extension/background/filter-update-manager.ts:~110`  
**Issue:** `result.cosmeticRules` are parsed but never applied, stored, or communicated to content scripts.  
**Fix:** Store cosmetic rules in `chrome.storage.local`. Content scripts should fetch updated selectors on startup.

### P2-002 — YouTube Player Discovery Timer Leak

**File:** `extension/content/youtube/compatibility.ts:88-99`  
**Issue:** `findTimer` is a local variable; `detachPlayerWatcher()` cannot clear it.  
**Fix:** Store as `this.findTimer = setInterval(...)` and clear in `detachPlayerWatcher()`.

### P2-003 — Redundant 800ms Polling Timer on Video Pages

**File:** `extension/content/youtube/compatibility.ts:107`  
**Issue:** `setInterval` at 800ms duplicates the `MutationObserver` on the player element, wasting CPU.  
**Fix:** Remove `setInterval` from `attachToPlayer()`. Rely on `MutationObserver` which fires immediately on `class` changes.

### P2-004 — innerHTML XSS in Element Picker Dialog

**File:** `extension/content/element-picker.ts:111`  
**Issue:** `selector` from DOM element properties injected into `innerHTML` without sanitization. Malicious pages can craft element IDs with HTML to execute script inside the extension dialog.  
**Fix:** Use `textContent` to display the selector, or sanitize HTML entities.

### P2-005 — No Content Security Policy in Manifest

**File:** `dist/manifest.json`  
**Fix:** Add:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```

### P2-006 — Filter Updates Fail Silently When Offline

**File:** `extension/background/filter-update-manager.ts:70`  
**Issue:** `fetch()` failures during service worker suspension may lose error state.  
**Fix:** Persist error state to storage before suspension; check connectivity before fetching.

---

## 20. Medium Priority Improvements (P3)

### P3-001 — Malware Protection is Vestigial

7 static cryptominer domains from 2018–2019. Auto-fetch URLHaus on install and daily alarm.

### P3-002 — Cosmetic Element Count Is Inflated

`scanInitialDOM()` counts pre-hidden elements. Count only elements where `getComputedStyle(el).display !== 'none'` before injection.

### P3-003 — `options_page` Should Be `options_ui`

Replace `options_page` with `options_ui: { "page": "options/index.html", "open_in_tab": true }` per MV3 guidance.

### P3-004 — No Shadow DOM Support in Element Picker

`document.querySelector()` doesn't penetrate shadow roots. Add shadow root traversal in `ElementPicker` hover handler.

### P3-005 — Service Worker `onInstalled` Hook Missing

No `chrome.runtime.onInstalled` listener. No first-run setup, migration, or rule seeding on update. Add `chrome.runtime.onInstalled.addListener(({ reason }) => { ... })`.

---

## 21. Low Priority Improvements (P4)

| ID | Issue |
|----|-------|
| P4-001 | No `chrome.runtime.onUpdateAvailable` handler — users won't be prompted to reload on update |
| P4-002 | `pageStatsMap` has no eviction policy — unbounded memory growth for heavy multi-tab use |
| P4-003 | `GET_DEBUG_INFO` message exists but is inaccessible from popup UI |
| P4-004 | No keyboard shortcut (`commands` API) for quick toggle |
| P4-005 | No internationalization / `default_locale` |
| P4-006 | `options_page` → prefer `options_ui` with `open_in_tab: true` |

---

## 22. Performance Audit

| Subsystem | Assessment |
|-----------|------------|
| DNR blocking | ✅ Excellent — native browser, 0 JS overhead |
| Cosmetic CSS injection | ✅ Excellent — single `<style>` element, no per-element JS |
| MutationObserver | ✅ Good — scoped to `document.body`, batched callbacks |
| YouTube polling | ⚠️ Wasteful — 800ms interval redundant with MutationObserver |
| YouTube find timer | ⚠️ Leak risk — not stored in class state |
| Filter parsing | ✅ Good — 1,000 rules < 150ms (verified by test) |
| Storage writes | ✅ Good — debounced 2s |
| `pageStatsMap` | ⚠️ Unbounded memory — no eviction |

---

## 23. Final Recommendation

### Deployment Matrix

| Target | Status | Required Actions |
|--------|--------|-----------------|
| **Local Unpacked (dev)** | ✅ READY | Stats work via `onRuleMatchedDebug`. Use as-is for development. |
| **Internal Beta** | 🟡 AFTER P1 FIXES | Fix P1-002 (tabs permission), P1-004 (whitelist), P2-002 (timer leak) |
| **Chrome Web Store** | 🔴 NOT READY | Requires P1 + P2 fixes + privacy policy + real malware protection + 10k+ rules |
| **Production** | 🔴 NOT READY | All above + E2E Chromium tests + real rule pipeline + malware feed |

### Fix Priority Order

1. **P1-002** — Add `"tabs"` to manifest permissions *(1-line fix, 2 minutes)*
2. **P1-004** — Fix `allowAllRequests` whitelist to cover sub-resources *(10-line fix)*
3. **P2-002** — Store `findTimer` in class state to prevent YouTube timer leak *(3-line fix)*
4. **P2-004** — Sanitize `selector` before `innerHTML` injection *(5-line fix)*
5. **P1-001** — Address zero-stats-in-packed issue *(design decision + significant work)*
6. **P2-003** — Remove redundant 800ms polling interval *(3-line fix)*
7. **P2-001** — Apply cosmetic rule updates from filter fetches *(significant work)*
8. **P1-003** — Integrate real EasyList compilation into build pipeline *(significant work)*

---

*Audit complete. Total issues: 4 P1 · 6 P2 · 5 P3 · 6 P4*  
*Overall: 🟡 READY AFTER FIXES*

