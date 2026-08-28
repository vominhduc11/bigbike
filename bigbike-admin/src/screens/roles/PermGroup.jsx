import { Check, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { MODULE_LABELS, PERM_LABEL_KEY_MAP, requiredBy } from './constants'

// Một nhóm quyền = một section thu gọn (chống ngợp khi có nhiều nhóm cùng mở).
// Tiêu đề kèm tóm tắt "đã cấp/tổng" để quét nhanh mà không cần bung nhóm.
// `open`/`onToggleOpen` do RoleDetail điều khiển.
export function PermGroup({ group, catalog, activePerms, editMode, onToggle, isSuperAdmin, showCodes = false, open, onToggleOpen }) {
  const { t } = useTranslation()
  const total = group.permissions.length
  const grantedCount = isSuperAdmin ? total : group.permissions.filter(p => activePerms.has(p.key)).length

  return (
    <CollapsibleSection
      title={t(group.groupKey, { defaultValue: MODULE_LABELS[group.moduleKey] || 'Nhóm quyền khác' })}
      open={open}
      onToggle={onToggleOpen}
      className="gap-2"
      bodyClassName="pl-6 pr-4 sm:pl-10"
      badge={
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {t('roles.groupGrantedCount', { granted: grantedCount, total, defaultValue: '{{granted}}/{{total}} quyền' })}
        </span>
      }
    >
      <div>
        {group.permissions.map(perm => {
          const granted = isSuperAdmin || activePerms.has(perm.key)
          const isSensitive = perm.sensitive
          const labelKey = PERM_LABEL_KEY_MAP[perm.key]
          const label = labelKey ? t(labelKey, { defaultValue: 'Quyền khác' }) : 'Quyền khác'
          const permId = `perm-${perm.key.replace(/[^a-z0-9]/gi, '-')}`
          const canEdit = editMode && !isSuperAdmin
          const requiredByKeys = requiredBy(perm.key, activePerms, catalog)

          return (
            <div key={perm.key} className="roles-perm-row">
              {canEdit ? (
                <Checkbox
                  id={permId}
                  checked={granted}
                  onCheckedChange={() => onToggle(perm.key, label)}
                  className="w-4 h-4 cursor-pointer shrink-0 mt-1"
                 />
              ) : (
                <div
                  className="w-4 h-4 shrink-0 flex items-center justify-center mt-1"
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
                  'flex-1 text-sm flex items-center gap-2 flex-wrap min-w-0 py-1',
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
                {perm.kind === 'SUPPORTING' ? (
                  <span className="bb-badge bb-badge-neutral text-xs">Hỗ trợ</span>
                ) : null}
                {perm.kind === 'EXPORT' ? (
                  <span className="bb-badge bb-badge-warning text-xs">Xuất dữ liệu</span>
                ) : null}
                {requiredByKeys.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Bắt buộc bởi {requiredByKeys.map(key => {
                      const keyLabel = PERM_LABEL_KEY_MAP[key]
                      return keyLabel ? t(keyLabel, { defaultValue: 'quyền liên quan' }) : 'quyền liên quan'
                    }).join(', ')}
                  </span>
                ) : null}
                {perm.requires?.length > 0 ? (
                  <span className="basis-full text-xs text-muted-foreground">
                    Cần: {perm.requires.map(key => {
                      const keyLabel = PERM_LABEL_KEY_MAP[key]
                      return keyLabel ? t(keyLabel, { defaultValue: 'quyền liên quan' }) : 'quyền liên quan'
                    }).join(', ')}
                  </span>
                ) : null}
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
