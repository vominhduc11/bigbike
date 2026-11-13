/* Official web-vitals collector for scripted lab observations, never field data. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = '5.1.0';

function installInDocument() {
  if (window !== window.top) return;
  const supported = !!(window.PerformanceEventTiming
    && 'interactionId' in PerformanceEventTiming.prototype
    && PerformanceObserver.supportedEntryTypes.includes('event'));
  const state = window.__bbperfInp = {
    time_origin: performance.timeOrigin, supported, inp_ms: null,
    reports: 0, hidden_flushes: 0, trusted_inputs: 0,
  };
  const report = () => window.__bbperfReportInp({ ...state }).catch(() => {});
  // One observer registration per document. The official library also flushes
  // pending Event Timing records on the native page-hidden transition.
  webVitals.onINP(metric => {
    state.inp_ms = Number.isFinite(metric.value) && metric.value >= 0 ? metric.value : null;
    state.reports += 1;
    report();
  }, { reportAllChanges: true, durationThreshold: 16 });
  for (const type of ['click', 'keydown']) {
    addEventListener(type, event => {
      if (event.isTrusted) {
        state.trusted_inputs += 1;
        report();
      }
    }, { capture: true, passive: true });
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      state.hidden_flushes += 1;
      // Run after the official hidden handlers have processed their records.
      queueMicrotask(report);
    }
  }, { capture: true });
  report();
}

class InpRecords {
  constructor() {
    this.records = new Map();
  }

  update(payload) {
    if (!payload || !Number.isFinite(payload.time_origin) || payload.time_origin <= 0
        || typeof payload.supported !== 'boolean') return null;
    if (!this.records.has(payload.time_origin)) {
      if (this.records.size >= 1000) throw Error('Lab INP document budget exceeded');
      this.records.set(payload.time_origin, {
        collector: 'web-vitals@' + VERSION, inp_lab_ms: null, inp_field_ms: null,
        supported: payload.supported, reports: 0, hidden_flushes: 0,
        trusted_input_events: 0, finalized_on_hidden: false,
        observation: 'interim reportAllChanges over scripted document interactions; full navigation may omit final interaction without a hidden callback',
        missing_reason: 'no trusted interaction observed',
      });
    }
    const record = this.records.get(payload.time_origin);
    // The binding receives only numeric/boolean values. Never copy metric.entries,
    // DOM targets, URLs, selectors, text, input values or application payloads.
    if (Number.isSafeInteger(payload.reports) && payload.reports >= record.reports
        && Number.isFinite(payload.inp_ms) && payload.inp_ms >= 0) record.inp_lab_ms = payload.inp_ms;
    for (const [source, destination] of [['reports', 'reports'], ['hidden_flushes', 'hidden_flushes'],
      ['trusted_inputs', 'trusted_input_events']]) {
      if (Number.isSafeInteger(payload[source]) && payload[source] >= 0) {
        record[destination] = Math.max(record[destination], payload[source]);
      }
    }
    record.finalized_on_hidden = record.hidden_flushes > 0;
    record.missing_reason = !record.supported ? 'Event Timing interactionId unsupported'
      : record.inp_lab_ms !== null ? null : record.trusted_input_events
        ? 'no INP callback in scripted observation window' : 'no trusted interaction observed';
    return record;
  }
}

function loadCollector(directory) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
  if (metadata.name !== 'web-vitals' || metadata.version !== VERSION) {
    throw Error('Pinned official web-vitals collector absent or wrong version');
  }
  const bytes = fs.readFileSync(path.join(directory, 'dist/web-vitals.iife.js'));
  return {
    source: bytes.toString() + '\n;(' + installInDocument.toString() + ')();',
    identity: { package: 'web-vitals', version: VERSION,
      bundle_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      duration_threshold_ms: 16, scope: 'interim scripted lab document; hidden finalization only when observed; not field INP' },
  };
}

async function installCollector(context, directory) {
  const collector = loadCollector(directory);
  const records = new InpRecords();
  await context.exposeBinding('__bbperfReportInp', (source, payload) => {
    if (source.frame === source.page.mainFrame()) records.update(payload);
  });
  // One combined init script guarantees library registration precedes our call.
  await context.addInitScript({ content: collector.source });
  return {
    identity: collector.identity,
    async record(page, settle = false) {
      if (settle) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForTimeout(300);
      }
      const state = await page.evaluate(() => window.__bbperfInp);
      if (!state) throw Error('Lab INP collector failed to initialize');
      return records.update(state);
    },
  };
}

module.exports = { InpRecords, loadCollector, installCollector };
