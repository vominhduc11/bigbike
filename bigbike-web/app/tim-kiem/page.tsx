import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArticleCard } from "@/components/content/ArticleCard";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { search } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { parsePositiveIntParam, parseTextParam, readSingleSearchParam } from "@/lib/utils/query";
import { toHomePath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchScopeSelect } from "@/components/search/SearchScopeSelect";

const SEARCH_PATH = "/tim-kiem/";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const [params, t] = await Promise.all([searchParams, getTranslations("Search")]);
  const q = readSingleSearchParam(params.q);
  return buildPublicMetadata({
    title: q ? t("metaTitleWithQuery", { query: q }) : t("title"),
    description: t("metaDescription"),
    canonicalPath: SEARCH_PATH,
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [params, t, tBreadcrumb] = await Promise.all([
    searchParams,
    getTranslations("Search"),
    getTranslations("Breadcrumb"),
  ]);
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

  const heroTitle = query ? t("heroTitleWithQuery", { query }) : t("title");

  return (
    <>
      <PageHero
        title={heroTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("breadcrumb") },
        ]}
      />
      <section className="bb-page">
      <div className="bb-container">
        <form method="GET" className="bb-query-form">
          <div className="bb-query-row">
            <label className="bb-query-label">
              {t("keywordLabel")}
              <Input
                name="q"
                defaultValue={query}
                className="bb-query-input"
                placeholder={t("keywordPlaceholder")}
                required
                minLength={1}
                maxLength={200}
              />
            </label>
            <label className="bb-query-label">
              {t("scopeLabel")}
              <SearchScopeSelect current={postType} />
            </label>
          </div>
          <div className="bb-section-row">
            <Button type="submit" variant="primary">{t("submit")}</Button>
            <Button asChild variant="secondary">
              <Link href={SEARCH_PATH}>{t("clear")}</Link>
            </Button>
          </div>
        </form>

        {query.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <SearchResults query={query} limit={limitParsed.value} types={types} />
        )}
      </div>
      </section>
    </>
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
  const [result, t] = await Promise.all([
    search({ q: query, limit, types }),
    getTranslations("Search"),
  ]);

  if (result.error) {
    return <ErrorState message={result.error.message} retryHref={`${SEARCH_PATH}?q=${encodeURIComponent(query)}`} />;
  }

  const products = result.data?.products ?? [];
  const articles = result.data?.articles ?? [];
  const totalHits = products.length + articles.length;

  if (totalHits === 0) {
    return (
      <EmptyState
        title={t("noResultTitle", { query })}
        description={t("noResultDescription")}
        action={
          <Button asChild variant="primary">
            <Link href="/san-pham/">{t("viewAllProducts")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="bb-result-summary">
        {t.rich("resultSummary", {
          productCount: products.length,
          articleCount: articles.length,
          query,
          strong: (chunks) => <strong>{chunks}</strong>,
          em: (chunks) => <em>{chunks}</em>,
        })}
      </p>

      {products.length > 0 ? (
        <section className="bb-search-section">
          <h2>{t("sectionProducts")}</h2>
          <div className="bb-grid-products">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {articles.length > 0 ? (
        <section className="bb-search-section">
          <h2>{t("sectionArticles")}</h2>
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
