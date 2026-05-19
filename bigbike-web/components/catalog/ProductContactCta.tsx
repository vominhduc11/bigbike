type ProductContactCtaProps = {
  productName: string;
  siteName: string;
  address?: string;
  hotline?: string;
  zaloUrl?: string;
};

/** Normalize a Zalo setting value (raw phone or full URL) into a tel/zalo link. */
function toZaloHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://zalo.me/${digits}` : value;
}

/**
 * Local-SEO contact band near the foot of the product detail page.
 * All shop details come from system settings so they stay editable in one place.
 */
export function ProductContactCta({
  productName,
  siteName,
  address,
  hotline,
  zaloUrl,
}: ProductContactCtaProps) {
  if (!address && !hotline && !zaloUrl) return null;

  return (
    <section className="border border-border border-t-2 border-t-brand bg-muted/40 px-6 py-8 text-center">
      <p className="font-display text-lg uppercase tracking-tight text-foreground sm:text-xl">
        Mua <span className="text-brand">{productName}</span> chính hãng tại {siteName}
      </p>
      <div className="mt-3 flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
        {address && (
          <p className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand" aria-hidden="true">
              <path d="M12 21s-7-5.33-7-11a7 7 0 1 1 14 0c0 5.67-7 11-7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>{address}</span>
          </p>
        )}
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {hotline && (
            <a
              href={`tel:${hotline.replace(/[^\d+]/g, "")}`}
              className="font-display text-base font-semibold text-brand hover:underline"
            >
              {hotline}
            </a>
          )}
          {zaloUrl && (
            <a
              href={toZaloHref(zaloUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-base font-semibold text-brand hover:underline"
            >
              Tư vấn qua Zalo
            </a>
          )}
        </p>
      </div>
    </section>
  );
}
