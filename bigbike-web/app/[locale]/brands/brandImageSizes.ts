/**
 * Width of the logo frame's content area in the responsive brand grid.
 * The card uses p-5 (40px total) and the grid uses a 12px gap.
 */
export const BRAND_LIST_IMAGE_SIZES =
  "(min-width: 1024px) calc((min(100vw - 64px, 1200px) - 48px) / 5 - 40px), " +
  "(min-width: 992px) calc((min(100vw - 64px, 1200px) - 24px) / 3 - 40px), " +
  "(min-width: 768px) calc((100vw - 72px) / 3 - 40px), " +
  "(min-width: 640px) calc((100vw - 52px) / 3 - 40px), " +
  "calc((100vw - 40px) / 2 - 40px)";
