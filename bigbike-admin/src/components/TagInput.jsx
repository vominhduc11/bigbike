import { useEffect, useRef, useState } from 'react'
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
  const debounceRef = useRef(null)
  // Hold latest tags in a ref so the effect doesn't re-run (and re-fetch) every
  // time the parent passes a new array reference for the same logical content.
  const tagsRef = useRef(tags)
  useEffect(() => { tagsRef.current = tags })

  // Fetch suggestions when the input string changes (only)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchMediaTags(input)
        setSuggestions(results.filter((t) => !tagsRef.current.includes(t)))
      } catch {
        setSuggestions([])
      }
    }, 150)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [input])

  function addTag(raw) {
    const t = raw.trim().toLowerCase()
    if (!t || tags.includes(t)) { setInput(''); return }
    onChange([...tags, t])
    setInput('')
  }

  function removeTag(t) {
    onChange(tags.filter((x) => x !== t))
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setShowSugg(false)
    }
  }

  return (
    <DropdownPopover
      open={showSugg && suggestions.length > 0 && !disabled}
      onOpenChange={(next) => { if (!next) setShowSugg(false) }}
      anchor={
        <div className={cn(
          'flex flex-wrap gap-1 border border-border rounded-xs p-1 min-h-8',
          disabled ? 'bg-surface-muted' : 'bg-surface'
        )}>
          {tags.map((tg) => (
            <span key={tg} className="inline-flex items-center gap-1 bg-primary text-white rounded-full py-0.5 pl-2 pr-1 text-xs font-semibold">
              <Hash size={10} />
              {tg}
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTag(tg)} aria-label={t('common.removeTag', { tag: tg })}
                  className="!h-3.5 !w-3.5 !rounded-full !p-0 bg-white/20 border-none text-white hover:bg-white/30 hover:text-white">
                  <XIcon size={9} />
                </Button>
              )}
            </span>
          ))}
          <Input type="text" value={input} disabled={disabled}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="h-auto min-w-20 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
        </div>
      }
    >
      <ul className="list-none p-1">
        {suggestions.slice(0, 10).map((s) => (
          <li key={s}>
            <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
              className="!h-auto flex w-full items-center justify-start gap-1 rounded-xs border-none bg-transparent px-2 py-1 text-xs hover:bg-surface-muted">
              <Hash size={12} /> {s}
            </Button>
          </li>
        ))}
      </ul>
    </DropdownPopover>
  )
}
