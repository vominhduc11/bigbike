import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-empty-state">
          <h1>Không tìm thấy trang</h1>
          <p>URL có thể đã thay đổi hoặc nội dung chưa được publish.</p>
          <div className="bb-not-found-nav">
            <Link href="/" className="bb-button bb-button-primary">
              VỀ TRANG CHỦ
            </Link>
            <Link href="/san-pham/" className="bb-button bb-button-secondary">
              XEM SẢN PHẨM
            </Link>
            <Link href="/danh-muc-san-pham/" className="bb-button bb-button-secondary">
              DANH MỤC
            </Link>
            <Link href="/lien-he/" className="bb-button bb-button-secondary">
              LIÊN HỆ
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
