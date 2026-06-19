"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { LocalDate } from "@/components/i18n/LocalDate";
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { openWriteReviewDialog } from "@/components/catalog/writeReviewBus";

type SortKey = "newest" | "highest" | "lowest";

type Review = {
  id: number | string;
  authorName: string;
  rating: number;
  title?: string;
  comment?: string;
  photos?: string[];
  createdAt: string;
};

// Customer review photos: max 10, ≤8MB each, images only — must mirror the backend caps.
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  // embedded = đang nằm trong panel tab sản phẩm: bỏ khung section riêng (viền
  // trên, lề lớn, id #reviews, tiêu đề lặp) vì thanh tab / H2 panel đã là tiêu đề.
  embedded?: boolean;
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
        <span className="font-body text-h4 font-semibold text-[var(--bb-text-primary)]">
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
          <span className="font-cta text-display font-semibold leading-none text-[var(--bb-text-primary)]">
            {avg.toFixed(1)}
          </span>
          <span className="text-caption text-muted-foreground">/5</span>
        </div>
        <StarRow rating={avg} iconClassName="h-5 w-5" />
        <span className="text-caption text-muted-foreground">{t("ratingCount", { count: total })}</span>
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
              <span className="flex w-9 shrink-0 items-center gap-1 text-caption text-[var(--bb-text-secondary)]">
                {star}
                <StarIcon filled className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="h-2 flex-1 overflow-hidden bg-background">
                <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right text-caption text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Nội dung bình luận: chống tràn ngang (break-words cho chuỗi dài không khoảng
// trắng như link dán) + cắt còn 5 dòng kèm nút Xem thêm/Thu gọn để một review dài
// (tối đa 1000 ký tự) không đẩy các review khác xuống quá xa. Nút chỉ hiện khi nội
// dung thực sự bị cắt — đo scrollHeight vs clientHeight lúc đang thu gọn.
function ReviewComment({ text }: { text: string }) {
  const t = useTranslations("Product.reviews");
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="mt-2">
      <p
        ref={ref}
        className={cn(
          "text-[length:var(--bb-text-base)] leading-relaxed text-[var(--bb-text-primary)] [overflow-wrap:anywhere]",
          !expanded && "line-clamp-5",
        )}
      >
        {text}
      </p>
      {clamped && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 text-caption font-semibold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}

// Lưới ảnh thực tế của khách: thumbnail vuông, bấm để phóng to trong dialog
// (REVIEW_RULE_005). Ảnh đã được duyệt cùng review nên chỉ render khi review hiển thị.
function ReviewPhotos({ photos, authorName }: { photos: string[]; authorName: string }) {
  const t = useTranslations("Product.reviews");
  const [active, setActive] = useState<number | null>(null);
  const open = active !== null;
  const altFor = (i: number) => t("photoAlt", { name: authorName, index: i + 1 });

  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2 p-0 m-0 list-none" aria-label={t("photosLabel")}>
        {photos.map((url, i) => (
          <li key={`${url}-${i}`}>
            <button
              type="button"
              onClick={() => setActive(i)}
              className="block h-16 w-16 overflow-hidden border border-border bg-muted outline-none transition-opacity duration-[var(--bb-duration-fast)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={altFor(i)} loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={(next) => !next && setActive(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{t("photosLabel")}</DialogTitle>
          {open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[active]}
              alt={altFor(active)}
              className="mx-auto max-h-[80vh] w-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.authorName.trim().charAt(0).toUpperCase() || "?";
  const photos = review.photos ?? [];
  return (
    <li className="flex gap-4 border-b border-border py-5 first:pt-0">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted font-body text-ui-18 font-semibold text-[var(--bb-text-primary)]"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <strong className="min-w-0 text-18 font-semibold text-[var(--bb-text-primary)] [overflow-wrap:anywhere]">
            {review.authorName}
          </strong>
          <time dateTime={review.createdAt} className="shrink-0 text-caption text-muted-foreground">
            <LocalDate value={review.createdAt} dateStyle="slashPad" />
          </time>
        </div>
        <StarRow rating={review.rating} />
        {review.title && (
          <p className="mt-1.5 mb-0 text-18 font-semibold text-[var(--bb-text-primary)] [overflow-wrap:anywhere]">
            {review.title}
          </p>
        )}
        {review.comment && <ReviewComment text={review.comment} />}
        {photos.length > 0 && <ReviewPhotos photos={photos} authorName={review.authorName} />}
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

// Trạng thái rỗng dùng chung (chưa có đánh giá / lọc không ra / lỗi tải). Cùng
// ngôn ngữ thị giác với form bên phải: viền liền + nền card, thay cho viền nét
// đứt cũ trông như placeholder. Huy hiệu sao tô theo màu thương hiệu để khối
// đánh giá không bị "trống trải" khi sản phẩm chưa có review. fillHeight cho ô
// chính cao bằng form để hai cột cân nhau.
function ReviewsPlaceholder({
  title,
  description,
  action,
  fillHeight = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  fillHeight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 border border-border bg-card px-6 py-16 text-center",
        fillHeight && "h-full",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center bg-[var(--bb-brand-primary-soft)] text-brand"
      >
        <StarIcon filled className="h-8 w-8" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 font-cta text-20 font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">
          {title}
        </p>
        {description && <p className="m-0 text-18 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type PhotoItem = {
  id: string;
  previewUrl: string;
  url?: string;
  status: "uploading" | "done" | "error";
};

export function WriteReviewForm({
  productId,
  onSuccess,
  variant = "card",
}: {
  productId: string;
  onSuccess: () => void;
  // "card" = khung viền + tiêu đề riêng (cũ, dùng inline). "dialog" = bỏ khung +
  // tiêu đề vì DialogTitle của modal đã là tiêu đề. Hiện chỉ modal dùng form này.
  variant?: "card" | "dialog";
}) {
  const t = useTranslations("Product.reviews");
  const isDialog = variant === "dialog";
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = photos.some((p) => p.status === "uploading");

  async function uploadOne(file: File) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { id, previewUrl, status: "uploading" }]);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/products/${productId}/reviews/photos/`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
        setPhotoError(json?.error ?? t("errorPhotoUpload"));
        return;
      }
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "done", url: json.url } : p)));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
      setPhotoError(t("errorPhotoUpload"));
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPhotoError("");
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(t("errorPhotoCount", { count: MAX_PHOTOS }));
      return;
    }
    const picked = Array.from(fileList);
    if (picked.length > remaining) {
      setPhotoError(t("errorPhotoCount", { count: MAX_PHOTOS }));
    }
    for (const file of picked.slice(0, remaining)) {
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError(t("errorPhotoType"));
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(t("errorPhotoSize"));
        continue;
      }
      void uploadOne(file);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

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
      const photoUrls = photos
        .filter((p) => p.status === "done" && p.url)
        .map((p) => p.url as string);
      const res = await fetch(`/api/products/${productId}/reviews/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          rating,
          title: title.trim(),
          comment: comment.trim(),
          photos: photoUrls,
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
    <div className={cn(isDialog ? "p-5" : "border border-border p-6")}>
      {!isDialog && (
        <h3 className="m-0 mb-5 font-body text-h4 font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">
          {t("formTitle")}
        </h3>
      )}

      {done ? (
        <p className="m-0 border border-border bg-muted px-4 py-3 text-caption text-[var(--bb-text-primary)]">
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
            <Label className="text-caption font-semibold text-[var(--bb-text-primary)]">
              {t("formStars")} <span className="text-brand">*</span>
            </Label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-author"
              className="text-caption font-semibold text-[var(--bb-text-primary)]"
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
              className="text-caption font-semibold text-[var(--bb-text-primary)]"
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
              htmlFor="review-title"
              className="text-caption font-semibold text-[var(--bb-text-primary)]"
            >
              {t("formTitleField")}
            </Label>
            <Input
              id="review-title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("formTitlePlaceholder")}
              maxLength={160}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="review-comment"
              className="text-caption font-semibold text-[var(--bb-text-primary)]"
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-caption font-semibold text-[var(--bb-text-primary)]">
              {t("formPhotos")}
            </Label>
            <p className="m-0 text-caption text-muted-foreground">{t("formPhotosHint")}</p>

            {photos.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-2 p-0 m-0 list-none">
                {photos.map((photo) => (
                  <li key={photo.id} className="relative h-16 w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url ?? photo.previewUrl}
                      alt=""
                      className={cn(
                        "h-full w-full border border-border object-cover",
                        photo.status !== "done" && "opacity-50",
                      )}
                    />
                    {photo.status === "uploading" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/50 text-caption text-muted-foreground">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label={t("removePhoto")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-[var(--bb-text-primary)] text-ui-11 leading-none text-white outline-none focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {photos.length < MAX_PHOTOS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("addPhoto")}
              </Button>
            )}
            {photoError && <p className="m-0 text-caption text-brand">{photoError}</p>}
          </div>

          {error && <p className="m-0 text-caption text-brand">{error}</p>}

          <Button type="submit" disabled={submitting || uploading} className="w-full">
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
        !embedded && "mt-16 mb-10 border-t border-border pt-14 max-md:mt-9 max-md:pt-10",
      )}
    >
      {!embedded && (
        <div className="mb-10 text-center max-md:mb-8">
          <h2 className="m-0 font-body text-ui-35 font-semibold uppercase leading-[4.286rem] tracking-[0] text-black max-md:text-ui-24 max-md:leading-[1.25]">
            {total > 0 ? t("titleWithCount", { count: total }) : t("title")}
          </h2>
          <p className="m-0 mt-1 text-18 text-muted-foreground">{t("subtitle")}</p>
        </div>
      )}

      {/* Khối đánh giá CHỈ để XEM — form viết đánh giá đã chuyển sang modal
          (WriteReviewDialog). Các nút "Viết đánh giá" dưới đây chỉ mở modal đó. */}
      <div className="min-w-0">
        {isLoading ? (
            <ReviewsLoading />
          ) : isError ? (
            <ReviewsPlaceholder
              fillHeight
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
              fillHeight
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
