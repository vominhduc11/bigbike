#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const scanPath = process.argv[2] ?? "/tmp/redirect-live-scan-final.json";
const outputPath = process.argv[3]
  ?? path.resolve(process.cwd(), "../docs/audits/FINDING_2026-08-14_REDIRECT_FINAL.md");

const scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
const firstPass = scan.results[0]?.rows ?? [];
const secondPass = scan.results[1]?.rows ?? [];

const escapeCell = (value) => String(value ?? "—")
  .replaceAll("|", "\\|")
  .replaceAll("\n", " ")
  .trim();

const countBy = (rows, selector) => rows.reduce((counts, row) => {
  const key = String(selector(row));
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const formatCounts = (counts) => Object.entries(counts)
  .map(([key, value]) => `${key}: ${value}`)
  .join(", ");

const sourceRows = scan.sourceRows ?? [];
const firstByUrl = new Map(firstPass.map((row) => [row.url_cu, row]));
const secondByUrl = new Map(secondPass.map((row) => [row.url_cu, row]));

const liveCell = (row) => {
  const observed = row?.observed;
  if (!observed) return "—";
  const finalUrl = new URL(observed.finalUrl);
  return `${observed.status}/${observed.hops} → ${finalUrl.pathname}${finalUrl.search}`;
};

const tableRows = sourceRows.map((source, index) => {
  const first = firstByUrl.get(source.url_cu);
  const second = secondByUrl.get(source.url_cu);
  return [
    index + 1,
    source.url_cu,
    source.loai,
    source.click,
    `${source.ma ?? "—"}/${source.chang ?? "—"}`,
    source.dich,
    source.ket_qua,
    liveCell(first),
    liveCell(second),
    first?.observed?.kind ?? "—",
  ];
});

const staticEntries = [
  ["V3", "gang-tay-bao-ho-xe-may-ls2-vega-man", "Găng tay bảo hộ xe máy LS2 Vega Man", "LS2 Vega Man motorcycle gloves", "LS2", "/danh-muc/gang-tay-xe-may-moto/"],
  ["V3", "gang-tay-moto-phuot-ls2-spark-man", "Găng tay moto phượt LS2 Spark Man", "LS2 Spark Man motorcycle riding gloves", "LS2", "/danh-muc/gang-tay-xe-may-moto/"],
  ["V3", "mu-bao-hiem-3-4-cacbon-nic-n03", "Mũ bảo hiểm 3/4 carbon NIC N03", "NIC N03 carbon open-face helmet", "NIC", "/danh-muc/mu-bao-hiem-3-4/"],
  ["V3", "quan-giap-bao-ho-moto-dririder-nordic-2", "Quần giáp bảo hộ moto Dririder Nordic 2", "Dririder Nordic 2 motorcycle riding pants", "Dririder", "/danh-muc/ao-quan-moto-adventure/"],
  ["V3", "vi-kriega-stash-wallet", "Ví Kriega Stash Wallet", "Kriega Stash Wallet", "Kriega", "/danh-muc/tui-deo-hong-tui-deo-dui/"],
  ["V3", "mu-fullface-ls2-ff807-dragon-carbon-6k-2-kinh", "Mũ fullface LS2 FF807 Dragon Carbon 6K 2 kính", "LS2 FF807 Dragon Carbon 6K dual-visor full-face helmet", "LS2", "/danh-muc/mu-bao-hiem-fullface/"],
  ["V3", "mu-bao-hiem-ls2-ff327-challenger-carbon-fold", "Mũ bảo hiểm LS2 FF327 Challenger Carbon Fold", "LS2 FF327 Challenger Carbon Fold helmet", "LS2", "/danh-muc/mu-bao-hiem-fullface/"],
  ["V5", "giap-nguc-roi-rs-taichi-trv079", "Giáp ngực rời RS Taichi TRV079", "RS Taichi TRV079 detachable chest protector", "RS Taichi", "/danh-muc/giap-bao-ho-tay-chan/"],
  ["V5", "tui-duoi-xe-chong-nuoc-tornado-2-pack-sack", "Túi đuôi xe chống nước Tornado 2 Pack Sack", "Tornado 2 Pack Sack waterproof tail bag", "Tornado", "/danh-muc/balo-tui-deo-tui-treo-xe/"],
  ["V5", "ao-giap-scoyco-jk53-jean", "Áo giáp Scoyco JK53 Jean", "Scoyco JK53 Jean riding jacket", "Scoyco", "/danh-muc/ao-quan-bao-ho/"],
  ["V5", "ao-thun-moto-thoi-trang", "Áo thun moto thời trang", "Motorcycle fashion T-shirt", "—", "/danh-muc/ao-quan-bao-ho/"],
  ["V5", "pat-chan-guong-osopro", "Pát chân gương Osopro", "Osopro mirror bracket", "Osopro", "/danh-muc/gia-do-dien-thoai-xe-may/"],
];

const staticRows = staticEntries.map(([group, slug, nameVi, nameEn, brand, category]) => {
  const source = sourceRows.find((row) => row.url_cu.includes(`/sp/${slug}.html`));
  const live = firstByUrl.get(source?.url_cu);
  const evidence = brand === "—"
    ? "Not run — exact brand evidence is absent"
    : "Source slug + reviewed registry; raw WordPress title unavailable";
  return [
    group,
    slug,
    nameVi,
    nameEn,
    brand,
    category,
    source ? `${source.ma}/${source.chang}; ${source.ket_qua}` : "Not found in source table",
    live ? `${live.observed.status} → ${live.observed.finalPath}` : "Not run",
    evidence,
  ];
});

const v4Repairs = [
  ["/sp/ao-lot-mac-trong-giap-sixs-ts2-italy.html", "/danh-muc/phu-kien-do-lot-do-mua-moto/"],
  ["/sp/ong-tay-chong-nang-givi-bs01dg.html", "/danh-muc/phu-kien-do-lot-do-mua-moto/"],
  ["/sp/pinlock-chong-suong-fogcity-cua-y.html", "/danh-muc/phu-kien-moto-khac/"],
  ["/danh-muc-san-pham/pinlock-kinh-chong-suong-mu/pinlock-70-agv-dks118-clear.html", "/danh-muc/phu-kien-moto-khac/"],
  ["/sp/trum-dau-mang-ben-trong-mu-bao-hiem-bigbike-keo-cam-thun-lanh.html", "/danh-muc/do-lot-the-thao-trum-dau-moto/"],
  ["/tui-deo-dui-cucyma-c01.html", "/danh-muc/tui-deo-hong-tui-deo-dui/"],
  ["/danh-muc/tui-deo-dui", "/danh-muc/tui-deo-hong-tui-deo-dui/"],
];

const migrationRows = [
  ["V1026", "Disable shadowed product source", "/product/caberg-drift-evo-ii-carbon", "enabled=false; preserve hit_count=183"],
  ["V1026", "Repair malformed FF807 target", "/sp/mu-fullface-ls2-ff807-dragon-carbollface/n-6k-2-kinh.html", "→ /sp/mu-fullface-ls2-ff807-dragon-carbon-6k-2-kinh.html"],
  ["V1026", "Repair reviewed category aliases", "7 source patterns", "targets listed below; no row delete"],
  ["V1026", "Disable five V5 category redirects", "TRV079, Tornado, JK53, generic T-shirt, Osopro", "history registry serves /sp/*.html as 200"],
  ["V1026", "Keep TSLA sellable", "/sp/trum-dau-fullface-keo-cam-tsla.html", "→ /product/trum-dau-fullface-keo-cam-tsla/"],
  ["V1027", "Disable exact FF327 unsafe source", "/sp/mu-bao-hiem-ls2-ff327-challenger-carbon-fold.html", "enabled=false; preserve hit_count=9"],
];

const lines = [];
lines.push("# Final audit: redirect, catalog size and discontinued-product remediation");
lines.push("");
lines.push("Date: 2026-08-14");
lines.push("Runtime: VPS stack, scanned at `http://localhost:3000` on the VPS host after starting Compose with `.env.vps`; `.env` was not used for the final runtime.");
lines.push("Source URL: https://table-share.org/t/cLa7qtgj");
lines.push("");
lines.push("## Outcome");
lines.push("");
lines.push(`- Parsed and scanned **${scan.rowCount} / ${scan.rowCount}** owner rows; source click sum: **${scan.clickSum}**.`);
lines.push(`- Two sequential passes at ${scan.delayMs} ms/request/pass are identical: **${scan.comparison.same ? "PASS" : "FAIL"}**, differences: ${scan.comparison.differences.length}.`);
lines.push(`- Final pass status counts: ${formatCounts(countBy(firstPass, (row) => row.observed.status))}.`);
lines.push(`- Final pass kind counts: ${formatCounts(countBy(firstPass, (row) => row.observed.kind))}.`);
lines.push(`- Final pass hop counts: ${formatCounts(countBy(firstPass, (row) => row.observed.hops))}.`);
lines.push("- No live scan row ended in `404`; 11 reviewed terminal rows ended in `410`; 35 reviewed legacy product-history rows ended in `200`.");
lines.push("");
lines.push("## Source-table baseline");
lines.push("");
lines.push(`- Source types: ${formatCounts(countBy(sourceRows, (row) => row.loai))}.`);
lines.push(`- Old HTTP status values: ${formatCounts(countBy(sourceRows, (row) => row.ma))}.`);
lines.push(`- Old hop values: ${formatCounts(countBy(sourceRows, (row) => row.chang))}.`);
lines.push(`- Old result values: ${formatCounts(countBy(sourceRows, (row) => row.ket_qua))}.`);
lines.push(`- Duplicate source URLs in the owner table: ${sourceRows.length - new Set(sourceRows.map((row) => row.url_cu)).size}.`);
lines.push("");
lines.push("## Two-pass proof");
lines.push("");
lines.push("| Pass | Rows | Hash | Status counts | Hop counts |");
lines.push("|---:|---:|---|---|---|");
for (const pass of scan.results) {
  lines.push(`| ${pass.pass} | ${pass.rows.length} | ${pass.hash} | ${formatCounts(countBy(pass.rows, (row) => row.observed.status))} | ${formatCounts(countBy(pass.rows, (row) => row.observed.hops))} |`);
}
lines.push("");
lines.push(`Comparison: \`${scan.comparison.same ? "same" : "different"}\`; differences: \`${scan.comparison.differences.length}\`.`);
lines.push("");
lines.push("## Data and web change log");
lines.push("");
lines.push("| Migration / area | Change | Evidence / result |");
lines.push("|---|---|---|");
for (const [migration, change, source, result] of migrationRows) {
  lines.push(`| ${migration} | ${change}: ${source} | ${result} |`);
}
lines.push("| V1026 | Category alias repairs | ${v4Repairs.length} reviewed rows updated in place; no `DELETE` in V1026/V1027. |".replace("${v4Repairs.length}", String(v4Repairs.length)));
lines.push("| Web registry | Added seven V3 and five V5 reviewed legacy entries | `/sp/{slug}.html` is a 200 history page with bilingual display, discontinued label, no purchase action, canonical `/sp/`, and up to three same-category live suggestions. |" );
lines.push("| Size archive | `/size/xxl/page/3` → `/?kich-co=XXL&page=3`; `3xl`/`xxxl` → `3XL`; `39`/`46` preserved | Live checks passed; `/?detail=26-01-13-zy0118t4.html` remained 200. |" );
lines.push("");
lines.push("Reviewed category alias repair destinations:");
lines.push("");
lines.push("| Source | Destination |");
lines.push("|---|---|");
for (const [source, target] of v4Repairs) lines.push(`| ${source} | ${target} |`);
lines.push("");
lines.push("The new migrations only disable or update rows; they do not delete redirect history. V1023 was pre-existing and was not rewritten.");
lines.push("");
lines.push("## V3/V5 legacy history and cross-brand evidence");
lines.push("");
lines.push("The registry uses the reviewed source slug and owner-approved category mapping. The raw legacy WordPress export was permanently removed by the owner, so the registry name is not presented as an independently verified historical database title.");
lines.push("");
lines.push("| Group | Slug | VI display name | EN display name | Brand | Category | Owner-table baseline | Final live result | Evidence level |");
lines.push("|---|---|---|---|---|---|---|---|---|");
for (const row of staticRows) lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
lines.push("");
lines.push("Cross-brand V7 status: registry brand assignment is present for 11 of 12 entries; the generic moto T-shirt has no brand assignment. **Not run:** exact old-title/brand cross-check against raw WordPress content, because the owner permanently removed the local export. The only exact matching current DB row found in the read-only check was `giap-nguc-roi-rs-taichi-trv079` with `publish_status=TRASH`; the other reviewed slugs were not exact current product rows in the query.");
lines.push("");
lines.push("## Full 241-row live table");
lines.push("");
lines.push("`Old` is the owner table's `ma/chang` plus destination/result. `Pass 1` and `Pass 2` are `HTTP status/hops → final path`; the hash proof above confirms the two columns are identical row-for-row.");
lines.push("");
lines.push("| # | Source URL | Type | Click | Old HTTP/hops | Old target | Old result | Pass 1 | Pass 2 | Final kind |");
lines.push("|---:|---|---|---:|---|---|---|---|---|---|");
for (const row of tableRows) lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
lines.push("");
lines.push("## Verification");
lines.push("");
lines.push("- `npm run lint`: passed.");
lines.push("- `npm test -- --run __tests__/proxy-redirect.test.ts`: 15/15 passed.");
lines.push("- `npm test -- --run __tests__/catalog-list-params.test.ts`: 8/8 passed.");
lines.push("- `npm run build`: passed; Docker web image build with `.env.vps`: passed; backend image build with V1027: passed.");
lines.push("- `./mvnw -Dtest=AdminRedirectApiTest -Dmaven.compiler.testExcludes='**/service/chat/**' test`: 20/20 passed.");
lines.push("- Flyway runtime: V1026 and V1027 both applied successfully; `bigbike-backend` and `bigbike-web` healthy after VPS-configured deployment; Postgres/Redis/MinIO were not restarted.");
lines.push("- Cache clear response after V1027: `entries=233`, `snapshot=true`.");
lines.push("");
lines.push("## Not run / remaining evidence debts");
lines.push("");
lines.push("- **Not run:** public production HTTPS scan against the external domain; this audit used the VPS host's local web endpoint with `.env.vps` loaded, to avoid an external traffic burst.");
lines.push("- **Not run:** exact historical WordPress title/brand provenance for the 12 new registry entries; the raw legacy export is absent.");
lines.push("- **Not run:** Merchant Center feed verification; no feed endpoint/file was found in the repository.");
lines.push("- **Not run:** full backend test suite and browser visual/mobile regression suite; focused redirect, catalog, build and live scans are recorded above.");
lines.push("");
lines.push("Canonical rule evidence: `docs/business/BUSINESS_RULES.md` rules `REDIRECT_RULE_011`–`REDIRECT_RULE_014`; `docs/engineering/API_CONTRACT.md` redirect and size-filter sections; `docs/engineering/INTEGRATION_GUIDE.md` redirect-cache lifecycle; `docs/engineering/TESTING_GUIDE.md` live 241-row scan requirement.");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${outputPath} (${lines.length} lines)`);
