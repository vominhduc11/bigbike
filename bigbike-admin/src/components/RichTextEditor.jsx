import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Code, Heading2, Heading3, Image, Italic, Link, Link2Off, List, ListOrdered,
  Minus, Quote, Redo, Strikethrough, Underline, Undo,
} from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'
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
        'inline-flex items-center justify-center w-[30px] h-[30px] rounded-xs border-none transition-colors',
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
    <span className="inline-block w-px h-[18px] bg-border mx-1 shrink-0" />
  )
}

export function RichTextEditor({ value, onChange, placeholder, disabled, hasError, enableImagePicker = false }) {
  const { t } = useTranslation()
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
    <div className={cn(
      'rounded-md overflow-hidden transition-colors border-[1.5px]',
      hasError ? 'border-danger-border' : 'border-border',
      disabled ? 'bg-surface-muted' : 'bg-surface'
    )}>
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 py-1.5 px-2.5 border-b border-border bg-surface-muted">
        {btn(() => editor.chain().focus().undo().run(), false, t('richEditor.undo'), <Undo size={14} />, !editor.can().undo())}
        {btn(() => editor.chain().focus().redo().run(), false, t('richEditor.redo'), <Redo size={14} />, !editor.can().redo())}
        <Divider />
        {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), t('richEditor.bold'), <Bold size={14} />)}
        {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), t('richEditor.italic'), <Italic size={14} />)}
        {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), t('richEditor.underline'), <Underline size={14} />)}
        {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), t('richEditor.strike'), <Strikethrough size={14} />)}
        {btn(() => editor.chain().focus().toggleCode().run(), editor.isActive('code'), t('richEditor.code'), <Code size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), t('richEditor.h2'), <Heading2 size={14} />)}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), t('richEditor.h3'), <Heading3 size={14} />)}
        <Divider />
        {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), t('richEditor.bulletList'), <List size={14} />)}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), t('richEditor.orderedList'), <ListOrdered size={14} />)}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), t('richEditor.quote'), <Quote size={14} />)}
        {btn(() => editor.chain().focus().setHorizontalRule().run(), false, t('richEditor.hr'), <Minus size={14} />)}
        <Divider />
        {btn(handleLink, editor.isActive('link'), t('richEditor.link'), <Link size={14} />)}
        {editor.isActive('link') && btn(() => editor.chain().focus().unsetLink().run(), false, t('richEditor.unlink'), <Link2Off size={14} />)}
        {enableImagePicker && (
          <>
            <Divider />
            {btn(() => setImagePickerOpen(true), false, t('richEditor.image'), <Image size={14} />)}
          </>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="rich-editor-content min-h-[240px]"
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
        {t('richEditor.charCount', { count: editor.storage.characterCount?.characters?.() ?? editor.getText().length })}
      </div>
    </div>
  )
}
