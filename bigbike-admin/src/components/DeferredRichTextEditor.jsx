import { lazy, Suspense } from 'react'
import { ScreenSkeleton } from './ScreenSkeleton'

const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({
  default: module.RichTextEditor,
})))

// Keep TipTap and ProseMirror out of a screen until an editor actually mounts.
// The fallback is the shared skeleton, sized to the existing editor footprint.
export function DeferredRichTextEditor({ inlineOnly = false, ...props }) {
  return (
    <Suspense fallback={<ScreenSkeleton variant="editor" inlineOnly={inlineOnly} />}>
      <RichTextEditor {...props} inlineOnly={inlineOnly} />
    </Suspense>
  )
}
