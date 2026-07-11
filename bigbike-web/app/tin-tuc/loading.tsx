import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { Skeleton } from "@/components/ui/skeleton";

export default async function ArticleListLoading() {
  const [tCommon, tBlog] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Blog"),
  ]);

  return (
    <div aria-label={tCommon("loading")} aria-busy="true">
      <PageHero title={tBlog("title")} breadcrumb={[]} />
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-12">
        <aside className="space-y-4 md:col-span-3">
          <Skeleton className="h-7 w-40 rounded-none" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-none" />
          ))}
        </aside>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:col-span-9 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border border-border bg-card">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-3 p-5 pt-8">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
