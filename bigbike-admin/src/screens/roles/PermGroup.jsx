import { Check, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { PERM_LABEL_KEY_MAP } from './constants'

export function PermGroup({ group, activePerms, editMode, onToggle, isSuperAdmin }) {
  const { t } = useTranslation()
  return (
    <div className="mb-6">
      <div className="text-xs font-bold tracking-wider uppercase text-muted-foreground py-1.5 border-b-2 border-border mb-1">
        {t(group.groupKey)}
      </div>

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
                'flex-1 text-sm flex items-center gap-1.5 flex-wrap min-w-0',
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

            {/* Technical code — for developers; secondary visual weight */}
            <span className="roles-perm-code" title={`${t('roles.permCode')}: ${perm.key}`}>
              {perm.key}
            </span>
          </div>
        )
      })}
    </div>
  )
}
