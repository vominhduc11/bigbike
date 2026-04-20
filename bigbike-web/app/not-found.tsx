import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-empty-state">
          <h1>Khong tim thay trang</h1>
          <p>URL co the da thay doi hoac noi dung chua duoc publish.</p>
          <Link href="/" className="bb-button bb-button-primary">
            Ve trang chu
          </Link>
        </section>
      </div>
    </section>
  );
}

