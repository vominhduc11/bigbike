import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleDetail } from './RoleDetail'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) =>
      (
        ({
          'common.actionBarLabel': 'Thanh thao tác',
          'common.dirty': 'Có thay đổi chưa lưu',
          'roles.cancelBtn': 'Huỷ',
          'roles.editBtn': 'Chỉnh sửa quyền',
          'roles.deleteRoleBtn': 'Xoá vai trò',
          'roles.saveBtn': 'Lưu thay đổi',
          'roles.summaryPermCount': '{{count}} quyền',
          'roles.summaryNoSensitive': 'Không có quyền nhạy cảm',
          'roles.groupGrantedCount': '{{granted}}/{{total}} quyền',
          'roles.roleDesc_WAREHOUSE': 'Kho hàng',
          'roles.showPermCodes': 'Hiện mã kỹ thuật',
          'roles.permCode': 'Mã quyền',
        })[key] ||
        values.defaultValue ||
        key
      ).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

const role = {
  id: 'WAREHOUSE',
  name: 'Kho hàng',
  description: '',
  isSystem: false,
  permissions: ['roles.read'],
  assignedUserCount: 0,
}

const catalog = [
  {
    groupKey: 'roles.groupSystem',
    moduleKey: 'roles',
    permissions: [{ key: 'roles.read', sensitive: false }],
  },
]

function renderDetail(overrides = {}) {
  return render(
    <RoleDetail
      role={role}
      canUpdate
      editMode
      draft={new Set(['roles.read'])}
      isDirty
      saving={false}
      catalog={catalog}
      onStartEdit={vi.fn()}
      onCancelEdit={vi.fn()}
      onRequestSave={vi.fn()}
      onToggle={vi.fn()}
      onDeleteRole={vi.fn()}
      {...overrides}
    />,
  )
}

describe('RoleDetail', () => {
  it('keeps edit actions in the shared sticky action bar', () => {
    renderDetail()

    expect(screen.getByRole('toolbar', { name: 'Thanh thao tác' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
  })

  it('preserves disabled and loading states while saving', () => {
    renderDetail({ saving: true })

    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('keeps the edit action accessible while viewing a long permission list', () => {
    renderDetail({ editMode: false, isDirty: false })

    expect(screen.getByRole('toolbar', { name: 'Thanh thao tác' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chỉnh sửa quyền' })).toBeEnabled()
  })

  it('does not render edit actions outside edit mode', () => {
    renderDetail({ canUpdate: false, editMode: false, isDirty: false })

    expect(screen.queryByRole('toolbar', { name: 'Thanh thao tác' })).not.toBeInTheDocument()
  })

  // Vai trò DEVELOPER giữ quyền cho phép MỞ LẠI khoá bảo trì. Bỏ nhầm một quyền ở đây là
  // không ai mở khoá được nữa, nên backend từ chối sửa và giao diện phải ẩn nút tương ứng.
  it('locks the DEVELOPER role against permission edits, with an explanation', () => {
    renderDetail({
      role: { ...role, id: 'DEVELOPER', name: 'Developer', isSystem: true },
      editMode: false,
      isDirty: false,
    })

    expect(screen.queryByRole('button', { name: 'Chỉnh sửa quyền' })).not.toBeInTheDocument()
    expect(screen.getByText(/khoá không cho sửa/i)).toBeInTheDocument()
  })

  // Khác SUPER_ADMIN: bảng quyền vẫn hiện đầy đủ để người xem biết vai trò này gồm những gì
  // (đó là lý do `maintenance.manage` được tạo — để khả năng bảo trì nhìn thấy được).
  it('still shows the DEVELOPER permission list, unlike SUPER_ADMIN', () => {
    const asDeveloper = { ...role, id: 'DEVELOPER', name: 'Developer', isSystem: true }
    const { unmount } = renderDetail({ role: asDeveloper, editMode: false, isDirty: false })
    expect(screen.getByText('Hiện mã kỹ thuật')).toBeInTheDocument()
    unmount()

    renderDetail({
      role: { ...role, id: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
      editMode: false,
      isDirty: false,
    })
    expect(screen.queryByText('Hiện mã kỹ thuật')).not.toBeInTheDocument()
  })
})
