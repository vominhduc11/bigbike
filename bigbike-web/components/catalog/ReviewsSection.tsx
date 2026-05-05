"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Review = {
  id: string;
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
        body: JSON.stringify({ authorName: authorName.trim(), rating, comment: comment.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setError(json.error ?? "Không thể gửi đánh giá."); return; }
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

export function ReviewsSection(props: ReviewsSectionProps) {
  return <ReviewsSectionContent key={props.productId} {...props} />;
}

function ReviewsSectionContent({ productId, initialRating }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<ReviewsData>({
    queryKey: ["product-reviews", productId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        size: "10",
      });
      const res = await fetch(`/api/products/${productId}/reviews/?${params.toString()}`);
      if (!res.ok) throw new Error("Không tải được đánh giá");
      return res.json() as Promise<ReviewsData>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading && !initialRating) return null;
  if (!data && !initialRating) return null;

  const rating = data?.avgRating || initialRating || 0;
  const total = data?.totalReviews ?? 0;

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
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
        }}
      />

      {data && data.reviews.length > 0 && (
        <ul className="wp-pdp-review-list">
          {data.reviews.map((review) => (
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

      {data && !data.reviews.length && rating > 0 && (
        <p className="wp-pdp-reviews-empty">Chưa có đánh giá chi tiết.</p>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="wp-review-pagination">
          <button
            type="button"
            className="wp-btn-secondary"
            disabled={!data.pagination.hasPrevious}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trang trước
          </button>
          <span className="wp-review-pagination-label">
            Trang {data.pagination.page}/{data.pagination.totalPages}
          </span>
          <button
            type="button"
            className="wp-btn-secondary"
            disabled={!data.pagination.hasNext}
            onClick={() => setPage((current) => current + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </section>
  );
}
