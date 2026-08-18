import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyIntro, serializeIntro } from '@/lib/categoryIntro'

const confirm = vi.hoisted(() => ({ showConfirm: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => {
      const messages = {
        'products.detail.specs.modeStructured': 'Nhập có cấu trúc',
        'products.detail.specs.modeHtml': 'Nhập nội dung nâng cao',
        'categories.detail.introCharacterCount': '{{count}} / {{max}} ký tự',
        'categories.detail.introAdvancedLabel': 'Nội dung HTML nâng cao',
        'categories.detail.introAdvancedHint': 'Dán HTML trực tiếp vào đây.',
        'categories.detail.introAdvancedPlaceholder': 'Dán nội dung HTML',
        'categories.detail.introAdvancedPreviewLabel': 'Xem trước nội dung',
        'categories.detail.introAdvancedPreviewEmpty': 'Chưa có nội dung để xem trước.',
        'categories.detail.introAiPromptTitle': 'Câu lệnh cho ChatGPT / Claude',
        'categories.detail.introAiPromptCopy': 'Chép câu lệnh',
        'categories.detail.introAiPromptCopied': 'Đã chép câu lệnh vào bộ nhớ tạm.',
        'categories.detail.introAiPromptCopyFailed': 'Không thể chép câu lệnh.',
        'categories.detail.introAiPasteLabel': 'Dán kết quả từ AI',
        'categories.detail.introAiPasteHint': 'Dán khuôn nhãn hoặc JSON.',
        'categories.detail.introAiPastePlaceholder': 'TIÊU ĐỀ: …',
        'categories.detail.introAiPasteReview': 'Đọc và xem trước',
        'categories.detail.introAiPasteEmpty': 'Chưa đọc được nội dung có cấu trúc.',
        'categories.detail.introAiReviewTitle': 'Đối chiếu nội dung từ AI',
        'categories.detail.introAiReviewDescription': 'Kiểm tra trước khi điền.',
        'categories.detail.introAiReviewReceived': 'Nhận được',
        'categories.detail.introAiReviewPreserved': 'Giữ nguyên',
        'categories.detail.introAiReviewIgnored': 'Bỏ qua',
        'categories.detail.introAiReviewBrands': '{{count}} thương hiệu',
        'categories.detail.introAiReviewFaqs': '{{count}} câu hỏi',
        'categories.detail.introAiReviewNone': 'Không có',
        'categories.detail.introAiReviewTooLong': 'Một số phần vượt giới hạn.',
        'categories.detail.introAiReviewConfirm': 'Xác nhận và điền',
        'categories.detail.introAiReviewCancel': 'Huỷ',
        'categories.detail.introAiIgnoredPreamble': 'Lời dẫn ngoài khuôn',
        'categories.detail.introAiIgnoredHtml': 'HTML ngoài danh sách',
        'categories.detail.introAiIgnoredIncompleteFaq': 'FAQ thiếu dữ liệu',
        'categories.detail.introAiIgnoredUnknown': 'Phần không nhận diện: {{label}}',
        'categories.detail.introAiIgnoredJson': 'Trường JSON không dùng: {{label}}',
        'categories.detail.introAiTooLong': '{{field}} vượt quá {{max}} ký tự',
        'categories.detail.introHeading': 'Tiêu đề',
        'categories.detail.introEyebrow': 'Nhãn nhỏ',
        'categories.detail.introText': 'Đoạn giới thiệu',
        'categories.detail.introBrands': 'Thương hiệu',
        'categories.detail.introSectionFaq': 'Câu hỏi thường gặp',
        'categories.detail.introAdvancedSwitchTitle': 'Chuyển sang nhập có cấu trúc?',
        'categories.detail.introAdvancedSwitchConfirm': 'Phần trình bày riêng sẽ bị mất.',
        'categories.detail.introAdvancedSwitchContinue': 'Tiếp tục',
        'categories.detail.introAdvancedSwitchCancel': 'Ở lại nhập nâng cao',
      }
      return (messages[key] || key).replace(/\{\{(\w+)\}\}/g, (_match, name) => values[name] ?? `{{${name}}}`)
    },
  }),
}))

