"use client";

import { useTranslations } from "next-intl";
import { MapPin, MessageCircle, Phone } from "lucide-react";
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
 * Local-SEO contact band at the foot of the product detail page: a light card
 * laid out in two columns — shop name + address on the left, call / Zalo action
 * buttons on the right (stacked on mobile). White surface with a red top accent
 * per the brand design system; the action buttons reuse the exact PDP purchase
 * tokens (red `bg-brand` for call, Zalo-blue outline for Zalo) so the band reads
 * as a real store-contact block instead of a cramped centred caption. All shop
 * details come from system settings so they stay editable in one place and
 * consistent with the footer / contact page and the LocalBusiness structured data.
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
    <section className="mt-16 mb-12 max-md:mt-6 max-md:mb-0">
      <div className="flex flex-col gap-7 border border-border border-t-2 border-t-brand bg-card px-8 py-7 md:flex-row md:items-center md:justify-between md:gap-12 max-md:px-5 max-md:py-6">
        <div className="min-w-0 max-md:text-center">
          <h3 className="!m-0 font-cta text-ui-20 max-md:text-ui-18 leading-title text-foreground">
            {t.rich("headline", {
              productName,
              siteName,
              brand: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
              site: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
            })}
          </h3>

          {address && (
            <p className="mt-2 !mb-0 flex items-start gap-2 text-18 max-md:text-ui-16 leading-body break-words text-muted-foreground max-md:justify-center">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <span>{address}</span>
            </p>
          )}
        </div>

        {(hotline || zaloUrl) && (
          <div className="flex shrink-0 flex-wrap items-center gap-4 max-md:w-full max-md:flex-col">
            {hotline && (
              <a
                href={telHref(hotline)}
                className="inline-flex items-center justify-center gap-2.5 !bg-brand px-7 py-3.5 font-cta text-ui-20 max-md:text-ui-18 font-bold !text-white transition-colors hover:!bg-brand-active max-md:w-full"
              >
                <Phone className="size-5" aria-hidden="true" />
                {hotline}
              </a>
            )}
            {zaloUrl && (
              <a
                href={zaloHref(zaloUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 border-2 !border-zalo !bg-white px-7 py-3.5 font-cta text-ui-20 max-md:text-ui-18 font-bold !text-zalo transition-colors hover:!bg-zalo-soft max-md:w-full"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
                {zaloNumber || t("zaloLink")}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
