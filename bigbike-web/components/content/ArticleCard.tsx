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
  return text.slice(0, pos).trimEnd() + "…";
}

function resolveArticleExcerpt(article: Article): string {
  const excerpt = article.excerpt?.trim();
  if (excerpt) return excerpt;
  const bodyText = article.body ? stripHtmlToText(article.body) : "";
  if (bodyText) return truncateText(bodyText);
  return "Xem chi tiết bài viết từ BigBike.";
}

export function ArticleCard({ article, variant = "default" }: ArticleCardProps) {
  const title = safeText(article.title, "Bài viết đang cập nhật");
  const excerpt = resolveArticleExcerpt(article);
  const category = safeText(article.category?.name ?? article.categories?.[0]?.name, "Tin tức");
  const publishedDate = formatDate(article.publishedAt ?? article.createdAt);

  return (
    <Link
      href={toArticlePath(article.slug)}
      className={`wp-news-card${variant === "featured" ? " wp-news-card-featured" : ""}`}
    >
      <div className="wp-news-img-wrap">
        <MediaImage
          image={article.coverImage}
          altFallback={title}
          className="wp-news-img"
          width={1200}
          height={675}
        />
      </div>
      <div className="wp-news-body">
        <span className="wp-news-date">{publishedDate}</span>
        <div className="wp-news-body-inside">
          <p className="wp-news-meta">{category}</p>
          <h3 className="wp-news-card-title">{title}</h3>
          <p className="wp-news-excerpt">{excerpt}</p>
          <span className="wp-news-read-more">Đọc tiếp</span>
        </div>
      </div>
    </Link>
  );
}
