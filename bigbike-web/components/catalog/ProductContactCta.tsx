"use client";

import { useLocale, useTranslations } from "next-intl";
import { MapPin, MessageCircle, ShoppingCart } from "lucide-react";
import { safeText, zaloHref } from "@/lib/utils/format";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { Button } from "@/components/ui/button";

type ProductContactCtaProps = {
  /** Bản tiếng Việt (SSR/ISR) — dùng làm fallback khi đang ở vi hoặc khi bản EN chưa tải xong. */
  productName: string;
  siteName: string;
  address?: string;
  zaloUrl?: string;
};

/** Cuộn mượt tới khu chọn phân loại + nút thêm giỏ ở đầu trang (.variations_form),
 *  bám mép dưới header dính. "Mua ngay" ở dải chân trang chỉ đưa khách trở lại khu
 *  mua hàng — nơi khách chọn size/màu rồi thêm vào giỏ — chứ KHÔNG tự thêm giỏ, vì
 *  ở vị trí này khách thường chưa chọn phân loại. */
function scrollToBuyBox() {
  const target =
    document.querySelector<HTMLElement>(".variations_form") ??
    document.getElementById("pdp-overview");
  if (!target) return;
  const header =
    document.querySelector<HTMLElement>("[data-bb-header]") ??
    document.querySelector<HTMLElement>(".bb-site-header");
  const offset = (header?.offsetHeight ?? 80) + 12;
  const y = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

/**
 * Local-SEO contact band at the foot of the product detail page: a light card
 * laid out in two columns — shop name + address on the left, a "Mua ngay" primary
 * CTA + Zalo consult button on the right (stacked on mobile). White surface with a
 * red top accent per the brand design system; the action buttons reuse the exact
 * PDP purchase tokens (red `bg-brand` for buy and consultation actions) so the
 * band reads as a real store block instead of a cramped centred caption. "Mua ngay"
 * scrolls back up to the buy box (variant picker + add-to-cart) rather than adding
 * to cart directly, since at this point in the page the shopper usually hasn't
 * picked a size/colour yet. Address/Zalo come from system settings so they stay
 * editable in one place and consistent with the footer / contact page and the
 * LocalBusiness structured data.
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
  zaloUrl,
}: ProductContactCtaProps) {
  const t = useTranslations("Product.contact");
  // Component này nằm trong LocalizedContentProvider (PurchaseSection/ProductView) nên đọc
  // trực tiếp bản EN qua useLocalizedField; `productName` truyền vào chỉ là bản vi fallback
  // (ProductView tính trước khi vào provider nên không tự đổi ngôn ngữ được).
  const locale = useLocale();
  const enName = useLocalizedField<string>("name");
  const displayName = safeText(locale === "en" ? enName : productName, productName);

  return (
    <section className="mt-16 mb-12 max-md:mt-6 max-md:mb-0">
      <div className="flex flex-col gap-7 border border-border border-t-2 border-t-brand bg-card px-8 py-7 md:flex-row md:items-center md:justify-between md:gap-12 max-md:px-5 max-md:py-6">
        <div className="min-w-0 max-md:text-center">
          <h3 className="!m-0 font-body text-a3-section leading-title text-foreground">
            {t.rich("headline", {
              productName: displayName,
              siteName,
              brand: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
              site: (chunks) => <span className="font-bold text-foreground">{chunks}</span>,
            })}
          </h3>

          {address && (
            <p className="mt-2 !mb-0 flex items-start gap-2 text-a4-content leading-body break-words text-muted-foreground max-md:justify-center">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
              <span>{address}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4 max-md:w-full max-md:flex-col">
          <Button
            type="button"
            variant="primary"
            onClick={scrollToBuyBox}
            className="h-auto rounded-none px-7 py-3.5 font-cta text-b4-action font-bold uppercase max-md:w-full"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {t("buyNow")}
          </Button>
          {zaloUrl && (
            <a
              href={zaloHref(zaloUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 border-2 !border-zalo !bg-white px-7 py-3.5 font-cta text-b4-action font-bold uppercase !text-zalo transition-colors hover:!bg-zalo-soft max-md:w-full"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              {t("zaloLink")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
