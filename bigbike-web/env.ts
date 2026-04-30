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
  },
  client: {
    NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_GTM_ID: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    BIGBIKE_API_BASE_URL: process.env.BIGBIKE_API_BASE_URL,
    BIGBIKE_LEGACY_UPLOADS_BASE: process.env.BIGBIKE_LEGACY_UPLOADS_BASE,
    BIGBIKE_MEDIA_INTERNAL_URL: process.env.BIGBIKE_MEDIA_INTERNAL_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    WEB_REVALIDATE_SECRET: process.env.WEB_REVALIDATE_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
