import { useEffect, useRef, useState } from 'react'

/**
 * Keeps pasted HTML local until a caller explicitly applies it.
 * `value` is the committed product field or the serialized item model.
 * `parse` must return an HtmlImportResult-like object with `acceptedCount`.
 */
export function useHtmlImportDraft(value = '', parse) {
  const parseRef = useRef(parse)

  const committedRef = useRef(value || '')
  const [draftHtml, setDraftHtml] = useState(value || '')
  const [result, setResult] = useState(() => parse(value || ''))
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    parseRef.current = parse
  }, [parse])

  useEffect(() => {
    const nextValue = value || ''
    if (nextValue === committedRef.current) return
    committedRef.current = nextValue
    setDraftHtml(nextValue)
    setResult(parseRef.current(nextValue))
    setDirty(false)
  }, [value])

  function updateDraft(nextHtml) {
    const next = nextHtml || ''
    setDraftHtml(next)
    setResult(parseRef.current(next))
    setDirty(next !== committedRef.current)
  }

  function commitDraft(nextHtml) {
    const next = nextHtml || ''
    committedRef.current = next
    setDraftHtml(next)
    setResult(parseRef.current(next))
    setDirty(false)
  }

  async function runApply(callback) {
    if (pending) return null
    setPending(true)
    try {
      const applied = await callback({ draftHtml, result })
      if (applied?.sourceHtml !== undefined) commitDraft(applied.sourceHtml)
      return applied
    } finally {
      setPending(false)
    }
  }

  return { draftHtml, result, dirty, pending, updateDraft, commitDraft, runApply }
}
