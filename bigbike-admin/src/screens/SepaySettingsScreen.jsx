import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { fetchBankTransferSettings, updateBankTransferSettings } from '../lib/adminApi'

const VIETNAMESE_BANKS = [
  { name: 'Vietcombank (VCB)',          bin: '970436' },
  { name: 'BIDV',                        bin: '970418' },
  { name: 'VietinBank (CTG)',            bin: '970415' },
  { name: 'Agribank',                    bin: '970405' },
  { name: 'Techcombank (TCB)',           bin: '970407' },
  { name: 'MB Bank',                     bin: '970422' },
  { name: 'ACB',                         bin: '970416' },
  { name: 'VPBank',                      bin: '970432' },
  { name: 'TPBank',                      bin: '970423' },
  { name: 'Sacombank (STB)',             bin: '970403' },
  { name: 'HDBank',                      bin: '970437' },
  { name: 'VIB',                         bin: '970441' },
  { name: 'SHB',                         bin: '970443' },
  { name: 'Eximbank (EIB)',              bin: '970431' },
  { name: 'MSB (Hàng Hải)',              bin: '970426' },
  { name: 'SeABank',                     bin: '970440' },
  { name: 'OCB (Phương Đông)',           bin: '970448' },
  { name: 'LienVietPostBank',            bin: '970449' },
  { name: 'NCB (Quốc Dân)',             bin: '970419' },
  { name: 'ABBank (An Bình)',            bin: '970425' },
  { name: 'BacABank (Bắc Á)',           bin: '970409' },
  { name: 'BaoVietBank (Bảo Việt)',     bin: '970438' },
  { name: 'CBBank (Xây Dựng)',          bin: '970444' },
  { name: 'DongABank (Đông Á)',         bin: '970406' },
  { name: 'GPBank (Dầu Khí Toàn Cầu)', bin: '970408' },
  { name: 'KienLongBank (Kiên Long)',   bin: '970452' },
  { name: 'NamABank (Nam Á)',           bin: '970428' },
  { name: 'PGBank (Xăng Dầu)',         bin: '970430' },
  { name: 'PVcomBank',                   bin: '970412' },
  { name: 'SCB (Sài Gòn)',             bin: '970429' },
  { name: 'VietABank (Việt Á)',         bin: '970427' },
  { name: 'HSBC Việt Nam',              bin: '458761' },
  { name: 'Standard Chartered',          bin: '970410' },
  { name: 'Shinhan Bank',                bin: '970424' },
  { name: 'Woori Bank',                  bin: '970457' },
  { name: 'CIMB Bank',                   bin: '422589' },
  { name: 'UOB Việt Nam',               bin: '970458' },
]