vi.mock('../../lib/confirm', () => confirm)
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange, placeholder, disabled }) => (
    <textarea
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
}))

import { IntroContentField } from './IntroContentField'

const customHtml = '<div class="custom-intro"><p>Bảng cỡ mũ</p><table><tbody><tr><th>Cỡ</th></tr><tr><td>M</td></tr></tbody></table></div>'

describe('IntroContentField input modes', () => {
  beforeEach(() => {
    confirm.showConfirm.mockReset()
  })

  it('opens custom HTML in advanced mode and keeps the raw table in preview', () => {
    const onChange = vi.fn()
    render(<IntroContentField value={customHtml} onChange={onChange} />)

    expect(screen.getByRole('tab', { name: 'Nhập nội dung nâng cao' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('textbox', { name: 'Nội dung HTML nâng cao' })).toHaveValue(customHtml)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText(`${customHtml.length} / 50.000 ký tự`)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the advanced tab when the warning is cancelled', async () => {
    confirm.showConfirm.mockResolvedValueOnce(false)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={customHtml} onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Nhập có cấu trúc' }))

    expect(confirm.showConfirm).toHaveBeenCalledWith(
      'Phần trình bày riêng sẽ bị mất.',
      'Chuyển sang nhập có cấu trúc?',
      expect.objectContaining({ variant: 'default' }),
    )
    expect(screen.getByRole('tab', { name: 'Nhập nội dung nâng cao' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('textbox', { name: 'Nội dung HTML nâng cao' })).toHaveValue(customHtml)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not overwrite custom HTML until a structured field is edited', async () => {
    confirm.showConfirm.mockResolvedValueOnce(true)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={customHtml} onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Nhập có cấu trúc' }))
    expect(onChange).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText('categories.detail.introHeadingPlaceholder'), 'Tiêu đề')

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.lastCall[0]).not.toContain('<table>')
  })

  it('opens generated category content in structured mode and switches tabs without writing', async () => {
    const structuredHtml = serializeIntro({ ...emptyIntro(), heading: 'Mũ bảo hiểm' }, 'vi')
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={structuredHtml} onChange={onChange} />)

    expect(screen.getByRole('tab', { name: 'Nhập có cấu trúc' })).toHaveAttribute('data-state', 'active')
    await user.click(screen.getByRole('tab', { name: 'Nhập nội dung nâng cao' }))
    await user.click(screen.getByRole('tab', { name: 'Nhập có cấu trúc' }))

    expect(confirm.showConfirm).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('categories.detail.introHeadingPlaceholder')).toHaveValue('Mũ bảo hiểm')
  })

  it('uses the same two modes and counter for English content', () => {
    const onChange = vi.fn()
    render(<IntroContentField value={customHtml} onChange={onChange} lang="en" />)

    expect(screen.getByRole('tab', { name: 'Nhập có cấu trúc' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nhập nội dung nâng cao' })).toBeInTheDocument()
  })

  it('shows a comparison before writing AI content into the form', async () => {
    const initialHtml = serializeIntro({ ...emptyIntro(), heading: 'Tiêu đề cũ' }, 'vi')
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<IntroContentField value={initialHtml} onChange={onChange} categoryName="Mũ bảo hiểm" />)

    const paste = screen.getByLabelText('Dán kết quả từ AI')
    fireEvent.change(paste, { target: { value: 'TIÊU ĐỀ: Tiêu đề mới\nTHƯƠNG HIỆU: AGV, LS2\nHỎI: Chọn loại nào?\nĐÁP: Chọn theo nhu cầu.' } })
    await user.click(screen.getByRole('button', { name: 'Đọc và xem trước' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Nhận được')).toBeInTheDocument()
    expect(screen.getByText('2 thương hiệu')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Xác nhận và điền' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.lastCall[0]).toContain('Tiêu đề mới')
    expect(onChange.mock.lastCall[0]).toContain('AGV')
    expect(onChange.mock.lastCall[0]).toContain('Chọn loại nào?')
  })
})
