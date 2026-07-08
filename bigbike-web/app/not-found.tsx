import { getTranslations } from "next-intl/server";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/content/ArticleCard";
import { listArticles } from "@/lib/api/public-api";
import { toHomePath } from "@/lib/utils/routes";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { NotFoundActions } from "./NotFoundActions";

export const revalidate = 3600;

export default async function NotFoundPage() {
  const [recentResult, t, tBreadcrumb] = await Promise.all([
    listArticles({ page: 1, size: 3, sort: "publishedAt:desc" }),
    getTranslations("NotFound"),
    getTranslations("Breadcrumb"),
  ]);
  const recent = recentResult.data ?? [];

  // Dùng đúng hero chung của site (.page-title qua WpStaticShell) như mọi trang tĩnh
  // khác — tiêu đề căn trái + breadcrumb dưới + ảnh minh hoạ mặc định bên phải. Shell
  // tự nạp bundle CSS theme (cùng href) để F5 thẳng vào /404 không mất style header/footer.
  // text-center chỉ đặt trên thân 404 bên dưới, KHÔNG để rớt vào hero.
  return (
    <WpStaticShell
      title={t("pageTitle")}
      breadcrumb={[
        { label: tBreadcrumb("home"), href: toHomePath() },
        { label: "404" },
      ]}
      mainClassName="bg-background min-h-[50vh]"
    >
      <Container>
        <div className="max-w-[720px] mx-auto pt-10 pb-20 flex flex-col gap-7 text-center">
          <div className="flex justify-center select-none" aria-hidden="true">
            <div className="relative">
              {/* bespoke: display-only ghost text, no token at this scale */}
              <span className="font-body font-bold text-[clamp(7rem,22vw,14rem)] leading-none tracking-normal text-foreground/[0.07] select-none">
                404
              </span>
              <span className="absolute inset-0 flex items-center justify-center font-body font-bold text-display-xl leading-none tracking-normal text-brand">
                404
              </span>
            </div>
          </div>
          <p className="text-body text-muted-foreground">{t("description")}</p>

          <NotFoundActions />

          {recent.length > 0 && (
            <section className="mt-6 text-left" aria-label={t("recentArticlesAriaLabel")}>
              <h2 className={cn(sectionHeading, "mb-[18px]")}>{t("recentArticlesHeading")}</h2>
              <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:gap-6 2xl:gap-8">
                {recent.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}
        </div>
      </Container>
    </WpStaticShell>
  );
}
