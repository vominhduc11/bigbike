import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

const WP_HERO_BG = "/wp/page-title-bg.png";
const WP_HERO_ILLUSTRATION = "/wp/mu-bao-hiem.png";

export type PageHeroBreadcrumbItem = {
  label: string;
  href?: string;
};

export type PageHeroProps = {
  imageUrl?: string | null;
  imageAlt?: string | null;
  kicker?: string | null;
  title: string;
  description?: string | null;
  breadcrumb?: PageHeroBreadcrumbItem[];
  meta?: ReactNode;
};

export function PageHero({
  imageUrl,
  imageAlt,
  kicker,
  title,
  description,
  breadcrumb,
  meta,
}: PageHeroProps) {
  const trimmedUrl = imageUrl?.trim();
  const customSrc = trimmedUrl ? resolveMediaUrl(trimmedUrl) : null;
  const resolvedUrl = customSrc || WP_HERO_BG;
  const altText = safeText(imageAlt, title);
  const isFallbackBg = !customSrc;

  return (
    <div className={`bb-cat-hero${isFallbackBg ? " bb-cat-hero--wp" : ""}`}>
      <Image
        src={resolvedUrl}
        alt={altText}
        fill
        className="bb-cat-hero-bg"
        priority
        sizes="100vw"
      />
      {!isFallbackBg && <div className="bb-cat-hero-overlay" />}
      <div className="bb-cat-hero-content bb-container">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="bb-cat-hero-breadcrumb" aria-label="Điều hướng">
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="contents">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {!isLast && item.href ? (
                    <Link href={item.href}>{item.label}</Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}
        {kicker ? <p className="bb-cat-hero-kicker">{kicker}</p> : null}
        <h1 className="bb-cat-hero-title">{title}</h1>
        {description ? <p className="bb-cat-hero-desc">{description}</p> : null}
        {meta ? <span className="bb-cat-hero-count">{meta}</span> : null}
      </div>
      {isFallbackBg && (
        <div className="bb-cat-hero-illustration" aria-hidden="true">
          <Image src={WP_HERO_ILLUSTRATION} alt="" width={420} height={420} />
        </div>
      )}
    </div>
  );
}
