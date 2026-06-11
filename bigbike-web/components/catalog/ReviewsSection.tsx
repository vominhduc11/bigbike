"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationNav } from "@/components/ui/PaginationNav";

type SortKey = "newest" | "highest" | "lowest";

type Review = {
  id: number | string;
  authorName: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

type ReviewsData = {
  avgRating: number;
  totalReviews: number;
  ratingBreakdown: Record<string, number>;
  reviews: Review[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type ReviewsSectionProps = {
  productId: string;
};

const PAGE_SIZE = 10;

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      className={cn("h-4 w-4", className)}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function StarRow({ rating, iconClassName }: { rating: number; iconClassName?: string }) {
  const t = useTranslations("Product.reviews");
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={t("starsCount", { count: rating.toFixed(1) })}
    >
      {Array.from({ length: 5 }, (_, i) => {
        // Tô theo tỷ lệ liên tục như RatingStars (REVIEW_RULE_002): 4.5 → nửa
        // sao thứ 5, không Math.round thành 5 sao đầy. Sao lẻ = overlay sao đầy
        // cắt theo % width trên nền sao rỗng.
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-flex">
            <StarIcon
              filled={fill >= 1}
              className={cn(iconClassName, fill >= 1 ? "text-brand" : "text-[var(--bb-text-secondary)]")}
            />
            {fill > 0 && fill < 1 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon filled className={cn(iconClassName, "text-brand")} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("Product.reviews");
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label={t("formStars")}
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = display >= star;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={t("starsCount", { count: star })}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              className={cn(
                "p-0.5 cursor-pointer transition-colors duration-[var(--bb-duration-fast)] outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                active ? "text-brand" : "text-[var(--bb-text-secondary)]",
              )}
            >
              <StarIcon filled={active} className="h-8 w-8" />
            </button>
          );
        })}
      </div>
      {display > 0 && (
        <span className="font-body text-lg font-semibold text-[var(--bb-text-primary)]">
          {display}/5
        </span>
      )}
    </div>
  );
}

function RatingSummary({
  avg,
  total,
  breakdown,
  activeStar,
  onSelectStar,
}: {
  avg: number;
  total: number;
  breakdown: Record<string, number>;
  activeStar: number | null;
  onSelectStar: (star: number) => void;
}) {
  const t = useTranslations("Product.reviews");
  return (
    <div className="flex flex-col gap-6 border border-border p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex shrink-0 flex-col items-center justify-center gap-2 max-sm:border-b max-sm:border-border max-sm:pb-6 sm:w-[160px] sm:border-r sm:border-border">
        <div className="flex items-baseline gap-1">
          <span className="font-body text-5xl font-semibold leading-none text-[var(--bb-text-primary)]">
            {avg.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/5</span>
        </div>
        <StarRow rating={avg} iconClassName="h-5 w-5" />
        <span className="text-sm text-muted-foreground">{t("ratingCount", { count: total })}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1.5" role="group" aria-label={t("filterByStarHint")}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = breakdown?.[String(star)] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isActive = activeStar === star;
          const disabled = count === 0;
          return (
            <button
              key={star}
              type="button"
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => onSelectStar(star)}
              title={t("starsCount", { count: star })}
              className={cn(
                "flex items-center gap-3 px-2 py-1 -mx-2 text-left transition-colors duration-[var(--bb-duration-fast)] outline-none",
                "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                disabled ? "cursor-default opacity-60" : "cursor-pointer hover:bg-muted",
                isActive && "bg-muted",
              )}
            >
              <span className="flex w-9 shrink-0 items-center gap-1 text-sm text-[var(--bb-text-secondary)]">
                {star}
                <StarIcon filled className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="h-2 flex-1 overflow-hidden bg-background">
                <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right text-sm text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <li className="flex gap-4 border-b border-border py-5 first:pt-0">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted font-body text-lg font-semibold text-[var(--bb-text-primary)]"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <strong className="font-semibold text-[var(--bb-text-primary)]">{review.authorName}</strong>
          <time dateTime={review.createdAt} className="text-sm text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString("vi-VN")}
          </time>
        </div>
        <StarRow rating={review.rating} />
        {review.comment && (
          <p className="mt-2 text-[length:var(--fs-body)] leading-relaxed text-[var(--bb-text-primary)]">
            {review.comment}
          </p>
        )}
      </div>
    </li>
  );
}

function ReviewsLoading() {
  return (
    <ul className="m-0 list-none p-0" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-4 border-b border-border py-5 first:pt-0">
          <span className="h-10 w-10 shrink-0 animate-pulse bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-32 animate-pulse bg-muted" />
            <div className="h-3 w-24 animate-pulse bg-muted" />
            <div className="h-3 w-full animate-pulse bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function WriteReviewForm({ productId, onSuccess }: { productId: string; onSuccess: () => void }) {
  const t = useTranslations("Product.reviews");
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError(t("errorPickStars"));
      return;
    }
    if (!authorName.trim()) {
      setError(t("errorPickName"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          rating,
          comment: comment.trim(),
          website,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (res.status === 429) {
          setError(t("errorRateLimit"));
        } else if (res.status === 409) {
          setError(json?.error ?? t("errorDuplicate"));
        } else {
          setError(json?.error ?? t("errorSubmit"));
        }
        return;
      }
      setDone(true);
      onSuccess();
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-border p-6">
      <h3 className="m-0 mb-5 font-body text-lg font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">
        {t("formTitle")}
      </h3>

      {done ? (
        <p className="m-0 border border-border bg-muted px-4 py-3 text-sm text-[var(--bb-text-primary)]">
          {t("thanks")}
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {/* Honeypot — bots fill this, humans never see it. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0 [pointer-events:none]"
          />

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-semibold text-[var(--bb-text-primary)]">
              {t("formStars")} <span className="text-brand">*</span>
            </Label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-author"
              className="text-sm font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formName")} <span className="text-brand">*</span>
            </Label>
            <Input
              id="review-author"
              name="author"
              type="text"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder={t("formNamePlaceholder")}
              maxLength={80}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-email"
              className="text-sm font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formEmail")}
            </Label>
            <Input
              id="review-email"
              name="email"
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-comment"
              className="text-sm font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formComment")}
            </Label>
            <Textarea
              id="review-comment"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("formCommentPlaceholder")}
              maxLength={1000}
              rows={5}
            />
          </div>

          {error && <p className="m-0 text-sm text-brand">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return fallback;
}

async function fetchReviewsPage(
  productId: string,
  page: number,
  rating: number | null,
  sort: SortKey,
  errorFallback: string,
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    sort,
  });
  if (rating) params.set("rating", String(rating));
  const res = await fetch(`/api/products/${productId}/reviews/?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as ReviewsData | { error?: string } | null;

  if (!res.ok) {
    throw new Error(getErrorMessage(payload, errorFallback));
  }

  return payload as ReviewsData;
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const t = useTranslations("Product.reviews");
  const queryClient = useQueryClient();
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

  const resetToFirstPage = () => {
    setPage(1);
    // Refetch every cached page of this product (any filter/sort) so a freshly
    // approved review shows up wherever the customer browses next.
    void queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
  };

  return (
    <section
      ref={sectionRef}
      id="reviews"
      className="mx-auto mt-16 mb-10 max-w-[1140px] scroll-mt-[var(--bb-header-height)] border-t border-border px-[15px] pt-14 max-md:mt-9 max-md:px-[var(--bb-mobile-page-x)] max-md:pt-10 min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px]"
    >
      <div className="mb-10 text-center max-md:mb-8">
        <h2 className="m-0 font-body text-ui-35 font-semibold uppercase leading-[4.286rem] tracking-[0] text-black max-md:text-2xl max-md:leading-[1.25]">
          {total > 0 ? t("titleWithCount", { count: total }) : t("title")}
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex gap-10 max-md:flex-col max-md:gap-8 max-[1024px]:gap-8">
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <ReviewsLoading />
          ) : isError ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16 text-center">
              <StarIcon filled={false} className="h-10 w-10 text-[var(--bb-text-secondary)]" />
              <p className="m-0 font-semibold text-[var(--bb-text-primary)]">{t("errorLoad")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t("retry")}
              </Button>
            </div>
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
                  {ratingFilter !== null && (
                    <>
                      <span className="text-sm text-muted-foreground">
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
                  <span className="shrink-0 text-sm text-muted-foreground">{t("sortLabel")}</span>
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
                <div className="mt-4 flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16 text-center">
                  <StarIcon filled={false} className="h-10 w-10 text-[var(--bb-text-secondary)]" />
                  <p className="m-0 font-semibold text-[var(--bb-text-primary)]">
                    {ratingFilter !== null ? t("noReviewsForFilter", { count: ratingFilter }) : t("noReviews")}
                  </p>
                </div>
              )}

              <PaginationNav page={page} totalPages={totalPages} onPageChange={goToPage} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16 text-center">
              <StarIcon filled={false} className="h-10 w-10 text-[var(--bb-text-secondary)]" />
              <p className="m-0 font-semibold text-[var(--bb-text-primary)]">{t("noReviews")}</p>
              <p className="m-0 text-sm text-muted-foreground">{t("beFirst")}</p>
            </div>
          )}
        </div>

        <div className="w-[340px] shrink-0 self-start max-md:w-full md:sticky md:top-[calc(var(--bb-header-height)_+_1.5rem)] max-[1024px]:w-[300px]">
          <WriteReviewForm productId={productId} onSuccess={resetToFirstPage} />
        </div>
      </div>
    </section>
  );
}
