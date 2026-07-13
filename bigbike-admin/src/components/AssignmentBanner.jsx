import { Users } from 'lucide-react'

// Banner phân công dùng chung giữa product-detail và content-detail — thuần hiển thị, không tự
// fetch. `roles` là mảng { id, name, items } động (1-6, Super Admin quản lý ở Settings), thay cho
// 3 cột cứng trước đây; layout tự co giãn/xuống dòng thay vì luôn đúng 3 cột.
//
// Vạch màu bên trái dùng MỘT tone thương hiệu (primary) cho MỌI vai trò. Các vai trò không mang
// ý nghĩa trạng thái, nên cycle qua success/warning/danger theo VỊ TRÍ dễ bị đọc nhầm thành
// "tốt / cảnh báo / lỗi" và còn đổi màu khi thứ tự thay đổi. Tên vai trò (in đậm) mới là thứ
// phân biệt; màu chỉ là điểm nhấn thương hiệu ổn định, không hàm ý trạng thái.
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
        {roles.map((role) => (
          <div key={role.id} className="border-l-4 border-l-primary pl-2 py-0.5">
            <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
              {role.name}
            </div>
            <div className="text-xs leading-relaxed text-muted-foreground">
              {role.items}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AssignmentBanner
