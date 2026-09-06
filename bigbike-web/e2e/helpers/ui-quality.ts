import { expect, type Page } from "@playwright/test";
import { BASE_ORIGIN } from "./config";

/* -------------------------------------------------------------------------- */
/*  Runtime / network guards                                                  */
/* -------------------------------------------------------------------------- */

export type ConsoleEntry = { type: string; text: string; location: string };
export type RequestFailure = { url: string; method: string; failure: string; resourceType: string };
export type BadResponse = { url: string; status: number; method: string; resourceType: string };

export type PageGuards = {
  consoleErrors: ConsoleEntry[];
  consoleWarnings: ConsoleEntry[];
  pageErrors: { message: string; stack: string }[];
  requestFailures: RequestFailure[];
  badResponses: BadResponse[];
};

export type GuardSummary = { serious: string[]; warnings: string[] };

// Third-party hosts whose failures are not bigbike-web defects (analytics, social, maps, sentry ingest).
const THIRD_PARTY = [
  "googletagmanager.com", "google-analytics.com", "analytics.google.com", "doubleclick.net",
  "googleadservices", "g.doubleclick", "facebook.com", "facebook.net", "fbcdn", "connect.facebook",
  "sentry.io", "ingest.sentry", ".sentry.io", "zalo.me", "zalo.zadn", "messenger.com", "m.me",
  "youtube.com", "youtube-nocookie.com", "ytimg.com", "maps.googleapis", "maps.gstatic",
  "gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com",
];

// Console noise that is not an actionable defect.
const BENIGN_CONSOLE = [
  /Download the React DevTools/i,
  /ResizeObserver loop (limit exceeded|completed)/i,
  /\[Fast Refresh\]/i,
  /preload(ed)? .* (is found, but is not used|but not used)/i,
  /ERR_BLOCKED_BY_CLIENT/i,
];

// Request-failure reasons that are routinely benign (canceled prefetch / navigation).
const BENIGN_FAILURE = [/net::ERR_ABORTED/i];

const HYDRATION_HINTS = [
  "Hydration failed", "hydration", "did not match", "Text content does not match",
  "server rendered HTML", "server-rendered HTML",
  "Minified React error #418", "Minified React error #419",
  "Minified React error #422", "Minified React error #423", "Minified React error #425",
];

const CSP_HINTS = ["Content Security Policy", "Refused to", "violates the following"];

function isThirdParty(url: string): boolean {
  return THIRD_PARTY.some((h) => url.includes(h));
}

function isFirstParty(url: string): boolean {
  try {
    return new URL(url, BASE_ORIGIN).origin === BASE_ORIGIN;
  } catch {
    return false;
  }
}

/** Attach console / pageerror / network listeners and collect findings into a mutable record. */
export function installPageGuards(page: Page): PageGuards {
  const guards: PageGuards = {
    consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [], badResponses: [],
  };

  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    const loc = msg.location();
    const entry: ConsoleEntry = { type, text, location: loc.url ? `${loc.url}:${loc.lineNumber}` : "" };
    if (type === "error") guards.consoleErrors.push(entry);
    else guards.consoleWarnings.push(entry);
  });

  page.on("pageerror", (err) => {
    guards.pageErrors.push({ message: err.message, stack: err.stack ?? "" });
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "unknown";
    if (BENIGN_FAILURE.some((re) => re.test(failure))) return;
    guards.requestFailures.push({ url: req.url(), method: req.method(), failure, resourceType: req.resourceType() });
  });

  page.on("response", (res) => {
    if (res.status() < 400) return;
    guards.badResponses.push({
      url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType(),
    });
  });

  return guards;
}

