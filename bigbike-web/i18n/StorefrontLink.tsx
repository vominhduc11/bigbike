/**
 * The only low-level Link entry point for storefront code.
 *
 * Storefront URLs are resolved by `lib/utils/routes.ts` before they reach this
 * component, so query strings, hashes, CMS links and alternate slugs all share
 * one locale contract. Keeping the framework import here prevents pages from
 * bypassing that navigation layer accidentally.
 */
export { default } from "next/link";
export type { LinkProps } from "next/link";
