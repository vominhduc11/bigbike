/**
 * Sentry is an operational signal, not a customer-record store.  Keep only the
 * route tag deliberately attached by the storefront reporter; request bodies,
 * query strings, breadcrumbs and user fields can contain checkout or account
 * data and must never leave the site.
 */
export function sanitizeStorefrontPath(value: string | undefined): string {
  if (!value) return "/";

  try {
    return new URL(value, "https://bigbike.invalid").pathname || "/";
  } catch {
    return "/";
  }
}

export function scrubSentryEvent<T extends object>(event: T): T {
  const source = event as T & {
    tags?: Record<string, unknown>;
    exception?: { values?: Array<Record<string, unknown>> };
  };
  const safeTags = Object.fromEntries(Object.entries(source.tags ?? {}).filter(([key]) => key.startsWith("storefront.")));
  const safeException = source.exception?.values?.map((value) => ({
    type: typeof value.type === "string" ? value.type : "StorefrontError",
    value: "Storefront error",
  }));

  return {
    ...event,
    tags: safeTags,
    exception: safeException ? { values: safeException } : undefined,
    user: undefined,
    request: undefined,
    extra: undefined,
    breadcrumbs: [],
    fingerprint: undefined,
  } as T;
}
