import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => ({
      'products.detail.highlights.modeStructured': 'Structured input',
      'products.detail.highlights.modeHtml': 'Paste HTML',
      'products.detail.highlights.htmlPlaceholder': 'Compose highlights HTML',
      'products.detail.highlights.htmlHint': 'Highlights HTML hint',
      'products.detail.highlights.previewLabel': 'Highlights preview',
      'products.detail.highlights.previewEmpty': 'No highlights preview',
      'products.detail.highlights.prosTitle': 'Pros',
      'products.detail.highlights.consTitle': 'Cons',
      'products.detail.htmlImport.read': 'Read {{count}} item(s).',
      'products.detail.htmlImport.readWithSkipped': 'Read {{count}} item(s); skipped {{skipped}} part(s).',
      'products.detail.htmlImport.unreadable': 'Could not read the pasted content — existing content was kept.',
      'products.detail.htmlImport.empty': 'The new content is empty — existing content was kept.',
      'products.detail.htmlImport.pending': 'The new content has not been accepted yet; click the button below before saving.',
      'products.detail.htmlImport.apply': 'Apply new content',
      'products.detail.htmlImport.useRaw': 'Use this as custom HTML',
      'products.detail.htmlImport.confirmTitle': 'Apply new HTML content?',
      'products.detail.htmlImport.confirmMessage': 'Read {{count}} and skipped {{skipped}}.',
      'products.detail.htmlImport.confirmApply': 'Apply and save',
      'products.detail.htmlImport.confirmCancel': 'Keep existing',
      'products.detail.htmlImport.arraySource': 'This block is stored as individual items.',
      'products.detail.faqs.modeStructured': 'Structured input',
      'products.detail.faqs.modeHtml': 'Paste HTML',
      'products.detail.faqs.htmlPlaceholder': 'Compose FAQ HTML',
      'products.detail.faqs.htmlHint': 'FAQ HTML hint',
      'products.detail.faqs.previewLabel': 'FAQ preview',
      'products.detail.faqs.previewEmpty': 'No FAQ preview',
      'products.detail.faqs.questionPlaceholder': 'Question *',
      'products.detail.faqs.answerPlaceholder': 'Answer *',
      'products.detail.faqs.empty': 'No questions',
      'products.detail.video.fromLibrary': 'Upload / media library',
      'products.detail.video.pickFromLibrary': 'Pick from library',
      'products.detail.video.legacySourceWarning': 'Legacy source must be replaced',
      'products.detail.video.addVideo': 'Add video',
      'products.detail.video.removeVideo': 'Remove video',
      'products.detail.video.titlePlaceholder': 'Video title',
      'products.detail.video.descriptionPlaceholder': 'Video description',
      'products.detail.video.urlLabel': 'Video link',
      'products.detail.video.titleLabel': 'Video title',
      'products.detail.video.descriptionLabel': 'Video description',
      'products.detail.gallery.videoUpload': 'Upload / media library',
      'products.detail.gallery.legacySourceWarning': 'Legacy gallery source must be replaced',
    }[key] || key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? `{{${name}}}`)),
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
vi.mock('../../components/MediaPickerModal', () => ({ MediaPickerModal: () => null }))
vi.mock('../../components/VideoPickerModal', () => ({
  VideoPickerModal: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect('/media/videos/library.mp4', { title: 'Library video' })}>
      Select library video
    </button>
  ),
}))

vi.mock('../../components/Sortable', () => ({
  SortableList: ({ items, renderItem, footer }) => (
    <div>{items.map((item, index) => (
      <div key={item._key || index}>{renderItem(item, { setNodeRef: () => {}, style: {}, handleProps: {} }, index)}</div>
    ))}{footer}</div>
  ),
  DragHandle: ({ disabled, label }) => <button type="button" disabled={disabled} aria-label={label}>Drag</button>,
}))

vi.mock('../../lib/confirm', () => ({ showConfirm: vi.fn() }))

