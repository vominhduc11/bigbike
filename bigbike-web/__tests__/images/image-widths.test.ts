import { describe, expect, it } from "vitest";

import { BIGBIKE_DEVICE_SIZES, BIGBIKE_IMAGE_SIZES } from "@/lib/image-widths";

const allWidths = [...BIGBIKE_IMAGE_SIZES, ...BIGBIKE_DEVICE_SIZES].sort((a, b) => a - b);

function selectedWidth(slot: number, dpr: number) {
  return allWidths.find((width) => width >= slot * dpr) ?? allWidths.at(-1);
}

describe("storefront image candidates", () => {
  it("keeps a compact, ordered and non-overlapping global set", () => {
    expect(BIGBIKE_IMAGE_SIZES).toEqual([64, 80, 96, 128, 160, 192, 240, 256, 288, 320, 384, 512]);
    expect(BIGBIKE_DEVICE_SIZES).toEqual([640, 768, 1024, 1280, 1440, 2048, 2560, 3840]);
    expect(allWidths).toHaveLength(20);
    expect(Math.max(...BIGBIKE_IMAGE_SIZES)).toBeLessThan(Math.min(...BIGBIKE_DEVICE_SIZES));
  });

  it("retains exact DPR 1–4 sources for 64/80/96px homepage category frames", () => {
    for (const slot of [64, 80, 96]) {
      expect([1, 2, 3, 4].map((dpr) => selectedWidth(slot, dpr))).toEqual(
        [1, 2, 3, 4].map((dpr) => slot * dpr),
      );
    }
  });

  it("does not undersize the important product and brand slots at DPR 2/3", () => {
    for (const slot of [195, 320, 668]) {
      for (const dpr of [2, 3]) {
        expect(selectedWidth(slot, dpr)).toBeGreaterThanOrEqual(slot * dpr);
      }
    }
  });
});
