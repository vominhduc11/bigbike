import { expect, test } from "@playwright/test";

import { ALL_PUBLIC } from "./helpers/routes";
import {
  checkRenderedHorizontalOverflow,
  disableAnimations,
  gotoAndSettle,
  type RenderedOverflowFinding,
} from "./helpers/ui-quality";

const MIN_WIDTH = 320;
const MAX_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;

type FindingInterval = {
  finding: RenderedOverflowFinding;
  ranges: Array<{ from: number; to: number }>;
  lastSeen: number;
};

function findingSignature(finding: RenderedOverflowFinding): string {
  return [finding.kind, finding.selector, finding.text].join("|");
}

test.describe.configure({ mode: "parallel" });

for (const route of ALL_PUBLIC) {
  test(`Responsive continuous — ${route.name} (${route.path})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: MIN_WIDTH, height: VIEWPORT_HEIGHT });
    await gotoAndSettle(page, route.path);
    await disableAnimations(page);

    const intervals = new Map<string, FindingInterval>();

    for (let width = MIN_WIDTH; width <= MAX_WIDTH; width += 1) {
      if (width !== MIN_WIDTH) {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      }

      const result = await checkRenderedHorizontalOverflow(page);
      const signaturesAtWidth = new Set<string>();
      for (const finding of result.findings) {
        const signature = findingSignature(finding);
        if (signaturesAtWidth.has(signature)) continue;
        signaturesAtWidth.add(signature);
        const existing = intervals.get(signature);
        if (!existing) {
          intervals.set(signature, {
            finding,
            ranges: [{ from: width, to: width }],
            lastSeen: width,
          });
          continue;
        }

        if (existing.lastSeen === width - 1) {
          existing.ranges[existing.ranges.length - 1].to = width;
        } else {
          existing.ranges.push({ from: width, to: width });
        }
        existing.lastSeen = width;
      }
    }

    const summary = Array.from(intervals.values()).map(({ finding, ranges }) => {
      const widthRanges = ranges
        .map(({ from, to }) => (from === to ? `${from}px` : `${from}–${to}px`))
        .join(", ");
      return (
        `[${finding.kind}] ${finding.selector} @ ${widthRanges}: ` +
        `x=${finding.left}..${finding.right}, khung=${finding.boundaryLeft}..${finding.boundaryRight}, ` +
        `"${finding.text}"`
      );
    });

    expect(
      summary,
      `Phát hiện nội dung tràn khi quét liên tục ${MIN_WIDTH}–${MAX_WIDTH}px trên ${route.name}:\n${summary.join("\n")}`,
    ).toEqual([]);
  });
}
