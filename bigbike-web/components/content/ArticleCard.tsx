"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Article } from "@/lib/contracts/public";
import { formatDate } from "@/lib/utils/format";
import { stripHtmlToText } from "@/lib/utils/text";
import { toArticlePath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { categoryBadge } from "@/lib/ui-classes";

type ArticleCardProps = {
  article: Article;
  variant?: "default" | "featured";
};

function truncateText(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf(" ", maxLength);
  const pos = cut > maxLength - 30 ? cut : maxLength;
  return text.slice(0, pos).trimEnd() + "…";
}

export function ArticleCard({ article, variant = "default" }: ArticleCardProps) {
  const t = useTranslations("Blog");

  function resolveArticleExcerpt(a: Article): string {
    const excerpt = a.excerpt?.trim();
    if (excerpt) return excerpt;
    const bodyText = a.body ? stripHtmlToText(a.body) : "";
    if (bodyText) return truncateText(bodyText);
    return t("articleExcerptFallback");
  }

  const titleRaw = article.title?.trim();
  const title = titleRaw && titleRaw.length > 0 ? titleRaw : t("articleTitleFallback");
  const excerpt = resolveArticleExcerpt(article);
  const categoryRaw = (article.category?.name ?? article.categories?.[0]?.name)?.trim();
  const category = categoryRaw && categoryRaw.length > 0 ? categoryRaw : t("articleCategoryFallback");
  const publishedDate = formatDate(article.publishedAt ?? article.createdAt);
  const isFeatured = variant === "featured";

  if (!isFeatured) {
    return (
      <Link
        href={toArticlePath(article.slug)}
        className="group flex flex-col no-underline text-inherit bg-card border-none rounded-none [box-shadow:var(--bb-shadow-md)] [transition:box-shadow_0.3s_ease] hover:border-brand hover:[box-shadow:var(--bb-shadow-product)] max-md:border max-md:border-solid max-md:border-border max-md:[box-shadow:none]"
      >
        <div className="relative aspect-[16/9] overflow-hidden shrink-0 bg-white">
          <MediaImage
            image={article.coverImage}
            altFallback={title}
            className="block w-full h-full object-cover [transition:transform_0.3s_ease] group-hover:[transform:scale(1.05)]"
            width={1200}
            height={675}
          />
        </div>
        <div className="relative pt-[41px] px-5 pb-[30px] flex flex-col gap-2 flex-1 bg-card max-md:pt-[34px] max-md:px-[14px] max-md:pb-[18px]">
          <span className="absolute -top-[21px] left-0 z-[2] inline-flex items-center h-[42px] min-w-[168px] pl-[22px] pr-[28px] bg-brand text-white font-cta text-ui-14 font-semibold tracking-normal uppercase whitespace-nowrap rounded-none [clip-path:polygon(0_0,100%_0,calc(100%-18px)_100%,0_100%)]">
            {publishedDate}
          </span>
          <div className="flex flex-col gap-2 flex-1">
            <p className={categoryBadge}>{category}</p>
            <h3 className="font-heading text-h4 font-semibold text-foreground normal-case leading-[1.2] m-0 [transition:color_0.14s] line-clamp-2 group-hover:text-brand">
              {title}
            </h3>
            <p className="text-caption text-muted-foreground leading-[1.55] m-0 min-h-[104px] line-clamp-4 max-md:min-h-0 max-md:line-clamp-3">
              {excerpt}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={toArticlePath(article.slug)}
      className="group flex flex-col md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] mb-[22px] md:min-h-[360px] no-underline text-inherit bg-card shadow-md transition-shadow duration-300 hover:shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
    >
      <div
        className="relative aspect-video md:aspect-auto overflow-hidden bg-muted shrink-0 md:h-full md:min-h-[320px]"
      >
        <MediaImage
          image={article.coverImage}
          altFallback={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          width={1200}
          height={675}
        />
      </div>
      <div
        className="relative pt-[41px] px-[34px] pb-[30px] flex flex-col gap-2 flex-1 bg-card justify-center"
      >
        <span className="absolute -top-[21px] left-0 z-[2] inline-flex items-center h-[42px] min-w-[168px] pl-[22px] pr-[28px] bg-brand text-white font-display text-sm font-bold tracking-wide uppercase whitespace-nowrap [clip-path:polygon(0_0,100%_0,calc(100%-18px)_100%,0_100%)]">
          {publishedDate}
        </span>
        <div className="flex flex-col gap-2 flex-1">
          <p className={categoryBadge}>
            {category}
          </p>
          <h3
            className="font-heading text-h4 font-semibold text-foreground normal-case leading-[1.2] m-0 transition-colors duration-300 group-hover:text-brand line-clamp-3"
          >
            {title}
          </h3>
          <p
            className="text-caption text-muted-foreground leading-body m-0"
          >
            {excerpt}
          </p>
          <span className="mt-auto pt-[6px] text-muted-foreground text-sm font-bold tracking-display uppercase transition-colors duration-300 group-hover:text-brand">
            {t("articleReadMore")}
          </span>
        </div>
      </div>
    </Link>
  );
}
