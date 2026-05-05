// Fix vi.json mojibake using data-driven character mapping
// Strategy:
//   1. Clean version (79dc208) has correct Vietnamese for existing keys
//   2. Mojibake version (HEAD) has same keys broken + 34 new keys broken
//   3. Build mojibake→correct char mapping from aligned key pairs
//   4. Apply mapping to the 34 new keys
//   5. Merge clean base + fixed new keys → final output

'use strict';
const fs = require('fs');
const { execSync } = require('child_process');

const cleanJson = execSync('git show 79dc208:bigbike-admin/src/locales/vi.json').toString();
const mojiJson  = execSync('git show HEAD:bigbike-admin/src/locales/vi.json').toString();

const clean = JSON.parse(cleanJson);
const moji  = JSON.parse(mojiJson);

// --- Build character mapping from aligned pairs ---
const charMap = new Map(); // mojibake char -> correct char sequence

function flatValues(obj, prefix = '') {
  const result = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k;
    if (typeof v === 'object' && v !== null) result.push(...flatValues(v, path));
    else result.push([path, v]);
  }
  return result;
}

const cleanFlat = new Map(flatValues(clean));
const mojiFlat  = new Map(flatValues(moji));

// Build mapping by aligning chars position-by-position for shared keys
// where clean value != moji value (i.e., the key was mojibaked)
for (const [key, cleanVal] of cleanFlat) {
  const mojiVal = mojiFlat.get(key);
  if (!mojiVal || mojiVal === cleanVal) continue; // skip unchanged / new keys

  // Simple approach: find longest common subsequence is too complex.
  // Instead, since we know the ASCII parts are identical, align by ASCII boundaries.
  // Split both strings into segments of ASCII runs and non-ASCII chars.
  const cleanParts = splitAsciiNonAscii(cleanVal);
  const mojiParts  = splitAsciiNonAscii(mojiVal);

  // Try to align: consecutive ASCII segments should match.
  // This allows us to pair up non-ASCII segments.
  alignAndMap(cleanParts, mojiParts, charMap);
}

function splitAsciiNonAscii(str) {
  // Returns array of {type: 'ascii'|'high', text: string}
  const parts = [];
  let current = '';
  let currentType = null;
  for (const ch of str) {
    const isAscii = ch.codePointAt(0) < 128;
    const type = isAscii ? 'ascii' : 'high';
    if (type !== currentType) {
      if (current) parts.push({ type: currentType, text: current });
      current = ch;
      currentType = type;
    } else {
      current += ch;
    }
  }
  if (current) parts.push({ type: currentType, text: current });
  return parts;
}

function alignAndMap(cleanParts, mojiParts, map) {
  // Walk both arrays simultaneously, matching ASCII segments.
  // When we find matching ASCII segments, pair up the high segments between them.
  let ci = 0, mi = 0;
  while (ci < cleanParts.length && mi < mojiParts.length) {
    const cp = cleanParts[ci];
    const mp = mojiParts[mi];
    if (cp.type === 'ascii' && mp.type === 'ascii') {
      if (cp.text === mp.text) { ci++; mi++; }
      else { ci++; mi++; } // mismatch in ASCII, skip
    } else if (cp.type === 'high' && mp.type === 'high') {
      // Pair these non-ASCII segments: mojiParts.text -> cleanParts.text
      if (!map.has(mp.text)) map.set(mp.text, cp.text);
      ci++; mi++;
    } else {
      // One is ASCII and other is high - skip misaligned
      if (cp.type === 'ascii') ci++;
      else mi++;
    }
  }
}

console.log('Mapping table entries:', charMap.size);

// --- Apply mapping to fix a mojibake string ---
function fixMojibake(str) {
  // Try to replace known mojibake substrings with correct chars.
  // Sort by length descending to match longer patterns first.
  const entries = [...charMap.entries()].sort((a, b) => b[0].length - a[0].length);

  let result = str;
  // Build a single regex that matches any mojibake pattern
  // Escape each pattern for use in regex
  const patterns = entries.map(([moji]) => moji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  // Apply replacements
  for (const [moji, correct] of entries) {
    result = result.split(moji).join(correct);
  }
  return result;
}

// --- Find and fix the 34 new keys ---
function flatKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k;
    if (typeof v === 'object' && v !== null) {
      for (const key of flatKeys(v, path)) keys.add(key);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

const cleanKeys = flatKeys(clean);
const newKeys = [...mojiFlat.keys()].filter(k => !cleanKeys.has(k));
console.log('New keys to fix:', newKeys.length);

// Fix new key values
const fixes = new Map();
for (const key of newKeys) {
  const broken = mojiFlat.get(key);
  const fixed  = fixMojibake(broken);
  fixes.set(key, fixed);
  console.log(`  ${key}: "${broken}" -> "${fixed}"`);
}

// --- Merge: start with clean, add fixed new keys ---
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// Deep clone clean
const result = JSON.parse(cleanJson);

// Insert new keys into their proper sections (maintaining order from moji version)
// We need to insert them in the right sections
for (const [key, value] of fixes) {
  setNestedKey(result, key, value);
}

// Write with same formatting as original (2-space indent, CRLF)
const output = JSON.stringify(result, null, 2).replace(/\n/g, '\r\n');
fs.writeFileSync('bigbike-admin/src/locales/vi.json', output, 'utf8');

console.log('\nDone. vi.json written with', newKeys.length, 'new keys fixed and merged with clean base.');

// Verify: re-scan for mojibake
const MOJIBAKE = /[\xC2\xC3][\x80-\xBF]|[á][¸-»]/;
const written = fs.readFileSync('bigbike-admin/src/locales/vi.json', 'utf8');
const remaining = written.split('\n').filter(line => MOJIBAKE.test(line));
console.log('Remaining mojibake lines after fix:', remaining.length);
if (remaining.length > 0) {
  remaining.slice(0, 5).forEach(l => console.log(' ', l.trim()));
}
