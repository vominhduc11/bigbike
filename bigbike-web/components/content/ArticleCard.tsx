import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { formatDate, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";

type ArticleCardProps = {
  article: Article;
};

export function ArticleCard({ article }: ArticleCardProps) {
  const title = safeText(article.title, "Bài viết đang cập nhật");
  const excerpt = safeText(article.excerpt, "Nội dung đang được cập nhật.");

  return (
    <Link href={toArticlePath(article.slug)} className="wp-news-card">
      <div className="wp-news-img">
        <MediaImage
          image={article.coverImage}
          altFallback={title}
          width={1200}
          height={675}
        />
      </div>
      <div className="wp-news-body">
        <p className="wp-news-meta">{formatDate(article.publishedAt ?? article.createdAt)}</p>
        <h3 className="wp-news-title">{title}</h3>
        <p className="wp-news-excerpt">{excerpt}</p>
      </div>
    </Link>
  );
}
