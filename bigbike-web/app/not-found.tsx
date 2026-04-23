import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-empty-state">
          <h1>Không tìm thấy trang</h1>
          <p>URL có thể đã thay đổi hoặc nội dung chưa được publish.</p>
          <Link href="/" className="bb-button bb-button-primary">
            Về trang chủ
          </Link>
        </section>
      </div>
    </section>
  );
}

