import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getArticleBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toArticlePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type ArticleDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Bai viet khong hop le",
      description: "Slug bai viet khong hop le.",
      canonicalPath: toArticlePath("invalid"),
      noIndex: true,
    });
  }

  const result = await getArticleBySlug(slug);
  if (!result.data) {
    return buildPublicMetadata({
      title: "Khong tim thay bai viet",
      description: "Khong tim thay bai viet yeu cau.",
      canonicalPath: toArticlePath(slug),
      noIndex: true,
    });
  }

  const article = result.data;
  return buildPublicMetadata({
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt ?? "Chi tiet bai viet BigBike.",
    canonicalPath: article.seo?.canonicalUrl ?? toArticlePath(article.slug),
    noIndex: article.seo?.noIndex ?? false,
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const result = await getArticleBySlug(slug);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }
  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? "Khong tai duoc bai viet."} />
        </div>
      </section>
    );
  }

  const article = result.data;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Tin tuc</p>
          <h1>{safeText(article.title, "Bai viet")}</h1>
          <p className="bb-page-subtitle">{safeText(article.excerpt, "Noi dung dang cap nhat.")}</p>
        </header>

        {result.fromFallback ? (
          <p className="bb-status-banner">Dang hien thi du lieu fallback dev cho bai viet detail.</p>
        ) : null}

        <section className="bb-section">
          <MediaImage
            image={article.coverImage}
            altFallback={safeText(article.title, "Bai viet")}
            className="bb-article-image"
            width={1600}
            height={900}
            priority
          />

          <div className="bb-metadata">
            <p>
              <strong>Ngay dang:</strong> {formatDate(article.publishedAt ?? article.createdAt)}
            </p>
            <p>
              <strong>Tac gia:</strong> {safeText(article.author?.name, "BigBike Team")}
            </p>
            <p>
              <strong>Category:</strong> {safeText(article.category?.name, "Tin tuc")}
            </p>
          </div>

          <article
            className="bb-richtext bb-section"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(article.body),
            }}
          />
        </section>
      </div>
    </section>
  );
}
