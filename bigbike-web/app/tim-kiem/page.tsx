import Link from "next/link";
import type { Metadata } from "next";
import { ArticleCard } from "@/components/content/ArticleCard";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { search } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { parsePositiveIntParam, parseTextParam, readSingleSearchParam } from "@/lib/utils/query";

const SEARCH_PATH = "/tim-kiem/";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = readSingleSearchParam(params.q);
  return buildPublicMetadata({
    title: q ? `Tìm kiếm: ${q}` : "Tìm kiếm",
    description: "Tìm kiếm sản phẩm và bài viết trong hệ thống BigBike.",
    canonicalPath: SEARCH_PATH,
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const qParsed = parseTextParam(params.q, 200);
  const postType = readSingleSearchParam(params.post_type)?.trim().toLowerCase() ?? "";
  const limitParsed = parsePositiveIntParam(params.limit, {
    defaultValue: 20,
    min: 1,
    max: 50,
    field: "limit",
  });

  const query = qParsed.value?.trim() ?? "";
  const types: Array<"product" | "article"> | undefined =
    postType === "product" ? ["product"] : postType === "article" ? ["article"] : undefined;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <h1>Tìm kiếm</h1>
        </header>

        <form method="GET" className="bb-query-form">
          <div className="bb-query-row">
            <label className="bb-query-label">
              Từ khoá
              <input
                name="q"
                defaultValue={query}
                className="bb-query-input"
                placeholder="VD: mũ bảo hiểm AGV"
                required
                minLength={1}
                maxLength={200}
              />
            </label>
            <label className="bb-query-label">
              Phạm vi
              <select name="post_type" defaultValue={postType || ""} className="bb-query-select">
                <option value="">Tất cả nội dung</option>
                <option value="product">Sản phẩm</option>
                <option value="article">Bài viết</option>
              </select>
            </label>
          </div>
          <div className="bb-section-row">
            <button className="bb-button bb-button-primary" type="submit">
              Tìm kiếm
            </button>
            <Link href={SEARCH_PATH} className="bb-button bb-button-secondary">
              Xoá
            </Link>
          </div>
        </form>

        {query.length === 0 ? (
          <EmptyState
            title="Nhập từ khoá để bắt đầu"
            description="Từ khoá có thể là tên sản phẩm, mã SKU hoặc chủ đề bài viết."
          />
        ) : (
          <SearchResults query={query} limit={limitParsed.value} types={types} />
        )}
      </div>
    </section>
  );
}

async function SearchResults({
  query,
  limit,
  types,
}: {
  query: string;
  limit: number;
  types?: Array<"product" | "article">;
}) {
  const result = await search({ q: query, limit, types });

  if (result.error) {
    return <ErrorState message={result.error.message} retryHref={`${SEARCH_PATH}?q=${encodeURIComponent(query)}`} />;
  }

  const products = result.data?.products ?? [];
  const articles = result.data?.articles ?? [];
  const totalHits = products.length + articles.length;

  if (totalHits === 0) {
    return (
      <EmptyState
        title={`Không có kết quả cho "${query}"`}
        description="Thử rút gọn từ khoá hoặc kiểm tra chính tả."
        action={
          <Link href="/san-pham/" className="bb-button bb-button-primary">
            XEM TẤT CẢ SẢN PHẨM
          </Link>
        }
      />
    );
  }

  return (
    <>
      <p className="bb-result-summary">
        Tìm thấy <strong>{products.length}</strong> sản phẩm và <strong>{articles.length}</strong> bài viết cho từ khoá{" "}
        <em>&ldquo;{query}&rdquo;</em>.
      </p>

      {products.length > 0 ? (
        <section className="bb-search-section">
          <h2>Sản phẩm</h2>
          <div className="bb-grid-products">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section className="bb-search-section">
          <h2>Bài viết</h2>
          <div className="bb-grid-articles">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
