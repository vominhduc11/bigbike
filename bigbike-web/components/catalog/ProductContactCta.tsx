"use client";

import { useTranslations } from "next-intl";
import { telHref, zaloHref } from "@/lib/utils/format";

type ProductContactCtaProps = {
  productName: string;
  siteName: string;
  address?: string;
  hotline?: string;
  zaloUrl?: string;
};

/** Pull a human-readable phone number out of a raw Zalo value (URL or number).
 * Returns the raw digits when grouping is unknown, "" when there are no digits
 * (e.g. an alias like zalo.me/bigbike). */
function zaloDisplayNumber(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return digits;
}

/**
 * Local-SEO contact band at the foot of the product detail page: a compact light
 * card showing "Mua <product> chính hãng tại <shop>" + the store address, hotline
 * and Zalo. White surface with a red top accent + red numbers — matches the
 * light-first PDP (same card chrome as the reviews block) per the brand design
 * system. All shop details come from system settings so they stay editable in one
 * place and consistent with the footer / contact page and the LocalBusiness
 * structured data.
 *
 * Width/horizontal gutter are NOT set here — the band must render inside the PDP
 * `.container` so it shares the exact same rail (max-width steps + 15px gutter) as
 * every other section on the page at every breakpoint. Don't re-add a bespoke
 * max-width/px wrapper or move it outside `.container`.
 */
export function ProductContactCta({
  productName,
  siteName,
  address,
  hotline,
  zaloUrl,
}: ProductContactCtaProps) {
  const t = useTranslations("Product.contact");
  if (!address && !hotline && !zaloUrl) return null;

  const zaloNumber = zaloUrl ? zaloDisplayNumber(zaloUrl) : "";

  return (
    <section className="mt-16 mb-12 max-md:mt-9">
      <div className="border border-border border-t-2 border-t-brand bg-card px-6 py-5 text-center max-md:px-4 max-md:py-4">
        <h3 className="font-cta text-15 leading-title text-balance text-muted-foreground max-md:text-13">
          {t.rich("headline", {
            productName,
            siteName,
            brand: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
            site: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
          })}
        </h3>

        {address && (
          <p className="mt-2.5 text-13 leading-body text-balance break-words text-muted-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mr-1.5 inline-block align-[-2px] text-brand"
              aria-hidden="true"
            >
              <path d="M12 21s-7-5.33-7-11a7 7 0 1 1 14 0c0 5.67-7 11-7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {address}
          </p>
        )}

        {(hotline || zaloUrl) && (
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-13 text-muted-foreground">
            {hotline && (
              <a
                href={telHref(hotline)}
                className="font-cta text-15 font-bold text-brand hover:underline"
              >
                {hotline}
              </a>
            )}
            {hotline && zaloUrl && <span aria-hidden="true">·</span>}
            {zaloUrl && (
              <span className="flex items-center gap-1.5">
                <span>{t("zaloLabel")}</span>
                <a
                  href={zaloHref(zaloUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-cta text-15 font-bold text-brand hover:underline"
                >
                  {zaloNumber || t("zaloLink")}
                </a>
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
