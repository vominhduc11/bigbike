"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";

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

function StarRow({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating.toFixed(1)} sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill={i < rounded ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
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

  if (done) {
    return <p className="woocommerce-message">{t("thanks")}</p>;
  }

  return (
    <div id="review_form_wrapper">
      <div id="review_form" className="comment-respond">
        <span id="reply-title" className="comment-reply-title">
          {t("formTitle")}
        </span>
        <form className="comment-form" onSubmit={handleSubmit} noValidate>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          />

          <p className="comment-form-rating">
            <label htmlFor="rating">
              {t("formStars")} <span className="required">*</span>
            </label>
            <select
              id="rating"
              name="rating"
              required
              value={rating}
              onChange={(event) => setRating(Number.parseInt(event.target.value, 10))}
            >
              <option value={0}>Đánh giá...</option>
              <option value={5}>Rất tốt</option>
              <option value={4}>Tốt</option>
              <option value={3}>Trung bình</option>
              <option value={2}>Không tệ</option>
              <option value={1}>Rất kém</option>
            </select>
          </p>

          <p className="comment-form-author">
            <label htmlFor="author">
              {t("formName")} <span className="required">*</span>
            </label>
            <input
              id="author"
              name="author"
              type="text"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              maxLength={80}
              required
            />
          </p>

          <p className="comment-form-email">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
            />
          </p>

          <p className="comment-form-comment">
            <label htmlFor="comment">{t("formComment")}</label>
            <textarea
              id="comment"
              name="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={5}
            />
          </p>

          {error && <p className="woocommerce-error">{error}</p>}

          <p className="form-submit">
            <button type="submit" className="submit" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </button>
          </p>
        </form>
      </div>
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

async function fetchReviewsPage(productId: string, page: number, errorFallback: string) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
  });
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
  const queryKey = ["product-reviews", productId] as const;

  const { data } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchReviewsPage(productId, pageParam, t("errorLoad")),
    getNextPageParam: (lastPage) => (
      lastPage.pagination.hasNext
        ? lastPage.pagination.page + 1
        : undefined
    ),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const reviews = data?.pages.flatMap((page) => page.reviews) ?? [];
  const total = data?.pages[0]?.totalReviews ?? 0;

  const resetToFirstPage = () => {
    queryClient.setQueryData<InfiniteData<ReviewsData>>(queryKey, (current) => {
      if (!current) return current;
      return {
        pages: current.pages.slice(0, 1),
        pageParams: current.pageParams.slice(0, 1),
      };
    });

    void queryClient.invalidateQueries({
      queryKey,
      exact: true,
      refetchType: "active",
    });
  };

  return (
    <div id="reviews" className="woocommerce-Reviews">
      <div id="comments">
        <h2 className="woocommerce-Reviews-title">
          {total > 0 ? `Reviews (${total})` : "Reviews"}
        </h2>

        {reviews.length > 0 ? (
          <ol className="commentlist">
            {reviews.map((review) => (
              <li key={review.id} className="review">
                <div className="comment_container">
                  <div className="comment-text">
                    <p className="meta">
                      <strong className="woocommerce-review__author">{review.authorName}</strong>
                      <time
                        className="woocommerce-review__published-date"
                        dateTime={review.createdAt}
                      >
                        {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                      </time>
                    </p>
                    <StarRow rating={review.rating} />
                    {review.comment && (
                      <div className="description">
                        <p>{review.comment}</p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="woocommerce-noreviews">There are no reviews yet.</p>
        )}
      </div>

      <WriteReviewForm productId={productId} onSuccess={resetToFirstPage} />
    </div>
  );
}
