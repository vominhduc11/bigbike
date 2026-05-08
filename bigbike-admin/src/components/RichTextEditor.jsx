import { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Code, Heading2, Heading3, Image, Italic, Link, Link2Off, List, ListOrdered,
  Minus, Quote, Redo, Strikethrough, Underline, Undo,
} from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30,
        borderRadius: 'var(--admin-radius-xs)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--admin-color-brand-red-subtle)' : 'transparent',
        color: active
          ? 'var(--admin-color-brand-red)'
          : disabled ? 'var(--admin-color-text-placeholder)' : 'var(--admin-color-text-secondary)',
        transition: 'var(--admin-transition-fast)',
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = 'var(--admin-color-surface-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--admin-color-brand-red-subtle)' : 'transparent' }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span style={{
      display: 'inline-block', width: 1, height: 18,
      background: 'var(--admin-color-border-default)',
      margin: '0 4px',
      flexShrink: 0,
    }} />
  )
}

export function RichTextEditor({ value, onChange, placeholder, disabled, hasError, enableImagePicker = false }) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [linkModal, setLinkModal] = useState({ open: false, value: '' })
  const linkInputRef = useCallback((el) => { if (el) el.focus() }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { languageClassPrefix: 'language-' },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      ImageExt.configure({
        HTMLAttributes: { class: 'rte-image' },
      }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange?.(html)
    },
  })

  const handleLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href || ''
    setLinkModal({ open: true, value: prev })
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return
    const url = linkModal.value.trim()
    if (url === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setLinkModal({ open: false, value: '' })
  }, [editor, linkModal.value])

  const cancelLink = useCallback(() => {
    setLinkModal({ open: false, value: '' })
    editor?.chain().focus().run()
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) return null

  const btn = (action, isActive, title, icon, disabledOverride) => (
    <ToolbarButton
      onClick={action}
      active={isActive}
      disabled={disabled || disabledOverride}
      title={title}
    >
      {icon}
    </ToolbarButton>
  )

  return (
    <div style={{
      border: `1.5px solid ${hasError ? 'var(--admin-color-status-danger-border)' : 'var(--admin-color-border-default)'}`,
      borderRadius: 'var(--admin-radius-md)',
      background: disabled ? 'var(--admin-color-surface-muted)' : 'var(--admin-color-surface-base)',
      overflow: 'hidden',
      transition: 'border-color var(--admin-transition-fast)',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
        padding: '6px 10px',
        borderBottom: '1px solid var(--admin-color-border-subtle)',
        background: 'var(--admin-color-surface-muted)',
      }}>
        {btn(() => editor.chain().focus().undo().run(), false, 'Hoàn tác (Ctrl+Z)', <Undo size={14} />, !editor.can().undo())}
        {btn(() => editor.chain().focus().redo().run(), false, 'Làm lại (Ctrl+Y)', <Redo size={14} />, !editor.can().redo())}
        <Divider />
        {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Đậm (Ctrl+B)', <Bold size={14} />)}
        {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Nghiêng (Ctrl+I)', <Italic size={14} />)}
        {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Gạch chân (Ctrl+U)', <Underline size={14} />)}
        {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), 'Gạch ngang', <Strikethrough size={14} />)}
        {btn(() => editor.chain().focus().toggleCode().run(), editor.isActive('code'), 'Code inline', <Code size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Tiêu đề H2', <Heading2 size={14} />)}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Tiêu đề H3', <Heading3 size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Danh sách chấm', <List size={14} />)}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Danh sách số', <ListOrdered size={14} />)}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Trích dẫn', <Quote size={14} />)}
        {btn(() => editor.chain().focus().setHorizontalRule().run(), false, 'Đường kẻ ngang', <Minus size={14} />)}
        <Divider />
        {btn(handleLink, editor.isActive('link'), 'Chèn liên kết', <Link size={14} />)}
        {editor.isActive('link') && btn(() => editor.chain().focus().unsetLink().run(), false, 'Xoá liên kết', <Link2Off size={14} />)}
        {enableImagePicker && (
          <>
            <Divider />
            {btn(() => setImagePickerOpen(true), false, 'Chèn ảnh từ thư viện', <Image size={14} />)}
          </>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="rich-editor-content"
        style={{ minHeight: 240 }}
      />

      {imagePickerOpen && (
        <MediaPickerModal
          onSelect={(url) => {
            editor.chain().focus().setImage({ src: url }).run()
            setImagePickerOpen(false)
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      )}

      {/* Link modal */}
      {linkModal.open && (
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--admin-color-border-subtle)',
          background: 'var(--admin-color-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <label style={{ fontSize: 'var(--admin-text-xs)', color: 'var(--admin-color-text-muted)', whiteSpace: 'nowrap' }}>
            URL:
          </label>
          <input
            ref={linkInputRef}
            type="url"
            className="control-input"
            style={{ flex: 1, fontSize: 'var(--admin-text-xs)', padding: '4px 8px' }}
            placeholder="https://..."
            value={linkModal.value}
            onChange={(e) => setLinkModal((m) => ({ ...m, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') cancelLink()
            }}
          />
          <button type="button" className="btn btn-primary" style={{ fontSize: 'var(--admin-text-xs)', padding: '4px 10px' }} onClick={applyLink}>
            Áp dụng
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 'var(--admin-text-xs)', padding: '4px 10px' }} onClick={cancelLink}>
            Huỷ
          </button>
        </div>
      )}

      {/* Character count */}
      <div style={{
        padding: '4px 12px',
        borderTop: '1px solid var(--admin-color-border-subtle)',
        fontSize: 'var(--admin-text-xs)',
        color: 'var(--admin-color-text-muted)',
        textAlign: 'right',
        background: 'var(--admin-color-surface-muted)',
      }}>
        {editor.storage.characterCount?.characters?.() ?? editor.getText().length} ký tự
      </div>
    </div>
  )
}
