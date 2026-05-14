import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/content/ArticleCard";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { ARTICLE_SORT_VALUES, listArticles, listPublicSettings } from "@/lib/api/public-api";
import type { Article, ContentCategorySummary } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readHeroSettings } from "@/lib/utils/page-hero";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";

const SORT_LABELS: Record<(typeof ARTICLE_SORT_VALUES)[number], string> = {
  "publishedAt:desc": "M\u1edbi nh\u1ea5t",
  "publishedAt:asc": "C\u0169 nh\u1ea5t",
  "createdAt:desc": "M\u1edbi t\u1ea1o",
  "createdAt:asc": "T\u1ea1o c\u0169 nh\u1ea5t",
  "title:asc": "T\u00ean A-Z",
  "title:desc": "T\u00ean Z-A",
};

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function collectArticleCategories(articles: Article[]): ContentCategorySummary[] {
  const categories = new Map<string, ContentCategorySummary>();

  for (const article of articles) {
    const articleCategories = [
      article.category,
      ...(article.categories ?? []),
    ].filter((category): category is ContentCategorySummary => Boolean(category?.slug && category.name));

    for (const category of articleCategories) {
      categories.set(category.slug, category);
    }
  }

  return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function sortLabel(value: string): string {
  return SORT_LABELS[value as keyof typeof SORT_LABELS] ?? value;
}

export async function generateMetadata({ searchParams }: ArticleListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasFilters =
    page > 1 ||
    Boolean(readSingleSearchParam(params.q)) ||
    Boolean(readSingleSearchParam(params.category)) ||
    Boolean(readSingleSearchParam(params.sort));

  return buildPublicMetadata({
    title: "Tin t\u1ee9c",
    description: "Tin t\u1ee9c, \u0111\u00e1nh gi\u00e1 s\u1ea3n ph\u1ea9m v\u00e0 h\u01b0\u1edbng d\u1eabn biker t\u1eeb BigBike.",
    canonicalPath: toArticleListPath(),
    noIndex: hasFilters,
  });
}

export default async function ArticleListPage({ searchParams }: ArticleListPageProps) {
  const params = await searchParams;

  const pageParsed = parsePositiveIntParam(params.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: 12,
    min: 1,
    max: 100,
    field: "size",
  });
  const categoryParsed = parseSlugParam(
    params.category === "all" ? undefined : params.category,
    "category",
  );
  const qParsed = parseTextParam(params.q, 100);
  const sortParsed = parseSortParam(params.sort, ARTICLE_SORT_VALUES, "publishedAt:desc");

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    qParsed.error,
    sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title={"Query ch\u01b0a h\u1ee3p l\u1ec7"} message={validationErrors.join(" ")} retryHref={toArticleListPath()} />
        </div>
      </section>
    );
  }

  const [result, settingsResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: categoryParsed.value,
      q: qParsed.value,
    }),
    listPublicSettings(),
  ]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");

  const articles = result.data;
  const totalItems = result.pagination?.totalItems ?? articles.length;
  const hasContentFilters = Boolean(qParsed.value || categoryParsed.value);
  const hasVisibleFilters =
    hasContentFilters ||
    Boolean(readSingleSearchParam(params.sort)) ||
    pageParsed.value > 1 ||
    sizeParsed.value !== 12;
  const featuredArticle = !hasContentFilters && pageParsed.value === 1 ? articles[0] : undefined;
  const gridArticles = featuredArticle ? articles.slice(1) : articles;
  const categories = collectArticleCategories(articles);
  const activeCategoryLabel =
    categories.find((category) => category.slug === categoryParsed.value)?.name ??
    categoryParsed.value;

  const makeListHref = (overrides: {
    page?: number;
    category?: string;
    q?: string;
    sort?: string;
    size?: number;
  }) =>
    `${toArticleListPath()}${buildQueryString({
      page: overrides.page,
      size: overrides.size,
      sort: overrides.sort,
      category: overrides.category,
      q: overrides.q,
    })}`;

  const chipBase = "inline-flex items-center min-h-[34px] px-3 border rounded-full text-[11px] font-bold tracking-[0.08em] no-underline uppercase transition-all duration-150";
  const chipActive = "text-white bg-brand/[0.6] border-brand";
  const chipInactive = "border-border text-muted-foreground hover:text-white hover:bg-brand/[0.6] hover:border-brand";

  return (
    <div className="bg-background">
      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        kicker={heroSettings.kicker ?? "BIGBIKE BLOG"}
        title={heroSettings.title ?? "Tin t\u1ee9c v\u00e0 h\u01b0\u1edbng d\u1eabn biker"}
        description={
          heroSettings.description ??
          "Ki\u1ebfn th\u1ee9c ch\u1ecdn gear, kinh nghi\u1ec7m s\u1eed d\u1ee5ng \u0111\u1ed3 b\u1ea3o h\u1ed9 moto v\u00e0 c\u1eadp nh\u1eadt s\u1ea3n ph\u1ea9m ch\u00ednh h\u00e3ng cho anh em rider Vi\u1ec7t Nam."
        }
        breadcrumb={[
          { label: "Trang ch\u1ee7", href: toHomePath() },
          { label: "Tin t\u1ee9c" },
        ]}
        meta={`${totalItems} b\u00e0i vi\u1ebft`}
      />

      <div className="bb-container mb-14">
        <div className="bg-card border border-border p-[18px] mb-[26px]">
          <form method="GET" className="grid grid-cols-[minmax(240px,1fr)_minmax(150px,0.45fr)_minmax(160px,0.42fr)_auto] gap-3 items-end" aria-label={"L\u1ecdc b\u00e0i vi\u1ebft"}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"T\u00ecm ki\u1ebfm"}</label>
              <Input
                name="q"
                defaultValue={qParsed.value}
                placeholder="VD: ch\u1ecdn size m\u0169, g\u0103ng tay touring..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"Danh m\u1ee5c"}</label>
              <Select name="category" defaultValue={categoryParsed.value ?? "all"}>
                <SelectTrigger>
                  <SelectValue placeholder={"T\u1ea5t c\u1ea3 danh m\u1ee5c"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{"T\u1ea5t c\u1ea3 danh m\u1ee5c"}</SelectItem>
                  {categoryParsed.value && !categories.some((c) => c.slug === categoryParsed.value) ? (
                    <SelectItem value={categoryParsed.value}>{`Danh m\u1ee5c hi\u1ec7n t\u1ea1i: ${categoryParsed.value}`}</SelectItem>
                  ) : null}
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">{"S\u1eafp x\u1ebfp"}</label>
              <Select name="sort" defaultValue={sortParsed.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_SORT_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {sortLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-[10px] items-center">
              <Button type="submit" variant="primary">
                {"\u00c1p d\u1ee5ng"}
              </Button>
              {hasVisibleFilters ? (
                <Link href={toArticleListPath()} className="text-[11px] font-bold tracking-[0.1em] uppercase text-muted-foreground border border-white/[0.12] py-[9px] px-[9px] no-underline transition-all duration-150 hover:border-brand hover:text-brand whitespace-nowrap">
                  {"Xo\u00e1 l\u1ecdc"}
                </Link>
              ) : null}
            </div>
          </form>

          {categories.length > 0 ? (
            <nav className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border" aria-label={"Danh m\u1ee5c tin t\u1ee9c"}>
              <Link
                href={makeListHref({
                  q: qParsed.value,
                  sort: sortParsed.value === "publishedAt:desc" ? undefined : sortParsed.value,
                })}
                className={`${chipBase} ${categoryParsed.value ? chipInactive : chipActive}`}
              >
                {"T\u1ea5t c\u1ea3"}
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={makeListHref({
                    category: category.slug,
                    q: qParsed.value,
                    sort: sortParsed.value === "publishedAt:desc" ? undefined : sortParsed.value,
                  })}
                  className={`${chipBase} ${categoryParsed.value === category.slug ? chipActive : chipInactive}`}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-[18px] mb-[18px]">
          <div>
            <span className="block text-brand text-[11px] font-bold tracking-[0.16em] uppercase mb-[10px]">
              {hasContentFilters ? "K\u1ebft qu\u1ea3 l\u1ecdc" : "B\u00e0i m\u1edbi nh\u1ea5t"}
            </span>
            <h2 className="m-0 font-display text-[clamp(1.35rem,2vw,2rem)] leading-tight tracking-[0.01em] uppercase text-foreground">
              {hasContentFilters
                ? `${totalItems} b\u00e0i vi\u1ebft ph\u00f9 h\u1ee3p`
                : "C\u1eadp nh\u1eadt t\u1eeb BigBike"}
            </h2>
          </div>
          <p className="m-0 text-muted-foreground text-sm text-right">
            {qParsed.value ? `T\u1eeb kho\u00e1: "${qParsed.value}"` : null}
            {qParsed.value && activeCategoryLabel ? " \u00b7 " : null}
            {activeCategoryLabel ? `Danh m\u1ee5c: ${activeCategoryLabel}` : null}
            {!qParsed.value && !activeCategoryLabel ? `S\u1eafp x\u1ebfp: ${sortLabel(sortParsed.value)}` : null}
          </p>
        </div>

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toArticleListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title={"Kh\u00f4ng c\u00f3 b\u00e0i vi\u1ebft"}
            description={"Ch\u01b0a c\u00f3 b\u00e0i vi\u1ebft ph\u00f9 h\u1ee3p v\u1edbi b\u1ed9 l\u1ecdc hi\u1ec7n t\u1ea1i."}
            action={
              hasVisibleFilters ? (
                <Button asChild variant="primary">
                  <Link href={toArticleListPath()}>{"Xem t\u1ea5t c\u1ea3 b\u00e0i vi\u1ebft"}</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {featuredArticle ? (
              <ArticleCard article={featuredArticle} variant="featured" />
            ) : null}

            {gridArticles.length > 0 ? (
              <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
                {gridArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
              </div>
            ) : null}
            {result.pagination ? (
              <PaginationNav
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toArticleListPath()}${buildQueryString({
                    page: nextPage,
                    size: sizeParsed.value,
                    sort: sortParsed.value,
                    category: categoryParsed.value,
                    q: qParsed.value,
                  })}`
                }
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
