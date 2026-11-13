const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { InpRecords, loadCollector } = require('./lab-inp.cjs');

test('unobserved and unsupported INP stay null instead of passing as zero', () => {
  const records = new InpRecords();
  const missing = records.update({ time_origin: 1, supported: true, inp_ms: null });
  assert.equal(missing.inp_lab_ms, null);
  assert.equal(missing.missing_reason, 'no trusted interaction observed');
  const unsupported = records.update({ time_origin: 2, supported: false });
  assert.equal(unsupported.inp_lab_ms, null);
  assert.match(unsupported.missing_reason, /unsupported/);
});

test('native hidden callback updates prior document record without mixing next document', () => {
  const records = new InpRecords();
  const search = records.update({ time_origin: 1, supported: true, inp_ms: 24, reports: 1, trusted_inputs: 2 });
  const product = records.update({ time_origin: 2, supported: true, inp_ms: 48, reports: 1 });
  records.update({ time_origin: 1, supported: true, inp_ms: 32, reports: 2, hidden_flushes: 1, trusted_inputs: 3 });
  assert.equal(search.inp_lab_ms, 32);
  assert.equal(search.hidden_flushes, 1);
  assert.equal(search.finalized_on_hidden, true);
  assert.equal(search.trusted_input_events, 3);
  assert.equal(product.inp_lab_ms, 48);
  assert.equal(search.inp_field_ms, null);
  records.update({ time_origin: 1, supported: true, inp_ms: 8, reports: 1 });
  assert.equal(search.inp_lab_ms, 32);
});

test('export excludes raw DOM, URL and payload values and rejects nonfinite measurements', () => {
  const records = new InpRecords();
  const report = records.update({ time_origin: 1, supported: true, inp_ms: Infinity,
    reports: 1, entries: [{ target: 'private-input', value: 'private@example.invalid' }],
    url: 'http://localhost/private?token=private', secret: 'private' });
  assert.equal(report.inp_lab_ms, null);
  assert.ok(!JSON.stringify(report).includes('private'));
  assert.equal(records.update({ time_origin: NaN, supported: true }), null);
});

test('collector rejects unpinned or unrelated packages before injection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bbperf-inp-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'web-vitals', version: '0.0.0' }));
    assert.throws(() => loadCollector(directory), /wrong version/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
