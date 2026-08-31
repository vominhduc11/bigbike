import { useEffect, useState } from 'react'
import { resolveDisplayUrl } from '@/lib/contracts'
import { evaluateImageDimensions } from '@/lib/imageRecommendations'

const IDLE = { status: 'idle', width: 0, height: 0 }

// Đo kích thước thật (naturalWidth × naturalHeight) của một URL ảnh.
// Trả về { status: 'idle'|'loading'|'loaded'|'error', width, height }.
// Ảnh được trình duyệt cache nên không tốn thêm băng thông so với preview.
export function useImageDimensions(url) {
  const trimmed = resolveDisplayUrl((url || '').trim())
  const [dims, setDims] = useState(IDLE)

  useEffect(() => {
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDims(IDLE)
      return
    }
    let alive = true
    setDims({ status: 'loading', width: 0, height: 0 })
    const img = new Image()
    img.onload = () => {
      if (alive) setDims({ status: 'loaded', width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      if (alive) setDims({ status: 'error', width: 0, height: 0 })
    }
    img.src = trimmed
    return () => {
      alive = false
    }
  }, [trimmed])

  return dims
}

// Đo kích thước ảnh ngay trên file người dùng vừa chọn, trước khi gọi API tải lên.
// Không chỉnh sửa file; object URL chỉ tồn tại trong lúc đọc và luôn được thu hồi.
export function readImageFileDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('missing-image-file'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    const cleanup = () => {
      img.onload = null
      img.onerror = null
      URL.revokeObjectURL(objectUrl)
    }
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      cleanup()
      if (width > 0 && height > 0) resolve({ width, height })
      else reject(new Error('missing-image-dimensions'))
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('unreadable-image'))
    }
    img.src = objectUrl
  })
}

// Đo kích thước thật của một file video (mp4 trong thư viện) qua metadata.
// Link ngoài như YouTube không đọc được kích thước → trả về 'error', không cảnh báo.
export function useVideoDimensions(url) {
  const trimmed = resolveDisplayUrl((url || '').trim())
  const [dims, setDims] = useState(IDLE)

  useEffect(() => {
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDims(IDLE)
      return
    }
    let alive = true
    setDims({ status: 'loading', width: 0, height: 0 })
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const onMeta = () => {
      if (alive) setDims({ status: 'loaded', width: video.videoWidth, height: video.videoHeight })
    }
    const onError = () => {
      if (alive) setDims({ status: 'error', width: 0, height: 0 })
    }
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

// Đo kích thước thật của một ảnh/video rồi so TỈ LỆ với spec khuyến nghị (imageRecommendations.js)
// — kích thước không còn là điều kiện chặn, chỉ còn hiển thị dạng gợi ý (MediaRequirementHint).
// `status` là trạng thái đo kích thước ('idle'|'loading'|'loaded'|'error'); với ảnh danh mục,
// không đọc được kích thước cũng bị chặn vì backend cần kiểm tra exact 1:1.
export function useMediaValidation(kind, url, recommend) {
  const shouldCheck = Boolean(recommend && url)
  const imageDims = useImageDimensions(kind !== 'video' && shouldCheck ? url : '')
  const videoDims = useVideoDimensions(kind === 'video' && shouldCheck ? url : '')
  const dims = kind === 'video' ? videoDims : imageDims

  if (!shouldCheck) return { status: 'idle', blocked: false, reasons: null, width: 0, height: 0 }
  if (dims.status === 'error' && recommend?.exactRatio) {
    return { ...dims, blocked: true, reasons: ['unreadableDimensions'] }
  }
  if (dims.status !== 'loaded') return { ...dims, blocked: false, reasons: null }

  const reasons = evaluateImageDimensions(dims.width, dims.height, recommend)
  return {
    status: 'loaded',
    blocked: Boolean(reasons),
    reasons,
    width: dims.width,
    height: dims.height,
  }
}
