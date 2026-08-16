#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const [key, inlineValue] = value.slice(2).split("=", 2);
  args.set(key, inlineValue ?? process.argv[index + 1]);
  if (inlineValue === undefined) index += 1;
}

const sourceUrl = args.get("source-url") ?? "https://table-share.org/t/cLa7qtgj";
const baseUrl = (args.get("base-url") ?? "http://localhost:3000").replace(/\/$/, "");
const delayMs = Number(args.get("delay-ms") ?? "500");
const passes = Number(args.get("passes") ?? "2");

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTable(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtml(cell[1]));
    if (cells.length < 7 || cells[0] === "url_cu") continue;
    rows.push({
      url_cu: cells[0],
      loai: cells[1],
      click: Number.parseInt(cells[2], 10) || 0,
      ma: Number.parseInt(cells[3], 10) || null,
      chang: Number.parseInt(cells[4], 10) || 0,
      dich: cells[5],
      ket_qua: cells[6],
    });
  }
  return rows;
}

/** The owner-supplied CSV is a local audit source, not runtime business data. */
function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const indexOf = (name) => header.indexOf(name);
  const pathIndex = indexOf("duong_dan");
  const groupIndex = indexOf("nhom");
  const clicksIndex = indexOf("luot_nhap_16t");
  const impressionsIndex = indexOf("luot_hien_thi_16t");
  if ([pathIndex, groupIndex, clicksIndex, impressionsIndex].some((index) => index < 0)) {
    throw new Error("CSV is missing the required redirect-audit columns");
  }
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",");
    return {
      url_cu: cells[pathIndex]?.trim() ?? "",
      loai: cells[groupIndex]?.trim() ?? "",
      click: Number.parseInt(cells[clicksIndex], 10) || 0,
      ma: Number.parseInt(cells[impressionsIndex], 10) || null,
      chang: 0,
      dich: "",
      ket_qua: "",
    };
  }).filter((row) => row.url_cu);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classify(pathname, status, body) {
  if (status === 410) return "terminal-410";
  const lowerPath = pathname.toLowerCase();
  const lowerBody = body.toLowerCase();
  if (lowerPath.includes("/sp/") && (lowerBody.includes("ngừng bán") || lowerBody.includes("discontinued"))) {
    return "legacy-history";
  }
  if (lowerPath.startsWith("/product/") || lowerPath.startsWith("/en/product/")) return "product";
  if (lowerPath.startsWith("/danh-muc/") || lowerPath.startsWith("/en/categories/")) return "category";
  if (lowerPath.startsWith("/brands/") || lowerPath.startsWith("/en/brands/")) return "brand";
  if (lowerPath.startsWith("/tin-tuc/") || lowerPath.startsWith("/en/tin-tuc/")) return "article";
  if (lowerPath === "/" || lowerPath === "/en/") return "home";
  if (lowerPath === "/sp/" || lowerPath === "/en/sp/" || lowerPath === "/en/products/") return "list";
  if (status === 404) return "404";
  return "other";
}

async function fetchOne(source) {
  let current = new URL(source, baseUrl).toString();
  const chain = [];
  let body = "";
  let status = 0;
  let error = null;
  for (let hop = 0; hop <= 10; hop += 1) {
    try {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": "BigBike-redirect-live-scan/2026-08-14" },
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
      if (redirectStatuses.has(status)) {
        const location = response.headers.get("location");
        if (!location) {
          body = await response.text();
          break;
        }
        const next = new URL(location, current).toString();
        chain.push({ status, from: current, to: next });
        current = next;
        continue;
      }
      body = await response.text();
      break;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      break;
    }
  }
  const finalUrl = new URL(current);
  return {
    status,
    finalUrl: current,
    finalPath: finalUrl.pathname,
    hops: chain.length,
    chain,
    kind: error ? "request-error" : classify(finalUrl.pathname, status, body),
    error,
  };
}

function stableHash(rows) {
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

const csvPath = args.get("csv");
const sourceRows = csvPath
  ? parseCsv(await fs.readFile(csvPath, "utf8"))
  : await (async () => {
      const sourceResponse = await fetch(sourceUrl, { headers: { "user-agent": "BigBike-redirect-live-scan/2026-08-14" } });
      if (!sourceResponse.ok) throw new Error(`Source table returned HTTP ${sourceResponse.status}`);
      return parseTable(await sourceResponse.text());
    })();
if (sourceRows.length === 0) throw new Error("No table rows were parsed from the source URL");

const results = [];
for (let pass = 1; pass <= passes; pass += 1) {
  const passRows = [];
  for (const [index, sourceRow] of sourceRows.entries()) {
    const observed = await fetchOne(sourceRow.url_cu);
    passRows.push({ ...sourceRow, observed });
    if (index < sourceRows.length - 1 || pass < passes) await sleep(delayMs);
  }
  results.push({ pass, hash: stableHash(passRows.map((row) => row.observed)), rows: passRows });
}

const first = results[0]?.rows ?? [];
const second = results[1]?.rows ?? [];
const differences = [];
for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
  const before = first[index]?.observed ?? null;
  const after = second[index]?.observed ?? null;
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    differences.push({ url_cu: sourceRows[index]?.url_cu, first: before, second: after });
  }
}

process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourceUrl: csvPath ? `file:${csvPath}` : sourceUrl,
  baseUrl,
  delayMs,
  rowCount: sourceRows.length,
  clickSum: sourceRows.reduce((sum, row) => sum + row.click, 0),
  sourceRows,
  results,
  comparison: {
    passesCompared: Math.min(results.length, 2),
    same: differences.length === 0,
    differences,
  },
}, null, 2));
