import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import LinkExt from '@tiptap/extension-link'
import UnderlineExt from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, Color, BackgroundColor } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, Code, Heading2, Heading3, Highlighter, Image,
  Italic, Link, Link2Off, List, ListOrdered, Minus, Quote, Redo, Strikethrough, Table as TableIcon,
  Underline, Undo,
} from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-xs border-none transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : disabled
            ? 'cursor-not-allowed text-muted-foreground/50'
            : 'cursor-pointer text-muted-foreground hover:bg-surface-hover'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span className="inline-block w-px h-5 bg-border mx-1 shrink-0" />
  )
}

export function RichTextEditor({ value, onChange, placeholder, disabled, hasError, enableImagePicker = false }) {
  const { t } = useTranslation()
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [linkModal, setLinkModal] = useState({ open: false, value: '' })
  const linkInputRef = useCallback((el) => { if (el) el.focus() }, [])

  // Chỉ coi là "user sửa" sau khi editor thực sự được focus. TipTap (v3) phát onUpdate
  // ngay khi parse/chuẩn hoá nội dung lúc mount — nếu HTML lưu khác chuỗi serialize chuẩn,
  // onUpdate này tạo "thay đổi" ma khiến form Cài đặt báo "chưa lưu" giả khi vừa mở tab.
  // Mọi thao tác qua toolbar đều gọi .focus() trước nên cờ này bật đúng lúc người dùng sửa.
  const userEditedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { languageClassPrefix: 'language-' },
      }),
      UnderlineExt,
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      ImageExt.configure({
        HTMLAttributes: { class: 'rte-image' },
      }),
      // Căn lề (áp cho heading + đoạn văn) + màu chữ/tô nền (TextStyle + Color/BackgroundColor,
      // xuất inline-style nên web render được khi bật allowInlineStyles) + bảng (TableKit).
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      BackgroundColor,
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: value || '',
    editable: !disabled,
    // Khi paste từ Word: gỡ background-color (highlight Word) và thuộc tính mso-* (Word-specific)
    // khỏi inline style trước khi TipTap parse — giữ lại color, font-weight và các style hợp lệ khác.
    editorProps: {
      transformPastedHTML(html) {
        const div = document.createElement('div')
        div.innerHTML = html
        div.querySelectorAll('[style]').forEach((el) => {
          const cleaned = el.getAttribute('style')
            .split(';')
            .filter((rule) => {
              const prop = (rule.split(':')[0] || '').trim().toLowerCase()
              if (!prop) return false
              if (prop.startsWith('mso-')) return false
              if (prop === 'background-color' || prop === 'background') return false
              return true
            })
            .join(';')
          if (cleaned.trim()) el.setAttribute('style', cleaned)
          else el.removeAttribute('style')
        })
        return div.innerHTML
      },
    },
    onFocus: () => { userEditedRef.current = true },
    onUpdate: ({ editor }) => {
      if (!userEditedRef.current) return
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange?.(html)
    },
  })

  // TipTap v3: useEditor KHÔNG re-render React mỗi khi con trỏ/định dạng đổi (khác v2). Nội dung
  // do ProseMirror vẽ thẳng nên vẫn thấy đổi, nhưng `editor.isActive(...)` tính lúc render sẽ
  // "đứng hình" → nút toolbar không sáng. useEditorState subscribe state, render lại khi các cờ đổi.
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null
      return {
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isUnderline: editor.isActive('underline'),
        isStrike: editor.isActive('strike'),
        isCode: editor.isActive('code'),
        isH2: editor.isActive('heading', { level: 2 }),
        isH3: editor.isActive('heading', { level: 3 }),
        isBulletList: editor.isActive('bulletList'),
        isOrderedList: editor.isActive('orderedList'),
        isBlockquote: editor.isActive('blockquote'),
        isLink: editor.isActive('link'),
        alignLeft: editor.isActive({ textAlign: 'left' }),
        alignCenter: editor.isActive({ textAlign: 'center' }),
        alignRight: editor.isActive({ textAlign: 'right' }),
        isTable: editor.isActive('table'),
        color: editor.getAttributes('textStyle').color || '',
        bgColor: editor.getAttributes('textStyle').backgroundColor || '',
        charCount: editor.storage.characterCount?.characters?.() ?? editor.getText().length,
      }
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
      // TipTap v3: tham số thứ 2 là options object. Phải truyền { emitUpdate: false }
      // để đồng bộ value từ ngoài (mount / refetch) KHÔNG bị tính là user sửa —
      // nếu không, mở form rich-text sẽ báo "thay đổi chưa lưu" giả. (v2 nhận false trực tiếp)
      editor.commands.setContent(value || '', { emitUpdate: false })
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
    <div className={cn(
      'rounded-md overflow-hidden transition-colors border-[1.5px]',
      hasError ? 'border-danger-border' : 'border-border',
      disabled ? 'bg-surface-muted' : 'bg-surface'
    )}>
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 py-1.5 px-2.5 border-b border-border bg-surface-muted">
        {btn(() => editor.chain().focus().undo().run(), false, t('richEditor.undo'), <Undo size={14} />, !s?.canUndo)}
        {btn(() => editor.chain().focus().redo().run(), false, t('richEditor.redo'), <Redo size={14} />, !s?.canRedo)}
        <Divider />
        {btn(() => editor.chain().focus().toggleBold().run(), s?.isBold, t('richEditor.bold'), <Bold size={14} />)}
        {btn(() => editor.chain().focus().toggleItalic().run(), s?.isItalic, t('richEditor.italic'), <Italic size={14} />)}
        {btn(() => editor.chain().focus().toggleUnderline().run(), s?.isUnderline, t('richEditor.underline'), <Underline size={14} />)}
        {btn(() => editor.chain().focus().toggleStrike().run(), s?.isStrike, t('richEditor.strike'), <Strikethrough size={14} />)}
        {btn(() => editor.chain().focus().toggleCode().run(), s?.isCode, t('richEditor.code'), <Code size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), s?.isH2, t('richEditor.h2'), <Heading2 size={14} />)}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), s?.isH3, t('richEditor.h3'), <Heading3 size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleBulletList().run(), s?.isBulletList, t('richEditor.bulletList'), <List size={14} />)}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), s?.isOrderedList, t('richEditor.orderedList'), <ListOrdered size={14} />)}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), s?.isBlockquote, t('richEditor.quote'), <Quote size={14} />)}
        {btn(() => editor.chain().focus().setHorizontalRule().run(), false, t('richEditor.hr'), <Minus size={14} />)}
        <Divider />
        {btn(handleLink, s?.isLink, t('richEditor.link'), <Link size={14} />)}
        {s?.isLink && btn(() => editor.chain().focus().unsetLink().run(), false, t('richEditor.unlink'), <Link2Off size={14} />)}
        {enableImagePicker && (
          <>
            <Divider />
            {btn(() => setImagePickerOpen(true), false, t('richEditor.image'), <Image size={14} />)}
          </>
        )}

        {/* Căn lề */}
        <Divider />
        {btn(() => editor.chain().focus().setTextAlign('left').run(), s?.alignLeft, t('richEditor.alignLeft', { defaultValue: 'Căn trái' }), <AlignLeft size={14} />)}
        {btn(() => editor.chain().focus().setTextAlign('center').run(), s?.alignCenter, t('richEditor.alignCenter', { defaultValue: 'Căn giữa' }), <AlignCenter size={14} />)}
        {btn(() => editor.chain().focus().setTextAlign('right').run(), s?.alignRight, t('richEditor.alignRight', { defaultValue: 'Căn phải' }), <AlignRight size={14} />)}

        {/* Màu chữ / tô nền */}
        <Divider />
        <span className="inline-flex h-8 items-center gap-1 px-1" title={t('richEditor.textColor', { defaultValue: 'Màu chữ' })}>
          <Baseline size={14} className="text-muted-foreground" />
          <input
            type="color"
            aria-label={t('richEditor.textColor', { defaultValue: 'Màu chữ' })}
            className="h-[20px] w-[24px] cursor-pointer rounded-xs border border-border bg-transparent p-0"
            value={s?.color || '#111827'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            disabled={disabled}
          />
        </span>
        <span className="inline-flex h-8 items-center gap-1 px-1" title={t('richEditor.bgColor', { defaultValue: 'Tô nền chữ' })}>
          <Highlighter size={14} className="text-muted-foreground" />
          <input
            type="color"
            aria-label={t('richEditor.bgColor', { defaultValue: 'Tô nền chữ' })}
            className="h-[20px] w-[24px] cursor-pointer rounded-xs border border-border bg-transparent p-0"
            value={s?.bgColor || '#fff3cd'}
            onChange={(e) => editor.chain().focus().setBackgroundColor(e.target.value).run()}
            disabled={disabled}
          />
        </span>
        {btn(() => editor.chain().focus().unsetColor().unsetBackgroundColor().run(), false, t('richEditor.clearColor', { defaultValue: 'Xóa màu' }), <span className="text-[12px] font-semibold line-through">A</span>)}

        {/* Bảng */}
        <Divider />
        {btn(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), false, t('richEditor.insertTable', { defaultValue: 'Chèn bảng' }), <TableIcon size={14} />)}
        {s?.isTable && (
          <>
            {btn(() => editor.chain().focus().addColumnAfter().run(), false, t('richEditor.addColumn', { defaultValue: 'Thêm cột' }), <span className="text-[11px] px-0.5">+|</span>)}
            {btn(() => editor.chain().focus().addRowAfter().run(), false, t('richEditor.addRow', { defaultValue: 'Thêm dòng' }), <span className="text-[11px] px-0.5">+−</span>)}
            {btn(() => editor.chain().focus().deleteColumn().run(), false, t('richEditor.deleteColumn', { defaultValue: 'Xóa cột' }), <span className="text-[11px] px-0.5 text-destructive">−|</span>)}
            {btn(() => editor.chain().focus().deleteRow().run(), false, t('richEditor.deleteRow', { defaultValue: 'Xóa dòng' }), <span className="text-[11px] px-0.5 text-destructive">−−</span>)}
            {btn(() => editor.chain().focus().deleteTable().run(), false, t('richEditor.deleteTable', { defaultValue: 'Xóa bảng' }), <span className="text-[11px] px-0.5 text-destructive">✕▦</span>)}
          </>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="rich-editor-content rte-canvas-frame min-h-[240px]"
      />

      {imagePickerOpen && (
        <MediaPickerModal
          recommend={IMAGE_RECO.general}
          kind="image"
          onSelect={(url, media) => {
            // No per-image alt UI exists inside the rich-text body, so the best we
            // can do is carry the library's saved alt/title onto the <img> tag —
            // there's no context field here to sync a fresh upload's alt back from.
            const alt = media?.altText || media?.title || undefined
            editor.chain().focus().setImage({ src: url, alt, title: media?.title || undefined }).run()
            setImagePickerOpen(false)
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      )}

      {/* Link modal */}
      {linkModal.open && (
        <div className="py-2.5 px-3 border-t border-border bg-surface-muted flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">
            URL:
          </label>
          <Input
            ref={linkInputRef}
            type="url"
            className="flex-1 text-xs"
            placeholder="https://..."
            value={linkModal.value}
            onChange={(e) => setLinkModal((m) => ({ ...m, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') cancelLink()
            }}
           />
          <Button type="button" size="sm" onClick={applyLink}>
            {t('richEditor.apply')}
          </Button>
          <Button variant="secondary" type="button" size="sm" onClick={cancelLink}>
            {t('common.cancel')}
          </Button>
        </div>
      )}

      {/* Character count */}
      <div className="py-1 px-3 border-t border-border text-xs text-muted-foreground text-right bg-surface-muted">
        {t('richEditor.charCount', { count: s?.charCount ?? 0 })}
      </div>
    </div>
  )
}
