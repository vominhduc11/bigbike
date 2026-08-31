import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyIntro, serializeIntro } from '@/lib/categoryIntro'

const confirm = vi.hoisted(() => ({ showConfirm: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => {
      const messages = {
        'products.detail.specs.modeStructured': 'Nhập có cấu trúc',
        'products.detail.specs.modeHtml': 'HTML',
        'categories.detail.introCharacterCount': '{{count}} / {{max}} ký tự',
        'categories.detail.introAdvancedLabel': 'Nội dung HTML',
        'categories.detail.introAdvancedHint': 'Dán HTML trực tiếp vào đây.',
        'categories.detail.introAdvancedPlaceholder': 'Dán nội dung HTML',
        'categories.detail.introAdvancedPreviewLabel': 'Xem trước nội dung',
        'categories.detail.introAdvancedPreviewEmpty': 'Chưa có nội dung để xem trước.',
        'categories.detail.introAiPromptTitle': 'Hướng dẫn tạo HTML',
        'categories.detail.introAiPromptCopy': 'Chép hướng dẫn',
        'categories.detail.introAiPromptCopied': 'Đã chép',
        'categories.detail.introAiPromptCopyFailed': 'Không thể chép',
        'categories.detail.introHeading': 'Tiêu đề',
        'categories.detail.introHeadingPlaceholder': 'Nhập tiêu đề',
        'categories.detail.introEyebrow': 'Nhãn nhỏ',
        'categories.detail.introEyebrowPlaceholder': 'Nhập nhãn nhỏ',
        'categories.detail.introText': 'Đoạn giới thiệu',
        'categories.detail.introBrands': 'Thương hiệu',
        'categories.detail.introSectionFaq': 'Câu hỏi thường gặp',
        'categories.detail.introFaqEmpty': 'Chưa có câu hỏi',
        'categories.detail.introSectionCta': 'Nút liên hệ',
        'categories.detail.introCtaText': 'Dòng chữ mời',
        'categories.detail.introCtaLabel': 'Chữ trên nút',
        'categories.detail.introCtaUrl': 'Liên kết nút bấm',
      }
      return (messages[key] || key).replace(
        /\{\{(\w+)\}\}/g,
        (_match, name) => values[name] ?? `{{${name}}}`,
      )
    },
  }),
}))

vi.mock('../../lib/confirm', () => confirm)
vi.mock('@/components/DeferredRichTextEditor', () => ({
  DeferredRichTextEditor: ({ value, onChange, placeholder, disabled }) => (
    <textarea
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
}))

import { IntroContentField } from './IntroContentField'

const customHtml =
  '<div class="custom-intro"><p>Bảng cỡ mũ</p><table><tbody><tr><th>Cỡ</th></tr><tr><td>M</td></tr></tbody></table><div class="unmanaged">Khối riêng</div></div>'

describe('IntroContentField HTML-first editing', () => {
  beforeEach(() => {
    confirm.showConfirm.mockReset()
  })

  it('opens custom HTML in the HTML tab and keeps the raw table in preview', () => {
    const onChange = vi.fn()
    render(<IntroContentField value={customHtml} onChange={onChange} />)

    expect(screen.getByRole('tab', { name: 'HTML' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('textbox', { name: 'Nội dung HTML' })).toHaveValue(customHtml)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('switches tabs without confirm or writing and patches the existing HTML when a field changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={customHtml} onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Nhập có cấu trúc' }))
    expect(confirm.showConfirm).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText('Nhập tiêu đề'), 'Mũ bảo hiểm')
    expect(onChange).toHaveBeenCalled()
    const patched = onChange.mock.lastCall[0]
    expect(patched).toContain('<table>')
    expect(patched).toContain('Bảng cỡ mũ')
    expect(patched).toContain('Khối riêng')
    expect(patched).toContain('Mũ bảo hiểm')
  })

  it('keeps all six FAQ nodes and their position while patching the heading', async () => {
    const faqs = Array.from(
      { length: 6 },
      (_, index) => `<h3 class="bb-ci-qt">Q${index + 1}</h3><p class="bb-ci-at">A${index + 1}</p>`,
    ).join('')
    const initialHtml = `<div class="bb-cat-intro"><div class="bb-ci-a"><h2 class="bb-ci-h2">Old</h2></div><table><tr><td>Compare</td></tr></table><div class="bb-ci-b">${faqs}</div></div>`
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={initialHtml} onChange={onChange} />)

    await user.type(screen.getByPlaceholderText('Nhập tiêu đề'), 'New')
    const doc = new DOMParser().parseFromString(onChange.mock.lastCall[0], 'text/html')
    const root = doc.querySelector('.bb-cat-intro')
    expect(root.querySelector('table')).not.toBeNull()
    expect(root.querySelectorAll('.bb-ci-qt')).toHaveLength(6)
    expect(root.querySelectorAll('.bb-ci-at')).toHaveLength(6)
    expect(root.querySelector('.bb-ci-qt').textContent).toBe('Q1')
    expect(root.querySelector('.bb-ci-at').textContent).toBe('A1')
  })

  it('shows the dynamic brief only on the HTML tab', async () => {
    const user = userEvent.setup()
    const getAiPrompt = vi.fn().mockResolvedValue('DYNAMIC CATEGORY PROFILE')
    const html = serializeIntro({ ...emptyIntro(), heading: 'Mũ' }, 'vi')
    render(<IntroContentField value={html} onChange={vi.fn()} getAiPrompt={getAiPrompt} />)

    expect(screen.queryByText('Hướng dẫn tạo HTML')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'HTML' }))
    expect(screen.getByText('Hướng dẫn tạo HTML')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chép hướng dẫn' }))
    expect(getAiPrompt).toHaveBeenCalledTimes(1)
  })
})