function buildQrUrl(bankBin, accountNumber, accountHolder) {
  if (!bankBin || !accountNumber || !accountHolder) return null
  const name = encodeURIComponent(accountHolder)
  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact.jpg?accountName=${name}&amount=0`
}

export function SepaySettingsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', settings: null })
  const [form, setForm] = useState({})
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchBankTransferSettings()
      .then((s) => {
        if (!active) return
        setState({ status: 'success', settings: s })
        setForm({
          enabled: s.enabled,
          bankBin: s.bankBin || '',
          bankName: s.bankName || '',
          accountNumber: s.accountNumber || '',
          accountHolder: s.accountHolder || '',
          timeoutHours: s.timeoutHours || 48,
        })
        setConfirmAccountNumber(s.accountNumber || '')
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', settings: null, error: e.message })
      })
    return () => { active = false }
  }, [fetchKey])

  const selectedBank = VIETNAMESE_BANKS.find((b) => b.bin === form.bankBin) || null
  const accountNumberChanged = form.accountNumber !== (state.settings?.accountNumber || '')
  const qrUrl = buildQrUrl(form.bankBin, form.accountNumber, form.accountHolder)

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }))
    if (formErrors[key]) setFormErrors((p) => ({ ...p, [key]: '' }))
  }

  function handleBankSelect(bin) {
    const bank = VIETNAMESE_BANKS.find((b) => b.bin === bin)
    setForm((p) => ({
      ...p,
      bankBin: bin,
      bankName: bank?.name || '',
    }))
  }

  function handleAccountNumberChange(value) {
    setField('accountNumber', value)
    setConfirmAccountNumber('')
  }

  function validate() {
    const errs = {}
    if (accountNumberChanged && confirmAccountNumber !== form.accountNumber) {
      errs.confirmAccountNumber = t('sepay.accountMismatch')
    }
    return errs
  }

  async function handleSave(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs)
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveOk(false)
    try {
      const updated = await updateBankTransferSettings({
        enabled: form.enabled,
        bankName: form.bankName,
        bankBin: form.bankBin,
        accountNumber: form.accountNumber,
        accountHolder: form.accountHolder,
        timeoutHours: Number(form.timeoutHours),
      })
      setState((p) => ({ ...p, settings: updated }))
      setConfirmAccountNumber(form.accountNumber)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 8000)
    } catch (err) {
      setSaveError(err.message || t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('common.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('sepay.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => setFetchKey((k) => k + 1)}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('sepay.eyebrow')}</p>
          <h1>{t('sepay.title')}</h1>
          <p>{t('sepay.description')}</p>
        </div>
      </header>

      {/* Manual confirmation warning — top-level, always visible */}
      <div style={{
        background: 'var(--admin-color-warning-bg, #fef9c3)',
        border: '1px solid var(--admin-color-warning-border, #facc15)',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: '0.9rem',
        color: 'var(--admin-color-warning-text, #713f12)',
        lineHeight: 1.5,
      }}>
        {t('sepay.manualWarning')}
      </div>

      {/* Disabled state warning */}
      {!form.enabled && (
        <div style={{
          background: 'var(--admin-color-danger-bg, #fee2e2)',
          border: '1px solid var(--admin-color-danger-border, #fca5a5)',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 20,
          fontSize: '0.875rem',
          color: 'var(--admin-color-danger-text, #991b1b)',
        }}>
          {t('sepay.disabledWarning')}
        </div>
      )}

      <div className="sepay-settings-layout">
        {/* Bank info form */}
        <div className="detail-section">
          <div className="detail-section-header">
            <h2>{t('sepay.bankInfoTitle')}</h2>
          </div>
          <form onSubmit={handleSave}>
            {/* Enable toggle */}
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">{t('sepay.enabled')}</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: canUpdate ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={!!form.enabled}
                  disabled={!canUpdate}
                  onChange={(e) => setField('enabled', e.target.checked)}
                />
                <span>{form.enabled ? t('common.enabled') : t('common.disabled')}</span>
              </label>
            </div>

            {/* Bank dropdown */}
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">{t('sepay.bank')}</label>
              <select
                className="control-input"
                style={{ width: '100%' }}
                value={form.bankBin}
                disabled={!canUpdate || !form.enabled}
                onChange={(e) => handleBankSelect(e.target.value)}
              >
                <option value="">{t('sepay.selectBank')}</option>
                {VIETNAMESE_BANKS.map((b) => (
                  <option key={b.bin} value={b.bin}>{b.name}</option>
                ))}
              </select>
              {selectedBank && (
                <p style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
                  Mã ngân hàng: {selectedBank.bin}
                </p>
              )}
            </div>

            {/* Account number */}
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">{t('sepay.accountNumber')}</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                type="text"
                value={form.accountNumber ?? ''}
                disabled={!canUpdate || !form.enabled}
                onChange={(e) => handleAccountNumberChange(e.target.value)}
              />
            </div>

            {/* Confirm account number — shown when account changed */}
            {accountNumberChanged && (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">{t('sepay.confirmAccountNumber')}</label>
                <input
                  className="control-input"
                  style={{
                    width: '100%',
                    borderColor: formErrors.confirmAccountNumber ? 'var(--admin-color-danger, #ef4444)' : undefined,
                  }}
                  type="text"
                  value={confirmAccountNumber}
                  disabled={!canUpdate}
                  onChange={(e) => {
                    setConfirmAccountNumber(e.target.value)
                    if (formErrors.confirmAccountNumber) setFormErrors((p) => ({ ...p, confirmAccountNumber: '' }))
                  }}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
                  {t('sepay.confirmAccountNumberHint')}
                </p>
                {formErrors.confirmAccountNumber && (
                  <p className="field-error" style={{ marginTop: 4 }}>{formErrors.confirmAccountNumber}</p>
                )}
              </div>
            )}

            {/* Account holder */}
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">{t('sepay.accountHolder')}</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                type="text"
                value={form.accountHolder ?? ''}
                disabled={!canUpdate || !form.enabled}
                onChange={(e) => setField('accountHolder', e.target.value)}
              />
            </div>

            {/* Timeout hours */}
            <div style={{ marginBottom: 20 }}>
              <label className="field-label">{t('sepay.timeoutHours')}</label>
              <input
                className="control-input"
                style={{ width: 120 }}
                type="number"
                min={1}
                value={form.timeoutHours ?? 48}
                disabled={!canUpdate || !form.enabled}
                onChange={(e) => setField('timeoutHours', e.target.value)}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
                {t('sepay.timeoutHoursHint')}
              </p>
            </div>

            {saveError && <p className="field-error" style={{ marginBottom: 8 }}>{saveError}</p>}
            {saveOk && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <p style={{ color: 'var(--admin-color-success, #16a34a)', fontSize: '0.875rem', margin: 0 }}>
                  ✓ {t('common.saved')}
                </p>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--admin-color-text-muted)', padding: 0 }}
                  onClick={() => setSaveOk(false)}
                >
                  ✕
                </button>
              </div>
            )}

            {canUpdate && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            )}
          </form>
        </div>

        {/* QR preview */}
        <div className="detail-section">
          <div className="detail-section-header">
            <h2>{t('sepay.qrPreviewTitle')}</h2>
          </div>
          {qrUrl ? (
            <>
              <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)', marginBottom: 12 }}>
                {t('sepay.qrPreviewDesc')}
              </p>
              <img
                src={qrUrl}
                alt="VietQR preview"
                style={{ maxWidth: 240, width: '100%', borderRadius: 8, border: '1px solid var(--admin-color-border)' }}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', marginTop: 8 }}>
                {form.bankName && <><strong>{form.bankName}</strong> · </>}
                {form.accountNumber} · {form.accountHolder}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--admin-color-text-muted)', lineHeight: 1.6 }}>
              {t('sepay.qrPreviewEmpty')}
            </p>
          )}

          {/* Manual note at bottom of preview panel */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--admin-color-border)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('sepay.manualNoteTitle')}</p>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--admin-color-text-muted)', margin: 0 }}>
              {t('sepay.manualNoteBody')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
