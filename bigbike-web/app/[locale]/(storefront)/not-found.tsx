import { getLocale, getTranslations } from "next-intl/server";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/content/ArticleCard";
import { listArticles } from "@/lib/api/public-api";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { NotFoundActions } from "./NotFoundActions";
import type { Locale } from "@/i18n/locale";

export const revalidate = 3600;

export default async function NotFoundPage() {
  const locale = (await getLocale()) as Locale;
  const [recentResult, t] = await Promise.all([
    listArticles({ page: 1, size: 3, sort: "publishedAt:desc", lang: locale }),
    getTranslations("NotFound"),
  ]);
  const recent = recentResult.data ?? [];

  // 404 dùng shell không hero để hành động khôi phục nằm trong màn hình đầu tiên.
  // StaticPageShell vẫn phát marker bb-heroless, giữ khoảng né logo desktop của site.
  return (
    <StaticPageShell
      title={t("pageTitle")}
      breadcrumb={[]}
      showHero={false}
      mainClassName="bg-background"
    >
      <Container>
        <NotFoundActions />

        {recent.length > 0 && (
          <section
            className="pb-12 pt-4 text-left md:pb-18"
            aria-label={t("recentArticlesAriaLabel")}
          >
            <h2 className={cn(sectionHeading, "mb-4.5")}>{t("recentArticlesHeading")}</h2>
            <div className="grid grid-cols-1 gap-5.5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6 2xl:gap-8">
              {recent.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  imageSizes="(min-width: 1200px) 376px, (min-width: 1024px) calc((100vw - 112px) / 3), (min-width: 640px) calc((100vw - 72px) / 2), calc(100vw - 32px)"
                />
              ))}
            </div>
          </section>
        )}
      </Container>
    </StaticPageShell>
  );
}
