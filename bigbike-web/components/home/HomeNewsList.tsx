"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicArticleList } from "@/lib/api/client-api";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { stripHtmlToText } from "@/lib/utils/text";
import { toArticlePath } from "@/lib/utils/routes";
import { LocalDate } from "@/components/i18n/LocalDate";
import type { Article } from "@/lib/contracts/public";

/* eslint-disable @next/next/no-img-element */

/**
 * Khối "Tin tức" trang chủ — server render `vi` (initialArticles) cho SEO/ISR; đổi sang EN
 * thì refetch bài mới nhất (category tin-tuc) theo lang ở client. Giữ DOM/class WP.
 */
export function HomeNewsList({ initialArticles }: { initialArticles: Article[] }) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["home-news", locale],
    queryFn: () =>
      fetchPublicArticleList({ page: 1, size: 3, category: "tin-tuc", lang: locale }).then((r) => r.data),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  const newsArticles = isAlt && data && data.length > 0 ? data : initialArticles;
  if (newsArticles.length === 0) return null;

  return (
    <div className="news-list">
      <div className="row">
        {newsArticles.map((a) => {
          const img = toLegacyWpMediaUrl(resolveMediaUrl(a.coverImage?.url?.trim()));
          const href = toArticlePath(a.slug);
          const title = safeText(a.title, "");
          return (
            <div className="col-md-4 col-sm-6" key={a.id}>
              <div className="news--item">
                <div className="news--item-thumbnail">
                  <Link className="lazy" href={href}>
                    {img ? <img src={img} alt={title} className="lazy" /> : null}
                  </Link>
                </div>
                <div className="news--item-desc">
                  <div className="news-date">
                    <p><LocalDate value={a.publishedAt ?? a.createdAt} dateStyle="slash" /></p>
                  </div>
                  <div className="news--item-inside">
                    <p className="title-post">
                      <Link href={href}>{title}</Link>
                    </p>
                    <p>{resolveWpNewsExcerpt(a)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncateWpExcerpt(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  const ending = "…";
  const cut = text.lastIndexOf(" ", maxLength - ending.length);
  const pos = cut > maxLength - 30 ? cut : maxLength - ending.length;
  return `${text.slice(0, pos).trimEnd()}${ending}`;
}

function resolveWpNewsExcerpt(article: Article): string {
  const manualExcerpt = article.excerpt?.trim();
  if (manualExcerpt) return truncateWpExcerpt(manualExcerpt);
  const bodyText = article.body ? stripHtmlToText(article.body) : "";
  return bodyText ? truncateWpExcerpt(bodyText) : "";
}
