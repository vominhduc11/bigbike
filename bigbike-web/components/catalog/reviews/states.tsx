import { StarIcon } from "./stars";

export function ReviewsLoading() {
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

// Trạng thái rỗng dùng chung (chưa có đánh giá / lọc không ra / lỗi tải): viền liền + nền card, huy
// hiệu sao tô màu thương hiệu. Padding dọc vừa phải (không kéo cao gây "trống trải") — form viết đánh
// giá đã chuyển sang modal nên khối này đứng một cột, không cần cao bằng form như trước.
export function ReviewsPlaceholder({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-border bg-card px-6 py-10 text-center max-md:py-8">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center bg-[var(--bb-brand-primary-soft)] text-rating-star"
      >
        <StarIcon filled className="h-7 w-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 font-body text-a3-section font-semibold text-[var(--bb-text-primary)]">
          {title}
        </p>
        {description && <p className="m-0 text-a4-content text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
