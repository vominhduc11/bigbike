import { Shield, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from './Badge'
import { getRoleDisplayName } from './constants'

export function RoleSidebar({ roles, selectedId, onSelect, editMode, isDirty, canUpdate, onCreateRole }) {
  const { t } = useTranslation()
  return (
    <div className="roles-sidebar">
      {roles.map(role => {
        const isActive = role.id === selectedId
        const displayName = getRoleDisplayName(role, t)
        const descKey = `roles.roleDesc_${role.id}`
        const desc = t(descKey, { defaultValue: role.description || '' })
        const showDesc = desc && desc !== displayName
        return (
          <Button
            variant="unstyled"
            key={role.id}
            className={`roles-role-item${isActive ? ' active' : ''}`}
            onClick={() => onSelect(role.id)}
            title={editMode && isDirty && !isActive ? t('roles.discardChanges') : undefined}
            aria-current={isActive ? 'true' : undefined}
          >
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <Shield size={13} className="text-muted-foreground shrink-0" aria-hidden />
              <span className="font-semibold text-sm text-foreground">
                {displayName}
              </span>
              <Badge isSystem={role.isSystem} assignedUserCount={role.assignedUserCount} />
            </div>
            {showDesc && (
              <div className="text-xs text-muted-foreground pl-5 mt-0.5">
                {desc}
              </div>
            )}
          </Button>
        )
      })}

      {canUpdate && (
        <div className="px-3 py-2.5 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onCreateRole}
            className="w-full flex items-center gap-1.5 justify-center">
            <Plus size={14} aria-hidden />
            {t('roles.createRoleBtn')}
          </Button>
        </div>
      )}
    </div>
  )
}
