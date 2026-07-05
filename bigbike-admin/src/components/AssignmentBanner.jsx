import { Users } from 'lucide-react'

// 6 màu cố định (khớp border-left như trước) — cycle 3 màu cũ sẽ làm vai trò 1 và 4 giống hệt
// nhau khi có >3 vai trò, nên dùng đủ 6 token trạng thái/thương hiệu sẵn có trong admin-tokens.css.
const ROLE_COLORS = [
  'var(--admin-color-primary)',
  'var(--admin-color-status-warning-text)',
  'var(--admin-color-text-primary)',
  'var(--admin-color-status-success-text)',
  'var(--admin-color-status-info-text)',
  'var(--admin-color-status-danger-text)',
]

// Banner phân công dùng chung giữa product-detail và content-detail — thuần hiển thị, không tự
// fetch. `roles` là mảng { id, name, items } động (1-6, Super Admin quản lý ở Settings), thay cho
// 3 cột cứng trước đây; layout tự co giãn/xuống dòng thay vì luôn đúng 3 cột.
export function AssignmentBanner({ title, roles, emptyMessage }) {
  if (!roles || roles.length === 0) {
    return emptyMessage ? (
      <div className="px-4 py-3 bg-surface-muted border-b border-border text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    ) : null
  }
  return (
    <div className="px-4 py-3 bg-surface-muted border-b border-border">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users size={12} />
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((role, index) => (
          <div
            key={role.id}
            className="border-l-[3px] pl-2 py-0.5"
            style={{ borderColor: ROLE_COLORS[index % ROLE_COLORS.length] }}
          >
            <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
              {role.name}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
              {role.items}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AssignmentBanner
