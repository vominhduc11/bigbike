import Link from "next/link";

/**
 * Tiêu đề + breadcrumb (Bigbike.vn → {title}) cho khung checkout KHÔNG-hero:
 * /gio-hang, /thanh-toan, /don-hang/xac-nhan. Port markup microdata
 * `.breadcrumb > ul > li[property="name"]` từ page-cart.php / page-checkout.php.
 * Đặt trực tiếp trong `.container` của từng trang.
 */
export function WpCheckoutPageHeading({ title }: { title: string }) {
  return (
    <div className="row align-items-center mt-20 md:!mt-[64px]">
      <div className="col-md-6">
        <h1>{title}</h1>
        <div className="breadcrumb">
          <ul>
            <li className="home">
              <Link href="/">
                <span property="name">Bigbike.vn</span>
              </Link>
            </li>
            <li>
              <span property="name">{title}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
