"use client";

import { useEffect, useState } from "react";

import { ArticleView } from "@/app/tin-tuc/[slug]/ArticleView";
import { PreviewGuard } from "@/components/preview/PreviewGuard";
import type { Article } from "@/lib/contracts/public";
import { env } from "@/env";

// Origin của app admin — chỉ nhận postMessage từ đây (chống frame lạ chèn dữ liệu).
// Header `frame-ancestors` ở next.config cũng chỉ cho admin nhúng route /preview/*.
const ADMIN_ORIGIN = env.NEXT_PUBLIC_ADMIN_ORIGIN?.replace(/\/$/, "") ?? "";

type PreviewInbound = { type: "bigbike-preview"; data: Article };

/**
 * Khung xem trước "sống" cho admin editor bài viết: KHÔNG tự fetch. Nhận dữ liệu
 * nháp (đã được backend dry-run map sang public Article shape) qua postMessage từ
 * app admin rồi render bằng đúng <ArticleView> của blog detail thật. Route noindex
 * (X-Robots-Tag ở next.config) và chỉ cho phép admin origin nhúng iframe.
 */
export default function ArticlePreviewPage() {
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (ADMIN_ORIGIN && event.origin !== ADMIN_ORIGIN) return;
      const inbound = event.data as PreviewInbound | undefined;
      if (!inbound || inbound.type !== "bigbike-preview" || !inbound.data) return;
      setArticle(inbound.data);
    }

    window.addEventListener("message", handleMessage);
    window.parent?.postMessage({ type: "bigbike-preview-ready" }, ADMIN_ORIGIN || "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!article) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-20 text-center text-muted-foreground sm:px-6">
        Đang chờ dữ liệu xem trước…
      </div>
    );
  }

  return (
    <>
      <PreviewGuard />
      <ArticleView article={article} previewMode />
    </>
  );
}
