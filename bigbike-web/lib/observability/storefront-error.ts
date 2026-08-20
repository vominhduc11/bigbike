"use client";

import * as Sentry from "@sentry/nextjs";
import { sanitizeStorefrontPath } from "./sentry-privacy";

export type StorefrontOperation = "checkout" | "add_to_cart" | "login" | "register" | "route_error";

type StatusLikeError = { status?: unknown };

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as StatusLikeError).status;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Expected customer outcomes (all 4xx responses) must not create alerts. */
export function isReportableStorefrontFailure(error: unknown): boolean {
  const status = statusOf(error);
  return status === null || status >= 500;
}

function currentPath(): string {
  return typeof window === "undefined" ? "/" : sanitizeStorefrontPath(window.location.href);
}

/**
 * Reports a deliberately generic exception.  The original response message,
 * query string and submitted values are never forwarded to Sentry.
 */
export function reportStorefrontFailure(operation: StorefrontOperation, error: unknown): boolean {
  if (!isReportableStorefrontFailure(error)) return false;

  const status = statusOf(error);
  const safeError = new Error("Storefront operation failed");
  if (error instanceof Error && error.stack) safeError.stack = error.stack;

  Sentry.withScope((scope) => {
    scope.setTag("storefront.operation", operation);
    scope.setTag("storefront.route", currentPath());
    scope.setTag("storefront.failure_kind", status ? `http_${Math.floor(status / 100)}xx` : "network_or_runtime");
    Sentry.captureException(safeError);
  });
  return true;
}
