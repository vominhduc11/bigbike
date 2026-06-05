import { useEffect, useState } from 'react'
import { resolveDisplayUrl } from '@/lib/contracts'

const IDLE = { status: 'idle', width: 0, height: 0 }

// Đo kích thước thật (naturalWidth × naturalHeight) của một URL ảnh.
// Trả về { status: 'idle'|'loading'|'loaded'|'error', width, height }.
// Ảnh được trình duyệt cache nên không tốn thêm băng thông so với preview.
export function useImageDimensions(url) {
  const trimmed = resolveDisplayUrl((url || '').trim())
  const [dims, setDims] = useState(IDLE)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!trimmed) { setDims(IDLE); return }
    let alive = true
    setDims({ status: 'loading', width: 0, height: 0 })
    const img = new Image()
    img.onload = () => { if (alive) setDims({ status: 'loaded', width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { if (alive) setDims({ status: 'error', width: 0, height: 0 }) }
    img.src = trimmed
    return () => { alive = false }
  }, [trimmed])

  return dims
}

// Đo kích thước thật của một file video (mp4 trong thư viện) qua metadata.
// Link ngoài như YouTube không đọc được kích thước → trả về 'error', không cảnh báo.
export function useVideoDimensions(url) {
  const trimmed = resolveDisplayUrl((url || '').trim())
  const [dims, setDims] = useState(IDLE)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!trimmed) { setDims(IDLE); return }
    let alive = true
    setDims({ status: 'loading', width: 0, height: 0 })
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const onMeta = () => { if (alive) setDims({ status: 'loaded', width: video.videoWidth, height: video.videoHeight }) }
    const onError = () => { if (alive) setDims({ status: 'error', width: 0, height: 0 }) }
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('error', onError)
    video.src = trimmed
    return () => {
      alive = false
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onError)
      video.src = ''
    }
  }, [trimmed])

  return dims
}
