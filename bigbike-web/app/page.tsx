import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CategoryCard } from "@/components/catalog/CategoryCard";
import { ArticleCard } from "@/components/content/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { listArticles, listCategories, listProducts } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toArticleListPath, toCategoryListPath, toHomePath, toProductListPath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Trang chủ",
  description: "BigBike homepage cho danh mục sản phẩm, bài viết và điều hướng public catalog.",
  canonicalPath: toHomePath(),
});

export default async function HomePage() {
  const [productsResult, categoriesResult, articlesResult] = await Promise.all([
    listProducts({
      page: 1,
      size: 8,
      sort: "createdAt:desc",
    }),
    listCategories({
      page: 1,
      size: 6,
      sort: "sortOrder:asc",
    }),
    listArticles({
      page: 1,
      size: 3,
      sort: "publishedAt:desc",
    }),
  ]);

  const hasFallback =
    productsResult.fromFallback || categoriesResult.fromFallback || articlesResult.fromFallback;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header className="bb-hero">
          <p className="bb-kicker">BigBike Public Catalog</p>
          <h1 className="bb-heading-xl">Do bao ho biker - catalog va content route legacy</h1>
          <p className="bb-page-subtitle">
            Giai đoạn Phase 4B tập trung vao UI read-only cho public catalog/content voi URL giu
            theo route legacy: /san-pham, /product/{'{slug}'}, /danh-muc-san-pham/{'{slug}'},
            /brands/{'{slug}'}, /tin-tuc/{'{slug}'}.html.
          </p>
          <div className="bb-section-row" style={{ marginTop: "var(--bb-space-5)" }}>
            <Link href={toProductListPath()} className="bb-button bb-button-primary">
              Xem sản phẩm
            </Link>
            <Link href={toArticleListPath()} className="bb-button bb-button-secondary">
              Đọc tin tức
            </Link>
          </div>
        </header>

        {hasFallback && process.env.NODE_ENV === "development" ? (
          <p className="bb-status-banner">
            Đang hiển thị dữ liệu fallback dev vi API backend chưa sẵn sàng hoặc tạm thời lỗi.
          </p>
        ) : null}

        <section className="bb-section" aria-labelledby="home-products-heading">
          <div className="bb-section-row">
            <h2 id="home-products-heading" className="bb-section-title">
              Sản phẩm nổi bật
            </h2>
            <Link href={toProductListPath()} className="bb-link">
              Xem tất cả
            </Link>
          </div>
          {productsResult.error && productsResult.data.length === 0 ? (
            <ErrorState message={productsResult.error.message} retryHref="/" />
          ) : productsResult.data.length === 0 ? (
            <EmptyState
              title="Chưa có sản phẩm"
              description="Danh sách sản phẩm hiện đang rỗng. Vui long quay lai sau."
            />
          ) : (
            <div className="bb-grid-products">
              {productsResult.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        <section className="bb-section" aria-labelledby="home-categories-heading">
          <div className="bb-section-row">
            <h2 id="home-categories-heading" className="bb-section-title">
              Danh mục sản phẩm
            </h2>
            <Link href={toCategoryListPath()} className="bb-link">
              Xem danh mục
            </Link>
          </div>
          {categoriesResult.error && categoriesResult.data.length === 0 ? (
            <ErrorState message={categoriesResult.error.message} retryHref="/" />
          ) : categoriesResult.data.length === 0 ? (
            <EmptyState
              title="Chưa có danh mục"
              description="Danh mục sản phẩm đang được cập nhật."
            />
          ) : (
            <div className="bb-grid-categories">
              {categoriesResult.data.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </section>

        <section className="bb-section" aria-labelledby="home-articles-heading">
          <div className="bb-section-row">
            <h2 id="home-articles-heading" className="bb-section-title">
              Tin tức và hướng dẫn
            </h2>
            <Link href={toArticleListPath()} className="bb-link">
              Xem tất cả bài viết
            </Link>
          </div>
          {articlesResult.error && articlesResult.data.length === 0 ? (
            <ErrorState message={articlesResult.error.message} retryHref="/" />
          ) : articlesResult.data.length === 0 ? (
            <EmptyState
              title="Chưa có bài viết"
              description="Nội dung hướng dẫn và tin tức đang được cập nhật."
            />
          ) : (
            <div className="bb-grid-articles">
              {articlesResult.data.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
