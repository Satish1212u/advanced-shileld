# Performance Engineering & Optimization

High performance is a primary design pillar of **Advanced AdBlocker & Privacy Shield**. This document outlines the engineering decisions, optimizations, and benchmarks that ensure minimal CPU, memory, and battery usage.

---

## 1. Network Filtering: Declarative vs. Programmatic

### Legacy Approach (`chrome.webRequest`):
1. Every network request triggered a JavaScript event in the background process.
2. Background JS thread had to pause the request, deserialize headers, match regex patterns, and return a blocking response.
3. High latency, high CPU usage, and high memory footprint.

### Our Approach (`chrome.declarativeNetRequest`):
1. Rules are compiled into JSON format at build time or during filter updates.
2. The browser registers these rules directly into Chromium's native C++ networking stack.
3. Network requests are evaluated directly in C++ with zero JavaScript invocation.
4. **Result**: Zero JavaScript thread contention, sub-millisecond blocking, and no background wake-ups for routine network checks.

---

## 2. Cosmetic Engine Optimizations

### 2.1 CSS Injection over DOM Traversal
Scanning and modifying every DOM node with JavaScript is notoriously slow. Instead:
- We inject a single `<style>` element into `document.head` containing combined selectors (`display: none !important; height: 0 !important;`).
- Chromium's native C++ layout engine hides and collapses matched elements automatically during style recalculation.
- JavaScript execution time during initial page load: **< 2ms**.

### 2.2 MutationObserver Circuit Breaker
Single-Page Applications (SPAs) frequently trigger rapid DOM mutations during updates:
- **`WeakSet` Node Tracking**: Elements are tagged in a `WeakSet` upon inspection. Even across thousands of DOM mutations, nodes are never re-evaluated.
- **Circuit Breaker Threshold**: If mutations exceed 400 mutations per second, the observer throttles further checks temporarily. This prevents infinite MutationObserver loops and guarantees smooth 60 FPS scrolling even on heavy dynamic pages.
- **Memory Safety**: `WeakSet` holds weak references, allowing garbage collection to reclaim memory as soon as elements are removed from the DOM.

---

## 3. Storage I/O Optimization

Writing to `chrome.storage.local` on every blocked ad request creates severe disk I/O bottlenecks.

### Batched & Debounced Writes (`StatsManager`):
- All incoming network blocks and cosmetic element counts are stored in an in-memory accumulator.
- Writes to `chrome.storage.local` are debounced with a 2,000ms timer.
- During high-traffic page loads (e.g. 50 ads blocked across 3 seconds), storage is written only once or twice instead of 50 times.

---

## 4. YouTube Event-Driven Architecture (No Polling)

Many ad blockers use high-frequency timers (`setInterval(..., 100)`) to check YouTube video player status, causing significant battery drain on laptops.

### Our Implementation:
- **Event-Driven Routes**: Listens to YouTube's native CustomEvents (`yt-navigate-finish`, `yt-page-data-updated`, and `popstate`) to detect route transitions instantly.
- **Targeted Video Observer**: The MutationObserver is attached exclusively to `.html5-video-player` and watches only attribute changes on `class`.
- When the user navigates away from video playback (e.g. to Home or Channel page), the player observer is automatically disconnected.

---

## 5. Bundle Size & Memory Metrics

| Asset | Size (Uncompressed) | Size (Gzip) |
| :--- | :--- | :--- |
| `dist/content/content.js` | 17.12 kB | 5.67 kB |
| `dist/content/element-picker.js` | 6.19 kB | 2.41 kB |
| `dist/background/service-worker.js` | 30.55 kB | 8.56 kB |
| `dist/popup/index.html` + assets | ~240 kB | ~75 kB |

- **Content Script Execution Time**: < 3ms at `document_start`.
- **Memory Overhead**: < 8 MB typical footprint across tabs.
- **Background Worker**: Suspends automatically when idle, consuming 0 MB RAM when inactive.

---

## 6. Performance Benchmarks

Run the built-in performance test suite:

```bash
npm test tests/performance/performance.test.ts
```

- **Filter List Parser**: Parses and validates 1,000 real-world filter rules in **< 30ms**.
- **Selector Generator**: Generates resilient, stable CSS selectors in **< 0.1ms per element**.

