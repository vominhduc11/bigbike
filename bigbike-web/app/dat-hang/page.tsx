import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpCheckoutPageHeading } from "@/components/wp/WpCheckoutPageHeading";
import { WpCheckoutClient } from "@/components/wp/WpCheckoutClient";
import { Tr } from "@/components/i18n/Tr";

/**
 * Đặt hàng — port 1:1 từ themes/bigbike/page-templates/page-checkout.php (cùng
 * khung với page-cart.php: KHÔNG hero, #main-content > .container > [row: h1 +
 * breadcrumb] + .cart-table). Nội dung form (the_content → [woocommerce_checkout]
 * → form-checkout.php) do <WpCheckoutClient/> render, giữ nguyên data/logic thật.
 */

const TITLE = "Đặt hàng";
const BREADCRUMB = [{ label: "Bigbike.vn", href: "/" }, { label: TITLE }];

export default function CheckoutPage() {
  return (
    <WpStaticShell
      title={TITLE}
      breadcrumb={BREADCRUMB}
      showHero={false}
      mainClassName=""
      cssHref=""
    >
      <div className="container">
        <WpCheckoutPageHeading title={<Tr ns="Checkout" k="title" />} />

        <div className="cart-table">
          <WpCheckoutClient />
        </div>
      </div>
    </WpStaticShell>
  );
}
