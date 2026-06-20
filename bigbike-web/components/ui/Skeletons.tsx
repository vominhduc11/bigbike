/**
 * Layout-matched skeleton components — barrel.
 *
 * Each skeleton mirrors the structural composition of its target page so the
 * shell users see while data loads matches what eventually renders. The
 * implementation is split by area under ./skeleton/:
 *   - primitives.tsx  — atoms (SkelText/…), SkeletonRoot, shared layout consts
 *   - storefront.tsx  — home, PDP, catalog/category/brand, search
 *   - account.tsx     — checkout, account, orders, form, order-confirm
 *   - content.tsx     — article, static/CMS, auth, contact, guide
 *
 * Re-exported here so call sites keep importing from "@/components/ui/Skeletons".
 */

export * from "./skeleton/storefront";
export * from "./skeleton/account";
export * from "./skeleton/content";
