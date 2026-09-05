import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { CartSkeleton } from "@/components/cart/parts/CartSkeleton";
import { CheckoutHeadingSkel } from "@/components/ui/skeleton/primitives";

/**
 * Khung chờ giỏ hàng — dựng đúng khung trang thật (StaticPageShell không băng-rôn
 * → Container → tiêu đề + đường dẫn → ruột giỏ) và dùng CHUNG `CartSkeleton` với
 * CartClient, nên khách chỉ thấy một khung chờ duy nhất từ đầu tới cuối.
 */
export default async function CartLoading() {
  const t = await getTranslations("Loading");
  return (
    <div id="main-content" className="bb-cart-page bb-heroless" role="status" aria-busy="true">
      <span className="sr-only">{t("content")}</span>
      <Container>
        <CheckoutHeadingSkel />
        <div className="pb-15 max-md:pb-7">
          <CartSkeleton />
        </div>
      </Container>
    </div>
  );
}
