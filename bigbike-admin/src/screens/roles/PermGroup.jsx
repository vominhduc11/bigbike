import { Check, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { PERM_LABEL_KEY_MAP } from './constants'

// Một nhóm quyền = một section thu gọn (chống ngợp khi có nhiều nhóm cùng mở).
// Tiêu đề kèm tóm tắt "đã cấp/tổng" để quét nhanh mà không cần bung nhóm.
// `open`/`onToggleOpen` do RoleDetail điều khiển.
export function PermGroup({ group, activePerms, editMode, onToggle, onBulk, isSuperAdmin, showCodes = false, open, onToggleOpen }) {
  const { t } = useTranslation()
  const canBulk = editMode && !isSuperAdmin && typeof onBulk === 'function'
  const total = group.permissions.length
  const grantedCount = isSuperAdmin ? total : group.permissions.filter(p => activePerms.has(p.key)).length

  return (
    <CollapsibleSection
      title={t(group.groupKey)}
      open={open}
      onToggle={onToggleOpen}
      badge={
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {t('roles.groupGrantedCount', { granted: grantedCount, total, defaultValue: '{{granted}}/{{total}} quyền' })}
        </span>
      }
    >
      <div>
        {/* Cấp / bỏ cả nhóm trong 1 chạm (quyền nhạy cảm vẫn bật riêng để xác nhận) */}
        {canBulk && (
          <div className="flex items-center justify-end gap-1 mb-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onBulk(group, true)}>
              {t('roles.selectAllGroup', { defaultValue: 'Chọn tất cả' })}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onBulk(group, false)}>
              {t('roles.clearGroup', { defaultValue: 'Bỏ chọn' })}
            </Button>
          </div>
        )}

        {group.permissions.map(perm => {
          const granted = isSuperAdmin || activePerms.has(perm.key)
          const isSensitive = perm.sensitive
          const labelKey = PERM_LABEL_KEY_MAP[perm.key]
          const label = labelKey ? t(labelKey, { defaultValue: perm.key }) : perm.key
          const permId = `perm-${perm.key.replace(/[^a-z0-9]/gi, '-')}`
          const canEdit = editMode && !isSuperAdmin

          return (
            <div key={perm.key} className="roles-perm-row">
              {canEdit ? (
                <Checkbox
                  id={permId}
                  checked={granted}
                  onCheckedChange={() => onToggle(perm.key, label)}
                  className="w-4 h-4 cursor-pointer shrink-0 mt-0.5"
                 />
              ) : (
                <div
                  className="w-4 h-4 shrink-0 flex items-center justify-center mt-0.5"
                  aria-hidden="true"
                >
                  {granted
                    ? <Check size={14} className="text-success" />
                    : <X size={14} className="text-border" />
                  }
                </div>
              )}

              <label
                htmlFor={canEdit ? permId : undefined}
                className={cn(
                  'flex-1 text-sm flex items-center gap-1.5 flex-wrap min-w-0 py-0.5',
                  canEdit ? 'cursor-pointer' : 'cursor-default',
                  granted ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <span>{label}</span>
                {isSensitive && (
                  <span
                    title={t('roles.sensitivePermNote')}
                    aria-label={t('roles.sensitivePermNote')}
                    className="text-warning inline-flex items-center"
                  >
                    <AlertTriangle size={12} aria-hidden />
                  </span>
                )}
              </label>

              {/* Mã kỹ thuật — ẩn mặc định (bật qua "Hiện mã kỹ thuật"); nhãn nghiệp vụ là chính */}
              {showCodes && (
                <span className="roles-perm-code" title={`${t('roles.permCode')}: ${perm.key}`}>
                  {perm.key}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
