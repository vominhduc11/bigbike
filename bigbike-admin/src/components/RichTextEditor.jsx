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
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Code,
  Heading2,
  Heading3,
  Highlighter,
  Image,
  Italic,
  Link,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo,
} from 'lucide-react'
import { MediaPickerModal } from './MediaPickerModal'
import { ScreenSkeleton } from './ScreenSkeleton'
import { MediaRequirementHint } from './MediaRequirementHint'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-xs border-none transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : disabled
            ? 'cursor-not-allowed text-muted-foreground/50'
            : 'cursor-pointer text-muted-foreground hover:bg-surface-hover',
      )}
    >
      {children}
    </Button>
  )
}

function Divider() {
  return <span className="inline-block w-px h-5 bg-border mx-1 shrink-0" />
}

// Đường dẫn hợp lệ cho nút chèn liên kết: http(s), mailto, tel hoặc nội bộ (bắt đầu / hoặc #).
// Rỗng = gỡ liên kết nên vẫn hợp lệ.
function isValidLinkHref(url) {
  const u = (url || '').trim()
  if (!u) return true
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)
}

function wrapInlineContent(value) {
  const raw = String(value || '')
  if (!raw.trim() || /<p(?:\s|>)/i.test(raw)) return raw
  return `<p>${raw}</p>`
}

function toInlineFragment(html) {
  const raw = String(html || '').trim()
  if (!raw || typeof DOMParser === 'undefined') return raw
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  const blocks = Array.from(doc.body.children)
  if (!blocks.length) return raw
  return blocks
    .map((block) => (block.tagName === 'P' ? block.innerHTML : block.outerHTML))
    .join('<br>')
}

// TipTap có thể vẫn trả về instance editor trong một lần render sau khi view đã
// bị huỷ. Mọi thao tác bên dưới phải đi qua các lớp bảo vệ này để effect muộn,
// callback toolbar hoặc callback media không chạm vào trạng thái ProseMirror đã chết.
function isEditorUsable(editor) {
  return Boolean(editor && !editor.isDestroyed)
}

function getEditorDom(editor) {
  if (!isEditorUsable(editor)) return null
  try {
    // `editor.view` là proxy có thể throw khi view chưa được gắn vào DOM.
    return editor.view?.dom ?? null
  } catch {
    return null
  }
}

function runLiveEditorAction(editor, action) {
  if (!isEditorUsable(editor)) return false
  action(editor)
  return true
}

function runEditorCommand(editor, action) {
  if (!isEditorUsable(editor) || !getEditorDom(editor)) return false
  action(editor)
  return true
}

function readEditorHtml(editor, inlineOnly) {
  if (!isEditorUsable(editor)) return null
  if (editor.isEmpty) return ''
  const html = editor.getHTML()
  return inlineOnly ? toInlineFragment(html) : html
}

