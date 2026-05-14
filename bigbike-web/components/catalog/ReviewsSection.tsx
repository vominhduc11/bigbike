"use client";

import { useState } from "react";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
          className="text-brand"
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
    <div className="bb-review-star-picker" role="radiogroup" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao`}
          className={`bb-review-star-btn${display >= n ? " active" : ""}`}
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
      <div className="bb-review-done">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        Cảm ơn bạn đã đánh giá! Đánh giá đang chờ kiểm duyệt.
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" className="bb-review-open-btn" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Viết đánh giá
      </Button>
    );
  }

  return (
    <form className="bb-review-form" onSubmit={handleSubmit} noValidate>
      <h4 className="bb-review-form-title">Đánh giá của bạn</h4>
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

      <div className="bb-review-form-field">
        <label>Số sao <span className="req">*</span></label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="bb-review-form-field">
        <label htmlFor="review-name">Tên của bạn <span className="req">*</span></label>
        <Input
          id="review-name"
          placeholder="Nguyễn Văn A"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={80}
          required
        />
      </div>

      <div className="bb-review-form-field">
        <label htmlFor="review-comment">Nhận xét</label>
        <Textarea
          id="review-comment"
          placeholder="Sản phẩm tốt, đúng size, giao hàng nhanh..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="bb-review-form-actions">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
          Huỷ
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Đang gửi..." : "Gửi đánh giá"}
        </Button>
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

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const queryKey = ["product-reviews", productId] as const;

  const {
    data,
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
  // Only use verified API average — never fall back to the denormalized product.rating
  // which can be a seeded/default value with no actual reviews behind it.
  const total = firstPage?.totalReviews ?? 0;
  const rating = total > 0 ? (firstPage?.avgRating ?? 0) : 0;

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

  return (
    <section className="bb-pdp-reviews">
      <div className="bb-pdp-reviews-header">
        <h2>Đánh giá sản phẩm</h2>
        {rating > 0 && (
          <div className="bb-pdp-rating-summary">
            <span className="bb-pdp-rating-score">{rating.toFixed(1)}</span>
            <StarRow rating={rating} size={20} />
            {total > 0 && (
              <span className="bb-pdp-rating-count">({total} đánh giá)</span>
            )}
          </div>
        )}
      </div>

      <WriteReviewForm
        productId={productId}
        onSuccess={resetToFirstPage}
      />

      {!!reviews.length && (
        <ul className="bb-pdp-review-list">
          {reviews.map((review) => (
            <li key={review.id} className="bb-pdp-review-item">
              <div className="bb-pdp-review-meta">
                <span className="bb-pdp-review-author">{review.authorName}</span>
                <StarRow rating={review.rating} size={14} />
                <time
                  className="bb-pdp-review-date"
                  dateTime={review.createdAt}
                >
                  {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </time>
              </div>
              {review.comment && (
                <p className="bb-pdp-review-comment">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="bb-review-pagination">
          <Button
            type="button"
            variant="secondary"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Đang tải thêm..." : "Xem thêm đánh giá"}
          </Button>
          {isFetchNextPageError && (
            <p className="text-sm text-destructive">Không thể tải thêm đánh giá.</p>
          )}
        </div>
      )}
    </section>
  );
}
