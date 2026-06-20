"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { openWriteReviewDialog } from "@/components/catalog/writeReviewBus";
import { RatingSummary } from "./reviews/RatingSummary";
import { ReviewCard } from "./reviews/ReviewCard";
import { ReviewsLoading, ReviewsPlaceholder } from "./reviews/states";
import { fetchReviewsPage } from "./reviews/api";
import type { SortKey } from "./reviews/types";

// WriteReviewForm lives in ./reviews/WriteReviewForm; re-exported here so existing
// `@/components/catalog/ReviewsSection` imports (WriteReviewDialog) keep working.
export { WriteReviewForm } from "./reviews/WriteReviewForm";

type ReviewsSectionProps = {
  productId: string;
  // embedded = đang nằm trong panel tab sản phẩm: bỏ khung section riêng (viền
  // trên, lề lớn, id #reviews, tiêu đề lặp) vì thanh tab / H2 panel đã là tiêu đề.
  embedded?: boolean;
};

export function ReviewsSection({ productId, embedded = false }: ReviewsSectionProps) {
  const t = useTranslations("Product.reviews");
  const sectionRef = useRef<HTMLElement>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const queryKey = ["product-reviews", productId, ratingFilter, sort, page] as const;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchReviewsPage(productId, page, ratingFilter, sort, t("errorLoad")),
    // Keep the previous page visible while the next one loads so the list and
    // summary don't flash back to the skeleton on every page/filter/sort switch.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Each page REPLACES the list (numbered pagination) so the section height
  // stays constant no matter how many reviews the product has.
  const reviews = data?.reviews ?? [];
  // avgRating / totalReviews / breakdown stay global (backend keeps them
  // unfiltered) so the summary panel is stable while drilling into one star.
  const total = data?.totalReviews ?? 0;
  const avgRating = data?.avgRating ?? 0;
  const ratingBreakdown = data?.ratingBreakdown ?? {};
  const totalPages = data?.pagination?.totalPages ?? 1;

  const goToPage = (next: number) => {
    setPage(next);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSelectStar = (star: number) => {
    setRatingFilter((current) => (current === star ? null : star));
    setPage(1);
  };

  const handleSortChange = (value: SortKey) => {
    setSort(value);
    setPage(1);
  };

  return (
    <section
      ref={sectionRef}
      id={embedded ? undefined : "reviews"}
      className={cn(
        "scroll-mt-[var(--bb-header-height)]",
        !embedded && "mt-12 border-t border-border pt-12 max-md:mt-10 max-md:pt-10",
      )}
    >
      {/* Tiêu đề DÙNG CHUNG kiểu `.pdp-section-head` với mọi section PDP khác (căn trái, 24/35px,
          margin-bottom 20px) — thay tiêu đề căn-giữa line-height lớn cũ vốn lệch nhịp với khối trên/dưới. */}
      {!embedded && (
        <div className="pdp-section-head">
          <h2 className="title">
            {total > 0 ? t("titleWithCount", { count: total }) : t("title")}
          </h2>
        </div>
      )}

      {/* Khối đánh giá CHỈ để XEM — form viết đánh giá đã chuyển sang modal
          (WriteReviewDialog). Các nút "Viết đánh giá" dưới đây chỉ mở modal đó. */}
      <div className="min-w-0">
        {isLoading ? (
            <ReviewsLoading />
          ) : isError ? (
            <ReviewsPlaceholder
              title={t("errorLoad")}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                  {t("retry")}
                </Button>
              }
            />
          ) : total > 0 ? (
            <>
              <RatingSummary
                avg={avgRating}
                total={total}
                breakdown={ratingBreakdown}
                activeStar={ratingFilter}
                onSelectStar={handleSelectStar}
              />

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-h-[36px] items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openWriteReviewDialog}>
                    {t("writeButton")}
                  </Button>
                  {ratingFilter !== null && (
                    <>
                      <span className="text-caption text-muted-foreground">
                        {t("filterActive", { count: ratingFilter })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRatingFilter(null)}
                      >
                        {t("clearFilter")}
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-caption text-muted-foreground">{t("sortLabel")}</span>
                  <Select value={sort} onValueChange={(value) => handleSortChange(value as SortKey)}>
                    <SelectTrigger className="w-[180px] min-h-[40px]" aria-label={t("sortLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                      <SelectItem value="highest">{t("sortHighest")}</SelectItem>
                      <SelectItem value="lowest">{t("sortLowest")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reviews.length > 0 ? (
                <ol className="m-0 mt-4 list-none p-0">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </ol>
              ) : (
                <div className="mt-4">
                  <ReviewsPlaceholder
                    title={ratingFilter !== null ? t("noReviewsForFilter", { count: ratingFilter }) : t("noReviews")}
                  />
                </div>
              )}

              <PaginationNav page={page} totalPages={totalPages} onPageChange={goToPage} />
            </>
          ) : (
            <ReviewsPlaceholder
              title={t("noReviews")}
              description={t("beFirst")}
              action={
                <Button type="button" variant="outline" size="sm" onClick={openWriteReviewDialog}>
                  {t("writeButton")}
                </Button>
              }
            />
          )}
      </div>
    </section>
  );
}
