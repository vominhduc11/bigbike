import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/layout/FormField'
import { Modal } from '@/components/layout/Modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { showConfirm } from '../../lib/confirm'
import { getRoleDisplayName } from './constants'

// F11 — sentinel cho lựa chọn "không nhân bản" trong Select (Radix không cho value rỗng).
const CLONE_NONE = '__none__'

// Bỏ dấu tiếng Việt (á→a, đ→d) trước khi tạo mã ID, tránh ID xấu kiểu "QU_N_L" khi
// tên là "Quản Lý". Chuẩn hoá NFD rồi loại dấu kết hợp + xử lý riêng đ/Đ.
function stripDiacritics(v) {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function CreateRoleDialog({ onConfirm, onCancel, saving, roles = [] }) {
  const { t } = useTranslation()
  const cloneableRoles = roles.filter((role) => role.id !== 'SUPER_ADMIN')
  const [name, setName] = useState('')
  const [id, setId]   = useState('')
  const [desc, setDesc] = useState('')
  const [idManual, setIdManual] = useState(false)
  const [showId, setShowId] = useState(false)
  const [touched, setTouched] = useState({})
  // F11 — nhân bản quyền từ một vai trò có sẵn thay vì luôn bắt đầu trống.
  const [cloneFromId, setCloneFromId] = useState(CLONE_NONE)

  const nameError = !name.trim() ? t('roles.createRoleErrorName') : ''
  const idError   = showId && !id.trim() ? t('roles.createRoleErrorId') : ''

  function handleNameChange(v) {
    setName(v)
    if (!idManual) {
      setId(stripDiacritics(v).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))
    }
  }

  function handleIdChange(v) {
    setIdManual(true)
    setId(stripDiacritics(v).toUpperCase().replace(/[^A-Z0-9_]/g, ''))
  }

  // Đóng khi form còn dữ liệu chưa lưu → xác nhận để không mất bản nháp.
  async function attemptCancel() {
    const dirty = name.trim() || desc.trim() || cloneFromId !== CLONE_NONE
    if (dirty) {
      const ok = await showConfirm(
        t('roles.createDiscardConfirm', { defaultValue: 'Bạn có thay đổi chưa lưu. Đóng sẽ mất các thay đổi đó. Tiếp tục?' }),
        t('roles.createDiscardTitle', { defaultValue: 'Bỏ tạo vai trò?' }),
      )
      if (!ok) return
    }
    onCancel()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (nameError || idError) {
      setTouched({ name: true, id: true })
      return
    }
    const sourceRole = cloneFromId !== CLONE_NONE ? roles.find((r) => r.id === cloneFromId) : null
    const permissions = sourceRole ? [...sourceRole.permissions] : []
    onConfirm({ id: id.trim(), name: name.trim(), description: desc.trim(), permissions })
  }

  return (
    <Modal
      open
      onClose={attemptCancel}
      title={
        <span className="flex items-center gap-2.5">
          <Plus size={18} className="text-primary shrink-0" aria-hidden />
          {t('roles.createRoleTitle')}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={attemptCancel} disabled={saving}>
            {t('roles.cancelBtn')}
          </Button>
          <Button size="sm" type="submit" form="create-role-form" loading={saving} className="flex items-center gap-1.5">
            {t('roles.createRoleBtn')}
          </Button>
        </>
      }
    >
      <form id="create-role-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <FormField
          label={t('roles.createRoleNameLabel')}
          required
          htmlFor="create-role-name"
          error={touched.name ? nameError : ''}
        >
          <Input
            id="create-role-name"
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
            placeholder={t('roles.createRoleNamePlaceholder')}
            autoFocus
          />
        </FormField>

        {/* Technical ID — hidden by default, auto-generated from name */}
        {!showId && id && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t('roles.createRoleIdAutoLabel')}: </span>
            <code className="font-mono text-foreground">{id}</code>
            <Button
              variant="unstyled"
              onClick={() => setShowId(true)}
              className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer underline p-0"
            >
              {t('roles.createRoleIdCustomize')}
            </Button>
          </div>
        )}

        {showId && (
          <FormField
            label={t('roles.createRoleIdLabel')}
            required
            htmlFor="create-role-id"
            helper={t('roles.createRoleIdHint')}
            error={touched.id ? idError : ''}
          >
            <Input
              id="create-role-id"
              type="text"
              value={id}
              onChange={e => handleIdChange(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, id: true }))}
              placeholder={t('roles.createRoleIdPlaceholder')}
              className="font-mono"
            />
          </FormField>
        )}

        <FormField label={t('roles.createRoleDescLabel')} htmlFor="create-role-desc">
          <Input
            id="create-role-desc"
            type="text"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={t('roles.createRoleDescPlaceholder')}
          />
        </FormField>

        {/* F11 — nhân bản quyền từ vai trò có sẵn thay vì luôn bắt đầu trống. */}
        {cloneableRoles.length > 0 && (
          <FormField
            label={t('roles.createRoleCloneLabel')}
            htmlFor="create-role-clone"
            helper={t('roles.createRoleCloneHint')}
          >
            <Select value={cloneFromId} onValueChange={setCloneFromId}>
              <SelectTrigger id="create-role-clone"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={CLONE_NONE}>{t('roles.createRoleCloneNone')}</SelectItem>
                {cloneableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{getRoleDisplayName(r, t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        <p className="m-0 text-xs text-muted-foreground">
          <span className="text-danger">*</span> {t('common.required', { defaultValue: 'Bắt buộc' })}
        </p>
      </form>
    </Modal>
  )
}
