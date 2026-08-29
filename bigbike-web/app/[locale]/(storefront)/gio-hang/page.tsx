import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { CheckoutPageHeading } from "@/components/layout/CheckoutPageHeading";
import { CartClient } from "@/components/cart/CartClient";
import { Tr } from "@/components/i18n/Tr";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locale";
import { toHomePath } from "@/lib/utils/routes";

/**
 * Giỏ hàng — port 1:1 từ themes/bigbike/page-templates/page-cart.php:
 * page-cart KHÔNG dùng banner .page-title (đã comment trong template), chỉ
 * #main-content > .container > [row: h1 + breadcrumb] + .cart-table. Nội dung
 * giỏ (the_content → shortcode [woocommerce_cart]) do <CartClient/> render,
 * giữ nguyên data/logic thật của bigbike-web.
 */

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Cart");
  const title = t("title");
  return (
    <StaticPageShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: toHomePath(locale) }, { label: title }]}
      showHero={false}
      mainClassName="bb-cart-page"
    >
      <Container>
        <CheckoutPageHeading title={<Tr ns="Cart" k="title" />} />

        <div className="pb-15 max-md:pb-7">
          <CartClient />
        </div>
      </Container>
    </StaticPageShell>
  );
}
