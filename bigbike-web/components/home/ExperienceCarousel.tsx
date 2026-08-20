"use client";

import { useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import type { Article } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { MediaImage } from "@/components/ui/MediaImage";

type Props = { articles: Article[] };

function normalizeLegacyUploadUrl(url: string | null | undefined): string | null {
  return resolveMediaUrl(url?.trim()) ?? null;
}

function expandForSwiperLoop(articles: Article[]): Article[] {
  if (articles.length <= 1) return articles;
  const expanded = [...articles];
  // Loop + centeredSlides needs enough real slides to clone without leaving
  // gaps at the fixed desktop baseline. Keep the existing ten-slide buffer.
  while (expanded.length < 10) expanded.push(...articles);
  return expanded;
}

function resolveArticleMedia(article: Article, fallbackTitle: string): {
  title: string;
  bgImage: Article["coverImage"] | null;
  bgAlt: string;
  productImage: Article["productImage"] | null;
  productAlt: string;
} {
  const title = safeText(article.title, fallbackTitle);

  return {
    title,
    bgImage: article.coverImage?.url
      ? { ...article.coverImage, url: resolveMediaUrl(article.coverImage.url.trim()) ?? undefined }
      : null,
    bgAlt: safeText(article.coverImage?.alt, title),
    productImage: article.productImage?.url
      ? { ...article.productImage, url: normalizeLegacyUploadUrl(article.productImage.url.trim()) ?? undefined }
      : null,
    productAlt: safeText(article.productImage?.alt, title),
  };
}

function ExperienceSlide({
  article,
  isActive,
}: {
  article: Article;
  isActive: boolean;
}) {
  const tCommon = useTranslations("Common");
  const tBlog = useTranslations("Blog");
  const media = resolveArticleMedia(article, tBlog("articleTitleFallback"));

  return (
    <div className="select-none">
      <div className="bb-exp-slide-cover overflow-hidden bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]">
        {media.bgImage ? (
          <MediaImage
            image={media.bgImage}
            altFallback={media.bgAlt}
            width={1200}
            height={600}
            sizes="(min-width: 768px) min(41vw, 590px), 83vw"
            className="block w-full max-h-94.5 max-[767px]:max-h-55 object-cover"
            loading={isActive ? "eager" : "lazy"}
          />
        ) : null}
      </div>

      <div
        className="bb-exp-slide-content mt-[-32%] max-[768px]:mt-[-18%] max-[375px]:mt-[-14%] md:pb-8"
        aria-hidden={!isActive}
      >
        {media.productImage ? (
          <div className="text-center">
            <MediaImage
              image={media.productImage}
              altFallback={media.productAlt}
              width={600}
              height={600}
              sizes="(min-width: 992px) 295px, (min-width: 768px) 52vw, 64vw"
              className="mx-auto w-1/2 max-w-105 max-[991px]:w-[64%] max-[767px]:w-[52vw] max-[767px]:max-w-57.5 max-[374px]:max-w-52.5"
              loading={isActive ? "eager" : "lazy"}
            />
          </div>
        ) : null}

        <div className="text-center max-[767px]:mt-3">
          <h3 className="m-0 font-body text-a2-page font-semibold leading-title text-black">
            {media.title}
          </h3>
          <div className="pt-10 text-center max-[767px]:pt-6">
            <LocalizedLink
              kind="article"
              viSlug={article.slug}
              enSlug={article.slugEn}
              className="bb-exp-slide-link inline-flex min-h-13 w-42.5 items-center justify-center border border-[var(--bb-border-default)] p-0 font-cta text-b4-action font-semibold leading-none uppercase text-black no-underline [transition:border-color_var(--bb-duration-fast)_var(--bb-ease-standard),color_var(--bb-duration-fast)_var(--bb-ease-standard)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:outline-offset-4 max-md:min-h-11 max-md:w-37.5"
              tabIndex={isActive ? 0 : -1}
            >
              {tCommon("viewDetails")}
            </LocalizedLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExperienceCarousel({ articles }: Props) {
  const tHome = useTranslations("Home");
  if (articles.length === 0) return null;

  const hasSideSlides = articles.length > 1;
  const carouselArticles = expandForSwiperLoop(articles);

  return (
    <Swiper
      // PRE-INIT GUARD (`:not(.swiper-initialized)`): tới khi Swiper init, mỗi slide
      // width:100% → 1 thẻ phình full khung rồi nhảy. Khoá bề rộng xấp xỉ slidesPerView
      // (mobile 83% / desktop tối đa 590px) để chặn cú phình. Desktop dùng slide
      // width cố định theo baseline 1440px nên surface có thể full-bleed mà card
      // không bị kéo giãn ở viewport 1920/2560.
      className="bb-exp-carousel w-full touch-pan-y !pb-8 max-md:!pb-4 [&_.swiper-slide]:h-auto [&_.swiper-slide]:cursor-pointer max-md:[&_.swiper-slide]:!w-[83%] md:[&_.swiper-slide]:!w-[min(41vw,590px)]"
      // Khu vực trải nghiệm tự chuyển mỗi 3 giây khi có nhiều hơn một bài viết.
      modules={hasSideSlides ? [Autoplay] : []}
      speed={1000}
      slidesPerView="auto"
      spaceBetween={13}
      centeredSlides
      loop={hasSideSlides}
      autoplay={hasSideSlides ? { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true } : undefined}
      initialSlide={hasSideSlides ? articles.length - 1 : 0}
      slideToClickedSlide={hasSideSlides}
      autoHeight
      watchOverflow
      breakpoints={{
        // 768 aligns with the CSS @media (min-width: 768px) / (max-width: 767px)
        // boundary used throughout globals.css. Using 767 caused a 1px window
        // where Swiper entered desktop mode (2.43 slides, autoHeight:false) but
        // the CSS still applied mobile overrides (margin-top:-18%, no
        // height:auto !important on wrapper), which could clip slide content.
        768: {
          slidesPerView: "auto",
          spaceBetween: 40,
          autoHeight: false,
        },
      }}
      aria-roledescription="carousel"
      aria-label={tHome("experienceAria")}
    >
      {carouselArticles.map((article, index) => (
        <SwiperSlide key={`${article.id}-${index}`}>
          {({ isActive }) => (
            <ExperienceSlide article={article} isActive={isActive} />
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
