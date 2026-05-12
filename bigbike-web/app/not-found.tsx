import Link from "next/link";
import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { ArticleCard } from "@/components/content/ArticleCard";
import { listArticles } from "@/lib/api/public-api";
import { toArticleListPath, toHomePath, toProductListPath } from "@/lib/utils/routes";

export const revalidate = 3600;

export default async function NotFoundPage() {
  const recentResult = await listArticles({ page: 1, size: 3, sort: "publishedAt:desc" });
  const recent = recentResult.data ?? [];

  return (
    <section className="bb-page wp-404-page">
      <PageHero
        title="Xin lỗi, nội dung bạn tìm kiếm không còn tồn tại có thể nội dung đã cũ hoặc bị xóa."
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "404" },
        ]}
      />
      <div className="bb-container">
        <div className="wp-404-inner">
          <div className="wp-404-image">
            <Image
              src="/wp/404.png"
              alt="Không tìm thấy trang"
              width={480}
              height={320}
              priority
            />
          </div>
          <p className="wp-404-lead">Bạn có thể tìm kiếm sản phẩm hoặc tham khảo các bài viết bên dưới.</p>

          <form
            action={toProductListPath()}
            method="get"
            className="wp-404-search"
            role="search"
            aria-label="Tìm kiếm sản phẩm"
          >
            <input
              type="search"
              name="q"
              placeholder="Tìm sản phẩm, thương hiệu..."
              className="wp-404-search-input"
              aria-label="Từ khoá tìm kiếm"
            />
            <button type="submit" className="bb-button bb-button-primary wp-404-search-btn">
              TÌM KIẾM
            </button>
          </form>

          <div className="wp-404-nav">
            <Link href={toHomePath()} className="bb-button bb-button-primary">
              VỀ TRANG CHỦ
            </Link>
            <Link href={toProductListPath()} className="bb-button bb-button-secondary">
              XEM SẢN PHẨM
            </Link>
            <Link href={toArticleListPath()} className="bb-button bb-button-secondary">
              ĐỌC TIN TỨC
            </Link>
          </div>

          {recent.length > 0 && (
            <section className="wp-404-recent" aria-label="Bài viết mới">
              <h2 className="wp-404-recent-title">BÀI VIẾT MỚI</h2>
              <div className="wp-news-grid">
                {recent.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
