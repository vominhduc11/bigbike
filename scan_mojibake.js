// Mojibake scanner for bigbike-admin
// Uses Unicode codepoint ranges to detect double-encoded UTF-8 Vietnamese text
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules','dist','build','coverage','.git','.next','__pycache__','.turbo','public']);
const ALLOWED_EXTS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.mdx','.css','.scss','.sass','.html','.htm','.yaml','.yml','.txt']);

/*
 * Mojibake detection using Unicode codepoint ranges.
 *
 * When UTF-8 Vietnamese is opened as Windows-1252 (Latin-1) and re-saved as UTF-8:
 *   - 0xC2 byte -> U+00C2 (Â)
 *   - 0xC3 byte -> U+00C3 (Ã)
 *   - 0xE1 byte -> U+00E1 (á)
 *   - 0xBA byte -> U+00BA (º)
 *   - 0xBB byte -> U+00BB (»)
 *   - 0x80 byte (Win-1252) -> U+20AC (euro sign: â€)
 *
 * Reliable patterns (never valid in real Vietnamese text):
 *   1. U+00C2 or U+00C3 followed by U+0080-U+00BF  -> 2-byte seq mojibake
 *   2. U+00E1 followed by U+00B8-U+00BB             -> 3-byte Vietnamese mojibake (1Exx range)
 *   3. U+00E2 + U+20AC                              -> smart quote/dash mojibake (â€)
 *   4. U+FFFD                                       -> replacement character
 */
const C2 = 'Â'; // Â
const C3 = 'Ã'; // Ã

// Build a regex that detects the patterns described above
// Pattern 1: Ã or Â followed by continuation byte range U+0080-U+00BF
// Pattern 2: á (U+00E1) followed by ¸-» (U+00B8-U+00BB)
// Pattern 3: â€ sequence (U+00E2 + U+20AC)
// Pattern 4: replacement char (U+FFFD)
const MOJIBAKE = new RegExp(
  '[ÂÃ][-¿]' +
  '|á[¸-»]' +
  '|â€' +
  '|�'
);

const results = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      try {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (MOJIBAKE.test(line)) {
            results.push({ file: full, line: i + 1, text: line.trim().slice(0, 200) });
          }
        });
      } catch (e2) { /* skip binary/unreadable */ }
    }
  }
}

walk('bigbike-admin');

const byFile = {};
for (const r of results) {
  if (!byFile[r.file]) byFile[r.file] = [];
  byFile[r.file].push(r);
}

console.log('=== MOJIBAKE SCAN RESULTS ===\n');
for (const [file, hits] of Object.entries(byFile)) {
  console.log('\nFILE: ' + file + ' (' + hits.length + ' hits)');
  for (const h of hits) {
    console.log('  L' + h.line + ': ' + h.text);
  }
}
console.log('\n=== TOTAL: ' + results.length + ' lines across ' + Object.keys(byFile).length + ' files ===');
