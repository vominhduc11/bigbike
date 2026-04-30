import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Tỷ lệ capture performance traces — 10% trong production, 100% trong dev
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay 1% sessions, 100% khi có lỗi
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Tắt Sentry khi không có DSN (dev không cấu hình)
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
