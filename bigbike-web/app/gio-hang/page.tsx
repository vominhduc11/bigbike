import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpCheckoutPageHeading } from "@/components/wp/WpCheckoutPageHeading";
import { WpCartClient } from "@/components/wp/WpCartClient";

/**
 * Giỏ hàng — port 1:1 từ themes/bigbike/page-templates/page-cart.php:
 * page-cart KHÔNG dùng banner .page-title (đã comment trong template), chỉ
 * #main-content > .container > [row: h1 + breadcrumb] + .cart-table. Nội dung
 * giỏ (the_content → shortcode [woocommerce_cart]) do <WpCartClient/> render,
 * giữ nguyên data/logic thật của bigbike-web.
 */

const TITLE = "Giỏ hàng";
const BREADCRUMB = [{ label: "Bigbike.vn", href: "/" }, { label: TITLE }];

export default function CartPage() {
  return (
    <WpStaticShell
      title={TITLE}
      breadcrumb={BREADCRUMB}
      showHero={false}
      mainClassName=""
      cssHref="/wp-content/themes/bigbike/css/wp-theme-cart.css?v=1"
    >
      <div className="container">
        {/* mt-20 theo page-cart.php; trên desktop đẩy thêm để h1 vượt qua đáy
            logo nghiêng của header WP (logo kéo xuống ~130px, trang này không có
            hero che như các route khác). Mobile logo nhỏ/căn giữa nên giữ mt-20. */}
        <WpCheckoutPageHeading title={TITLE} />

        <div className="cart-table">
          <WpCartClient />
        </div>
      </div>
    </WpStaticShell>
  );
}