/** Bucket collected findings into serious (fail the gate) vs warnings (report only). */
export function summarizeGuards(guards: PageGuards): GuardSummary {
  const serious: string[] = [];
  const warnings: string[] = [];

  for (const e of guards.pageErrors) serious.push(`[pageerror] ${e.message}`);

  for (const e of guards.consoleErrors) {
    if (HYDRATION_HINTS.some((h) => e.text.includes(h))) serious.push(`[hydration] ${e.text}`);
    else if (CSP_HINTS.some((h) => e.text.includes(h))) serious.push(`[csp] ${e.text} @ ${e.location}`);
    else if (e.location && isThirdParty(e.location)) warnings.push(`[console.error:3p] ${e.text}`);
    else serious.push(`[console.error] ${e.text} @ ${e.location}`);
  }

  for (const e of guards.consoleWarnings) {
    if (HYDRATION_HINTS.some((h) => e.text.includes(h))) serious.push(`[hydration-warn] ${e.text}`);
    else warnings.push(`[console.warn] ${e.text}`);
  }

  for (const f of guards.requestFailures) {
    const msg = `[requestfailed:${f.resourceType}] ${f.method} ${f.url} — ${f.failure}`;
    if (isThirdParty(f.url)) warnings.push(msg);
    else if (isFirstParty(f.url)) serious.push(msg);
    else warnings.push(msg);
  }

  for (const r of guards.badResponses) {
    const msg = `[http ${r.status}:${r.resourceType}] ${r.method} ${r.url}`;
    if (isThirdParty(r.url) || !isFirstParty(r.url)) { warnings.push(msg); continue; }
    if (r.status >= 500) serious.push(msg);
    else if (r.status === 401 || r.status === 403) warnings.push(msg); // guest-protected endpoints are expected
    else if (r.url.includes("/_next/image")) serious.push(msg); // broken image optimization
    else if (["document", "script", "stylesheet", "font"].includes(r.resourceType)) serious.push(msg);
    else warnings.push(msg); // other 4xx (optional fetch/xhr) — surface but don't fail
  }

  return { serious, warnings };
}

/** Assert there are no serious runtime/network issues; returns the summary for logging warnings. */
export function expectNoSeriousIssues(guards: PageGuards, label: string): GuardSummary {
  const summary = summarizeGuards(guards);
  expect(
    summary.serious,
    `Serious runtime/network issues on ${label}:\n${summary.serious.join("\n")}`,
  ).toEqual([]);
  return summary;
}

/* -------------------------------------------------------------------------- */
/*  Navigation helpers                                                        */
/* -------------------------------------------------------------------------- */

export async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      let ticks = 0;
      const step = Math.max(220, Math.floor(window.innerHeight * 0.85));
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        ticks += 1;
        if (total >= document.body.scrollHeight - window.innerHeight || ticks > 80) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 55);
    });
  });
}

/** Navigate, wait for load + idle (best effort), fonts, then scroll to trigger lazy content. */
export async function gotoAndSettle(page: Page, path: string, opts: { scroll?: boolean } = {}) {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready.then(() => undefined)).catch(() => {});
  if (opts.scroll !== false) await autoScroll(page);
  await page.waitForTimeout(250);
  return resp;
}

