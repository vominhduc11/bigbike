import { describe, expect, it, vi } from 'vitest'
import {
  DANGEROUS_ACTIONS,
  DANGEROUS_VALUES,
  INITIAL_QUERY,
  RESOURCE_OPTIONS,
  ACTOR_OPTIONS,
  buildCsvRow,
  getActionLabel,
  getDatePreset,
  getModuleLabel,
  getModuleTone,
  sanitizeSpreadsheetCell,
  toBadgeVariant,
  tryParse,
} from './constants'
import viLocale from '../../locales/vi.json'
import enLocale from '../../locales/en.json'

// Bộ dịch thật (không mock) — mục đích là bắt nhãn thiếu, không phải bắt cách gọi t().
function makeT(locale) {
  return (key, options = {}) => {
    const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), locale)
    if (typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? ''))
    }
    if ('defaultValue' in options) return options.defaultValue
    return key
  }
}
const t = makeT(viLocale)

describe('DANGEROUS_ACTIONS', () => {
  // Mọi thao tác xoá VĨNH VIỄN đều phải được đánh dấu — đây là nhóm không khôi
  // phục được, trước đây bị bỏ sót hoàn toàn khỏi tập này.
  it.each([
    'PRODUCT_HARD_DELETED',
    'CATEGORY_HARD_DELETED',
    'BRAND_HARD_DELETED',
    'CONTENT_ARTICLE_HARD_DELETED',
    'MEDIA_HARD_DELETED',
  ])('đánh dấu nguy hiểm cho xoá vĩnh viễn: %s', (action) => {
    expect(DANGEROUS_ACTIONS.has(action)).toBe(true)
  })

  it.each([
    'PRODUCT_SOFT_DELETED',
    'CATEGORY_SOFT_DELETED',
    'BRAND_SOFT_DELETED',
    'CONTENT_ARTICLE_DELETED',
    'MEDIA_DELETED',
  ])('đánh dấu nguy hiểm cho chuyển vào Thùng rác: %s', (action) => {
    expect(DANGEROUS_ACTIONS.has(action)).toBe(true)
  })

  it.each([
    'MENU_DELETED',
    'MENU_ITEM_DELETED',
    'ROLE_DELETED',
    'REDIRECT_DELETED',
    'SLIDER_DELETED',
    'HOME_VIDEO_DELETED',
    'MEDIA_FOLDER_DELETED',
    'ATTRIBUTE_DELETED',
    'ATTRIBUTE_VALUE_DELETED',
    'REVIEW_DELETED',
  ])('đánh dấu nguy hiểm cho xoá bản ghi cấu hình/nội dung: %s', (action) => {
    expect(DANGEROUS_ACTIONS.has(action)).toBe(true)
  })

  it.each(['ADMIN_USER_DISABLED', 'ADMIN_USER_SUSPENDED', 'ADMIN_LOGIN_FAILED', 'ADMIN_ACCOUNT_LOCKED'])(
    'đánh dấu nguy hiểm cho sự kiện khoá truy cập: %s',
    (action) => {
      expect(DANGEROUS_ACTIONS.has(action)).toBe(true)
    },
  )

  it.each(['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'ADMIN_LOGIN_SUCCESS', 'SETTING_UPDATED', 'PRODUCT_RESTORED'])(
    'KHÔNG đánh dấu nguy hiểm cho thao tác thường: %s',
    (action) => {
      expect(DANGEROUS_ACTIONS.has(action)).toBe(false)
    },
  )

  it('không đánh dấu khi hành động rỗng/không xác định', () => {
    expect(DANGEROUS_ACTIONS.has('')).toBe(false)
    expect(DANGEROUS_ACTIONS.has(undefined)).toBe(false)
  })
})

describe('nhãn hiển thị', () => {
  // Nếu thiếu nhãn, màn hình rơi về `actionOther` = "(MÃ_KỸ_THUẬT)" — chủ shop
  // không đọc được. Test này khoá lại độ phủ nhãn cho mọi mã đang được dùng.
  it('mọi mã trong DANGEROUS_ACTIONS đều có nhãn tiếng Việt thật', () => {
    const missing = [...DANGEROUS_ACTIONS].filter((code) => !viLocale.auditLog.action[code])
    expect(missing).toEqual([])
  })

  it('mọi mã trong DANGEROUS_ACTIONS đều có nhãn tiếng Anh thật', () => {
    const missing = [...DANGEROUS_ACTIONS].filter((code) => !enLocale.auditLog.action[code])
    expect(missing).toEqual([])
  })

  it('mọi mục trong bộ lọc nhóm quản lý đều có nhãn ở cả 2 ngôn ngữ', () => {
    const codes = RESOURCE_OPTIONS.filter((r) => r !== 'ALL')
    expect(codes.filter((c) => !viLocale.auditLog.module[c])).toEqual([])
    expect(codes.filter((c) => !enLocale.auditLog.module[c])).toEqual([])
  })

  it('mọi mục trong bộ lọc người thực hiện đều có nhãn ở cả 2 ngôn ngữ', () => {
    const codes = ACTOR_OPTIONS.filter((a) => a !== 'ALL')
    expect(codes.filter((c) => !viLocale.auditLog.actorType[c])).toEqual([])
    expect(codes.filter((c) => !enLocale.auditLog.actorType[c])).toEqual([])
  })

  it('xoá mềm danh mục ghi rõ là chuyển vào Thùng rác, không phải "ẩn"', () => {
    // Danh mục có 2 cờ độc lập (Thùng rác và hiển thị) — nhãn cũ "Ẩn danh mục"
    // mô tả nhầm sang thao tác ẩn khỏi web.
    expect(getActionLabel(t, 'CATEGORY_SOFT_DELETED')).toBe('Chuyển danh mục vào Thùng rác')
    expect(getActionLabel(t, 'CATEGORY_SOFT_DELETED')).not.toMatch(/^Ẩn/)
  })

  it('mã hành động lạ rơi về hiển thị nguyên mã trong ngoặc', () => {
    expect(getActionLabel(t, 'SOMETHING_BRAND_NEW')).toBe('Hoạt động khác')
  })

  it('mã hành động lạ vẫn có nhãn dự phòng khi bộ dịch trả lại nguyên khóa', () => {
    const keyReturningT = (key, options = {}) => {
      if (key === 'auditLog.actionOther') return `(${options.code})`
      if (key === 'common.unknown') return 'Không xác định'
      return key
    }
    expect(getActionLabel(keyReturningT, 'SOMETHING_BRAND_NEW')).toBe('Không xác định')
  })

  it('hành động rỗng hiển thị dấu gạch, không phải chuỗi rỗng', () => {
    expect(getActionLabel(t, '')).toBe('—')
    expect(getActionLabel(t, null)).toBe('—')
  })

  it('nhóm quản lý lạ rơi về nhãn an toàn, nhóm rỗng hiển thị "Khác"', () => {
    expect(getModuleLabel(t, 'BRAND_NEW_MODULE')).toBe('Khác')
    expect(getModuleLabel(t, '')).toBe('Khác')
  })

  it('dữ liệu cũ của tính năng đã gỡ vẫn đọc được', () => {
    expect(getModuleLabel(t, 'SERIAL')).toBe('Mã serial (tính năng đã gỡ)')
  })
})

describe('getModuleTone / toBadgeVariant', () => {
  it('trả tone đã khai báo', () => {
    expect(getModuleTone('ORDER')).toBe('info')
    expect(getModuleTone('SITE_SETTING')).toBe('danger')
  })

  it('nhóm chưa khai báo rơi về neutral thay vì undefined', () => {
    expect(getModuleTone('HOME_HIGHLIGHT')).toBe('neutral')
    expect(getModuleTone(undefined)).toBe('neutral')
  })

  it('neutral đổi thành biến thể muted của Badge', () => {
    expect(toBadgeVariant('neutral')).toBe('muted')
    expect(toBadgeVariant('danger')).toBe('danger')
  })
})

describe('getDatePreset', () => {
  it('hôm nay trả về cùng một ngày cho cả 2 đầu', () => {
    const { from, to } = getDatePreset('today')
    expect(from).toBe(to)
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('7 ngày và 30 ngày cho khoảng bắt đầu sớm hơn kết thúc', () => {
    for (const preset of ['7d', '30d', 'month']) {
      const { from, to } = getDatePreset(preset)
      expect(from <= to).toBe(true)
    }
  })

  it('7 ngày bao gồm cả hôm nay (6 ngày trước → hôm nay)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 25))
    expect(getDatePreset('7d')).toEqual({ from: '2026-07-19', to: '2026-07-25' })
    expect(getDatePreset('month')).toEqual({ from: '2026-07-01', to: '2026-07-25' })
    vi.useRealTimers()
  })

  it('preset lạ trả về khoảng rỗng', () => {
    expect(getDatePreset('nope')).toEqual({ from: '', to: '' })
  })
})

describe('tryParse', () => {
  it('trả object khi chuỗi JSON hợp lệ', () => {
    expect(tryParse('{"a":1}')).toEqual({ a: 1 })
  })

  it('trả null khi chuỗi hỏng, không ném lỗi', () => {
    expect(tryParse('{khong-phai-json')).toBeNull()
    expect(tryParse('')).toBeNull()
  })
})

describe('buildCsvRow', () => {
  it('ưu tiên tên người thực hiện, sau đó email, cuối cùng là loại', () => {
    const base = { createdAt: '2026-07-25T03:00:00Z', action: 'PRODUCT_UPDATED', resourceType: 'PRODUCT' }
    expect(buildCsvRow({ ...base, actorDisplayName: 'Minh', actorEmail: 'm@x.vn', actorType: 'ADMIN' }, t)[1]).toBe('Minh')
    expect(buildCsvRow({ ...base, actorEmail: 'm@x.vn', actorType: 'ADMIN' }, t)[1]).toBe('m@x.vn')
    expect(buildCsvRow({ ...base, actorType: 'SYSTEM' }, t)[1]).toBe(t('auditLog.actorType.SYSTEM'))
  })

  it('không để lọt undefined vào ô đối tượng liên quan', () => {
    const row = buildCsvRow({ createdAt: '', action: '', resourceType: '', actorType: '' }, t)
    expect(row.every((cell) => typeof cell === 'string')).toBe(true)
    expect(row.join('')).not.toMatch(/undefined|null|NaN|\[object Object\]/)
  })

  it('dùng mã đối tượng khi có, nếu không thì tên hiển thị', () => {
    const base = { createdAt: '', action: '', resourceType: 'ORDER', actorType: 'ADMIN' }
    expect(buildCsvRow({ ...base, resourceCode: 'DH-001', resourceDisplayName: 'Mũ' }, t)[5]).toBe('DH-001')
    expect(buildCsvRow({ ...base, resourceDisplayName: 'Mũ' }, t)[5]).toBe('Mũ')
  })
})

describe('sanitizeSpreadsheetCell', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@IMPORTDATA("https://example.com")'])(
    'vô hiệu hóa công thức bảng tính bắt đầu bằng %s',
    (value) => {
      expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`)
    },
  )

  it('vô hiệu hóa công thức kể cả khi có khoảng trắng hoặc tab ở đầu', () => {
    expect(sanitizeSpreadsheetCell('  =1+1')).toBe("'  =1+1")
    expect(sanitizeSpreadsheetCell('\t@SUM(A1)')).toBe("'\t@SUM(A1)")
  })

  it('giữ nguyên nội dung thông thường và chuyển giá trị trống thành chuỗi', () => {
    expect(sanitizeSpreadsheetCell('DH-001')).toBe('DH-001')
    expect(sanitizeSpreadsheetCell(null)).toBe('')
  })
})

describe('DANGEROUS_VALUES', () => {
  it('chứa các giá trị trạng thái cần cảnh báo trong bảng so sánh', () => {
    expect(DANGEROUS_VALUES.has('CANCELLED')).toBe(true)
    expect(DANGEROUS_VALUES.has('SUSPENDED')).toBe(true)
    expect(DANGEROUS_VALUES.has('ACTIVE')).toBe(false)
  })
})

describe('INITIAL_QUERY', () => {
  it('mặc định không lọc gì và bắt đầu từ trang 1', () => {
    expect(INITIAL_QUERY).toEqual({
      actorType: 'ALL', resourceType: 'ALL', q: '', from: '', to: '', page: 1, pageSize: 20,
    })
  })

  it('cỡ trang mặc định nằm trong giới hạn máy chủ cho phép (1..100)', () => {
    expect(INITIAL_QUERY.pageSize).toBeGreaterThanOrEqual(1)
    expect(INITIAL_QUERY.pageSize).toBeLessThanOrEqual(100)
  })
})
