import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    BIGBIKE_API_BASE_URL: z.string().url().optional(),
    BIGBIKE_LEGACY_UPLOADS_BASE: z.string().url().optional(),
    BIGBIKE_MEDIA_INTERNAL_URL: z.string().url().optional(),
    REVALIDATE_SECRET: z.string().optional(),
    WEB_REVALIDATE_SECRET: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    // Site canonical origin — server-side fallback for sitemap/canonical
    BIGBIKE_SITE_URL: z.string().url().optional(),
    // Internal API token for backend proxy calls
    INTERNAL_API_TOKEN: z.string().optional(),
    // Redirect rule TTL in seconds for the in-process L1 cache (proxy.ts)
    BIGBIKE_REDIRECT_CACHE_TTL_SECONDS: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_GTM_ID: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    // Canonical site origin — used client-side for absolute URL generation
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // Optional URL vars: convert empty string → undefined so Zod url() validator doesn't reject ""
    BIGBIKE_API_BASE_URL: process.env.BIGBIKE_API_BASE_URL || undefined,
    BIGBIKE_LEGACY_UPLOADS_BASE: process.env.BIGBIKE_LEGACY_UPLOADS_BASE || undefined,
    BIGBIKE_MEDIA_INTERNAL_URL: process.env.BIGBIKE_MEDIA_INTERNAL_URL || undefined,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET || undefined,
    WEB_REVALIDATE_SECRET: process.env.WEB_REVALIDATE_SECRET || undefined,
    SENTRY_DSN: process.env.SENTRY_DSN || undefined,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN || undefined,
    SENTRY_ORG: process.env.SENTRY_ORG || undefined,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT || undefined,
    BIGBIKE_SITE_URL: process.env.BIGBIKE_SITE_URL || undefined,
    INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || undefined,
    BIGBIKE_REDIRECT_CACHE_TTL_SECONDS: process.env.BIGBIKE_REDIRECT_CACHE_TTL_SECONDS || undefined,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || undefined,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID || undefined,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
