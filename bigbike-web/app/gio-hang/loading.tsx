import Link from "next/link";
import { Container } from "@/components/layout/Container";

export default function CartLoading() {
  return (
    <div id="main-content" className="bb-cart-page" aria-busy="true">
      <Container>
        <div className="bb-cart-heading-row">
          <div className="bb-cart-heading-col">
            <h1>Giỏ hàng</h1>
            <nav className="bb-cart-breadcrumb" aria-label="Breadcrumb">
              <ul>
                <li>
                  <Link href="/">Bigbike.vn</Link>
                </li>
                <li aria-current="page">
                  <span>Giỏ hàng</span>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="cart-table">
          <div className="woocommerce-notices-wrapper" />
        </div>
      </Container>
    </div>
  );
}
