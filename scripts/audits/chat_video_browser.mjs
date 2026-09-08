#!/usr/bin/env node
// Real UI, real API and real AI. Never imports the broad E2E cleanup fixture.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const privateDir = process.argv[2];
if (!privateDir || !process.argv.includes("--authorized-test-video")) throw new Error("Explicit fixture/AI authorization required");
const evidence = path.resolve(privateDir, "video-browser");
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const require = createRequire(path.join(root, "bigbike-web/package.json"));
const { chromium, expect } = require("@playwright/test");
const labels = JSON.parse(fs.readFileSync(path.join(root, "bigbike-web/messages/vi.json"))).Support;
const container = "bb-assistant-audit-pg-20260908";
const label = execFileSync("docker", ["inspect", "--format", '{{ index .Config.Labels "bigbike.task" }}', container], { encoding: "utf8" }).trim();
if (label !== "assistant-20260908") throw new Error("Expected the isolated database");
function quota() {
  return Number(execFileSync("docker", ["exec", container, "psql", "-X", "-U", "assistant_audit", "-d", "assistant_audit", "-At", "-c",
    "SELECT coalesce((SELECT used_count FROM chat_video_daily_usage WHERE usage_date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),0)"], { encoding: "utf8" }).trim());
}
const manifestFile = path.join(evidence, "private-manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)) : { caseId: "V04_UI", base: "http://127.0.0.1:58080" };
function savePrivate() { fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), { mode: 0o600 }); }
function emit(row) {
  fs.appendFileSync(path.join(evidence, "results.jsonl"), JSON.stringify(row) + "\n");
  console.log(JSON.stringify(row));
}
const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (manifest.storage) await context.addInitScript(storage => {
    for (const [key, value] of Object.entries(storage)) sessionStorage.setItem(key, value);
  }, manifest.storage);
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("response", async response => {
    if (response.url().endsWith("/api/v1/chat/sessions") && response.request().method() === "POST" && response.status() === 200) {
      try {
        const data = (await response.json()).data;
        manifest.token = data.visitorToken; manifest.visitorId = response.request().postDataJSON().visitorId; savePrivate();
      } catch { /* The page can close while an unrelated session response is arriving. */ }
    }
  });
  const home = await page.goto("http://127.0.0.1:53001/", { waitUntil: "domcontentloaded", timeout: 120000 });
  emit({ caseId: "UI_HOME", http: home.status() });
  const opener = page.getByRole("button", { name: labels.open, exact: true });
  if (!(await page.locator("#bigbike-assistant-panel").isVisible())) {
    await expect(page.locator('[data-bigbike-launcher-ready="true"]')).toBeAttached({ timeout: 60000 });
    await opener.click({ timeout: 60000 });
  }
  await expect(page.locator("#bigbike-chat-message")).toBeEnabled({ timeout: 15000 });
  if (process.argv.includes("--inspect-only")) {
    await expect(page.locator("button").filter({ has: page.locator("svg") }).and(page.getByRole("button", { name: labels.chooseVideo, exact: true }))).toBeEnabled();
    manifest.storage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    savePrivate();
    await page.screenshot({ path: path.join(evidence, "chat-video-before-send.png") });
    emit({ caseId: "UI_VIDEO_BUTTON_READY", videoQuota: quota(), consoleErrors: failures });
    await browser.close();
    process.exit(0);
  }
  if (!manifest.complete) {
    if (quota() >= 8) throw new Error("The eight authorized video slots are exhausted; use read-only replay");
    const videoInput = page.locator('input[type="file"][accept*="video"]');
    await videoInput.setInputFiles({ name: "E2E_TOO_LARGE.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(40 * 1024 * 1024 + 1) });
    await expect(page.getByText(labels.videoTooLarge, { exact: true })).toBeVisible();
    emit({ caseId: "UI_VIDEO_40MB_PLUS_ONE", rejected: true, videoQuota: quota() });
    await videoInput.setInputFiles(path.join(privateDir, "media/videos/clip-10.mp4"));
    await expect(page.getByText(labels.selectedVideoReady, { exact: true })).toBeVisible();
    await expect(page.locator("button").and(page.getByRole("button", { name: labels.chooseImage, exact: true }))).toBeDisabled();
    await page.locator("#bigbike-chat-message").fill("Chính sách bảo hành mũ của shop thế nào?");
    const uploadPromise = page.waitForResponse(r => r.url().includes("/api/v1/chat/videos?") && r.request().method() === "POST", { timeout: 65000 });
    const streamPromise = page.waitForResponse(r => r.url().endsWith("/api/v1/chat/messages/stream") && r.request().method() === "POST", { timeout: 65000 });
    const before = quota();
    const started = Date.now();
    await page.getByRole("button", { name: labels.send, exact: true }).click();
    const upload = await uploadPromise;
    const uploadData = await upload.json();
    if (upload.status() !== 200) throw new Error("Video upload failed: " + JSON.stringify(uploadData.error));
    manifest.conversationId = uploadData.data.conversationId;
    manifest.video = uploadData.data.video; savePrivate();
    const stream = await streamPromise;
    manifest.requestId = stream.request().postDataJSON().requestId; savePrivate();
    const events = await stream.text();
    const resultEvent = events.split(/\n\n/).find(event => event.includes("event:result"));
    if (!resultEvent) throw new Error("No complete assistant reply in SSE");
    const result = JSON.parse(resultEvent.split("\n").find(line => line.startsWith("data:")).slice(5));
    expect(result.answer).toMatch(/bảo hành/i);
    expect(Date.now() - started).toBeLessThan(60000);
    const safe = { ...result }; delete safe.conversationId; delete safe.assistantMessageId; delete safe.continuation;
    emit({ caseId: "V04_UI", http: stream.status(), seconds: (Date.now() - started) / 1000,
      caption: "Chính sách bảo hành mũ của shop thế nào?", response: safe, quotaBefore: before, quotaAfter: quota(), remainingAfterUpload: uploadData.data.remainingMillis });
    manifest.complete = true;
    manifest.storage = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    savePrivate();
  }
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: path.join(evidence, `chat-video-${width}.png`) });
    emit({ caseId: "UI_VIDEO_RESPONSIVE", width, withinViewport: true });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  const open = page.getByRole("button", { name: labels.open, exact: true });
  if (await open.isVisible()) {
    await expect(page.locator('[data-bigbike-launcher-ready="true"]')).toBeAttached();
    await open.click();
  }
  const player = page.getByRole("dialog").locator("video").last();
  await expect(player).toBeVisible({ timeout: 20000 });
  await expect.poll(() => player.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(1);
  const state = await player.evaluate(video => ({ duration: video.duration, controls: video.controls, privateBlob: video.src.startsWith("blob:") }));
  expect(state.duration).toBeLessThanOrEqual(15); expect(state.controls).toBe(true); expect(state.privateBlob).toBe(true);
  emit({ caseId: "UI_VIDEO_HISTORY_RELOAD", ...state, consoleErrors: failures });
} finally { await browser.close(); }