import { FaqEditor, GalleryEditor, HighlightsEditor, HighlightsHtmlEditor, VideoEditor } from './ContentEditors'
import { showConfirm } from '../../lib/confirm'

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

  it('dán HTML thông thường không xoá FAQ cũ trước khi nhận nội dung', async () => {
    const onChange = vi.fn()
    render(
      <FaqEditor
        items={[{ _key: 'old', question: 'Câu hỏi cũ', answer: '<p>Đáp án cũ</p>' }]}
        onChange={onChange}
        validationErrors={{}}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Paste HTML' }))
    const htmlBox = screen.getByRole('textbox', { name: 'Paste HTML' })
    fireEvent.change(htmlBox, { target: { value: '<h3>Câu hỏi mới?</h3><p>Đáp án mới.</p>' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('The new content has not been accepted yet; click the button below before saving.')).toBeInTheDocument()
    expect(screen.getByText('Read 1 item(s).')).toBeInTheDocument()
  })

  it('chỉ ghi FAQ sau khi bấm nhận và xác nhận', async () => {
    vi.mocked(showConfirm).mockResolvedValueOnce(true)
    const onChange = vi.fn()
    render(
      <FaqEditor
        items={[{ _key: 'old', question: 'Câu hỏi cũ', answer: '<p>Đáp án cũ</p>' }]}
        onChange={onChange}
        validationErrors={{}}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Paste HTML' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Paste HTML' }), { target: { value: '<h3>Câu hỏi mới?</h3><p>Đáp án mới.</p>' } })
    await user.click(screen.getByRole('button', { name: 'Apply new content' }))

    expect(showConfirm).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ question: 'Câu hỏi mới?', answer: '<p>Đáp án mới.</p>' }),
    ]))
  })
})

describe('HighlightsHtmlEditor data safety', () => {
  it('ký tự đầu tiên hoặc HTML không đọc được không làm mất hai nhóm cũ', async () => {
    const onChangePositive = vi.fn()
    const onChangeNegative = vi.fn()
    render(
      <HighlightsHtmlEditor
        positiveNotes={[{ _key: 'p', content: 'Ưu điểm cũ', contentEn: '' }]}
        negativeNotes={[{ _key: 'n', content: 'Nhược điểm cũ', contentEn: '' }]}
        onChangePositive={onChangePositive}
        onChangeNegative={onChangeNegative}
      />,
    )
    const htmlBox = screen.getByRole('textbox', { name: 'Paste HTML' })
    fireEvent.change(htmlBox, { target: { value: '<div>không theo mẫu</div>' } })

    expect(onChangePositive).not.toHaveBeenCalled()
    expect(onChangeNegative).not.toHaveBeenCalled()
    expect(screen.getByText('Could not read the pasted content — existing content was kept.')).toBeInTheDocument()
  })
})

describe('Video editors only expose writable sources', () => {
  it('video sản phẩm chỉ có YouTube và Upload / media library, đồng thời chọn được video thư viện', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [items, setItems] = useState([
        { _key: 'video-1', url: '', title: '', description: '', type: 'youtube', thumbnailUrl: '' },
      ])
      return <VideoEditor items={items} onChange={setItems} validationErrors={{}} />
    }

    render(<Harness />)
    expect(screen.getByRole('button', { name: 'YouTube' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload / media library' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /TikTok/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Facebook/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Upload / media library' }))
    await user.click(screen.getByRole('button', { name: 'Pick from library' }))
    await user.click(screen.getByRole('button', { name: 'Select library video' }))

    expect(screen.getByText('library.mp4')).toBeInTheDocument()
  })

  it('video sản phẩm và gallery legacy hiện cảnh báo nhưng không hiện lựa chọn legacy', () => {
    const { rerender } = render(
      <VideoEditor
        items={[{ _key: 'legacy', url: 'https://www.tiktok.com/@x/video/1234567890123456789', type: '' }]}
        onChange={() => {}}
        validationErrors={{ 'videos.0.url': 'Source must be replaced' }}
      />,
    )
    expect(screen.getByText('Legacy source must be replaced')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /TikTok/i })).not.toBeInTheDocument()

    rerender(
      <GalleryEditor
        items={[{
          _key: 'legacy-gallery',
          mediaType: 'video',
          provider: '',
          videoUrl: 'https://www.facebook.com/x/videos/123',
          url: '',
          alt: '',
        }]}
        onChange={() => {}}
        validationErrors={{ 'gallery.0.videoUrl': 'Source must be replaced' }}
      />,
    )
    expect(screen.getByText('Legacy gallery source must be replaced')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Facebook/i })).not.toBeInTheDocument()
  })
})
