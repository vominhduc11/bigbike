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
    title: q ? `Tim kiem: ${q}` : "Tim kiem",
    description: "Tim kiem san pham va bai viet trong he thong BigBike.",
    canonicalPath: SEARCH_PATH,
    // Search result pages should not be indexed (per Google guidelines).
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const qParsed = parseTextParam(params.q, 200);
  const limitParsed = parsePositiveIntParam(params.limit, {
    defaultValue: 20,
    min: 1,
    max: 50,
    field: "limit",
  });

  const query = qParsed.value?.trim() ?? "";

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Search</p>
          <h1>Tim kiem</h1>
          <p className="bb-page-subtitle">
            Nhap tu khoa de tim san pham va bai viet trong toan bo he thong.
          </p>
        </header>

        <form method="GET" className="bb-query-form">
          <div className="bb-query-row">
            <label className="bb-query-label">
              Tu khoa
              <input
                name="q"
                defaultValue={query}
                className="bb-query-input"
                placeholder="VD: mu bao hiem AGV"
                required
                minLength={1}
                maxLength={200}
              />
            </label>
          </div>
          <div className="bb-section-row">
            <button className="bb-button bb-button-primary" type="submit">
              Tim kiem
            </button>
            <Link href={SEARCH_PATH} className="bb-button bb-button-secondary">
              Xoa
            </Link>
          </div>
        </form>

        {query.length === 0 ? (
          <EmptyState
            title="Nhap tu khoa de bat dau"
            description="Tu khoa co the la ten san pham, ma SKU, hoac chu de bai viet."
          />
        ) : (
          <SearchResults query={query} limit={limitParsed.value} />
        )}
      </div>
    </section>
  );
}

async function SearchResults({ query, limit }: { query: string; limit: number }) {
  const result = await search({ q: query, limit });

  if (result.error) {
    return <ErrorState message={result.error.message} retryHref={`${SEARCH_PATH}?q=${encodeURIComponent(query)}`} />;
  }

  const products = result.data?.products ?? [];
  const articles = result.data?.articles ?? [];
  const totalHits = products.length + articles.length;

  if (totalHits === 0) {
    return (
      <EmptyState
        title={`Khong co ket qua cho "${query}"`}
        description="Thu rut gon tu khoa hoac kiem tra chinh ta."
      />
    );
  }

  return (
    <>
      <p className="bb-result-summary">
        Tim thay <strong>{products.length}</strong> san pham va <strong>{articles.length}</strong> bai viet cho tu khoa <em>&ldquo;{query}&rdquo;</em>.
      </p>

      {products.length > 0 ? (
        <section className="bb-search-section">
          <h2>San pham</h2>
          <div className="bb-grid-products">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section className="bb-search-section">
          <h2>Bai viet</h2>
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
