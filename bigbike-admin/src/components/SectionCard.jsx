// Section-card dùng chung cho các màn detail/form (ProductDetail, ContentDetail, …).
// Cấu trúc: card-head (title + badge tuỳ chọn) + card-body. Section bắt buộc hiển thị
// dấu * đỏ nhẹ sau tiêu đề thay vì badge "BẮT BUỘC" to.
//
// Gộp từ 2 bản copy trước đây (product-detail/Layout.jsx dùng <h3>, content-detail/SectionCard.jsx
// dùng <h2>). Bản <h2> không khớp rule CSS `.bb-card-header h3` nên tiêu đề bị lệch cỡ do preflight
// reset — nay thống nhất dùng <h3>. Body giữ nguyên `.bb-card-body` (không ép flex-gap) để không
// đổi layout của các nội dung con vốn tự quản khoảng cách.
import { useTranslation } from 'react-i18next'

// `headingLevel` (2|3|4, mặc định 3) để cấp tiêu đề khớp ngữ cảnh (tránh nhảy H1→H3);
// CSS `.bb-card-header :is(h2,h3,h4)` giữ nguyên cỡ chữ ở mọi cấp.
export function SectionCard({ title, badge, required, headingLevel = 3, children }) {
  const { t } = useTranslation()
  const Heading = `h${headingLevel}`
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <Heading>
          {title}
          {required && (
            <span
              className="ml-1 text-danger"
              aria-label={t('common.required')}
              title={t('common.required')}
            >*</span>
          )}
        </Heading>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}
