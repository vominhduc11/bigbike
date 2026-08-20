import { useEffect, useState } from 'react'
import { fetchMediaReferences } from './adminApi'

/**
 * Lazy-loads media references when they are not already bundled on the item.
 * Skips the fetch if references were returned with the list item or usageCount === 0.
 */
export function useMediaReferences(media) {
  const [refs, setRefs] = useState(media.references ?? [])
  const [refsLoading, setRefsLoading] = useState(false)
  const [refsError, setRefsError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setRefs(media.references ?? [])
    setRefsError(false)
    setRefsLoading(false)
    /* eslint-enable react-hooks/set-state-in-effect */
    if (media.references && media.references.length > 0) return undefined
    if ((media.usageCount ?? 0) === 0) return undefined
    let active = true
    setRefsLoading(true)
    fetchMediaReferences(media.id)
      .then((items) => {
        if (!active) return
        setRefs(items)
        setRefsError(false)
      })
      .catch(() => {
        if (active) setRefsError(true)
      })
      .finally(() => {
        if (active) setRefsLoading(false)
      })
    return () => {
      active = false
    }
  }, [media.id, revision]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    refs,
    refsLoading,
    refsError,
    retryRefs: () => setRevision((value) => value + 1),
  }
}
