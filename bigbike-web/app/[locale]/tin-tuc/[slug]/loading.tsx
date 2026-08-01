import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default async function ArticleDetailLoading() {
  const [tCommon, tBlog] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Blog"),
  ]);

  return (
    <div aria-label={tCommon("loading")} aria-busy="true">
      <PageHero title={tBlog("title")} breadcrumb={[]} />
      <Container className="grid grid-cols-1 gap-8 pb-10 md:grid-cols-12">
        <article className="space-y-6 md:col-span-8">
          <Skeleton className="aspect-video w-full rounded-none" />
          <Skeleton className="h-4 w-48 rounded-none" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-3 rounded-none" style={{ width: `${95 - (index % 4) * 8}%` }} />
            ))}
          </div>
        </article>
        <aside className="space-y-8 md:col-span-4">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group} className="space-y-4">
              <Skeleton className="h-7 w-40 rounded-none" />
              {Array.from({ length: 3 }).map((__, index) => (
                <div key={index} className="flex gap-3 border-b border-border pb-4">
                  <Skeleton className="aspect-video w-2/5 rounded-none" />
                  <div className="w-3/5 space-y-2">
                    <Skeleton className="h-3 w-1/2 rounded-none" />
                    <Skeleton className="h-4 w-full rounded-none" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </aside>
      </Container>
    </div>
  );
}
