import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { fetchAttributes, fetchAttributeValues, updateAttributeValueSwatch } from '../lib/adminApi'
import { MediaPickerModal } from '../components/MediaPickerModal'
import { StatePanel } from '../components/StatePanel'

const COLOR_KINDS = new Set(['color', 'colour'])

function isColorKind(kind) {
  return COLOR_KINDS.has((kind || '').toLowerCase())
}

function SwatchPreview({ colorHex, swatchImageUrl }) {
  if (swatchImageUrl) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 52,
          height: 52,
          border: '1px solid #000',
          backgroundColor: '#f5f5f5',
          backgroundImage: `url(${swatchImageUrl})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          flexShrink: 0,
        }}
      />
    )
  }
  if (colorHex) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 52,
          height: 52,
          border: '1px solid #000',
          backgroundColor: colorHex,
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 52,
        height: 52,
        border: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        flexShrink: 0,
      }}
    />
  )
}

function ColorAttributeSection({ attribute, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pickerValueId, setPickerValueId] = useState(null)
  const [drafts, setDrafts] = useState({})

  const { data: values = [], isLoading, isError } = useQuery({
    queryKey: ['attribute-values', attribute.id],
    queryFn: () => fetchAttributeValues(attribute.id),
  })

  const saveMutation = useMutation({
    mutationFn: ({ valueId, colorHex, swatchImageUrl }) =>
      updateAttributeValueSwatch(valueId, { colorHex, swatchImageUrl }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attribute-values', attribute.id] })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[variables.valueId]
        return next
      })
      toast.success(t('attributes.successUpdate'))
    },
    onError: (err) => {
      toast.error(err?.message || t('attributes.errSaveFailed'))
    },
  })

  function getDraft(valueId, field, fallback) {
    return drafts[valueId]?.[field] ?? fallback
  }

  function setDraft(valueId, field, val) {
    setDrafts((prev) => ({
      ...prev,
      [valueId]: { ...(prev[valueId] || {}), [field]: val },
    }))
  }

  function handleSave(value) {
    const draft = drafts[value.id] || {}
    saveMutation.mutate({
      valueId: value.id,
      colorHex: draft.colorHex !== undefined ? draft.colorHex : value.colorHex,
      swatchImageUrl: draft.swatchImageUrl !== undefined ? draft.swatchImageUrl : value.swatchImageUrl,
    })
  }

  if (isLoading) {
    return <p className="text-muted" style={{ padding: '8px 0' }}>{t('common.loading')}</p>
  }

  if (isError) {
    return <p className="text-danger" style={{ padding: '8px 0' }}>{t('attributes.loadValuesError', { defaultValue: 'Không tải được danh sách màu.' })}</p>
  }

  return (
    <>
      {pickerValueId && (
        <MediaPickerModal
          onSelect={(url) => {
            setDraft(pickerValueId, 'swatchImageUrl', url)
            setPickerValueId(null)
          }}
          onClose={() => setPickerValueId(null)}
        />
      )}
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 64 }}>{t('attributes.colPreview')}</th>
              <th>{t('attributes.colLabel')}</th>
              <th style={{ width: 160 }}>{t('attributes.colHex')}</th>
              <th style={{ width: 200 }}>{t('attributes.colImage')}</th>
              {canUpdate && <th style={{ width: 80 }} />}
            </tr>
          </thead>
          <tbody>
            {values.map((value) => {
              const draftHex = getDraft(value.id, 'colorHex', value.colorHex ?? '')
              const draftUrl = getDraft(value.id, 'swatchImageUrl', value.swatchImageUrl ?? '')
              const isSaving = saveMutation.isPending && saveMutation.variables?.valueId === value.id

              return (
                <tr key={value.id}>
                  <td>
                    <SwatchPreview colorHex={draftHex} swatchImageUrl={draftUrl} />
                  </td>
                  <td>
                    <strong>{value.label}</strong>
                    <br />
                    <span className="text-muted" style={{ fontSize: 12 }}>{value.slug}</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="bb-query-input"
                      style={{ width: '100%', fontFamily: 'monospace' }}
                      value={draftHex}
                      placeholder="#RRGGBB"
                      maxLength={7}
                      disabled={!canUpdate}
                      onChange={(e) => setDraft(value.id, 'colorHex', e.target.value)}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {draftUrl && (
                        <img
                          src={draftUrl}
                          alt=""
                          style={{ width: 32, height: 32, objectFit: 'contain', border: '1px solid #ccc', background: '#f5f5f5' }}
                        />
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setPickerValueId(value.id)}
                        >
                          <Image size={12} />
                          {t('attributes.btnSelectImage')}
                        </button>
                      )}
                      {canUpdate && draftUrl && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          title={t('common.remove', { defaultValue: 'Xoá' })}
                          onClick={() => setDraft(value.id, 'swatchImageUrl', '')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                  {canUpdate && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={isSaving}
                        onClick={() => handleSave(value)}
                      >
                        {isSaving ? '…' : t('attributes.btnSave')}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function AttributeListScreen({ canUpdate }) {
  const { t } = useTranslation()

  const { data: attributes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attributes'],
    queryFn: fetchAttributes,
  })

  const colorAttributes = attributes.filter((a) => isColorKind(a.kind))
  const otherAttributes = attributes.filter((a) => !isColorKind(a.kind))

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('attributes.eyebrow', { defaultValue: 'Catalog' })}</p>
          <h1>{t('attributes.title')}</h1>
          <p className="desc">{t('attributes.description', { defaultValue: 'Quản lý swatch ảnh và mã màu cho các thuộc tính màu sắc sản phẩm.' })}</p>
        </div>
      </div>

      {isError && (
        <StatePanel
          tone="danger"
          title={t('attributes.loadError', { defaultValue: 'Không tải được thuộc tính' })}
          description={error?.message || ''}
          actionLabel={t('common.retry')}
          onAction={refetch}
        />
      )}

      {isLoading && (
        <StatePanel tone="info" title={t('common.loading')} description={t('common.pleaseWait')} />
      )}

      {!isLoading && !isError && (
        <>
          {colorAttributes.length === 0 && (
            <StatePanel
              tone="neutral"
              title={t('attributes.noColorAttrs', { defaultValue: 'Chưa có thuộc tính màu sắc' })}
              description={t('attributes.noColorAttrsDesc', { defaultValue: 'Các thuộc tính có kind="color" sẽ hiển thị ở đây để quản lý swatch.' })}
            />
          )}

          {colorAttributes.map((attr) => (
            <div key={attr.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Palette size={16} />
                <strong>{attr.name}</strong>
                <span className="text-muted" style={{ fontSize: 12 }}>({attr.code} · {attr.valueCount} {t('attributes.values', { defaultValue: 'màu' })})</span>
              </div>
              <div className="card-body card-body--flush">
                <ColorAttributeSection attribute={attr} canUpdate={canUpdate} />
              </div>
            </div>
          ))}

          {otherAttributes.length > 0 && (
            <div className="card">
              <div className="card-header">
                <strong>{t('attributes.otherTitle', { defaultValue: 'Thuộc tính khác' })}</strong>
              </div>
              <div className="card-body card-body--flush">
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('attributes.colName', { defaultValue: 'Tên' })}</th>
                        <th>{t('attributes.colCode', { defaultValue: 'Code' })}</th>
                        <th>{t('attributes.colKind', { defaultValue: 'Loại' })}</th>
                        <th>{t('attributes.colCount', { defaultValue: 'Số giá trị' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherAttributes.map((attr) => (
                        <tr key={attr.id}>
                          <td>{attr.name}</td>
                          <td><code>{attr.code}</code></td>
                          <td>{attr.kind}</td>
                          <td>{attr.valueCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
