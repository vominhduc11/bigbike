// Section-card dùng chung cho các màn detail/form (ProductDetail, ContentDetail, …).
// Cấu trúc: card-head (title + badge tuỳ chọn) + card-body. Section bắt buộc hiển thị
// dấu * đỏ nhẹ sau tiêu đề thay vì badge "BẮT BUỘC" to.
//
// Gộp từ 2 bản copy trước đây (product-detail/Layout.jsx dùng <h3>, content-detail/SectionCard.jsx
// dùng <h2>). Bản <h2> không khớp rule CSS `.bb-card-header h3` nên tiêu đề bị lệch cỡ do preflight
// reset — nay thống nhất dùng <h3>. Body giữ nguyên `.bb-card-body` (không ép flex-gap) để không
// đổi layout của các nội dung con vốn tự quản khoảng cách.
export function SectionCard({ title, badge, required, children }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <h3>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-status-danger-text)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h3>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}
