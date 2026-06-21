"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

// Share icon links + native-share button (1em icons, brand on hover).
const SOCIAL_LINK =
  "inline-flex items-center justify-center mr-[30px] p-0 border-none bg-transparent text-muted-foreground text-ui-24 no-underline align-middle cursor-pointer hover:text-brand [&_svg]:w-[1em] [&_svg]:h-[1em]";

/** Hàng "Chia sẻ": nút share gốc (Web Share API → fallback copy link) + Facebook/Twitter/Instagram. */
export function ShareRow({
  productName,
  canonicalUrl,
  instagramUrl,
}: {
  productName: string;
  canonicalUrl: string;
  instagramUrl?: string;
}) {
  const t = useTranslations("Product.buyBox");
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: productName, url: canonicalUrl });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context) — silently ignore.
    }
  }, [productName, canonicalUrl]);

  return (
    <div className="mt-[30px] max-md:mt-[22px] flex flex-wrap items-center">
      <p className="m-0 mr-[30px] text-black text-ui-21 font-semibold lowercase">
        {t("shareLabel")}
      </p>
      <button
        type="button"
        className={SOCIAL_LINK}
        onClick={handleShare}
        aria-label={t("shareNative")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
      </button>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("shareFacebook")}
        className={SOCIAL_LINK}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M9.2 14V8.5h1.85l.28-2.15H9.2V5c0-.62.17-1.04 1.06-1.04h1.13V2.05A15.4 15.4 0 0 0 9.84 2C8.2 2 7.08 3 7.08 4.84V6.35H5.22V8.5h1.86V14H9.2Z" />
        </svg>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(productName)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("shareTwitter")}
        className={SOCIAL_LINK}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M12.6 1.5h2.45l-5.35 6.12L16 14.5h-4.93l-3.86-5.05-4.42 5.05H.34l5.72-6.54L0 1.5h5.05l3.49 4.61L12.6 1.5Zm-.86 11.52h1.36L4.32 2.9H2.86l8.88 10.12Z" />
        </svg>
      </a>
      {instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("shareInstagram")}
          className={SOCIAL_LINK}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
      ) : null}
      {shareCopied && (
        <span className="ml-2 text-caption font-medium text-brand" role="status">
          {t("shareCopied")}
        </span>
      )}
    </div>
  );
}
