import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { CheckoutPageHeading } from "@/components/layout/CheckoutPageHeading";
import { CartClient } from "@/components/cart/CartClient";
import { Tr } from "@/components/i18n/Tr";

/**
 * Giỏ hàng — port 1:1 từ themes/bigbike/page-templates/page-cart.php:
 * page-cart KHÔNG dùng banner .page-title (đã comment trong template), chỉ
 * #main-content > .container > [row: h1 + breadcrumb] + .cart-table. Nội dung
 * giỏ (the_content → shortcode [woocommerce_cart]) do <CartClient/> render,
 * giữ nguyên data/logic thật của bigbike-web.
 */

const TITLE = "Giỏ hàng";
const BREADCRUMB = [{ label: "Bigbike.vn", href: "/" }, { label: TITLE }];

export default function CartPage() {
  return (
    <StaticPageShell
      title={TITLE}
      breadcrumb={BREADCRUMB}
      showHero={false}
      mainClassName="bb-cart-page"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        {/* mt-20 theo page-cart.php; trên desktop đẩy thêm để h1 vượt qua đáy
            logo nghiêng của header WP (logo kéo xuống ~130px, trang này không có
            hero che như các route khác). Mobile logo nhỏ/căn giữa nên giữ mt-20. */}
        <CheckoutPageHeading title={<Tr ns="Cart" k="title" />} />

        <div className="pb-15 max-md:pb-7">
          <CartClient />
        </div>
      </div>
    </StaticPageShell>
  );
}
