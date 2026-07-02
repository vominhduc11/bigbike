"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LocalDate } from "@/components/i18n/LocalDate";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRow } from "./stars";
import type { Review } from "./types";

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
          "text-ui-18 max-md:text-ui-16 leading-relaxed text-[var(--bb-text-primary)] [overflow-wrap:anywhere]",
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
          className="mt-1 text-ui-14 max-md:text-ui-12 font-semibold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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

export function ReviewCard({ review }: { review: Review }) {
  const initial = review.authorName.trim().charAt(0).toUpperCase() || "?";
  const photos = review.photos ?? [];
  return (
    <li className="flex gap-4 border-b border-border py-5 first:pt-0">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted font-body text-ui-18 max-md:text-ui-16 font-semibold text-[var(--bb-text-primary)]"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <strong className="min-w-0 text-ui-20 max-md:text-ui-18 font-semibold text-[var(--bb-text-primary)] [overflow-wrap:anywhere]">
            {review.authorName}
          </strong>
          <time dateTime={review.createdAt} className="shrink-0 text-ui-14 max-md:text-ui-12 text-muted-foreground">
            <LocalDate value={review.createdAt} dateStyle="slashPad" />
          </time>
        </div>
        <StarRow rating={review.rating} />
        {review.comment && <ReviewComment text={review.comment} />}
        {photos.length > 0 && <ReviewPhotos photos={photos} authorName={review.authorName} />}
      </div>
    </li>
  );
}
