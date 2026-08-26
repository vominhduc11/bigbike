import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => opts?.defaultValue ?? key }),
}))

vi.mock('./MediaPickerModal', () => ({
  MediaPickerModal: ({ onSelect, onClose }) => (
    <div data-testid="media-picker">
      <button type="button" onClick={() => onSelect('/media/test.jpg', { altText: 'Ảnh test' })}>select image</button>
      <button type="button" onClick={onClose}>close picker</button>
    </div>
  ),
}))

const editorRef = vi.hoisted(() => ({ current: null, options: null }))

vi.mock('@tiptap/react', () => ({
  useEditor: (options) => {
    editorRef.options = options
    return editorRef.current
  },
  useEditorState: ({ editor, selector }) => selector({ editor, transactionNumber: 0 }),
  EditorContent: () => <div data-testid="editor-content" />,
}))

import { RichTextEditor } from './RichTextEditor'

function makeEditor({ isDestroyed, allActive = false, view = { dom: document.createElement('div') } }) {
  const chain = {}
  for (const method of [
    'focus', 'undo', 'redo', 'toggleBold', 'toggleItalic', 'toggleUnderline', 'toggleStrike',
    'toggleHeading', 'toggleBulletList', 'toggleOrderedList', 'toggleBlockquote', 'unsetLink',
    'setLink', 'setTextAlign', 'toggleCode', 'setHorizontalRule', 'setColor', 'setBackgroundColor',
    'unsetColor', 'unsetBackgroundColor', 'insertTable', 'addColumnAfter', 'addRowAfter',
    'deleteColumn', 'deleteRow', 'deleteTable', 'setImage',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain.run = vi.fn(() => true)

  return {
    isDestroyed,
    isEmpty: false,
    getHTML: vi.fn(() => '<p>cũ</p>'),
    getText: vi.fn(() => 'cũ'),
    getAttributes: vi.fn((name) => (allActive && name === 'link' ? { href: 'https://example.com' } : {})),
    isActive: vi.fn(() => allActive),
    can: vi.fn(() => ({ undo: () => true, redo: () => true })),
    storage: {},
    setEditable: vi.fn(),
    commands: { setContent: vi.fn() },
    chain: vi.fn(() => chain),
    view,
    chainState: chain,
  }
}

describe('RichTextEditor', () => {
  beforeEach(() => {
    editorRef.current = null
    editorRef.options = null
  })

  it('không tạo editor ngay trong lúc render (tránh bị huỷ trước khi mount)', () => {
    render(<RichTextEditor value="<p>a</p>" />)
    expect(editorRef.options.immediatelyRender).toBe(false)
  })

  it('giữ khung tải khi editor chưa sẵn sàng', () => {
    render(<RichTextEditor value="<p>a</p>" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  // Hồi quy: editor bị huỷ trước khi effect chạy (màn hình nặng, commit trễ hơn
  // 1ms của @tiptap/react) — getHTML() lúc đó throw "reading 'cached'" và sập cả trang.
  it('không đụng vào editor đã bị huỷ', () => {
    editorRef.current = makeEditor({ isDestroyed: true })
    const { rerender } = render(<RichTextEditor value="<p>a</p>" />)
    expect(() => rerender(<RichTextEditor value="<p>b</p>" />)).not.toThrow()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('editor-content')).not.toBeInTheDocument()
    expect(editorRef.current.getHTML).not.toHaveBeenCalled()
    expect(editorRef.current.setEditable).not.toHaveBeenCalled()
    expect(editorRef.current.commands.setContent).not.toHaveBeenCalled()
  })

  it('đồng bộ nội dung từ ngoài khi editor còn sống', () => {
    editorRef.current = makeEditor({ isDestroyed: false })
    render(<RichTextEditor value="<p>mới</p>" />)
    expect(editorRef.current.getHTML).toHaveBeenCalled()
    expect(editorRef.current.commands.setContent).toHaveBeenCalledWith('<p>mới</p>', { emitUpdate: false })
  })

  it('giữ nguyên lệnh toolbar khi editor còn sống', () => {
    editorRef.current = makeEditor({ isDestroyed: false })
    render(<RichTextEditor value="<p>a</p>" />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'richEditor.bold' }))

    expect(editorRef.current.chain).toHaveBeenCalledTimes(1)
    expect(editorRef.current.chainState.toggleBold).toHaveBeenCalledTimes(1)
    expect(editorRef.current.chainState.run).toHaveBeenCalledTimes(1)
  })

  it('mọi callback UI đều no-op an toàn nếu editor chết sau khi đã render', () => {
    editorRef.current = makeEditor({ isDestroyed: false, allActive: true })
    render(<RichTextEditor value="<p>a</p>" enableImagePicker />)
    const editor = editorRef.current
    editor.chain.mockImplementation(() => { throw new Error('Không được gọi chain trên editor đã huỷ') })
    editor.isDestroyed = true

    const toolbarButtons = [
      'richEditor.undo', 'richEditor.redo', 'richEditor.bold', 'richEditor.italic',
      'richEditor.underline', 'richEditor.strike', 'richEditor.h2', 'richEditor.h3',
      'richEditor.bulletList', 'richEditor.orderedList', 'richEditor.quote', 'richEditor.link',
      'richEditor.unlink', 'richEditor.image', 'Căn trái', 'Căn giữa', 'Căn phải',
    ]
    expect(() => toolbarButtons.forEach((name) => {
      fireEvent.mouseDown(screen.getByRole('button', { name }))
    })).not.toThrow()
    expect(screen.queryByTestId('media-picker')).not.toBeInTheDocument()

    const more = screen.getByRole('button', { name: 'Thêm' })
    const menuItems = [
      'richEditor.code', 'richEditor.hr', 'Xoá màu', 'Chèn bảng', 'Thêm cột', 'Thêm dòng',
      'Xoá cột', 'Xoá dòng', 'Xoá bảng',
    ]
    expect(() => menuItems.forEach((name) => {
      fireEvent.pointerDown(more)
      fireEvent.click(more)
      fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(name) }))
    })).not.toThrow()

    fireEvent.pointerDown(more)
    fireEvent.click(more)
    fireEvent.change(screen.getByLabelText('Màu chữ'), { target: { value: '#123456' } })
    fireEvent.change(screen.getByLabelText('Tô nền chữ'), { target: { value: '#654321' } })
    expect(screen.queryByTestId('media-picker')).not.toBeInTheDocument()
  }, 15_000)

  it('callback của media và hộp liên kết không chạm editor sau khi editor bị huỷ', () => {
    const editor = makeEditor({ isDestroyed: false, allActive: true })
    editorRef.current = editor
    const { rerender } = render(<RichTextEditor value="<p>a</p>" enableImagePicker />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'richEditor.image' }))
    expect(screen.getByTestId('media-picker')).toBeInTheDocument()
    editor.isDestroyed = true

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'select image' }))).not.toThrow()
    expect(editor.chain).not.toHaveBeenCalled()

    editor.isDestroyed = false
    rerender(<RichTextEditor value="<p>a</p>" enableImagePicker />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'richEditor.link' }))
    expect(screen.getByRole('button', { name: 'richEditor.apply' })).toBeInTheDocument()
    editor.isDestroyed = true

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'richEditor.apply' }))).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))).not.toThrow()
    expect(editor.chain).not.toHaveBeenCalled()
  })

  it('bỏ qua onUpdate đến muộn và view chưa mount mà không làm throw', () => {
    const onChange = vi.fn()
    const editor = makeEditor({ isDestroyed: false })
    editorRef.current = editor
    render(<RichTextEditor value="<p>a</p>" onChange={onChange} hasError />)
    editor.getHTML.mockClear()
    editor.getText.mockClear()
    editor.isDestroyed = true

    expect(() => editorRef.options.onUpdate({ editor })).not.toThrow()
    expect(onChange).not.toHaveBeenCalled()
    expect(editor.getHTML).not.toHaveBeenCalled()
    expect(editor.getText).not.toHaveBeenCalled()

    editorRef.current = makeEditor({
      isDestroyed: false,
      view: {
        get dom() {
          throw new Error('editor view not mounted yet')
        },
      },
    })
    expect(() => render(<RichTextEditor value="<p>b</p>" hasError />)).not.toThrow()
  })
})
