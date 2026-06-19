"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { LHtml } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { VideoAsset } from "@/lib/contracts/public";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Các mảnh nội dung sản phẩm dịch được trong tab PDP — đọc bản EN từ
 * `LocalizedContentProvider` (kind="product") nếu có, fallback về props `vi` render
 * sẵn ở server. Tách riêng để page.tsx (server) giữ nguyên kiến trúc ISR/SEO.
 */

type Spec = { name?: string | null; value?: string | null };
type Faq = { question?: string | null; answer?: string | null };

/** Tab "Thông số kĩ thuật" — bảng spec, đổi theo ngôn ngữ. */
export function ProductSpecsTable({ viSpecs }: { viSpecs: Spec[] }) {
  const t = useTranslations("Product");
  const enSpecs = useLocalizedField<Spec[]>("specifications");
  const specs = Array.isArray(enSpecs) && enSpecs.length > 0 ? enSpecs : viSpecs;

  if (specs.length === 0) {
    return (
      <div className="thong-so-ki-thuat">
        <p>{t("specsEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="thong-so-ki-thuat overflow-x-auto">
      <table className="shop_attributes w-full border-collapse text-body">
        <tbody>
          {specs.map((s, i) => (
            <tr key={i} className="border-b border-border last:border-b-0 even:bg-muted/30">
              <th
                scope="row"
                className="w-[38%] px-3.5 py-3.5 text-left align-top font-barlow font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {s.name}
              </th>
              <td className="px-3.5 py-3.5 align-top text-foreground">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tab "Câu hỏi thường gặp" — accordion FAQ, đổi theo ngôn ngữ. */
export function ProductFaqs({ viFaqs }: { viFaqs: Faq[] }) {
  const t = useTranslations("Product");
  const enFaqs = useLocalizedField<Faq[]>("faqs");
  const faqs = Array.isArray(enFaqs) && enFaqs.length > 0 ? enFaqs : viFaqs;

  if (faqs.length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("faqsEmpty")}</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full border-t border-border">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="gap-3 normal-case hover:text-brand data-[state=open]:text-brand">
            <span className="flex min-w-0 flex-1 items-baseline gap-3">
              <span
                className="shrink-0 font-cta text-ui-18 font-bold leading-none tabular-nums text-brand"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-18 font-semibold leading-snug">{faq.question}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div
              className="wyswyg pl-9 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(faq.answer ?? "") }}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Tab "Mô tả" — HTML mô tả sản phẩm, đổi theo ngôn ngữ. */
export function ProductDescriptionTab({ viHtml }: { viHtml: string }) {
  const t = useTranslations("Product");
  const enHtml = useLocalizedField<unknown>("description");
  const hasEn = typeof enHtml === "string" && enHtml.trim().length > 0;
  if (!hasEn && viHtml.trim().length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("descriptionEmpty")}</p>
      </div>
    );
  }
  return <LHtml field="description" viHtml={viHtml} className="wyswyg" />;
}


/** Nội dung dài SEO cuối trang (contentBottom) — rich HTML, đổi theo ngôn ngữ.
 *  Fallback về bản VI render sẵn ở server khi payload EN không có field này. */
export function ProductContentBottom({ viHtml }: { viHtml: string }) {
  return <LHtml field="contentBottom" viHtml={viHtml} className="wyswyg" />;
}

// Ưu/Nhược điểm + Phù hợp với ai (V246): chuyển thành KHỐI trong mô tả — render bởi
// ProsConsBlockView / SuitabilityBlockView trong ProductDescriptionBlocks. Component cũ đã gỡ.

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Một ô video — embed YouTube hoặc HTML5 video + tiêu đề + mô tả. Dùng chung cho lưới lẫn carousel. */
function VideoCard({ video }: { video: VideoAsset }) {
  const ytId = getYouTubeId(video.url ?? "");
  const rawUrl = resolveMediaUrl(video.url?.trim()) ?? video.url ?? "";
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video bg-black overflow-hidden">
        {ytId ? (
          <iframe
            className="absolute inset-0 h-full w-full border-none"
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title={video.title ?? "Video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            className="absolute inset-0 h-full w-full object-contain"
            controls
            preload="metadata"
            src={rawUrl ? `${rawUrl}#t=0.001` : undefined}
          />
        )}
      </div>
      {video.title && (
        <h3 className="font-heading text-h3 font-bold uppercase tracking-wide text-foreground">
          {video.title}
        </h3>
      )}
      {video.description && (
        <p className="text-body leading-relaxed text-muted-foreground">{video.description}</p>
      )}
    </div>
  );
}

// Ngưỡng chuyển sang carousel: từ 3 video trở lên (1–2 video giữ lưới cho khách thấy hết ngay).
const VIDEO_CAROUSEL_THRESHOLD = 3;

const VIDEO_ARROW_BTN =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground transition-opacity hover:opacity-60 pointer-coarse:hidden max-md:hidden [&>svg]:h-9 [&>svg]:w-9";

/** Carousel video (≥3) — lướt ngang 1 (mobile) / 2 (desktop) ô; mũi tên + chấm phân trang chuẩn design-system. */
function VideosCarousel({ videos }: { videos: VideoAsset[] }) {
  const t = useTranslations("Common");
  const swiperRef = useRef<SwiperType | null>(null);
  const paginationId = `bb-vid-pag-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div className="relative">
      {!isLocked && (
        <button
          type="button"
          className={cn(VIDEO_ARROW_BTN, "-left-3 min-[1440px]:-left-12")}
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label={t("scrollPrev")}
        >
          <ChevronLeft strokeWidth={1.5} />
        </button>
      )}

      <div className="w-full overflow-hidden">
        <Swiper
          // FOUC guard trước khi Swiper init: khoá bề rộng slide theo breakpoint (1 → md:2 → xl:3).
          className="md:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/2 min-[1280px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/3"
          modules={[Pagination]}
          onSwiper={(s) => {
            swiperRef.current = s;
            setIsLocked(s.isLocked);
          }}
          onBreakpoint={(s) => setIsLocked(s.isLocked)}
          speed={600}
          // Hiện NHIỀU video cùng lúc trên desktop (mobile 1 → md 2 → xl 3); mỗi lần lướt dịch 1 video
          // (slidesPerGroup=1) theo đúng ý "qua lại 1 video".
          slidesPerView={1}
          slidesPerGroup={1}
          spaceBetween={24}
          watchOverflow
          pagination={{ el: `#${paginationId}`, clickable: true }}
          breakpoints={{
            768: { slidesPerView: 2, slidesPerGroup: 1, spaceBetween: 28 },
            1280: { slidesPerView: 3, slidesPerGroup: 1, spaceBetween: 32 },
          }}
        >
          {videos.map((video, i) => (
            <SwiperSlide key={i} className="h-auto">
              <VideoCard video={video} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {!isLocked && (
        <button
          type="button"
          className={cn(VIDEO_ARROW_BTN, "-right-3 min-[1440px]:-right-12")}
          onClick={() => swiperRef.current?.slideNext()}
          aria-label={t("scrollNext")}
        >
          <ChevronRight strokeWidth={1.5} />
        </button>
      )}

      {!isLocked && (
        <div
          id={paginationId}
          className="flex justify-center mt-[30px] [&_.swiper-pagination-bullet]:my-0 [&_.swiper-pagination-bullet]:mx-[5px] [&_.swiper-pagination-bullet]:h-[10px] [&_.swiper-pagination-bullet]:w-[10px] [&_.swiper-pagination-bullet]:!rounded-full [&_.swiper-pagination-bullet]:bg-border-default [&_.swiper-pagination-bullet]:opacity-100 [&_.swiper-pagination-bullet]:[transition:all_0.3s_ease] [&_.swiper-pagination-bullet-active]:!w-[20px] [&_.swiper-pagination-bullet-active]:!rounded-[20px] [&_.swiper-pagination-bullet-active]:!bg-brand"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Khối "Video sản phẩm" — tự thích ứng theo số lượng: ≤2 video xếp lưới 1→2 cột (khách thấy hết ngay);
 * ≥3 video chuyển sang carousel lướt ngang (gọn chiều cao, đồng bộ carousel "sản phẩm tương tự").
 */
export function ProductVideosSection({ videos }: { videos: VideoAsset[] }) {
  const t = useTranslations("Product");

  if (videos.length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("videosEmpty")}</p>
      </div>
    );
  }

  if (videos.length >= VIDEO_CAROUSEL_THRESHOLD) {
    return <VideosCarousel videos={videos} />;
  }

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {videos.map((video, i) => (
        <VideoCard key={i} video={video} />
      ))}
    </div>
  );
}
