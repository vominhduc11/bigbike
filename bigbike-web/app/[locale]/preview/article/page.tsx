"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { ArticleView } from "@/app/[locale]/tin-tuc/[slug]/ArticleView";
import { Container } from "@/components/layout/Container";
import { PreviewGuard } from "@/components/preview/PreviewGuard";
import { useApplyPreviewLocale } from "@/components/providers/ClientIntlProvider";
import type { Article } from "@/lib/contracts/public";
import { resolveLocale, type Locale } from "@/i18n/locale";
import { env } from "@/env";

// Origin của app admin — chỉ nhận postMessage từ đây (chống frame lạ chèn dữ liệu).
// Header `frame-ancestors` ở next.config cũng chỉ cho admin nhúng route /preview/*.
const ADMIN_ORIGIN = env.NEXT_PUBLIC_ADMIN_ORIGIN?.replace(/\/$/, "") ?? "";

type PreviewInbound = { type: "bigbike-preview"; data: Article; lang?: string };

/**
 * Khung xem trước "sống" cho admin editor bài viết: KHÔNG tự fetch. Nhận dữ liệu
 * nháp (đã được backend dry-run map sang public Article shape) qua postMessage từ
 * app admin rồi render bằng đúng <ArticleView> của blog detail thật. Route noindex
 * (X-Robots-Tag ở next.config) và chỉ cho phép admin origin nhúng iframe.
 */
export default function ArticlePreviewPage() {
  const t = useTranslations("Common");
  const [article, setArticle] = useState<Article | null>(null);
  const applyPreviewLocale = useApplyPreviewLocale();
  // Locale đã áp gần nhất — tránh swap message thừa mỗi lần data đổi (debounce ~400ms
  // lúc admin đang gõ) khi lang thật ra không đổi.
  const appliedLangRef = useRef<Locale | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (ADMIN_ORIGIN && event.origin !== ADMIN_ORIGIN) return;
      const inbound = event.data as PreviewInbound | undefined;
      if (!inbound || inbound.type !== "bigbike-preview" || !inbound.data) return;
      setArticle(inbound.data);
      const nextLang = resolveLocale(inbound.lang);
      if (appliedLangRef.current !== nextLang) {
        appliedLangRef.current = nextLang;
        applyPreviewLocale(nextLang);
      }
    }

    window.addEventListener("message", handleMessage);
    window.parent?.postMessage({ type: "bigbike-preview-ready" }, ADMIN_ORIGIN || "*");

    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once listener; applyPreviewLocale identity is stable (context useMemo)
  }, []);

  if (!article) {
    return (
      <Container className="py-20 text-center text-muted-foreground">
        {t("previewWaiting")}
      </Container>
    );
  }

  return (
    <>
      <PreviewGuard />
      <ArticleView article={article} previewMode />
    </>
  );
}
