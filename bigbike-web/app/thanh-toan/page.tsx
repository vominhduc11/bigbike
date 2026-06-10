import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpCheckoutPageHeading } from "@/components/wp/WpCheckoutPageHeading";
import { WpCheckoutClient } from "@/components/wp/WpCheckoutClient";

/**
 * Thanh toán — port 1:1 từ themes/bigbike/page-templates/page-checkout.php (cùng
 * khung với page-cart.php: KHÔNG hero, #main-content > .container > [row: h1 +
 * breadcrumb] + .cart-table). Nội dung form (the_content → [woocommerce_checkout]
 * → form-checkout.php) do <WpCheckoutClient/> render, giữ nguyên data/logic thật.
 */

const TITLE = "Thanh toán";
const BREADCRUMB = [{ label: "Bigbike.vn", href: "/" }, { label: TITLE }];

export default function CheckoutPage() {
  return (
    <WpStaticShell
      title={TITLE}
      breadcrumb={BREADCRUMB}
      showHero={false}
      mainClassName=""
      cssHref="/wp-content/themes/bigbike/css/wp-theme-checkout.css?v=2"
    >
      <div className="container">
        <WpCheckoutPageHeading title={TITLE} />

        <div className="cart-table">
          <WpCheckoutClient />
        </div>
      </div>
    </WpStaticShell>
  );
}
