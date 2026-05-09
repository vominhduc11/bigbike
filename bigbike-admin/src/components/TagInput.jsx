import { useEffect, useRef, useState } from 'react'
import { X as XIcon, Hash } from 'lucide-react'
import { fetchMediaTags } from '../lib/adminApi'

/**
 * Multi-tag input with prefix-based autocomplete from {@code GET /admin/media/tags}.
 *
 * Behaviour:
 *   - Type → suggestion dropdown filtered by prefix (debounced 150ms).
 *   - Enter or "," → add the typed value as a new tag.
 *   - Click suggestion → add it.
 *   - Backspace on empty input → remove last tag.
 *   - Click ✕ on a chip → remove that tag.
 *
 * Tags are normalized to lowercase + trim, dedup-ed.
 */
export function TagInput({ value, onChange, placeholder, disabled }) {
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
      const results = await fetchMediaTags(input)
      setSuggestions(results.filter((t) => !tagsRef.current.includes(t)))
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
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        border: '1px solid var(--c-border)', borderRadius: 4,
        background: disabled ? 'var(--c-bg-subtle)' : 'var(--c-surface)',
        padding: 4, minHeight: 32,
      }}>
        {tags.map((tg) => (
          <span key={tg} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'var(--c-primary)', color: '#fff',
            borderRadius: 999, padding: '2px 4px 2px 8px',
            fontSize: '0.72rem', fontWeight: 600,
          }}>
            <Hash size={10} />
            {tg}
            {!disabled && (
              <button type="button" onClick={() => removeTag(tg)} aria-label={`Remove ${tg}`}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer',
                  width: 14, height: 14, borderRadius: '50%', color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>
                <XIcon size={9} />
              </button>
            )}
          </span>
        ))}
        <input type="text" value={input} disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: 80, border: 'none', outline: 'none',
            background: 'transparent', fontSize: '0.85rem', padding: '2px 4px',
          }} />
      </div>

      {showSugg && suggestions.length > 0 && !disabled && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5,
          listStyle: 'none', margin: '2px 0 0 0', padding: 4,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {suggestions.slice(0, 10).map((s) => (
            <li key={s}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                style={{
                  all: 'unset', display: 'flex', alignItems: 'center', gap: 4,
                  width: '100%', padding: '4px 8px', fontSize: '0.8rem',
                  cursor: 'pointer', borderRadius: 3, boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-bg-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Hash size={12} /> {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
