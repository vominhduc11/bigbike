import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { ArticleCard } from "@/components/content/ArticleCard";
import { listArticles } from "@/lib/api/public-api";
import { toArticleListPath, toHomePath, toProductListPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const revalidate = 3600;

export default async function NotFoundPage() {
  const recentResult = await listArticles({ page: 1, size: 3, sort: "publishedAt:desc" });
  const recent = recentResult.data ?? [];

  return (
    <section className="min-h-[62vh] bg-background py-20 text-center">
      <PageHero
        kicker="Lỗi 404"
        title="Không tìm thấy trang"
        description="Nội dung bạn tìm kiếm không còn tồn tại — có thể đã cũ hoặc đã được gỡ bỏ."
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "404" },
        ]}
      />
      <div className="bb-container">
        <div className="max-w-[720px] mx-auto pt-10 pb-20 flex flex-col gap-7">
          <div className="flex justify-center select-none" aria-hidden="true">
            <div className="relative">
              <span className="font-display font-bold text-[clamp(7rem,22vw,14rem)] leading-none tracking-tighter text-foreground/[0.07] select-none">
                404
              </span>
              <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-[clamp(3.5rem,10vw,7rem)] leading-none tracking-tight text-brand">
                404
              </span>
            </div>
          </div>
          <p className="text-base text-muted-foreground">Bạn có thể tìm kiếm sản phẩm hoặc tham khảo các bài viết bên dưới.</p>

          <form
            action={toProductListPath()}
            method="get"
            className="flex flex-col sm:flex-row w-full max-w-[560px] mx-auto border border-border overflow-hidden bg-card"
            role="search"
            aria-label="Tìm kiếm sản phẩm"
          >
            <Input
              type="search"
              name="q"
              placeholder="Tìm sản phẩm, thương hiệu..."
              className="flex-1 border-0 rounded-none bg-transparent h-12 min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Từ khoá tìm kiếm"
            />
            <Button type="submit" variant="primary" className="rounded-none h-12 shrink-0 w-full sm:w-auto">
              TÌM KIẾM
            </Button>
          </form>

          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild variant="primary">
              <Link href={toHomePath()}>VỀ TRANG CHỦ</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={toProductListPath()}>XEM SẢN PHẨM</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={toArticleListPath()}>ĐỌC TIN TỨC</Link>
            </Button>
          </div>

          {recent.length > 0 && (
            <section className="mt-6 text-left" aria-label="Bài viết mới">
              <h2 className="font-display text-2xl font-semibold uppercase tracking-wider mb-[18px] text-foreground">BÀI VIẾT MỚI</h2>
              <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
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
