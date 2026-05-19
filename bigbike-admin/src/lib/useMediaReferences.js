import { useEffect, useState } from 'react'
import { fetchMediaReferences } from './adminApi'

/**
 * Lazy-loads media references when they are not already bundled on the item.
 * Skips the fetch if references were returned with the list item or usageCount === 0.
 */
export function useMediaReferences(media) {
  const [refs, setRefs] = useState(media.references ?? [])
  const [refsLoading, setRefsLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefs(media.references ?? [])
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (media.references && media.references.length > 0) return
    if ((media.usageCount ?? 0) === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefsLoading(true)
    fetchMediaReferences(media.id)
      .then(setRefs)
      .catch(() => {})
      .finally(() => setRefsLoading(false))
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { refs, refsLoading }
}
