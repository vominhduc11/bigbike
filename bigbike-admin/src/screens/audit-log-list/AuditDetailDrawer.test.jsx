import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditDetailDrawer } from './AuditDetailDrawer'
import viLocale from '../../locales/vi.json'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    // Dùng bộ dịch tiếng Việt thật để bắt được nhãn thiếu/sai, giữ nguyên cơ chế
    // defaultValue mà màn hình đang dựa vào.
    t: (key, options = {}) => {
      const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), viLocale)
      if (typeof value === 'string') {
        return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? ''))
      }
      if (options && 'defaultValue' in options) return options.defaultValue
      return key
    },
  }),
}))

// Modal thật bọc Radix Dialog + portal; test này quan tâm nội dung bên trong.
vi.mock('../../components/layout', () => ({
  Modal: ({ open, title, children, onClose, closeLabel }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onClose}>{closeLabel}</button>
        {children}
      </div>
    ) : null,
}))

function makeLog(overrides = {}) {
  return {
    id: 'log-1',
    actorType: 'ADMIN',
    actorDisplayName: 'Minh',
    actorEmail: 'minh@bigbike.vn',
    action: 'PRODUCT_UPDATED',
    resourceType: 'PRODUCT',
    resourceId: null,
    resourceDisplayName: 'Mũ bảo hiểm LS2',
    resourceCode: null,
    beforeData: null,
    afterData: null,
    ipAddress: null,
    createdAt: '2026-07-25T03:00:00Z',
    ...overrides,
  }
}

function renderDrawer(overrides = {}) {
  const onClose = vi.fn()
  render(<AuditDetailDrawer log={makeLog(overrides)} onClose={onClose} />)
  return { onClose }
}

beforeEach(() => vi.clearAllMocks())

describe('thông tin chung', () => {
  it('hiện tên người thực hiện và đối tượng liên quan', () => {
    renderDrawer()
    expect(screen.getByText('Minh')).toBeInTheDocument()
    expect(screen.getByText('Mũ bảo hiểm LS2')).toBeInTheDocument()
  })

  it('không có tên thì hiện loại người thực hiện thay vì để trống', () => {
    renderDrawer({ actorDisplayName: null, actorEmail: null, actorType: 'SYSTEM' })
    // Xuất hiện cả ở chỗ tên (thay thế) lẫn thẻ loại bên cạnh.
    expect(screen.getAllByText(viLocale.auditLog.actorType.SYSTEM).length).toBeGreaterThan(0)
    expect(screen.getByRole('dialog').textContent).not.toMatch(/undefined|null/)
  })

  it('dùng chung cách gọi tên hành động với bảng danh sách', () => {
    renderDrawer({ action: 'CATEGORY_SOFT_DELETED', resourceType: 'CATEGORY' })
    expect(screen.getByText('Chuyển danh mục vào Thùng rác')).toBeInTheDocument()
  })

  it('hành động lạ hiện nguyên mã trong ngoặc, không phải chuỗi rỗng', () => {
    renderDrawer({ action: 'MOT_MA_LA' })
    expect(screen.getByText('(MOT_MA_LA)')).toBeInTheDocument()
  })

  it('nhóm quản lý của dữ liệu cũ vẫn đọc được', () => {
    renderDrawer({ resourceType: 'SERIAL', action: 'SERIALS_BULK_IMPORTED' })
    expect(screen.getByText('Mã serial (tính năng đã gỡ)')).toBeInTheDocument()
    expect(screen.getByText('Nhập hàng loạt mã serial (tính năng đã gỡ)')).toBeInTheDocument()
  })
})

describe('địa chỉ truy cập', () => {
  it('hiện khi bản ghi có ghi nhận', () => {
    renderDrawer({ ipAddress: '203.0.113.9', action: 'ADMIN_LOGIN_FAILED', resourceType: 'ADMIN_AUTH' })
    expect(screen.getByText(viLocale.auditLog.drawerIpLabel)).toBeInTheDocument()
    expect(screen.getByText('203.0.113.9')).toBeInTheDocument()
  })

  it('ẩn hẳn dòng khi không có, không hiện ô trống', () => {
    renderDrawer({ ipAddress: null })
    expect(screen.queryByText(viLocale.auditLog.drawerIpLabel)).not.toBeInTheDocument()
  })
})

