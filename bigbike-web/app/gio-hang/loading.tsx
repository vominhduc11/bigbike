import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Tr } from "@/components/i18n/Tr";

export default function CartLoading() {
  return (
    <div id="main-content" className="bb-cart-page" aria-busy="true">
      <Container>
        <div className="bb-cart-heading-row">
          <div className="bb-cart-heading-col">
            <h1><Tr ns="Cart" k="title" /></h1>
            <nav className="bb-cart-breadcrumb" aria-label="Breadcrumb">
              <ul>
                <li>
                  <Link href="/">Bigbike.vn</Link>
                </li>
                <li aria-current="page">
                  <span><Tr ns="Cart" k="title" /></span>
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