export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}.swiper-wrapper{transition:none!important}`,
  });
}

/* -------------------------------------------------------------------------- */
/*  Layout / image checks                                                     */
/* -------------------------------------------------------------------------- */

export type OverflowOffender = { tag: string; cls: string; id: string; right: number; left: number; width: number; text: string };
export type OverflowResult = { hasOverflow: boolean; viewportWidth: number; scrollWidth: number; offenders: OverflowOffender[] };

export async function checkHorizontalOverflow(page: Page, tolerance = 2): Promise<OverflowResult> {
  return page.evaluate((tol) => {
    // The viewport scroller (usually <html>) is authoritative for whether the page
    // is actually horizontally scrollable. body.scrollWidth can exceed it when body
    // clips its own overflow (overflow-x:hidden) — that is NOT a user-visible overflow.
    const scroller = (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
    const vw = scroller.clientWidth;
    const scrollWidth = scroller.scrollWidth;
    const offenders: OverflowOffender[] = [];
    if (scrollWidth > vw + tol) {
      for (const el of Array.from(document.querySelectorAll("body *")) as HTMLElement[]) {
        const style = getComputedStyle(el);
        if (style.position === "fixed" || style.position === "sticky") continue;
        if (style.visibility === "hidden" || style.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + tol || r.left < -tol) {
          // Skip elements clipped/scrolled by an ancestor — they don't expand the
          // document's scroll width (e.g. off-screen Swiper slides under overflow:hidden).
          let clipped = false;
          let p = el.parentElement;
          while (p && p !== document.documentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "hidden" || ox === "clip" || ox === "auto" || ox === "scroll") { clipped = true; break; }
            p = p.parentElement;
          }
          if (clipped) continue;
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute("class") || "").slice(0, 130),
            id: el.id || "",
            right: Math.round(r.right),
            left: Math.round(r.left),
            width: Math.round(r.width),
            text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
          });
        }
      }
      offenders.sort((a, b) => b.width - a.width);
    }
    return { hasOverflow: scrollWidth > vw + tol, viewportWidth: vw, scrollWidth, offenders: offenders.slice(0, 10) };
  }, tolerance);
}

export async function expectNoHorizontalOverflow(page: Page, label: string, tolerance = 2): Promise<OverflowResult> {
  const r = await checkHorizontalOverflow(page, tolerance);
  const detail = r.offenders
    .map((o) => `  <${o.tag}${o.id ? "#" + o.id : ""} class="${o.cls}"> w=${o.width} l=${o.left} r=${o.right} "${o.text}"`)
    .join("\n");
  expect(
    r.hasOverflow,
    `Horizontal overflow on ${label}: scrollWidth=${r.scrollWidth} > viewport=${r.viewportWidth}\nWidest offenders:\n${detail}`,
  ).toBe(false);
  return r;
}

export type RenderedOverflowKind =
  | "element-viewport"
  | "text-viewport"
  | "text-container";

export type RenderedOverflowFinding = {
  kind: RenderedOverflowKind;
  selector: string;
  text: string;
  left: number;
  right: number;
  boundaryLeft: number;
  boundaryRight: number;
  depth: number;
};

export type RenderedOverflowResult = {
  viewportWidth: number;
  findings: RenderedOverflowFinding[];
};

/**
 * Geometry-first overflow audit. Unlike scrollWidth, this still sees content
 * hidden by the global html/body overflow policy and measures every rendered
 * text line using Range#getClientRects(). Intentional carousel tracks and
 * genuinely horizontally-scrollable regions remain accessible and are skipped.
 */
export async function checkRenderedHorizontalOverflow(
  page: Page,
  tolerance = 2,
): Promise<RenderedOverflowResult> {
  return page.evaluate((tol) => {
    const viewportWidth = window.innerWidth;
    const findings: RenderedOverflowFinding[] = [];
    const seen = new Set<string>();
    const carouselSelector =
      '[data-responsive-overflow-ignore="carousel"], .swiper, [aria-roledescription="carousel"]';

    const number = (value: string) => Number.parseFloat(value) || 0;
    const rounded = (value: number) => Math.round(value * 10) / 10;
    const metricsCache = new WeakMap<Element, {
      rect: DOMRect;
      style: CSSStyleDeclaration;
      visible: boolean;
    }>();
    const carouselCache = new WeakMap<Element, boolean>();
    const horizontalScrollerCache = new WeakMap<Element, boolean>();
    const truncationCache = new WeakMap<Element, boolean>();
    const boundsCache = new WeakMap<Element, { left: number; right: number }>();

    const metricsFor = (element: Element) => {
      const cached = metricsCache.get(element);
      if (cached) return cached;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const metrics = {
        rect,
        style,
        visible:
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0,
      };
      metricsCache.set(element, metrics);
      return metrics;
    };

    const depthOf = (element: Element) => {
      let depth = 0;
      let current: Element | null = element;
      while (current.parentElement) {
        depth += 1;
        current = current.parentElement;
      }
      return depth;
    };

    const describe = (element: Element) => {
      const html = element as HTMLElement;
      if (html.id) return `${element.tagName.toLowerCase()}#${html.id}`;
      for (const attr of ["data-testid", "data-product-card", "data-catalog-product-grid", "data-bb-rail"]) {
        if (html.hasAttribute(attr)) return `${element.tagName.toLowerCase()}[${attr}]`;
      }
      const classes = Array.from(element.classList)
        .filter((name) => !name.includes(":"))
        .slice(0, 3)
        .join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };

    const visible = (element: Element) => metricsFor(element).visible;

    const intentionallyTruncated = (element: Element) => {
      if (truncationCache.has(element)) return truncationCache.get(element) ?? false;
      const visited: Element[] = [];
      let current: Element | null = element;
      let result = false;
      while (current && current !== document.body) {
        if (truncationCache.has(current)) {
          result = truncationCache.get(current) ?? false;
          break;
        }
        visited.push(current);
        const className = current.getAttribute("class") ?? "";
        if (/(^|\s)truncate(\s|$)|(^|\s)line-clamp-/.test(className)) {
          result = true;
          break;
        }
        current = current.parentElement;
      }
      visited.forEach((item) => truncationCache.set(item, result));
      return result;
    };

    const ignoredByCarousel = (element: Element) => {
      if (carouselCache.has(element)) return carouselCache.get(element) ?? false;
      const ignored = Boolean(element.closest(carouselSelector));
      carouselCache.set(element, ignored);
      return ignored;
    };

    const insideAccessibleHorizontalScroller = (element: Element) => {
      if (horizontalScrollerCache.has(element)) {
        return horizontalScrollerCache.get(element) ?? false;
      }
      const parent = element.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) {
        horizontalScrollerCache.set(element, false);
        return false;
      }
      const style = metricsFor(parent).style;
      const parentScrolls =
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        parent.scrollWidth > parent.clientWidth + tol;
      const result = parentScrolls || insideAccessibleHorizontalScroller(parent);
      horizontalScrollerCache.set(element, result);
      return result;
    };

    const contentBounds = (element: Element) => {
      const cached = boundsCache.get(element);
      if (cached) return cached;
      const { rect, style } = metricsFor(element);
      const bounds = {
        left: rect.left + number(style.borderLeftWidth) + number(style.paddingLeft),
        right: rect.right - number(style.borderRightWidth) - number(style.paddingRight),
      };
      boundsCache.set(element, bounds);
      return bounds;
    };

    const add = (
      kind: RenderedOverflowKind,
      element: Element,
      rect: Pick<DOMRect, "left" | "right">,
      boundary: { left: number; right: number },
      textValue: string,
    ) => {
      const finding: RenderedOverflowFinding = {
        kind,
        selector: describe(element),
        text: textValue.replace(/\s+/g, " ").trim().slice(0, 90),
        left: rounded(rect.left),
        right: rounded(rect.right),
        boundaryLeft: rounded(boundary.left),
        boundaryRight: rounded(boundary.right),
        depth: depthOf(element),
      };
      const key = `${finding.kind}|${finding.selector}|${finding.text}|${finding.left}|${finding.right}|${finding.boundaryLeft}|${finding.boundaryRight}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push(finding);
      }
    };

    const elements = Array.from(document.querySelectorAll("body *"));
    for (const element of elements) {
      if (ignoredByCarousel(element) || !visible(element)) continue;
      const rect = metricsFor(element).rect;
      // Fully off-canvas nodes are closed drawers/popovers; only partially visible
      // content can be cut from the customer's view.
      if (rect.right <= 0 || rect.left >= viewportWidth) continue;
      if (insideAccessibleHorizontalScroller(element)) continue;

      if (rect.left < -tol || rect.right > viewportWidth + tol) {
        add(
          "element-viewport",
          element,
          rect,
          { left: 0, right: viewportWidth },
          element.textContent ?? "",
        );
      }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    let textNode = walker.nextNode();
    while (textNode) {
      const owner = textNode.parentElement;
      if (
        !owner ||
        owner.closest('[aria-hidden="true"], .sr-only') ||
        ignoredByCarousel(owner) ||
        !visible(owner) ||
        insideAccessibleHorizontalScroller(owner) ||
        intentionallyTruncated(owner)
      ) {
        textNode = walker.nextNode();
        continue;
      }

      let container: Element | null = owner;
      while (container && container !== document.body && container !== document.documentElement) {
        const display = metricsFor(container).style.display;
        if (display !== "inline" && display !== "contents") break;
        container = container.parentElement;
      }
      if (!container || container === document.body || container === document.documentElement) {
        textNode = walker.nextNode();
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(textNode);
      const boundary = contentBounds(container);
      for (const lineRect of Array.from(range.getClientRects())) {
        if (lineRect.width <= 0 || lineRect.height <= 0) continue;
        if (lineRect.right > 0 && lineRect.left < viewportWidth) {
          if (lineRect.left < -tol || lineRect.right > viewportWidth + tol) {
            add("text-viewport", owner, lineRect, { left: 0, right: viewportWidth }, textNode.textContent ?? "");
          }
          if (lineRect.left < boundary.left - tol || lineRect.right > boundary.right + tol) {
            add("text-container", owner, lineRect, boundary, textNode.textContent ?? "");
          }
        }
      }
      range.detach();
      textNode = walker.nextNode();
    }

    findings.sort((a, b) => b.depth - a.depth || a.kind.localeCompare(b.kind));
    return { viewportWidth, findings: findings.slice(0, 25) };
  }, tolerance);
}

export async function expectNoRenderedHorizontalOverflow(
  page: Page,
  label: string,
  tolerance = 2,
): Promise<RenderedOverflowResult> {
  const result = await checkRenderedHorizontalOverflow(page, tolerance);
  const detail = result.findings
    .map((finding) =>
      `  [${finding.kind}] ${finding.selector} x=${finding.left}..${finding.right} ` +
      `inside ${finding.boundaryLeft}..${finding.boundaryRight} "${finding.text}"`,
    )
    .join("\n");
  expect(
    result.findings,
    `Rendered horizontal overflow on ${label} (viewport=${result.viewportWidth}):\n${detail}`,
  ).toEqual([]);
  return result;
}

export async function getBrokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = [];
    for (const img of Array.from(document.images)) {
      const rect = img.getBoundingClientRect();
      const rendered = rect.width > 1 && rect.height > 1;
      if (img.complete && img.naturalWidth === 0 && rendered) {
        broken.push(img.currentSrc || img.src || "(no src)");
      }
    }
    return Array.from(new Set(broken));
  });
}

export async function expectNoBrokenImages(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(300);
  const broken = await getBrokenImages(page);
  expect(broken, `Broken images on ${label}:\n${broken.join("\n")}`).toEqual([]);
}
