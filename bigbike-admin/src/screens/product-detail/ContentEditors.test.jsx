import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => ({
      'products.detail.highlights.modeStructured': 'Structured input',
      'products.detail.highlights.modeHtml': 'Paste HTML',
      'products.detail.highlights.htmlPlaceholder': 'Compose highlights HTML',
      'products.detail.highlights.htmlHint': 'Highlights HTML hint',
      'products.detail.highlights.previewLabel': 'Highlights preview',
      'products.detail.highlights.previewEmpty': 'No highlights preview',
      'products.detail.highlights.prosTitle': 'Pros',
      'products.detail.highlights.consTitle': 'Cons',
      'products.detail.faqs.modeStructured': 'Structured input',
      'products.detail.faqs.modeHtml': 'Paste HTML',
      'products.detail.faqs.htmlPlaceholder': 'Compose FAQ HTML',
      'products.detail.faqs.htmlHint': 'FAQ HTML hint',
      'products.detail.faqs.previewLabel': 'FAQ preview',
      'products.detail.faqs.previewEmpty': 'No FAQ preview',
      'products.detail.faqs.questionPlaceholder': 'Question *',
      'products.detail.faqs.answerPlaceholder': 'Answer *',
      'products.detail.faqs.empty': 'No questions',
    }[key] || key),
  }),
}))

vi.mock('../../components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange, placeholder, disabled }) => (
    <textarea
      data-testid="rich-text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('../../components/AiHtmlBrief', () => ({ default: () => null }))

vi.mock('../../components/Sortable', () => ({
  SortableList: ({ items, renderItem, footer }) => (
    <div>{items.map((item, index) => (
      <div key={item._key || index}>{renderItem(item, { setNodeRef: () => {}, style: {}, handleProps: {} }, index)}</div>
    ))}{footer}</div>
  ),
  DragHandle: ({ disabled, label }) => <button type="button" disabled={disabled} aria-label={label}>Drag</button>,
}))

vi.mock('../../lib/confirm', () => ({ showConfirm: vi.fn() }))

import { FaqEditor, HighlightsEditor, HighlightsHtmlEditor } from './ContentEditors'

function FaqHarness() {
  const [items, setItems] = useState([
    { _key: 'first', question: 'Có kèm Pinlock không?', answer: '<p>Có.</p>', questionEn: 'Does it include Pinlock?', answerEn: '<p>Yes.</p>' },
  ])
  return <FaqEditor items={items} onChange={setItems} validationErrors={{}} />
}

describe('HighlightsEditor structured mode', () => {
  it('dùng ô nhập chữ thường (không phải rich-text editor)', async () => {
    const items = [{ _key: 'p1', content: 'Nhẹ hơn LS2 Storm II 29g', contentEn: '' }]
    const onChange = vi.fn()
    render(<HighlightsEditor items={items} onChange={onChange} placeholder="Pro" addLabel="Add pro" />)

    expect(screen.queryByTestId('rich-text')).not.toBeInTheDocument()
    const input = screen.getByPlaceholderText('Pro')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveValue('Nhẹ hơn LS2 Storm II 29g')
  })
})

// Mô phỏng ProductDetailScreen: 1 công tắc mode dùng chung, chuyển sang "Dán mã HTML" thì
// đổi từ 2 HighlightsEditor (Ưu điểm/Nhược điểm riêng) sang 1 HighlightsHtmlEditor gộp chung.
function HighlightsHarness() {
  const [mode, setMode] = useState('structured')
  const [positive, setPositive] = useState([{ _key: 'p1', content: 'Nhẹ và thoáng.', contentEn: 'Light and airy.' }])
  const [negative, setNegative] = useState([{ _key: 'n1', content: 'Không kèm Pinlock.', contentEn: 'No Pinlock included.' }])
  return (
    <div>
      <button type="button" onClick={() => setMode(mode === 'structured' ? 'html' : 'structured')}>
        Toggle mode
      </button>
      {mode === 'html' ? (
        <HighlightsHtmlEditor
          positiveNotes={positive}
          negativeNotes={negative}
          onChangePositive={setPositive}
          onChangeNegative={setNegative}
        />
      ) : (
        <>
          <HighlightsEditor items={positive} onChange={setPositive} placeholder="Pro" addLabel="Add pro" />
          <HighlightsEditor items={negative} onChange={setNegative} placeholder="Con" addLabel="Add con" />
        </>
      )}
    </div>
  )
}

describe('HighlightsEditor + HighlightsHtmlEditor shared mode', () => {
  it('một công tắc mode gộp cả Ưu điểm và Nhược điểm vào 1 khối mã HTML duy nhất', async () => {
    render(<HighlightsHarness />)
    const user = userEvent.setup()

    expect(screen.getByPlaceholderText('Pro')).toHaveValue('Nhẹ và thoáng.')
    expect(screen.getByPlaceholderText('Con')).toHaveValue('Không kèm Pinlock.')

    await user.click(screen.getByRole('button', { name: 'Toggle mode' }))

    const htmlBox = screen.getByRole('textbox', { name: 'Paste HTML' })
    expect(htmlBox).toHaveValue(
      '<div class="bb-highlights-pros"><h4>Pros</h4><ul class="bb-highlights-list"><li>Nhẹ và thoáng.</li></ul></div>'
      + '<div class="bb-highlights-cons"><h4>Cons</h4><ul class="bb-highlights-list"><li>Không kèm Pinlock.</li></ul></div>',
    )

    // Xem trước phải dựng lại đúng thẻ màu như web thật (2 heading + 2 mục), không phải đổ chữ thô.
    expect(screen.getByRole('heading', { name: 'Pros' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cons' })).toBeInTheDocument()
    const previewLists = screen.getAllByRole('list')
    expect(previewLists.map((list) => list.textContent)).toEqual(['Nhẹ và thoáng.', 'Không kèm Pinlock.'])

    await user.click(screen.getByRole('button', { name: 'Toggle mode' }))
    expect(screen.getByPlaceholderText('Pro')).toHaveValue('Nhẹ và thoáng.')
    expect(screen.getByPlaceholderText('Con')).toHaveValue('Không kèm Pinlock.')
  })
})

describe('FaqEditor HTML tab', () => {
  it('chuyển qua lại hai tab không mất câu hỏi và câu trả lời', async () => {
    render(<FaqHarness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Paste HTML' }))
    expect(screen.getByRole('textbox', { name: 'Paste HTML' })).toHaveValue(
      '<div class="bb-faqs-list"><div class="bb-faq-item"><h4 class="bb-faq-question">Có kèm Pinlock không?</h4><div class="bb-faq-answer"><p>Có.</p></div></div></div>',
    )

    // Xem trước phải dựng lại accordion đánh số (01, 02…) như web thật, không phải đoạn văn thường.
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('Có kèm Pinlock không?')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Structured input' }))
    expect(screen.getByPlaceholderText('Question *')).toHaveValue('Có kèm Pinlock không?')
    expect(screen.getByTestId('rich-text')).toHaveValue('<p>Có.</p>')
  })
})
