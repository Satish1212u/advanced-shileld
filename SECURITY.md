# Security & Privacy Model

This document outlines the security architecture, threat model, and privacy practices of **Advanced AdBlocker & Privacy Shield**.

---

## 1. Core Security Principles

### 1.1 Zero Remote Code Execution (No `eval`)
Manifest V3 prohibits dynamic code execution. The extension adheres strictly to this policy:
- No `eval()`, `new Function()`, or `setTimeout("string")`.
- All extension pages enforce a strict Content Security Policy (`script-src 'self'`).
- Filter list updates contain only declarative patterns and CSS selectors; executable scriptlets are rejected.

### 1.2 Least Privilege
Permissions are strictly scoped to the capabilities required for ad-blocking and privacy protection:
- **`declarativeNetRequest`**: Used for network-level request blocking.
- **`storage`**: Stores user preferences, whitelists, and statistics locally.
- **`alarms`**: Coordinates background updates without long-lived background loops.
- **`activeTab` & `scripting`**: Injects the element picker only when explicitly triggered by the user.
- **`<all_urls>`**: Required as a host permission so that network blocking rules apply across third-party ad exchanges and cosmetic rules can be injected into any website.

---

## 2. Privacy & Data Handling

### 2.1 100% Local Processing
- **No Browsing History Collection**: The extension never logs, transmits, or records user browsing history.
- **No External Analytics**: There are no analytics trackers, telemetry pings, or diagnostic beacons embedded in the extension.
- **No Cloud Backend**: All filtering, selector matching, and statistics tracking occur locally on the user's device.

### 2.2 Statistics Engine Privacy
- Blocked counts are stored as aggregate counters associated only with domain names (e.g. `example.com: 14 ads blocked`).
- Full URLs, query parameters, search queries, and request bodies are never retained.

---

## 3. Filter List Ingestion & Validation

When updating filter lists from public sources:

1. **Schema Validation**: Downloaded content is parsed into an Abstract Syntax Tree (AST) using `FilterParser`.
2. **Dangerous Pattern Detection**: `RuleValidator` flags and rejects dangerous rules:
   - Wildcards that could block all web traffic (e.g. `*`, `https://*`).
   - Unbalanced quotes or brackets in CSS selectors.
   - Selectors containing pseudo-execution vectors (e.g. `javascript:` or embedded HTML tags).
3. **Atomic Activation & Rollback**: Rules are tested through `chrome.declarativeNetRequest.updateDynamicRules`. If the browser rejects any rule, the transaction aborts and previous working rules remain active.

---

## 4. Threat Defense & Malware Warning System

The extension includes a dedicated malware protection layer (`rules_malware`):
- Known malicious, cryptojacking, and phishing domains are intercepted at the network layer.
- Navigating to a blocked threat triggers the Security Warning page (`blocked/index.html`).
- The warning page informs the user why the domain was blocked, provides a safe one-click "Back to Safety" button, and offers an advanced manual override option if the user explicitly chooses to proceed.

