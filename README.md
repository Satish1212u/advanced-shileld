# Advanced AdBlocker & Privacy Shield

A production-grade, high-performance browser ad-blocking and privacy extension for Chromium-based browsers built on **Manifest V3**.

![Shield Status](https://img.shields.io/badge/Manifest-V3-blue.svg)
![Type](https://img.shields.io/badge/TypeScript-Strict-blue.svg)
![Performance](https://img.shields.io/badge/Zero--Overhead-Native_DNR-emerald.svg)
![Tests](https://img.shields.io/badge/Vitest-Passing-emerald.svg)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Installation & Quick Start](#installation--quick-start)
- [How to Load Unpacked in Chromium](#how-to-load-unpacked-in-chromium)
- [Network Filtering (`declarativeNetRequest`)](#network-filtering-declarativenetrequest)
- [Filter List Pipeline & Compiler](#filter-list-pipeline--compiler)
- [Cosmetic Filtering Engine](#cosmetic-filtering-engine)
- [YouTube Compatibility Subsystem](#youtube-compatibility-subsystem)
- [Interactive Element Picker](#interactive-element-picker)
- [Permissions & Least Privilege](#permissions--least-privilege)
- [Testing & Quality Verification](#testing--quality-verification)
- [Performance Benchmarks](#performance-benchmarks)
- [Security & Privacy Model](#security--privacy-model)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

Modern web advertising degrades browser performance, consumes bandwidth, and exposes users to invasive surveillance. **Advanced AdBlocker & Privacy Shield** is designed from the ground up to solve these challenges using Chromium's **Manifest V3 Declarative Net Request (DNR)** API combined with an intelligent cosmetic engine and dedicated YouTube SPA event-driven ad suppression.

### Core Priorities:
1. **Fast Performance**: Heavy regex evaluations are offloaded to Chromium's native C++ network engine. Zero JavaScript parsing overhead during page loads.
2. **Reliable Ad Blocking**: Dual-layer defense combining network request prevention and CSS cosmetic element collapsing.
3. **Robust YouTube Compatibility**: Handles single-page app (SPA) navigations (`Home -> Search -> Video -> Shorts`) without polling, automatically fast-forwards unskippable prerolls, and dismisses skip buttons without degrading video quality or breaking DRM.
4. **Privacy Protection**: Blocks tracking beacons, telemetry pixels, analytics SDKs, and third-party cookies.
5. **Safe Failure**: Guarantees that invalid filter feeds or corrupt rules never crash the browser or brick websites.

---

## Key Features

- **Declarative Network Filtering**: 5 static rulesets (`rules_ads`, `rules_privacy`, `rules_annoyances`, `rules_malware`, `rules_youtube`) plus dynamic priority rules for user whitelists and updates.
- **Fast Cosmetic Engine**: Uses browser-native CSS injection combined with a throttled MutationObserver with circuit-breaker protection (max 400 mutations/sec) and a `WeakSet` to prevent memory leaks and infinite loops.
- **YouTube Compatibility Layer**: Listens directly to YouTube's internal `yt-navigate-finish` events, hides overlays, clicks skip buttons, and restores audio/playback seamlessly.
- **Interactive Element Picker**: Visual target selector allowing users to click any unwanted DOM node. Generates resilient, non-fragile CSS selectors (ignoring auto-generated hashes like `ember1234` or `css-9xa8b`) and permanently hides them on that domain.
- **Per-Site Controls & Whitelisting**: One-click toggles in the popup for instant site allowlisting via dynamic `ALLOW_ALL_REQUESTS` rules.
- **Batched Statistics Engine**: Tracks blocked ads, trackers, cosmetic elements, and estimated bandwidth savings. Flushes to `chrome.storage.local` with debouncing to avoid I/O bottlenecks.
- **Automatic Filter List Updates**: Automated background updates via `chrome.alarms` with strict AST validation and atomic rollback if downloaded rules are malformed.

---

## Architecture Overview

```
advanced-adblocker/
├── dist/                              # Production Chromium extension bundle
│   ├── manifest.json
│   ├── background/service-worker.js   # Background service worker (ES module)
│   ├── content/
│   │   ├── content.js                 # Primary content script (Self-contained IIFE)
│   │   └── element-picker.js          # Interactive DOM element picker (IIFE)
│   ├── popup/index.html               # React + Tailwind popup dashboard
│   ├── options/index.html             # React + Tailwind options & rules manager
│   ├── blocked/index.html             # Malware / Threat warning page
│   ├── rules/                         # Compiled declarativeNetRequest JSON rulesets
│   └── icons/                         # 16px, 48px, 128px PNG shield icons
│
├── extension/                         # Extension source code
│   ├── background/                    # RuleManager, StatsManager, SiteManager, FilterUpdateManager
│   ├── content/                       # CosmeticEngine, ElementPicker, YouTube Compatibility
│   ├── popup/                         # Popup UI React components
│   ├── options/                       # Options UI React components
│   ├── blocked/                       # Threat warning UI
│   ├── rules/                         # Raw static rule definitions
│   └── shared/                        # Types, constants, and utilities
│
├── parser/                            # Adblock Plus / EasyList AST Parser & Compiler
│   ├── filter-parser.ts
│   ├── rule-validator.ts
│   ├── rule-converter.ts
│   ├── easylist-parser.ts
│   └── easyprivacy-parser.ts
│
├── scripts/
│   ├── build-extension.ts             # Multi-target Vite production bundler
│   ├── build-rules.ts                 # Compiles filter lists to DNR JSON rulesets
│   └── update-filters.ts              # Filter list CLI update script
│
├── tests/                             # Vitest unit, integration, and performance tests
│   ├── parser/
│   ├── rules/
│   ├── cosmetic/
│   ├── youtube/
│   ├── stats/
│   └── performance/
```

---

## Installation & Quick Start

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript strict type-check
npm run typecheck

# 3. Run automated test suite
npm run test

# 4. Compile the production extension bundle
npm run build
```

The output will be created in the `dist/` directory.

---

## How to Load Unpacked in Chromium

1. Open any Chromium browser (Google Chrome, Brave, Edge, Chromium).
2. Navigate to `chrome://extensions` in the address bar.
3. Toggle the **Developer mode** switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker dialog, select the `dist/` folder from this project:
   ```
   c:\Users\ASUS\Desktop\add blocker\dist
   ```
6. The extension **Advanced AdBlocker & Privacy Shield** will appear in your extensions list. Pin it to your toolbar to test the popup and live badge counters!

---

## Network Filtering (`declarativeNetRequest`)

Network blocking operates at the browser level through `chrome.declarativeNetRequest`.

### Supported Rule Actions:
- `block`: Denies matching network requests.
- `allow`: Overrides block rules with higher priority (used for exceptions).
- `allowAllRequests`: Dynamic site whitelist rules allowing all resources on trusted domains.

### Supported Resource Types:
- `script`
- `image`
- `stylesheet`
- `font`
- `media`
- `xmlhttprequest`
- `sub_frame`
- `ping`
- `websocket`
- `other`

---

## Filter List Pipeline & Compiler

The extension avoids hard-coding rules. Instead, it utilizes an intermediate representation (IR) compiler:

```
Filter List Text (EasyList / EasyPrivacy)
                 ↓
     FilterParser (Tokenization)
                 ↓
      IntermediateRule (AST)
                 ↓
  RuleValidator (Safety & Syntax)
                 ↓
  RuleConverter (DNR / Cosmetic)
                 ↓
   Compiled Rules (dist/rules/*.json)
```

### Safety & Validation Rules:
- Overly broad patterns (e.g. `*` or `http*`) that could block entire websites are caught and rejected by `RuleValidator`.
- Malformed regexes and unbalanced cosmetic selectors are safely filtered.
- Unknown procedural scriptlets (e.g. `+js(...)`) are logged during development and discarded without crashing the parser.

---

## Cosmetic Filtering Engine

Cosmetic element hiding operates via `CosmeticEngine`:
1. **Native CSS Stylesheet**: Injects a unified `<style>` tag into `document.head` containing combined common ad selectors and custom user selectors (`display: none !important; height: 0 !important;`). The browser's C++ rendering engine collapses these elements with zero JavaScript execution overhead.
2. **Targeted MutationObserver**: Only watches newly inserted elements (`mutation.type === 'childList'`).
3. **Circuit Breaker**: If dynamic script mutations exceed 400 mutations per second, the observer throttles to protect CPU and battery life.
4. **Memory Leak Prevention**: Uses a JavaScript `WeakSet` to track processed nodes, ensuring elements are never repeatedly evaluated or retained in memory after DOM unmounting.

---

## YouTube Compatibility Subsystem

YouTube employs a complex Single Page Application (SPA) architecture with custom HTML5 video player components (`.html5-video-player`).

### Layered Handling:
1. **Network Filtering**: Blocks analytics beacons, telemetry pings, and ad logging calls (`youtube.com/api/stats/ads`, `youtube.com/pagead/*`, `youtube.com/ptracking`).
2. **SPA Route Tracking**: Hooks into YouTube's native CustomEvents (`yt-navigate-finish`, `yt-page-data-updated`, and `popstate`) to transition between Home, Search, Video, Channel, and Shorts views without page reloads.
3. **Cosmetic Suppression**: Collapses `#masthead-ad`, `ytd-banner-promo-renderer`, `ytd-in-feed-ad-layout-renderer`, `ytd-ad-slot-renderer`, and `.ytp-ad-module`.
4. **Ad Player Handling**: When the player enters the `ad-showing` state:
   - Instantly clicks skip buttons (`.ytp-ad-skip-button`, `.ytp-ad-skip-button-modern`) when rendered.
   - For unskippable prerolls, mutes audio and fast-forwards the ad to its duration.
   - When normal video resumes, restores original volume and resets playback rate to 1.0.
   - **Never violates DRM, encryption, or authentication tokens.**

---

## Interactive Element Picker

Users can block custom intrusive elements:
1. Click **"Block Element on This Page"** in the extension popup.
2. Hovering over webpage elements displays a high-contrast red outline (`2px solid #ef4444`).
3. Clicking an element opens the confirmation card showing the generated CSS selector.
4. `generateStableSelector` ignores volatile IDs (e.g. `id="ember1928"` or `id=":r1:"`) and framework classes (`.css-19v82a`), producing clean semantic selectors (e.g. `aside.sidebar-widget > div:nth-of-type(2)`).
5. Clicking **"Block Element"** immediately hides the element and persists the rule in `chrome.storage.local`.

---

## Permissions & Least Privilege

| Permission | Purpose | Why It Is Necessary |
| :--- | :--- | :--- |
| `declarativeNetRequest` | Network Filtering | Primary API to block ad and tracking requests natively in Chromium. |
| `storage` | Persistence | Stores user preferences, whitelisted domains, statistics, and custom rules locally. |
| `alarms` | Background Updates | Schedules periodic filter updates without keeping a persistent background timer running. |
| `activeTab` | Element Picker | Grants temporary access to inspect DOM elements when the user triggers the element picker. |
| `scripting` | Dynamic Injection | Allows the element picker dialog and events to be injected into the active tab on demand. |
| `<all_urls>` (Host) | Global Protection | Required for network blocking rules across third-party ad networks and injecting cosmetic stylesheets into arbitrary domains. |

---

## Testing & Quality Verification

Automated testing is built on **Vitest**.

```bash
# Run all unit, integration, and performance tests
npm run test

# Run tests with code coverage
npm run test:coverage
```

### Test Suites Included:
- `tests/parser/filter-parser.test.ts`: Validates parsing of EasyList comments, network rules, cosmetic rules, and exceptions.
- `tests/rules/rule-converter.test.ts`: Verifies conversion to Chrome DNR rules and cosmetic formats.
- `tests/rules/rule-validator.test.ts`: Ensures dangerous patterns are blocked and safe rules are accepted.
- `tests/rules/site-whitelist.test.ts`: Tests URL domain extraction and dynamic `ALLOW_ALL_REQUESTS` rules.
- `tests/youtube/youtube.test.ts`: Tests YouTube detector, page types, skip button presence, and observer subscriptions.
- `tests/stats/stats-manager.test.ts`: Verifies block counts, data saved calculations, and storage batching.
- `tests/performance/performance.test.ts`: Benchmarks parser speed over 1,000 rules.

---

## Performance Benchmarks

- **Rule Parsing Speed**: 1,000 rules parsed and validated in under 30ms.
- **Content Script Bundle Size**: ~17 KB minified IIFE (5.6 KB gzip).
- **Background Worker Size**: ~30 KB minified ES module (8.5 KB gzip).
- **Storage Write Batching**: Updates are debounced and committed every 2,000ms, eliminating high-frequency disk I/O.
- **MutationObserver Circuit Breaker**: Caps DOM processing at 400 mutations/sec to guarantee 60 FPS scrolling.

---

## Security & Privacy Model

- **Local Execution**: All parsing, filtering, and storage operations run 100% locally on your machine. No telemetry or browsing history is sent to any external server.
- **Threat Warning System**: Known malware and cryptojacking destinations are redirected or flagged with an interstitial warning page (`blocked/index.html`) explaining the risk with an option to go back or override.
- **No Eval / No Remote Code**: Strict Content Security Policy compliant. No `eval()`, `new Function()`, or dynamic remote script execution.
- **Safe Rollback**: Downloaded filter list updates are verified against strict schema tests. If an update fails, the previous working ruleset remains active.

---

## Troubleshooting

### Q: Why do ads still show on a specific site?
- Check the popup to verify filtering is enabled on that site.
- If the ad is an internal image or new network domain, click **"Block Element on This Page"** to hide the ad container permanently.

### Q: Does the extension work on YouTube Shorts and video playlists?
- Yes. The YouTube compatibility engine monitors `yt-navigate-finish` events and maintains ad suppression across all SPA page routes.

---

## Contributing

1. Fork the repository and create a feature branch (`git checkout -b feature/improvement`).
2. Verify all tests pass and code typechecks:
   ```bash
   npm run typecheck
   npm run test
   npm run build
   ```
3. Submit a pull request with a detailed description of your changes.

