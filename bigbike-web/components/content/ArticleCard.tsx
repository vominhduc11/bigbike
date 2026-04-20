import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { formatDate, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";

type ArticleCardProps = {
  article: Article;
};

export function ArticleCard({ article }: ArticleCardProps) {
  const title = safeText(article.title, "Bai viet dang cap nhat");
  const excerpt = safeText(article.excerpt, "Noi dung dang duoc cap nhat.");

  return (
    <article className="bb-article-card bb-card bb-card-hover">
      <Link href={toArticlePath(article.slug)} className="bb-article-card-link">
        <MediaImage
          image={article.coverImage}
          altFallback={title}
          className="bb-article-image"
          width={1200}
          height={675}
        />
        <div className="bb-article-body">
          <p className="bb-article-meta">{formatDate(article.publishedAt ?? article.createdAt)}</p>
          <h3>{title}</h3>
          <p>{excerpt}</p>
        </div>
      </Link>
    </article>
  );
}

