import { useTranslation } from 'react-i18next'
import { AlertCircle, ExternalLink, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingField } from './SettingField'
import { groupBySection, SECTION_GUIDE, STOREFRONT_BASE, KEY_GUIDE } from './constants'

export function SettingTabPanel({ title, items, canUpdate, drafts, draftsEn, errors, onDraftChange, onDraftChangeEn, onDraftBlur, onSave, onDiscard, saving }) {
  const { t } = useTranslation()
  const dirtyCount = items.filter(
    (s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined
  ).length

  const hasError = items.some((s) => errors[s.key])

  return (
    <div className="bb-card">
      <div className="bb-card-header"><h3>{title}</h3></div>
      <div className="bb-card-body">
        {groupBySection(items).map(({ sec, fields }) => {
          const meta = SECTION_GUIDE[sec]
          const url = meta?.path ? STOREFRONT_BASE + meta.path : null
          return (
            <div key={sec}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, margin: '18px 0 12px', paddingBottom: 6,
                  borderBottom: '1px solid var(--bb-border)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{meta?.title || 'Khác'}</span>
                {url ? (
                  <a
                    href={`${url}#bbf=${sec}`} target="_blank" rel="noreferrer"
                    className="bb-btn bb-btn-secondary bb-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                  >
                    <ExternalLink size={13} /> Xem trên web
                  </a>
                ) : meta?.internal ? (
                  <span className="bb-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                    <Lock size={12} /> Nội bộ
                  </span>
                ) : null}
              </div>
              {fields.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  where={KEY_GUIDE[setting.key]?.[1]}
                  canUpdate={canUpdate}
                  draft={drafts[setting.key]}
                  draftEn={draftsEn[setting.key]}
                  error={errors[setting.key]}
                  onChange={onDraftChange}
                  onChangeEn={onDraftChangeEn}
                  onBlur={onDraftBlur}
                />
              ))}
            </div>
          )
        })}
      </div>

      {canUpdate && dirtyCount > 0 && (
        <div className="card-foot">
          <span className="settings-unsaved-hint">
            <AlertCircle size={14} />
            {t('settings.unsavedCount', { count: dirtyCount })}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" loading={saving} disabled={hasError} onClick={onSave}>
              {t('settings.saveCount', { count: dirtyCount })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
