import { useEffect, useState } from 'react'
import { MediaPickerModal } from './MediaPickerModal'

function IconLibrary() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ImagePreview({ url }) {
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const trimmed = url.trim()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!trimmed) { setOk(false); return }
    setLoading(true)
    const img = new Image()
    img.loading = 'eager'
    img.onload = () => { setOk(true); setLoading(false) }
    img.onerror = () => { setOk(false); setLoading(false) }
    img.src = trimmed
  }, [trimmed])

  if (!trimmed) return null
  if (loading) return <div className="img-preview img-preview-loading">Đang tải...</div>
  if (!ok) return <div className="img-preview img-preview-error">URL ảnh không hợp lệ</div>
  return <img src={trimmed} alt="preview" className="img-preview" loading="eager" />
}

export function ImageUrlInput({ value, onChange, alt, onAltChange, disabled, error }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasImage = Boolean(value?.trim())

  return (
    <div className="image-url-input">
      <div className="image-url-input-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm image-url-pick-btn"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          <IconLibrary />
          {hasImage ? 'Đổi ảnh' : 'Chọn từ thư viện'}
        </button>
        {hasImage && (
          <button
            type="button"
            className="btn btn-icon btn-danger-ghost"
            onClick={() => { onChange(''); onAltChange?.('') }}
            disabled={disabled}
            aria-label="Xóa ảnh"
          >
            ✕
          </button>
        )}
      </div>
      {error && <small className="field-error">{error}</small>}
      <ImagePreview url={value} />
      {hasImage && onAltChange !== undefined && (
        <input
          className="control-input"
          type="text"
          placeholder="Alt text ảnh (mô tả ngắn cho SEO & accessibility)"
          value={alt ?? ''}
          onChange={(e) => onAltChange(e.target.value)}
          disabled={disabled}
          maxLength={255}
          style={{ marginTop: 8 }}
        />
      )}
      {pickerOpen && (
        <MediaPickerModal
          onSelect={(url) => { onChange(url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
