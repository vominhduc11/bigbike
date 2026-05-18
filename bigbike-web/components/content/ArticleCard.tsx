import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { formatDate, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";

type ArticleCardProps = {
  article: Article;
  variant?: "default" | "featured";
};

function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf(" ", maxLength);
  const pos = cut > maxLength - 30 ? cut : maxLength;
  return text.slice(0, pos).trimEnd() + "\u2026";
}

function resolveArticleExcerpt(article: Article): string {
  const excerpt = article.excerpt?.trim();
  if (excerpt) return excerpt;
  const bodyText = article.body ? stripHtmlToText(article.body) : "";
  if (bodyText) return truncateText(bodyText);
  return "Xem chi ti\u1ebft b\u00e0i vi\u1ebft t\u1eeb BigBike.";
}

export function ArticleCard({ article, variant = "default" }: ArticleCardProps) {
  const title = safeText(article.title, "B\u00e0i vi\u1ebft \u0111ang c\u1eadp nh\u1eadt");
  const excerpt = resolveArticleExcerpt(article);
  const category = safeText(article.category?.name ?? article.categories?.[0]?.name, "Tin t\u1ee9c");
  const publishedDate = formatDate(article.publishedAt ?? article.createdAt);
  const isFeatured = variant === "featured";

  return (
    <Link
      href={toArticlePath(article.slug)}
      className={
        isFeatured
          ? "group flex flex-col md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] mb-[22px] md:min-h-[360px] no-underline text-inherit bg-card shadow-md transition-shadow duration-300 hover:shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
          : "group flex flex-col no-underline text-inherit bg-card shadow-md transition-shadow duration-300 hover:shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
      }
    >
      <div
        className={
          isFeatured
            ? "relative aspect-video md:aspect-auto overflow-hidden bg-muted shrink-0 md:h-full md:min-h-[320px]"
            : "relative aspect-video overflow-hidden bg-muted shrink-0"
        }
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
        className={
          isFeatured
            ? "relative pt-[41px] px-[34px] pb-[30px] flex flex-col gap-2 flex-1 bg-card justify-center"
            : "relative pt-5 px-5 pb-[30px] flex flex-col gap-2 flex-1 bg-card"
        }
      >
        {isFeatured && (
          <span className="absolute -top-[21px] left-0 z-[2] inline-flex items-center h-[42px] min-w-[168px] pl-[22px] pr-[28px] bg-brand text-white font-display text-sm font-bold tracking-[0.04em] uppercase whitespace-nowrap [clip-path:polygon(0_0,100%_0,calc(100%-18px)_100%,0_100%)]">
            {publishedDate}
          </span>
        )}
        <div className="flex flex-col gap-2 flex-1">
          <p className="text-sm font-bold tracking-[0.14em] uppercase text-brand m-0">
            {isFeatured ? category : `${category} / ${publishedDate}`}
          </p>
          <h3
            className={
              isFeatured
                ? "font-display font-semibold uppercase tracking-[0.02em] text-foreground leading-[1.12] m-0 transition-colors duration-300 group-hover:text-brand line-clamp-3 text-[clamp(1.4rem,2.6vw,2.3rem)]"
                : "font-display text-lg font-semibold uppercase tracking-[0.02em] text-foreground leading-[1.3] m-0 transition-colors duration-300 group-hover:text-brand line-clamp-2"
            }
          >
            {title}
          </h3>
          <p
            className={
              isFeatured
                ? "text-sm text-muted-foreground leading-[1.65] m-0"
                : "text-sm text-muted-foreground leading-[1.55] m-0 min-h-[104px] line-clamp-4"
            }
          >
            {excerpt}
          </p>
          {isFeatured && (
            <span className="mt-auto pt-[6px] text-muted-foreground text-sm font-bold tracking-[0.12em] uppercase transition-colors duration-300 group-hover:text-brand">
              {"\u0110\u1ecdc ti\u1ebfp"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
