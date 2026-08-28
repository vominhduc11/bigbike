"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset } from "@/lib/contracts/public";
import { cn } from "@/lib/utils";

export type PageHeroCrumb = {
  label: string;
  href?: string;
  altHref?: string;
  labelNode?: ReactNode;
};

const DEFAULT_BG = "/brand/page-title-bg.png";
const DEFAULT_ILLUSTRATION = "/brand/page-title-illustration.png";

export function PageHero({
  title,
  titleNode,
  breadcrumb,
  bgUrl,
  illustrationUrl,
  illustrationImage,
  illustrationNode,
  illustrationAlt,
  focusId,
  className,
  titleAs = "h1",
}: {
  title: string;
  titleNode?: ReactNode;
  breadcrumb: PageHeroCrumb[];
  bgUrl?: string | null;
  illustrationUrl?: string | null;
  /** Metadata-backed illustrations avoid guessing dimensions in next/image. */
  illustrationImage?: ImageAsset | null;
  /** Optional already-framed visual for entity-specific illustrations. */
  illustrationNode?: ReactNode;
  illustrationAlt?: string | null;
  focusId?: string;
  className?: string;
  /** Màn hình chờ dùng div để không gửi tiêu đề giả cùng nội dung thật. */
  titleAs?: "h1" | "div";
}) {
  const tBreadcrumb = useTranslations("Breadcrumb");
  const background = bgUrl?.trim() || DEFAULT_BG;
  const illustration = illustrationUrl?.trim() || DEFAULT_ILLUSTRATION;
  const illustrationAsset: ImageAsset = illustrationImage?.url?.trim()
    ? { ...illustrationImage, url: illustration }
    : { url: illustration, width: 451, height: 400 };
  const hasCustomIllustration = illustrationNode != null;
  const TitleTag = titleAs;

  return (
    <section
      className={cn(
        "relative mb-22.5 min-h-62.5 overflow-hidden bg-cover bg-center bg-no-repeat md:min-h-112.5",
        className,
      )}
      style={{ backgroundImage: `url('${background}')` }}
      data-page-hero
      data-bb-full-bleed
      data-bb-focus={focusId}
    >
      <Container className="relative z-10 flex min-h-62.5 items-center md:min-h-112.5">
        <div className="w-full md:w-1/2">
          <TitleTag className="m-0 font-body text-a2-page font-semibold leading-title text-white!">
            {titleNode ?? title}
          </TitleTag>
          <nav className="mt-2" aria-label={tBreadcrumb("ariaLabel")}>
            <ol className="m-0 flex list-none flex-wrap p-0">
              {breadcrumb.map((crumb, index) => {
                const href = crumb.href;
                return (
                  <li
                    key={`${crumb.label}-${index}`}
                    className="hidden items-center text-a5-meta text-white! before:mx-1 before:content-['/'] first:inline-flex! first:before:hidden last:inline-flex! md:inline-flex!"
                  >
                    {href ? (
                      <Link
                        href={href}
                        className="font-semibold text-white! no-underline! hover:text-brand!"
                      >
                        {crumb.labelNode ?? crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white!">{crumb.labelNode ?? crumb.label}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div
          className={cn(
            "absolute bottom-0 right-[15px] w-1/2 max-w-[451px]",
            hasCustomIllustration
              ? "block max-md:bottom-2 max-md:right-4 max-md:max-w-[50%]"
              : "hidden md:block!",
          )}
        >
          <div
            data-page-hero-illustration
            className="relative flex h-100 w-full items-end justify-center"
          >
            {illustrationNode ?? (
              <MediaImage
                image={illustrationAsset}
                altFallback={illustrationAlt ?? title}
                width={451}
                height={400}
                fill
                sizes="(min-width: 950px) 451px, (min-width: 768px) calc((100vw - 48px) / 2), 0px"
                className="object-contain"
              />
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
