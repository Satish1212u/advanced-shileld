# Architecture Documentation

This document describes the internal design, component relationships, data flow, and runtime mechanics of **Advanced AdBlocker & Privacy Shield**.

---

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------+
|                               CHROMIUM BROWSER                              |
|                                                                             |
|  +----------------------------+             +----------------------------+  |
|  |     C++ Network Engine     |             |      Page DOM Renderer     |  |
|  | (declarativeNetRequest)    |             |                            |  |
|  +-------------+--------------+             +--------------+-------------+  |
+----------------|-------------------------------------------|----------------+
                 | Native C++ Rule Interception              | DOM CSS Injection
                 v                                           v
+-------------------------------+             +-------------------------------+
|     Static & Dynamic Rules    |             |      content/content.js       |
|  - rules_ads                  |             |  - CosmeticEngine             |
|  - rules_privacy              |             |  - ElementPicker              |
|  - rules_annoyances           |             |  - YouTubeCompatibility      |
|  - rules_malware              |             +---------------+---------------+
|  - rules_youtube              |                             |
|  - dynamic site whitelist     |                             | Chrome Messages
+----------------+--------------+                             v
                 ^                            +-------------------------------+
                 | Runtime Rule Sync          | background/service-worker.js  |
                 |                            |  - RuleManager                |
+----------------+--------------+             |  - SiteManager                |
|  popup & options Dashboards   | <---------> |  - StatsManager               |
|  - App.tsx (React + Tailwind) |             |  - FilterUpdateManager        |
+-------------------------------+             +---------------+---------------+
                                                              |
                                                              v
                                              +-------------------------------+
                                              |      chrome.storage.local     |
                                              |  (Batched & Debounced I/O)    |
                                              +-------------------------------+
```

---

## 2. Core Subsystems

### 2.1 Background Service Worker (`extension/background/`)
Chromium Manifest V3 replaces persistent background pages with ephemeral service workers. The service worker operates entirely on an event-driven basis.

- **`RuleManager`**: Controls `chrome.declarativeNetRequest`.
  - Maps categories (`ads`, `privacy`, `annoyances`, `malware`, `youtube`) to static ruleset IDs.
  - Generates deterministic rule IDs for domain whitelisting (`DYNAMIC_RULE_RANGES.WHITELIST_START` = 100000).
  - Handles dynamic rule updates for user-defined filters.
- **`SiteManager`**: Manages site settings and per-domain configurations.
  - Determines if a domain is active or whitelisted.
  - Keeps local storage in sync with dynamic DNR allow rules.
- **`StatsManager`**: Tracks blocked requests and cosmetic hides without overloading storage I/O.
  - Maintains in-memory page maps (`Map<string, PageStats>`).
  - Implements a 2,000ms debounced write queue to `chrome.storage.local`.
  - Updates the active tab badge text with real-time blocked counts.
- **`FilterUpdateManager`**: Handles atomic filter-list updates.
  - Executes periodically via `chrome.alarms` (`check_filter_updates`).
  - Downloads, parses, validates, and atomically replaces dynamic rules.
  - Reverts gracefully to previous working rules if a feed is unreachable or malformed.

### 2.2 Content Script & Cosmetic Engine (`extension/content/`)
The content script is injected at `document_start` across all frames:

- **`CosmeticEngine`**:
  - Injects a high-priority CSS stylesheet (`display: none !important; height: 0 !important;`) for instant DOM collapsing before paint.
  - Uses a targeted `MutationObserver` on `childList` to detect dynamically created ad placeholders.
  - Tracks nodes in a `WeakSet` to avoid duplicate processing.
  - Employs a circuit-breaker: if mutations exceed 400/sec, DOM checks are throttled to preserve 60 FPS page performance.
- **`ElementPicker`**:
  - Provides a hover-to-highlight element selection overlay (`2px solid #ef4444`).
  - Computes resilient CSS selectors via `generateStableSelector` by filtering out non-semantic framework IDs (e.g. `id="ember123"`).
  - Prompts the user with a preview modal before saving the rule.

### 2.3 YouTube Compatibility Layer (`extension/content/youtube/`)
YouTube requires specialized handling due to its Single-Page Application (SPA) lifecycle:

- **`YouTubeDetector`**:
  - Identifies page context: `video`, `shorts`, `search`, `channel`, `playlist`, or `home`.
  - Inspects `.html5-video-player` for `ad-showing` and `ad-interrupting` classes.
  - Scans for active skip buttons (`.ytp-ad-skip-button-modern`).
- **`YouTubeObserver`**:
  - Subscribes to YouTube's native CustomEvents: `yt-navigate-finish`, `yt-page-data-updated`, and `popstate`.
  - Dispatches route updates to handlers without timer-based polling.
- **`YouTubeCompatibility`**:
  - Injects YouTube-specific cosmetic ad styles (`#masthead-ad`, `.ytp-ad-module`, `ytd-banner-promo-renderer`).
  - When an ad interrupts video playback:
    - Automatically triggers skip button clicks.
    - If unskippable, mutes audio and fast-forwards the ad to completion.
    - Automatically restores volume, un-mutes, and resets playback rate when legitimate video resumes.
  - Operates strictly within player display controls—**never modifies media source extensions, DRM, or access keys.**

### 2.4 Filter-List Compiler (`parser/`)
Translates standard EasyList / Adblock Plus syntax into Manifest V3 DNR JSON rules:

```
Input Line
   │
   ▼
FilterParser
   ├── Comments / Empty lines ────> Ignored
   ├── Cosmetic (##, #@#) ────────> CosmeticRule
   └── Network (||, @@, $) ───────> IntermediateRule
                                           │
                                           ▼
                                     RuleValidator
                                           │ (Check wildcards, valid syntax)
                                           ▼
                                     RuleConverter
                                           │
                                           ▼
                         chrome.declarativeNetRequest.Rule
```

---

## 3. Dynamic Rule ID Allocation Strategy

To avoid ID collisions across multiple rulesets and features, IDs are partitioned into designated numerical ranges:

| Range | Purpose | Managed By |
| :--- | :--- | :--- |
| `1000 - 1999` | Static Ads Ruleset | `rules/ads/rules.json` |
| `2000 - 2999` | Static Privacy Ruleset | `rules/privacy/rules.json` |
| `3000 - 3999` | Static Annoyances Ruleset | `rules/annoyances/rules.json` |
| `4000 - 4999` | Static Malware Ruleset | `rules/malware/rules.json` |
| `5000 - 5999` | Static YouTube Ruleset | `rules/youtube/rules.json` |
| `100000 - 199999` | Dynamic Site Whitelists | `RuleManager.setSiteWhitelisted` |
| `200000 - 299999` | Custom User DNR Rules | `RuleManager.applyCustomRules` |
| `300000 - 399999` | Downloaded Filter Updates | `FilterUpdateManager` |

---

## 4. Build & Bundling Architecture

Chromium Manifest V3 enforces strict module separation:
1. **Background Service Worker**: Bundled as a standalone ES module (`background/service-worker.js`).
2. **Content Scripts**: Bundled as **self-contained IIFEs** (`content/content.js` and `content/element-picker.js`). Chrome content scripts do not support relative ES dynamic imports; using IIFEs guarantees immediate execution without syntax errors.
3. **UI Windows**: Popup (`popup/index.html`), Options (`options/index.html`), and Blocked warning page (`blocked/index.html`) are compiled with Vite and React 19.

