"use client";

import { useState } from "react";
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
  initialRating: number | null;
};

const PAGE_SIZE = 10;

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating.toFixed(1)} sao`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill={i < rounded ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          style={{ color: "var(--bb-brand-primary)" }}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  return (
    <div className="wp-review-star-picker" role="radiogroup" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao`}
          className={`wp-review-star-btn${display >= n ? " active" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={display >= n ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function WriteReviewForm({ productId, onSuccess }: { productId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Vui lòng chọn số sao."); return; }
    if (!authorName.trim()) { setError("Vui lòng nhập tên."); return; }
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
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 429) {
          setError("Bạn gửi đánh giá quá nhanh. Vui lòng thử lại sau.");
        } else if (res.status === 409) {
          setError(json.error ?? "Đánh giá tương tự vừa được gửi. Vui lòng thử lại sau.");
        } else {
          setError(json.error ?? "Không thể gửi đánh giá.");
        }
        return;
      }
      setDone(true);
      onSuccess();
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="wp-review-done">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        Cảm ơn bạn đã đánh giá! Đánh giá đang chờ kiểm duyệt.
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="wp-review-open-btn" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Viết đánh giá
      </button>
    );
  }

  return (
    <form className="wp-review-form" onSubmit={handleSubmit} noValidate>
      <h4 className="wp-review-form-title">Đánh giá của bạn</h4>
      {/* Honeypot — ẩn khỏi user, bot auto-fill sẽ bị block */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />

      <div className="wp-review-form-field">
        <label>Số sao <span className="req">*</span></label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="wp-review-form-field">
        <label htmlFor="review-name">Tên của bạn <span className="req">*</span></label>
        <input
          id="review-name"
          className="wp-input"
          placeholder="Nguyễn Văn A"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={80}
          required
        />
      </div>

      <div className="wp-review-form-field">
        <label htmlFor="review-comment">Nhận xét</label>
        <textarea
          id="review-comment"
          className="wp-input wp-textarea-resize"
          placeholder="Sản phẩm tốt, đúng size, giao hàng nhanh..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
        />
      </div>

      {error && <p className="wp-field-error">{error}</p>}

      <div className="wp-review-form-actions">
        <button type="button" className="wp-btn-secondary" onClick={() => setOpen(false)} disabled={submitting}>
          Huỷ
        </button>
        <button type="submit" className="wp-btn-primary" disabled={submitting}>
          {submitting ? "Đang gửi..." : "Gửi đánh giá"}
        </button>
      </div>
    </form>
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

async function fetchReviewsPage(productId: string, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
  });
  const res = await fetch(`/api/products/${productId}/reviews/?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as ReviewsData | { error?: string } | null;

  if (!res.ok) {
    throw new Error(getErrorMessage(payload, "Không thể tải đánh giá."));
  }

  return payload as ReviewsData;
}

export function ReviewsSection({ productId, initialRating }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const queryKey = ["product-reviews", productId] as const;

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchReviewsPage(productId, pageParam),
    getNextPageParam: (lastPage) => (
      lastPage.pagination.hasNext
        ? lastPage.pagination.page + 1
        : undefined
    ),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const firstPage = data?.pages[0];
  const reviews = data?.pages.flatMap((page) => page.reviews) ?? [];
  const rating = firstPage?.avgRating || initialRating || 0;
  const total = firstPage?.totalReviews ?? 0;

  const resetToFirstPage = () => {
    queryClient.setQueryData<InfiniteData<ReviewsData>>(queryKey, (current) => {
      if (!current) {
        return current;
      }

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

  if (isLoading && !initialRating) return null;
  if (!firstPage && !initialRating) return null;

  return (
    <section className="wp-pdp-reviews">
      <div className="wp-pdp-reviews-header">
        <h2>Đánh giá sản phẩm</h2>
        {rating > 0 && (
          <div className="wp-pdp-rating-summary">
            <span className="wp-pdp-rating-score">{rating.toFixed(1)}</span>
            <StarRow rating={rating} size={20} />
            {total > 0 && (
              <span className="wp-pdp-rating-count">({total} đánh giá)</span>
            )}
          </div>
        )}
      </div>

      <WriteReviewForm
        productId={productId}
        onSuccess={resetToFirstPage}
      />

      {!!reviews.length && (
        <ul className="wp-pdp-review-list">
          {reviews.map((review) => (
            <li key={review.id} className="wp-pdp-review-item">
              <div className="wp-pdp-review-meta">
                <span className="wp-pdp-review-author">{review.authorName}</span>
                <StarRow rating={review.rating} size={14} />
                <time
                  className="wp-pdp-review-date"
                  dateTime={review.createdAt}
                >
                  {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </time>
              </div>
              {review.comment && (
                <p className="wp-pdp-review-comment">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {firstPage && !reviews.length && rating > 0 && (
        <p className="wp-pdp-reviews-empty">Chưa có đánh giá chi tiết.</p>
      )}

      {hasNextPage && (
        <div className="wp-review-pagination">
          <button
            type="button"
            className="wp-btn-secondary"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Đang tải thêm..." : "Xem thêm đánh giá"}
          </button>
          {isFetchNextPageError && (
            <p className="wp-field-error">Không thể tải thêm đánh giá.</p>
          )}
        </div>
      )}
    </section>
  );
}
