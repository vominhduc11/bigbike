/**
 * Social-login failures come back as `?error=<code>` on the login page — the backend has no
 * other channel once the browser has left for the provider. Anything unrecognised (including
 * the pre-2026-08 `error=oauth`) falls back to the generic message rather than showing nothing,
 * which is what used to leave customers re-clicking a button that could never work.
 */
const OAUTH_ERROR_KEYS = {
  oauth_cancelled: "errorCancelled",
  oauth_unconfigured: "errorUnconfigured",
  oauth_blocked: "errorBlocked",
  oauth_failed: "errorFailed",
} as const;

export type OAuthErrorKey = (typeof OAUTH_ERROR_KEYS)[keyof typeof OAUTH_ERROR_KEYS];

/** Translation key under `Auth.social` for an `?error=` value, or undefined when absent. */
export function oauthErrorKey(rawError: string | null | undefined): OAuthErrorKey | undefined {
  if (!rawError) return undefined;
  return OAUTH_ERROR_KEYS[rawError as keyof typeof OAUTH_ERROR_KEYS] ?? "errorFailed";
}
