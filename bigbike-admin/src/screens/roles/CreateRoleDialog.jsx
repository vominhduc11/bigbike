import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CreateRoleDialog({ onConfirm, onCancel, saving }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [id, setId]   = useState('')
  const [desc, setDesc] = useState('')
  const [idManual, setIdManual] = useState(false)
  const [showId, setShowId] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(v) {
    setName(v)
    if (!idManual) {
      setId(v.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))
    }
  }

  function handleIdChange(v) {
    setIdManual(true)
    setId(v.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError(t('roles.createRoleErrorName')); return }
    if (!id.trim())   { setError(t('roles.createRoleErrorId'));   return }
    setError('')
    onConfirm({ id: id.trim(), name: name.trim(), description: desc.trim(), permissions: [] })
  }

  return (
    <div
      className="roles-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-role-title"
      onClick={onCancel}
    >
      <form className="roles-confirm-dialog max-w-[460px]" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-5">
          <Plus size={18} className="text-primary shrink-0" aria-hidden />
          <strong id="create-role-title" className="text-base text-foreground">
            {t('roles.createRoleTitle')}
          </strong>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="create-role-name" className="block text-sm font-semibold mb-1 text-foreground">
              {t('roles.createRoleNameLabel')} <span className="text-danger">*</span>
            </label>
            <Input
              id="create-role-name"
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={t('roles.createRoleNamePlaceholder')}
              autoFocus
             />
          </div>

          {/* Technical ID — hidden by default, auto-generated from name */}
          {!showId && id && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t('roles.createRoleIdAutoLabel')}: </span>
              <code className="font-mono text-foreground">{id}</code>
              <button
                type="button"
                onClick={() => setShowId(true)}
                className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer underline p-0"
              >
                {t('roles.createRoleIdCustomize')}
              </button>
            </div>
          )}

          {showId && (
            <div>
              <label htmlFor="create-role-id" className="block text-sm font-semibold mb-1 text-foreground">
                {t('roles.createRoleIdLabel')} <span className="text-danger">*</span>
              </label>
              <Input
                id="create-role-id"
                type="text"
                value={id}
                onChange={e => handleIdChange(e.target.value)}
                placeholder={t('roles.createRoleIdPlaceholder')}
                className="font-mono"
               />
              <div className="text-xs text-muted-foreground mt-1">
                {t('roles.createRoleIdHint')}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="create-role-desc" className="block text-sm font-semibold mb-1 text-foreground">
              {t('roles.createRoleDescLabel')}
            </label>
            <Input
              id="create-role-desc"
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={t('roles.createRoleDescPlaceholder')}
             />
          </div>
        </div>

        {error && (
          <div className="mt-2.5 text-sm text-danger" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button size="sm" type="submit" loading={saving} className="flex items-center gap-1.5">
            {t('roles.createRoleBtn')}
          </Button>
        </div>
      </form>
    </div>
  )
}
