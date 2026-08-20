import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X as XIcon, Hash } from 'lucide-react'
import { fetchMediaTags } from '../lib/adminApi'
import { DropdownPopover } from './DropdownPopover'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Multi-tag input with prefix-based autocomplete from {@code GET /admin/media/tags}.
 *
 * Behaviour:
 *   - Type -> suggestion dropdown filtered by prefix (debounced 150ms).
 *   - Enter or "," -> add the typed value as a new tag.
 *   - Click suggestion -> add it.
 *   - Backspace on empty input -> remove last tag.
 *   - Click the remove icon on a chip -> remove that tag.
 *
 * Tags are normalized to lowercase + trim, dedup-ed.
 */
export function TagInput({ value, onChange, placeholder, disabled }) {
  const { t } = useTranslation()
  const tags = Array.isArray(value) ? value : []
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg] = useState(false)
  // Lỗi tải gợi ý KHÔNG được biến thành danh sách rỗng im lặng — giữ cờ để hiện thông báo.
  const [suggError, setSuggError] = useState(false)
  // Option đang được đánh dấu bằng bàn phím (arrow) trong listbox; -1 = chưa chọn.
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef(null)
  const listboxId = useId()
  const optionId = (i) => `${listboxId}-opt-${i}`
  // Hold latest tags in a ref so the effect doesn't re-run (and re-fetch) every
  // time the parent passes a new array reference for the same logical content.
  const tagsRef = useRef(tags)
  useEffect(() => {
    tagsRef.current = tags
  })

  // Fetch suggestions when the input string changes (only)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchMediaTags(input)
        setSuggestions(results.filter((tag) => !tagsRef.current.includes(tag)))
        setSuggError(false)
      } catch {
        setSuggestions([])
        setSuggError(true)
      }
    }, 150)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [input])

  const visibleSuggestions = suggestions.slice(0, 10)
  // Reset đánh dấu khi danh sách gợi ý đổi để activeIndex không trỏ nhầm.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1)
  }, [suggestions])

  function addTag(raw) {
    const tag = raw.trim().toLowerCase()
    setActiveIndex(-1)
    if (!tag || tags.includes(tag)) {
      setInput('')
      return
    }
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tag) {
    onChange(tags.filter((x) => x !== tag))
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (visibleSuggestions.length) {
        setShowSugg(true)
        setActiveIndex((i) => (i + 1) % visibleSuggestions.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (visibleSuggestions.length)
        setActiveIndex((i) => (i <= 0 ? visibleSuggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && visibleSuggestions[activeIndex])
        addTag(visibleSuggestions[activeIndex])
      else if (input.trim()) addTag(input)
    } else if (e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.at(-1))
    } else if (e.key === 'Escape') {
      setShowSugg(false)
      setActiveIndex(-1)
    }
  }

  const listboxOpen = showSugg && !disabled && (visibleSuggestions.length > 0 || suggError)

  return (
    <DropdownPopover
      open={listboxOpen}
      onOpenChange={(next) => {
        if (!next) setShowSugg(false)
      }}
      anchor={
        <div
          className={cn(
            'flex flex-wrap gap-1 border border-border rounded-xs p-1 min-h-8',
            disabled ? 'bg-surface-muted' : 'bg-surface',
          )}
        >
          {tags.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 bg-primary text-white rounded-full py-0.5 pl-2 pr-1 text-xs font-semibold"
            >
              <Hash size={10} aria-hidden="true" />
              {tg}
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTag(tg)}
                  aria-label={t('common.removeTag', { tag: tg })}
                  className="!h-5 !w-5 !rounded-full !p-0 bg-white/20 border-none text-white hover:bg-white/30 hover:text-white"
                >
                  <XIcon size={12} aria-hidden="true" />
                </Button>
              )}
            </span>
          ))}
          <Input
            type="text"
            value={input}
            disabled={disabled}
            role="combobox"
            aria-expanded={listboxOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="h-auto min-w-20 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      }
    >
      <ul id={listboxId} role="listbox" className="list-none p-1">
        {suggError ? (
          <li role="alert" className="px-2 py-1 text-xs text-danger">
            {t('common.tagFetchError', {
              defaultValue: 'Không tải được gợi ý thẻ. Bạn vẫn có thể tự nhập thẻ.',
            })}
          </li>
        ) : (
          visibleSuggestions.map((s, i) => (
            <li
              key={s}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(s)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded-xs px-2 py-1 text-xs hover:bg-surface-muted',
                i === activeIndex && 'bg-surface-muted',
              )}
            >
              <Hash size={12} aria-hidden="true" /> {s}
            </li>
          ))
        )}
      </ul>
    </DropdownPopover>
  )
}
