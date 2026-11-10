# 🛡️ Advanced AdBlocker & Privacy Shield

> A high-performance Chrome Extension for blocking ads, trackers, popups, annoying web content, and privacy-invasive requests — with dedicated YouTube protection.

<img width="359" height="517" alt="image" src="https://github.com/user-attachments/assets/68c27840-0027-40e6-8a19-5554abc8c670" />


## 🚀 Overview

**Advanced AdBlocker & Privacy Shield** is a Chromium-based browser extension designed to provide fast and privacy-focused web protection.

It combines **Chrome Manifest V3 Declarative Net Request (DNR)** rules with cosmetic filtering to block unwanted network requests and hide intrusive page elements.

The project also includes dedicated filtering for YouTube, privacy protection, annoyance blocking, malware-related domains, site whitelisting, statistics, and an element picker.

## ✨ Features

- 🚫 **Ad Blocking** — Blocks known advertising requests and domains
- 🕵️ **Tracker Protection** — Blocks common tracking and analytics requests
- 🎯 **Cosmetic Filtering** — Removes unwanted ads and page elements
- ▶️ **YouTube Protection** — Dedicated YouTube filtering and compatibility logic
- 🔐 **Privacy Shield** — EasyPrivacy-based privacy filtering
- ⚠️ **Malware Protection** — Filtering rules for known malicious domains
- 🔕 **Annoyance Blocking** — Removes intrusive popups and annoying page elements
- 🎨 **Element Picker** — Select and hide unwanted elements manually
- 🌐 **Site Whitelist** — Disable protection for trusted websites
- 📊 **Protection Statistics** — Track filtering activity
- 🔄 **Filter Updates** — Supports dynamic filter-rule updates
- ⚡ **Manifest V3 DNR** — Uses Chrome's native declarative request blocking
- 🧩 **Modern UI** — Popup dashboard and dedicated settings page

## 🏗️ Architecture

```text
┌──────────────────────────────────────┐
│          Chromium Browser            │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ Popup UI     │  │ Options UI   │  │
│  └──────┬───────┘  └──────┬───────┘  │
│         │                  │          │
│         └────────┬─────────┘          │
│                  ▼                    │
│        ┌───────────────────┐          │
│        │ Service Worker    │          │
│        │ Background Engine │          │
│        └─────────┬─────────┘          │
│                  │                    │
│        ┌─────────▼─────────┐          │
│        │ Rule Manager      │          │
│        │ Filter Manager    │          │
│        │ Stats Manager     │          │
│        └─────────┬─────────┘          │
│                  │                    │
│        ┌─────────▼─────────┐          │
│        │ Chrome DNR Engine │          │
│        └─────────┬─────────┘          │
│                  │                    │
│        ┌─────────▼─────────┐          │
│        │ Content Scripts   │          │
│        │ Cosmetic Filter   │          │
│        │ YouTube Engine    │          │
│        └───────────────────┘          │
│                                      │
└──────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Core application logic |
| React | Popup & options interface |
| Vite | Build tooling |
| Chrome Manifest V3 | Extension platform |
| Declarative Net Request | Network-level blocking |
| EasyList | Advertisement filtering |
| EasyPrivacy | Tracker/privacy filtering |
| Playwright | End-to-end testing |
| Vitest | Unit testing |
| Tailwind CSS | UI styling |

## 📁 Project Structure

```text
advanced-adblocker/
│
├── extension/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── rule-manager.ts
│   │   ├── filter-update-manager.ts
│   │   ├── site-manager.ts
│   │   └── stats-manager.ts
│   │
│   ├── content/
│   │   ├── content.ts
│   │   ├── cosmetic-engine.ts
│   │   ├── element-picker.ts
│   │   └── youtube/
│   │
│   ├── popup/
│   ├── options/
│   ├── blocked/
│   ├── rules/
│   └── shared/
│
├── parser/
│   ├── filter-parser.ts
│   ├── easylist-parser.ts
│   ├── easyprivacy-parser.ts
│   ├── rule-converter.ts
│   └── rule-validator.ts
│
├── scripts/
│   ├── build-extension.ts
│   ├── build-rules.ts
│   └── update-filters.ts
│
├── tests/
│   ├── parser/
│   ├── rules/
│   ├── stats/
│   ├── youtube/
│   ├── performance/
│   └── e2e/
│
├── dist/
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
├── PERFORMANCE.md
└── package.json
```

## ⚡ Installation

### Option 1 — Load Unpacked

1. Clone this repository:

```bash
git clone https://github.com/Satish1212u/advanced-shileld.git
cd advanced-shileld
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build
```

4. Open Chrome and go to:

```text
chrome://extensions/
```

5. Enable **Developer mode**.

6. Click **Load unpacked**.

7. Select the generated:

```text
dist/
```

folder.

The extension should now appear in your browser.

## 🧪 Testing

Run the unit test suite:

```bash
npm test
```

Run tests once:

```bash
npm run test:run
```

Run the production build:

```bash
npm run build
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## 🔒 Privacy

This extension is designed around a privacy-first architecture.

The extension primarily performs filtering locally inside the browser using Chrome's extension APIs and filtering rules.

It does not require an account to use the core blocking functionality.

For more information, see:

- [`SECURITY.md`](SECURITY.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)

## ⚠️ Beta Status

This project is currently in **Beta**.

The extension has been tested against common websites and YouTube scenarios, but ad-blocking behavior can change as websites update their advertising and anti-ad-block systems.

No ad blocker can guarantee that every advertisement on every website will always be blocked.

## 🗺️ Roadmap

- [x] Manifest V3 architecture
- [x] Network-level filtering
- [x] Cosmetic filtering
- [x] Privacy filtering
- [x] Annoyance filtering
- [x] YouTube-specific protection
- [x] Site whitelist
- [x] Element picker
- [x] Filter update pipeline
- [x] Popup dashboard
- [x] Automated tests
- [ ] Production-grade statistics improvements
- [ ] Chrome Web Store release
- [ ] More filter lists
- [ ] Advanced per-site controls
- [ ] Performance monitoring dashboard
- [ ] Android / Android TV companion version

## 🤝 Contributing

Contributions, bug reports, feature requests, and improvements are welcome.

If you find a problem:

1. Open an issue.
2. Describe the website and behavior.
3. Include relevant console/error information.
4. Explain the expected behavior.

Pull requests are welcome for improvements to the filtering engine, UI, performance, security, and testing.

## 📄 License

This project is licensed under the **MIT License**.

See [`LICENSE`](LICENSE) for details.

## ⭐ Support

If you find this project useful, consider giving it a ⭐ on GitHub.

---

### Built with ❤️ for a cleaner and more private web.