function readEditorText(editor) {
  if (!isEditorUsable(editor)) return null
  return editor.getText()
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
  enableImagePicker = false,
  inlineOnly = false,
  maxLength,
}) {
  const { t } = useTranslation()
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [linkModal, setLinkModal] = useState({ open: false, value: '', error: '' })
  const linkInputRef = useCallback((el) => {
    if (el) el.focus()
  }, [])

  // Chỉ coi là "user sửa" sau khi editor thực sự được focus. TipTap (v3) phát onUpdate
  // ngay khi parse/chuẩn hoá nội dung lúc mount — nếu HTML lưu khác chuỗi serialize chuẩn,
  // onUpdate này tạo "thay đổi" ma khiến form Cài đặt báo "chưa lưu" giả khi vừa mở tab.
  // Mọi thao tác qua toolbar đều gọi .focus() trước nên cờ này bật đúng lúc người dùng sửa.
  const userEditedRef = useRef(false)

  const editor = useEditor({
    extensions: inlineOnly
      ? [
          StarterKit.configure({
            blockquote: false,
            bulletList: false,
            code: false,
            codeBlock: false,
            heading: false,
            horizontalRule: false,
            listItem: false,
            link: false,
            orderedList: false,
            strike: false,
          }),
          LinkExt.configure({
            openOnClick: false,
            HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
          }),
          Placeholder.configure({ placeholder: placeholder || '' }),
        ]
      : [
          StarterKit.configure({
            heading: { levels: [2, 3] },
            codeBlock: { languageClassPrefix: 'language-' },
            link: false,
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
    content: inlineOnly ? wrapInlineContent(value) : value || '',
    editable: !disabled,
    // KHÔNG tạo editor ngay trong lúc render. @tiptap/react hẹn giờ 1ms để huỷ editor nếu
    // component chưa kịp mount; màn hình nặng (kéo-thả, nhiều khối) làm React commit trễ hơn
    // 1ms → editor bị huỷ trước khi effect chạy, effect đồng bộ `value` gọi getHTML() trên
    // editor đã huỷ (schema = null) và làm sập cả trang qua ErrorBoundary.
    // immediatelyRender: false dời việc tạo editor vào effect, sau khi đã đánh dấu mounted.
    immediatelyRender: false,
    // Khi paste từ Word: gỡ background-color (highlight Word) và thuộc tính mso-* (Word-specific)
    // khỏi inline style trước khi TipTap parse — giữ lại color, font-weight và các style hợp lệ khác.
    editorProps: {
      // Đặt tên đọc được + vai trò cho vùng soạn thảo (contenteditable) để trình đọc màn hình
      // hiểu đây là ô nhập văn bản nhiều dòng, thay vì một vùng vô danh.
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label':
          placeholder || t('richEditor.editorLabel', { defaultValue: 'Nội dung văn bản' }),
      },
      transformPastedHTML(html) {
        const div = document.createElement('div')
        div.innerHTML = html
        div.querySelectorAll('[style]').forEach((el) => {
          const cleaned = el
            .getAttribute('style')
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
    onFocus: () => {
      userEditedRef.current = true
    },
    onUpdate: ({ editor }) => {
      if (!userEditedRef.current || !isEditorUsable(editor)) return
      const text = readEditorText(editor)
      if (text === null || (maxLength && text.length > maxLength)) return
      const html = readEditorHtml(editor, inlineOnly)
      if (html === null) return
      onChange?.(html)
    },
  })

  // TipTap v3: useEditor KHÔNG re-render React mỗi khi con trỏ/định dạng đổi (khác v2). Nội dung
  // do ProseMirror vẽ thẳng nên vẫn thấy đổi, nhưng `editor.isActive(...)` tính lúc render sẽ
  // "đứng hình" → nút toolbar không sáng. useEditorState subscribe state, render lại khi các cờ đổi.
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!isEditorUsable(editor)) return null
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
        charCount: editor.storage?.characterCount?.characters?.() ?? editor.getText().length,
      }
    },
  })

  const handleLink = useCallback(() => {
    if (!isEditorUsable(editor)) return
    const prev = editor.getAttributes('link').href || ''
    setLinkModal({ open: true, value: prev, error: '' })
  }, [editor])

  const applyLink = useCallback(() => {
    if (!isEditorUsable(editor)) return
    const url = linkModal.value.trim()
    if (url === '') {
      runEditorCommand(editor, (liveEditor) => liveEditor.chain().focus().unsetLink().run())
    } else if (!isValidLinkHref(url)) {
      setLinkModal((m) => ({
        ...m,
        error: t('richEditor.linkInvalid', {
          defaultValue:
            'Đường dẫn không hợp lệ. Dùng http(s)://, mailto:, tel: hoặc đường dẫn nội bộ bắt đầu bằng /.',
        }),
      }))
      return
    } else {
      runEditorCommand(editor, (liveEditor) =>
        liveEditor.chain().focus().setLink({ href: url }).run(),
      )
    }
    setLinkModal({ open: false, value: '', error: '' })
  }, [editor, linkModal.value, t])

  const cancelLink = useCallback(() => {
    setLinkModal({ open: false, value: '', error: '' })
    runEditorCommand(editor, (liveEditor) => liveEditor.chain().focus().run())
  }, [editor])

  useEffect(() => {
    // editor.isDestroyed: instance có thể đã bị huỷ trước khi effect chạy (đổi instance /
    // unmount). getHTML() trên editor đã huỷ throw vì schema = null → sập trang.
    if (!isEditorUsable(editor)) return
    const current = readEditorHtml(editor, inlineOnly)
    if (current === null) return
    if (value !== current) {
      // TipTap v3: tham số thứ 2 là options object. Phải truyền { emitUpdate: false }
      // để đồng bộ value từ ngoài (mount / refetch) KHÔNG bị tính là user sửa —
      // nếu không, mở form rich-text sẽ báo "thay đổi chưa lưu" giả. (v2 nhận false trực tiếp)
      runLiveEditorAction(editor, (liveEditor) => {
        liveEditor.commands.setContent(inlineOnly ? wrapInlineContent(value) : value || '', {
          emitUpdate: false,
        })
      })
    }
  }, [value, editor, inlineOnly])

  useEffect(() => {
    runLiveEditorAction(editor, (liveEditor) => liveEditor.setEditable(!disabled))
  }, [disabled, editor])

  // Phản ánh trạng thái lỗi lên vùng soạn thảo (aria-invalid) để không chỉ dựa vào viền màu.
  useEffect(() => {
    // editor.view là getter luôn trả về giá trị "truthy" (Proxy tạm) khi view ProseMirror
    // thật chưa mount hoặc đã destroy — check !editor.view không bắt được. editor.isDestroyed
    // mới phản ánh đúng trạng thái view thật, tránh throw "editor may not be mounted yet".
    const dom = getEditorDom(editor)
    if (!dom) return
    if (hasError) dom.setAttribute('aria-invalid', 'true')
    else dom.removeAttribute('aria-invalid')
  }, [hasError, editor])

  // editor chỉ có sau effect đầu tiên (immediatelyRender: false) — giữ đúng khung chỗ của
  // editor để không giật layout trong một nhịp render.
  if (!isEditorUsable(editor)) return <ScreenSkeleton variant="editor" inlineOnly={inlineOnly} />

  const runChain = (configure) =>
    runEditorCommand(editor, (liveEditor) => {
      configure(liveEditor.chain().focus()).run()
    })

  const btn = (action, isActive, title, icon, disabledOverride) => (
    <ToolbarButton
      onClick={action}
      active={isActive}
      disabled={disabled || !isEditorUsable(editor) || disabledOverride}
      title={title}
    >
      {icon}
    </ToolbarButton>
  )

  return (
    <div
      className={cn(
        'rounded-md overflow-hidden transition-colors border-[1.5px]',
        hasError ? 'border-danger-border' : 'border-border',
        disabled ? 'bg-surface-muted' : 'bg-surface',
      )}
    >
      {/* Toolbar */}
      <div
        role="group"
        aria-label={t('richEditor.toolbarLabel', { defaultValue: 'Thanh công cụ định dạng' })}
        className="flex items-center flex-wrap gap-1 py-2 px-3 border-b border-border bg-surface-muted"
      >
        {btn(
          () => runChain((chain) => chain.undo()),
          false,
          t('richEditor.undo'),
          <Undo size={14} />,
          !s?.canUndo,
        )}
        {btn(
          () => runChain((chain) => chain.redo()),
          false,
          t('richEditor.redo'),
          <Redo size={14} />,
          !s?.canRedo,
        )}
        <Divider />
        {btn(
          () => runChain((chain) => chain.toggleBold()),
          s?.isBold,
          t('richEditor.bold'),
          <Bold size={14} />,
        )}
        {btn(
          () => runChain((chain) => chain.toggleItalic()),
          s?.isItalic,
          t('richEditor.italic'),
          <Italic size={14} />,
        )}
        {!inlineOnly && (
          <>
            {btn(
              () => runChain((chain) => chain.toggleUnderline()),
              s?.isUnderline,
              t('richEditor.underline'),
              <Underline size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.toggleStrike()),
              s?.isStrike,
              t('richEditor.strike'),
              <Strikethrough size={14} />,
            )}
            <Divider />
            {btn(
              () => runChain((chain) => chain.toggleHeading({ level: 2 })),
              s?.isH2,
              t('richEditor.h2'),
              <Heading2 size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.toggleHeading({ level: 3 })),
              s?.isH3,
              t('richEditor.h3'),
              <Heading3 size={14} />,
            )}
            <Divider />
            {btn(
              () => runChain((chain) => chain.toggleBulletList()),
              s?.isBulletList,
              t('richEditor.bulletList'),
              <List size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.toggleOrderedList()),
              s?.isOrderedList,
              t('richEditor.orderedList'),
              <ListOrdered size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.toggleBlockquote()),
              s?.isBlockquote,
              t('richEditor.quote'),
              <Quote size={14} />,
            )}
          </>
        )}
        <Divider />
        {btn(handleLink, s?.isLink, t('richEditor.link'), <Link size={14} />)}
        {s?.isLink &&
          btn(
            () => runChain((chain) => chain.unsetLink()),
            false,
            t('richEditor.unlink'),
            <Link2Off size={14} />,
          )}
        {!inlineOnly && enableImagePicker && (
          <>
            <Divider />
            {btn(
              () => {
                if (isEditorUsable(editor)) setImagePickerOpen(true)
              },
              false,
              t('richEditor.image'),
              <Image size={14} />,
            )}
          </>
        )}

        {!inlineOnly && (
          <>
            {/* Căn lề */}
            <Divider />
            {btn(
              () => runChain((chain) => chain.setTextAlign('left')),
              s?.alignLeft,
              t('richEditor.alignLeft', { defaultValue: 'Căn trái' }),
              <AlignLeft size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.setTextAlign('center')),
              s?.alignCenter,
              t('richEditor.alignCenter', { defaultValue: 'Căn giữa' }),
              <AlignCenter size={14} />,
            )}
            {btn(
              () => runChain((chain) => chain.setTextAlign('right')),
              s?.alignRight,
              t('richEditor.alignRight', { defaultValue: 'Căn phải' }),
              <AlignRight size={14} />,
            )}

            {/* Thêm — gom công cụ ít dùng: mã, kẻ ngang, màu chữ/nền, bảng */}
            <Divider />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || !isEditorUsable(editor)}
                  title={t('richEditor.more', { defaultValue: 'Thêm' })}
                  aria-label={t('richEditor.more', { defaultValue: 'Thêm' })}
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-xs border-none transition-colors',
                    s?.isCode || s?.isTable
                      ? 'bg-primary/10 text-primary'
                      : 'cursor-pointer text-muted-foreground hover:bg-surface-hover',
                  )}
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenuItem onSelect={() => runChain((chain) => chain.toggleCode())}>
                  <Code size={14} /> {t('richEditor.code')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runChain((chain) => chain.setHorizontalRule())}>
                  <Minus size={14} /> {t('richEditor.hr')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Ô chọn màu để trong <div> (không phải MenuItem) để không kích hoạt select; chọn xong menu tự đóng. */}
                <div className="flex items-center gap-3 px-2 py-2">
                  <label
                    className="inline-flex cursor-pointer items-center gap-2 text-sm"
                    title={t('richEditor.textColor', { defaultValue: 'Màu chữ' })}
                  >
                    <Baseline size={14} className="text-muted-foreground" />
                    <Input
                      type="color"
                      aria-label={t('richEditor.textColor', { defaultValue: 'Màu chữ' })}
                      className="h-6 w-8 cursor-pointer rounded-xs border border-border bg-transparent p-0"
                      value={s?.color || '#111827'}
                      onChange={(e) => runChain((chain) => chain.setColor(e.target.value))}
                      disabled={disabled || !isEditorUsable(editor)}
                    />
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-2 text-sm"
                    title={t('richEditor.bgColor', { defaultValue: 'Tô nền chữ' })}
                  >
                    <Highlighter size={14} className="text-muted-foreground" />
                    <Input
                      type="color"
                      aria-label={t('richEditor.bgColor', { defaultValue: 'Tô nền chữ' })}
                      className="h-6 w-8 cursor-pointer rounded-xs border border-border bg-transparent p-0"
                      value={s?.bgColor || '#fff3cd'}
                      onChange={(e) =>
                        runChain((chain) => chain.setBackgroundColor(e.target.value))
                      }
                      disabled={disabled || !isEditorUsable(editor)}
                    />
                  </label>
                </div>
                <DropdownMenuItem
                  onSelect={() => runChain((chain) => chain.unsetColor().unsetBackgroundColor())}
                >
                  <span className="text-xs font-semibold line-through">A</span>{' '}
                  {t('richEditor.clearColor', { defaultValue: 'Xoá màu' })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    runChain((chain) =>
                      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
                    )
                  }
                >
                  <TableIcon size={14} />{' '}
                  {t('richEditor.insertTable', { defaultValue: 'Chèn bảng' })}
                </DropdownMenuItem>
                {s?.isTable && (
                  <>
                    <DropdownMenuItem onSelect={() => runChain((chain) => chain.addColumnAfter())}>
                      {t('richEditor.addColumn', { defaultValue: 'Thêm cột' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => runChain((chain) => chain.addRowAfter())}>
                      {t('richEditor.addRow', { defaultValue: 'Thêm dòng' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger focus:text-danger"
                      onSelect={() => runChain((chain) => chain.deleteColumn())}
                    >
                      {t('richEditor.deleteColumn', { defaultValue: 'Xoá cột' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger focus:text-danger"
                      onSelect={() => runChain((chain) => chain.deleteRow())}
                    >
                      {t('richEditor.deleteRow', { defaultValue: 'Xoá dòng' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger focus:text-danger"
                      onSelect={() => runChain((chain) => chain.deleteTable())}
                    >
                      {t('richEditor.deleteTable', { defaultValue: 'Xoá bảng' })}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {enableImagePicker && (
              <MediaRequirementHint
                recommend={IMAGE_RECO.general}
                className="m-0 basis-full pt-1"
              />
            )}
          </>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className={cn('rich-editor-content', inlineOnly ? 'min-h-32' : 'min-h-[240px]')}
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
            runEditorCommand(editor, (liveEditor) => {
              liveEditor
                .chain()
                .focus()
                .setImage({ src: url, alt, title: media?.title || undefined })
                .run()
            })
            setImagePickerOpen(false)
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      )}

      {/* Link modal */}
      {linkModal.open && (
        <div className="py-3 px-3 border-t border-border bg-surface-muted flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="rte-link-url"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {t('richEditor.linkUrlLabel', { defaultValue: 'Đường dẫn' })}
            </label>
            <Input
              id="rte-link-url"
              ref={linkInputRef}
              type="url"
              className="flex-1 text-xs"
              placeholder="https://..."
              value={linkModal.value}
              aria-invalid={linkModal.error ? true : undefined}
              aria-describedby={linkModal.error ? 'rte-link-error' : undefined}
              onChange={(e) => setLinkModal((m) => ({ ...m, value: e.target.value, error: '' }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
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
          {linkModal.error && (
            <span id="rte-link-error" role="alert" className="text-xs text-danger">
              {linkModal.error}
            </span>
          )}
        </div>
      )}

      {/* Character count */}
      <div className="py-1 px-3 border-t border-border text-xs text-muted-foreground text-right bg-surface-muted">
        {t('richEditor.charCount', { count: s?.charCount ?? 0 })}
      </div>
    </div>
  )
}
