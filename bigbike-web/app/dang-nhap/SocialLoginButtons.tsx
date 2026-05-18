import { oauthAuthorizeUrl } from "@/lib/api/client-api";

/** Facebook brand mark — white glyph on the brand-blue circle. */
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.33-.04-1.57-.14-2.88-.14C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5z" />
    </svg>
  );
}

/** Google "G" — the four-colour brand mark. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * "Đăng nhập bằng:" Facebook / Google buttons. Each is a plain anchor — the browser
 * must leave the SPA so the OAuth provider can complete its redirect round-trip.
 * Circular buttons use `rounded-full` (allowed for genuinely round elements).
 */
export function SocialLoginButtons({ returnTo }: { returnTo: string }) {
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      <span className="text-sm text-muted-foreground">Đăng nhập bằng:</span>
      <a
        href={oauthAuthorizeUrl("facebook", returnTo)}
        aria-label="Đăng nhập bằng Facebook"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-white transition-opacity hover:opacity-90"
      >
        <FacebookIcon />
      </a>
      <a
        href={oauthAuthorizeUrl("google", returnTo)}
        aria-label="Đăng nhập bằng Google"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white transition-opacity hover:opacity-90"
      >
        <GoogleIcon />
      </a>
    </div>
  );
}
