import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { Container } from "@/components/layout/Container";
import { CheckoutPageHeading } from "@/components/layout/CheckoutPageHeading";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { Tr } from "@/components/i18n/Tr";

/**
 * Đặt hàng — port 1:1 từ themes/bigbike/page-templates/page-checkout.php (cùng
 * khung với page-cart.php: KHÔNG hero, #main-content > .container > [row: h1 +
 * breadcrumb] + .cart-table). Nội dung form (the_content → [woocommerce_checkout]
 * → form-checkout.php) do <CheckoutClient/> render, giữ nguyên data/logic thật.
 */

const TITLE = "Đặt hàng";
const BREADCRUMB = [{ label: "Bigbike.vn", href: "/" }, { label: TITLE }];

export default function CheckoutPage() {
  return (
    <StaticPageShell
      title={TITLE}
      breadcrumb={BREADCRUMB}
      showHero={false}
      mainClassName="bb-checkout-page"
    >
      <Container>
        <CheckoutPageHeading title={<Tr ns="Checkout" k="title" />} />

        <div className="pb-15">
          <CheckoutClient />
        </div>
      </Container>
    </StaticPageShell>
  );
}
