import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { CheckoutPageHeading } from "@/components/layout/CheckoutPageHeading";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { Tr } from "@/components/i18n/Tr";
import { listPublicSettings } from "@/lib/api/public-api";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

/**
 * Đặt hàng — port 1:1 từ themes/bigbike/page-templates/page-checkout.php (cùng
 * khung với page-cart.php: KHÔNG hero, #main-content > .container > [row: h1 +
 * breadcrumb] + .cart-table). Nội dung form (the_content → [woocommerce_checkout]
 * → form-checkout.php) do <CheckoutClient/> render, giữ nguyên data/logic thật.
 */

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Checkout");
  const title = t("title");
  const settingsResult = await listPublicSettings(locale);
  return (
    <StaticPageShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: toHomePath(locale) }, { label: title }]}
      showHero={false}
      mainClassName="bb-checkout-page"
    >
      <Container>
        <CheckoutPageHeading title={<Tr ns="Checkout" k="title" />} />

        <div className="pb-15">
          <CheckoutClient settings={settingsResult.data ?? []} />
        </div>
      </Container>
    </StaticPageShell>
  );
}
