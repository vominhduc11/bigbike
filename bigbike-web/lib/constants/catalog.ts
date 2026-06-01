/**
 * Shared query defaults for the PRODUCT catalog pages (`/san-pham`,
 * `/danh-muc-san-pham/[slug]`, `/brands/[slug]`).
 *
 * Config-only constants (sort key, page size, numeric param bound) — no business
 * data — so the `check:no-runtime-business-data` guard is satisfied.
 *
 * NOTE: the news (`/tin-tuc`, 12) and search (`/tim-kiem`, 10) listings use their
 * own page sizes. These constants are for the product catalog only — do not fold
 * those other listings onto `DEFAULT_PRODUCT_PAGE_SIZE`.
 */
export const DEFAULT_PRODUCT_SORT = "createdAt:desc";

export const DEFAULT_PRODUCT_PAGE_SIZE = 24;

/** Upper bound accepted for the `min_price` / `max_price` query params. */
export const PRICE_PARAM_MAX = 1_000_000_000;