describe('cảnh báo thao tác nguy hiểm', () => {
  it('hiện băng cảnh báo cho xoá vĩnh viễn', () => {
    renderDrawer({ action: 'PRODUCT_HARD_DELETED' })
    expect(screen.getByText(viLocale.auditLog.drawerDangerBanner)).toBeInTheDocument()
  })

  it('không hiện băng cảnh báo cho thao tác cập nhật thường', () => {
    renderDrawer({ action: 'PRODUCT_UPDATED' })
    expect(screen.queryByText(viLocale.auditLog.drawerDangerBanner)).not.toBeInTheDocument()
  })
})

describe('bảng so sánh trước / sau', () => {
  it('chỉ liệt kê trường thực sự thay đổi', () => {
    renderDrawer({
      beforeData: JSON.stringify({ name: 'Mũ A', retailPrice: 1000, sku: 'SKU-1' }),
      afterData: JSON.stringify({ name: 'Mũ B', retailPrice: 1000, sku: 'SKU-1' }),
    })
    expect(screen.getByText('Mũ A')).toBeInTheDocument()
    expect(screen.getByText('Mũ B')).toBeInTheDocument()
    expect(screen.queryByText('SKU-1')).not.toBeInTheDocument()
  })

  it('giá trị rỗng hiển thị dấu gạch, không phải null', () => {
    renderDrawer({
      beforeData: JSON.stringify({ salePrice: null }),
      afterData: JSON.stringify({ salePrice: 500000 }),
    })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('500000')).toBeInTheDocument()
  })

  it('giá trị dạng khối dữ liệu không rơi thành [object Object]', () => {
    renderDrawer({
      beforeData: JSON.stringify({ seo: { title: 'Cũ' } }),
      afterData: JSON.stringify({ seo: { title: 'Mới' } }),
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).not.toContain('[object Object]')
    expect(screen.getByText('{"title":"Cũ"}')).toBeInTheDocument()
    expect(screen.getByText('{"title":"Mới"}')).toBeInTheDocument()
  })

  it('hai khối dữ liệu khác nhau không bị coi là giống nhau', () => {
    renderDrawer({
      beforeData: JSON.stringify({ image: { url: '/media/a.jpg' } }),
      afterData: JSON.stringify({ image: { url: '/media/b.jpg' } }),
    })
    expect(screen.queryByText(viLocale.auditLog.drawerNoChanges)).not.toBeInTheDocument()
  })

  it('báo rõ khi không có dữ liệu trước/sau để so sánh', () => {
    renderDrawer({ beforeData: null, afterData: null })
    expect(screen.getByText(viLocale.auditLog.drawerNoChanges)).toBeInTheDocument()
  })

  it('dữ liệu hỏng không làm vỡ màn hình, chỉ báo không so sánh được', () => {
    renderDrawer({ beforeData: '{khong-phai-json', afterData: '{cung-hong' })
    expect(screen.getByText(viLocale.auditLog.drawerNoChanges)).toBeInTheDocument()
  })

  it('chỉ có dữ liệu sau (bản ghi tạo mới) thì không dựng bảng so sánh', () => {
    renderDrawer({ beforeData: null, afterData: JSON.stringify({ name: 'Mũ mới' }), action: 'PRODUCT_CREATED' })
    expect(screen.getByText(viLocale.auditLog.drawerNoChanges)).toBeInTheDocument()
  })
})

describe('dữ liệu kỹ thuật', () => {
  it('mặc định thu gọn, bấm mới mở ra', async () => {
    const user = userEvent.setup()
    renderDrawer({ afterData: JSON.stringify({ name: 'Mũ mới' }) })

    const toggle = screen.getByRole('button', { name: (content) => content.startsWith(viLocale.auditLog.drawerTechData) })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/"name": "Mũ mới"/)).toBeInTheDocument()
  })

  it('không có dữ liệu thô thì ẩn hẳn phần này', () => {
    renderDrawer({ beforeData: null, afterData: null })
    expect(screen.queryByRole('button', { name: (content) => content.startsWith(viLocale.auditLog.drawerTechData) })).not.toBeInTheDocument()
  })
})

describe('đóng bảng chi tiết', () => {
  it('gọi onClose khi bấm nút đóng', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDrawer()
    await user.click(screen.getByRole('button', { name: viLocale.auditLog.drawerClose }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
