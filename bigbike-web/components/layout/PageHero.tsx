import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

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
  const resolvedUrl = trimmedUrl ? resolveMediaUrl(trimmedUrl) : null;
  const altText = safeText(imageAlt, title);

  return (
    <div className={`wp-cat-hero${resolvedUrl ? "" : " wp-cat-hero--no-img"}`}>
      {resolvedUrl ? (
        <>
          <Image
            src={resolvedUrl}
            alt={altText}
            fill
            className="wp-cat-hero-bg"
            priority
            sizes="100vw"
          />
          <div className="wp-cat-hero-overlay" />
        </>
      ) : null}
      <div className="wp-cat-hero-content bb-container">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="wp-cat-hero-breadcrumb" aria-label="Điều hướng">
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={`${item.label}-${index}`} style={{ display: "contents" }}>
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
        {kicker ? <p className="wp-cat-hero-kicker">{kicker}</p> : null}
        <h1 className="wp-cat-hero-title">{title}</h1>
        {description ? <p className="wp-cat-hero-desc">{description}</p> : null}
        {meta ? <span className="wp-cat-hero-count">{meta}</span> : null}
      </div>
    </div>
  );
}
