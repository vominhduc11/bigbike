"use client";

import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { stripHtmlToText } from "@/lib/utils/text";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { LocalDate } from "@/components/i18n/LocalDate";
import type { Article } from "@/lib/contracts/public";

/* eslint-disable @next/next/no-img-element */

/**
 * Khối "Tin tức" trang chủ — server render `vi` (initialArticles) cho SEO/ISR; đổi sang EN
 * thì refetch bài mới nhất (category tin-tuc) theo lang ở client.
 */
export function HomeNewsList({ initialArticles }: { initialArticles: Article[] }) {
  const newsArticles = initialArticles;
  if (newsArticles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {newsArticles.map((a) => {
          const img = toLegacyWpMediaUrl(resolveMediaUrl(a.coverImage?.url?.trim()));
          const title = safeText(a.title, "");
          return (
            <article className="bg-card shadow-sm" key={a.id}>
                <div className="aspect-video overflow-hidden text-center">
                  <LocalizedLink kind="article" viSlug={a.slug} enSlug={a.slugEn} className="block h-full">
                    {img ? <img src={img} alt={title} className="h-full w-full object-cover" loading="lazy" /> : null}
                  </LocalizedLink>
                </div>
                <div className="relative">
                  <div className="absolute -top-5 left-0 flex h-10 items-stretch">
                    <p className="m-0 bg-brand pl-5 pr-2 font-cta text-b5-label font-semibold uppercase leading-10 text-white"><LocalDate value={a.publishedAt ?? a.createdAt} dateStyle="slash" /></p>
                    <span className="-ml-2 block w-6 skew-x-[-20deg] bg-brand" aria-hidden="true" />
                  </div>
                  <div className="px-5 pb-8 pt-10">
                    <h3 className="mb-6 font-body text-a3-section font-semibold leading-6 text-foreground">
                      <LocalizedLink kind="article" viSlug={a.slug} enSlug={a.slugEn} className="text-foreground hover:text-brand">
                        {title}
                      </LocalizedLink>
                    </h3>
                    <p className="m-0 text-a4-content leading-5 text-foreground">{resolveNewsExcerpt(a)}</p>
                  </div>
                </div>
            </article>
          );
        })}
    </div>
  );
}

function truncateExcerpt(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  const ending = "…";
  const cut = text.lastIndexOf(" ", maxLength - ending.length);
  const pos = cut > maxLength - 30 ? cut : maxLength - ending.length;
  return `${text.slice(0, pos).trimEnd()}${ending}`;
}

function resolveNewsExcerpt(article: Article): string {
  const manualExcerpt = article.excerpt?.trim();
  if (manualExcerpt) return truncateExcerpt(manualExcerpt);
  const bodyText = article.body ? stripHtmlToText(article.body) : "";
  return bodyText ? truncateExcerpt(bodyText) : "";
}
