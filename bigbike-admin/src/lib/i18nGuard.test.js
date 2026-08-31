import { analyzeI18n } from './i18nGuard'
import { describe, expect, it } from 'vitest'

function check({ vi, en, code }) {
  return analyzeI18n({
    vi,
    en,
    sourceFiles: [{ path: 'fixture.jsx', code }],
  })
}

describe('i18n guard', () => {
  it('catches locale parity gaps', () => {
    const result = check({
      vi: { common: { save: 'Lưu', onlyVi: 'Chỉ tiếng Việt' } },
      en: { common: { save: 'Save' } },
      code: "const View = () => <span>{t('common.save')}</span>",
    })

    expect(result.errors).toContainEqual({ type: 'locale-missing-in-en', key: 'common.onlyVi' })
  })

  it('catches a static screen key missing from either locale', () => {
    const result = check({
      vi: { common: { save: 'Lưu' } },
      en: { common: { save: 'Save' } },
      code: "const View = () => <span>{t('common.notAdded')}</span>",
    })

    expect(
      result.errors.some(
        (item) => item.type === 'source-key-missing-in-vi' && item.key === 'common.notAdded',
      ),
    ).toBe(true)
    expect(
      result.errors.some(
        (item) => item.type === 'source-key-missing-in-en' && item.key === 'common.notAdded',
      ),
    ).toBe(true)
  })

  it('checks dynamic key patterns against both locales', () => {
    const passing = check({
      vi: { common: { tableDensity: { compact: 'Gọn', regular: 'Vừa' } } },
      en: { common: { tableDensity: { compact: 'Compact', regular: 'Regular' } } },
      code: 'const View = ({ value }) => <span>{t(`common.tableDensity.${value}`)}</span>',
    })
    expect(passing.errors).toHaveLength(0)

    const failing = check({
      vi: { common: { tableDensity: { compact: 'Gọn' } } },
      en: { common: { tableDensity: { compact: 'Compact' } } },
      code: 'const View = ({ value }) => <span>{t(`common.missingGroup.${value}`)}</span>',
    })
    expect(failing.errors.some((item) => item.type === 'source-key-missing-in-vi')).toBe(true)
  })

  it('checks t and i18n.t calls and rejects raw runtime-code fallbacks', () => {
    const result = check({
      vi: { common: { unknown: 'Không xác định' }, status: { order: { PAID: 'Đã thanh toán' } } },
      en: { common: { unknown: 'Unknown' }, status: { order: { PAID: 'Paid' } } },
      code: "const View = ({ status }) => <span>{t(`status.order.${status}`, { defaultValue: status })}{i18n.t('common.unknown')}</span>",
    })

    expect(result.stats.callCount).toBe(2)
    expect(result.errors.some((item) => item.type === 'raw-runtime-fallback')).toBe(true)

    const secondArgumentResult = check({
      vi: { common: { unknown: 'Không xác định' }, status: { order: { PAID: 'Đã thanh toán' } } },
      en: { common: { unknown: 'Unknown' }, status: { order: { PAID: 'Paid' } } },
      code: 'const View = ({ status }) => <span>{t(`status.order.${status}`, status)}</span>',
    })

    expect(secondArgumentResult.errors.some((item) => item.type === 'raw-runtime-fallback')).toBe(
      true,
    )
  })
})
