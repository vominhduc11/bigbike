import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/layout/Modal'
import {
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_MIN_PIXELS,
  brandLogoCheckerboardStyle,
} from '@/lib/brandLogoPolicy'

const FRAME_SIZE = 420
const OUTPUT_SIZES = [800, 640, 512, 400]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('BRAND_LOGO_UNREADABLE'))
    image.src = url
  })
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('BRAND_LOGO_EXPORT_FAILED'))
    }, 'image/png')
  })
}

async function createCroppedFile(image, crop, filename) {
  const targetSide = Math.min(crop.width, crop.height)
  const sourceX = clamp(crop.x, 0, image.naturalWidth - targetSide)
  const sourceY = clamp(crop.y, 0, image.naturalHeight - targetSide)
  let lastBlob = null

  for (const outputSize of OUTPUT_SIZES) {
    const canvas = document.createElement('canvas')
    canvas.width = outputSize
    canvas.height = outputSize
    const context = canvas.getContext('2d')
    if (!context) throw new Error('BRAND_LOGO_EXPORT_FAILED')
    context.clearRect(0, 0, outputSize, outputSize)
    context.drawImage(
      image,
      sourceX,
      sourceY,
      targetSide,
      targetSide,
      0,
      0,
      outputSize,
      outputSize,
    )
    const blob = await canvasToBlob(canvas)
    lastBlob = blob
    if (blob.size <= BRAND_LOGO_MAX_BYTES && outputSize >= BRAND_LOGO_MIN_PIXELS) {
      const safeName = (filename || 'brand-logo').replace(/\.[^.]+$/, '') || 'brand-logo'
      return new File([blob], `${safeName}.png`, { type: 'image/png' })
    }
  }

  if (lastBlob && lastBlob.size > BRAND_LOGO_MAX_BYTES) throw new Error('BRAND_LOGO_TOO_LARGE')
  throw new Error('BRAND_LOGO_EXPORT_FAILED')
}

export function BrandLogoCropDialog({ open, sourceUrl, filename, onCancel, onComplete, error }) {
  const { t } = useTranslation()
  const frameRef = useRef(null)
  const imageRef = useRef(null)
  const pointerRef = useRef(null)
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [frameSize, setFrameSize] = useState(FRAME_SIZE)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open || !sourceUrl) {
      // Reset the preview when the parent closes the dialog; this is an intentional
      // synchronization with the externally controlled `open`/`sourceUrl` props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImage(null)
      return undefined
    }
    let alive = true
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setLocalError('')
    loadImage(sourceUrl)
      .then((loaded) => { if (alive) setImage(loaded) })
      .catch(() => { if (alive) setLocalError(t('brands.logo.errors.unreadable')) })
    const measure = () => {
      if (frameRef.current) setFrameSize(frameRef.current.clientWidth || FRAME_SIZE)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      alive = false
      window.removeEventListener('resize', measure)
    }
  }, [open, sourceUrl, t])

  const baseScale = image
    ? Math.max(frameSize / image.naturalWidth, frameSize / image.naturalHeight)
    : 1
  const scale = baseScale * zoom
  const imageWidth = image ? image.naturalWidth * scale : frameSize
  const imageHeight = image ? image.naturalHeight * scale : frameSize
  const maxX = Math.max(0, (imageWidth - frameSize) / 2)
  const maxY = Math.max(0, (imageHeight - frameSize) / 2)

  function setClampedPosition(next) {
    setPosition({
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    })
  }

  function handlePointerDown(event) {
    if (!image || busy) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointerRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position }
  }

  function handlePointerMove(event) {
    const start = pointerRef.current
    if (!start || start.pointerId !== event.pointerId) return
    setClampedPosition({
      x: start.position.x + event.clientX - start.x,
      y: start.position.y + event.clientY - start.y,
    })
  }

  function handlePointerUp(event) {
    if (pointerRef.current?.pointerId === event.pointerId) pointerRef.current = null
  }

  async function handleConfirm() {
    if (!image || busy) return
    setBusy(true)
    setLocalError('')
    try {
      const sourceX = image.naturalWidth / 2 - position.x / scale - frameSize / (2 * scale)
      const sourceY = image.naturalHeight / 2 - position.y / scale - frameSize / (2 * scale)
      const sourceSide = frameSize / scale
      const file = await createCroppedFile(image, { x: sourceX, y: sourceY, width: sourceSide, height: sourceSide }, filename)
      await onComplete(file)
    } catch (cropError) {
      const key = cropError?.message === 'BRAND_LOGO_TOO_LARGE'
        ? 'brands.logo.errors.tooLarge'
        : 'brands.logo.errors.exportFailed'
      setLocalError(t(key))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={t('brands.logo.cropTitle')}
      description={t('brands.logo.cropDescription')}
      onClose={busy ? undefined : onCancel}
      wide
      contentClassName="max-w-2xl"
      actions={(
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!image || busy}>
            {busy ? t('brands.logo.processing') : t('brands.logo.cropDone')}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {t('brands.logo.cropInstruction')}
          </span>
        </p>
        <div
          ref={frameRef}
          className="relative mx-auto aspect-square w-full max-w-md touch-none select-none overflow-hidden border border-border"
          style={brandLogoCheckerboardStyle()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="application"
          aria-label={t('brands.logo.cropAreaLabel')}
        >
          {image ? (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt={t('brands.logo.cropPreviewAlt')}
              draggable="false"
              className="pointer-events-none absolute max-w-none"
              style={{
                width: `${imageWidth}px`,
                height: `${imageHeight}px`,
                left: `calc(50% + ${position.x}px)`,
                top: `calc(50% + ${position.y}px)`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('brands.logo.loading')}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 border-2 border-primary/70" aria-hidden="true" />
        </div>
        <label className="mx-auto flex w-full max-w-md items-center gap-3 text-sm text-muted-foreground">
          <span className="shrink-0">{t('brands.logo.zoom')}</span>
          <Input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value)
              setZoom(nextZoom)
              if (image) {
                const nextScale = baseScale * nextZoom
                const nextWidth = image.naturalWidth * nextScale
                const nextHeight = image.naturalHeight * nextScale
                const nextMaxX = Math.max(0, (nextWidth - frameSize) / 2)
                const nextMaxY = Math.max(0, (nextHeight - frameSize) / 2)
                setPosition((current) => ({
                  x: clamp(current.x, -nextMaxX, nextMaxX),
                  y: clamp(current.y, -nextMaxY, nextMaxY),
                }))
              }
            }}
            disabled={!image || busy}
            className="h-2 w-full cursor-pointer border-0 bg-transparent p-0 shadow-none accent-primary"
            aria-label={t('brands.logo.zoom')}
          />
        </label>
        {(error || localError) ? (
          <p className="flex items-start gap-2 text-sm text-danger" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error || localError}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
