import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SortableRow } from '../../components/Sortable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { TableCell, TableRow } from '@/components/ui/table'
import { TableRowActions } from '../../components/TableRowActions'

export function SortableMenuItem({
  item,
  displayLabel,
  parentLabel,
  rootLabel,
  canUpdate,
  onEdit,
  onDelete,
  isDeleting,
  selected,
  onToggleSelect,
  onToggleStatus,
  isToggling,
  hiddenKeys = [],
}) {
  const { t } = useTranslation()
  const isInactive = item.status === 'INACTIVE'
  const itemName = displayLabel ?? item.label ?? ''

  return (
    <SortableRow id={item.id}>
      {(sortable) => (
        <TableRow
          ref={sortable.setNodeRef}
          style={sortable.style}
          className={cn(isInactive && 'opacity-50', sortable.isDragging && 'opacity-40')}
        >
          {canUpdate && onToggleSelect && (
            <TableCell className="w-12 px-2 py-2">
              <Checkbox
                checked={Boolean(selected)}
                onCheckedChange={onToggleSelect}
                aria-label={t('menus.selectItemAria', {
                  name: itemName,
                  defaultValue: 'Chọn mục {{name}}',
                })}
              />
            </TableCell>
          )}
          <TableCell className="w-12 px-2 py-2">
            {canUpdate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
                title={t('menus.dragReorderTitle', { defaultValue: 'Kéo để sắp xếp (cùng cấp)' })}
                aria-label={t('menus.dragReorderItemAria', {
                  name: itemName,
                  defaultValue: 'Kéo để sắp xếp mục {{name}}',
                })}
                {...sortable.handleProps}
              >
                <GripVertical size={15} />
              </Button>
            )}
          </TableCell>
          <TableCell
            style={{
              paddingLeft: `calc(var(--admin-space-2) + ${item.depth} * var(--admin-space-4))`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              {item.depth > 0 && (
                <Badge variant="muted" className="shrink-0 px-1 py-1 font-mono">
                  L{item.depth + 1}
                </Badge>
              )}
              <span
                className={cn(
                  'truncate text-sm font-medium text-foreground',
                  isInactive && 'line-through decoration-muted-foreground',
                )}
              >
                {displayLabel ?? item.label}
              </span>
              {canUpdate && onToggleStatus ? (
                <Switch
                  checked={!isInactive}
                  onCheckedChange={() => onToggleStatus(item)}
                  disabled={isToggling}
                  title={
                    isInactive
                      ? t('menus.showItemTitle', { defaultValue: 'Bật hiển thị mục này' })
                      : t('menus.hideItemTitle', { defaultValue: 'Ẩn mục này' })
                  }
                  aria-label={
                    isInactive
                      ? t('menus.showItemAria', {
                          name: itemName,
                          defaultValue: 'Bật hiển thị mục {{name}}',
                        })
                      : t('menus.hideItemAria', { name: itemName, defaultValue: 'Ẩn mục {{name}}' })
                  }
                  className="shrink-0"
                />
              ) : (
                isInactive && (
                  <Badge variant="muted" rounded="full" className="shrink-0 uppercase">
                    {t('menus.itemHiddenBadge', { defaultValue: 'Ẩn' })}
                  </Badge>
                )
              )}
            </div>
          </TableCell>
          {!hiddenKeys.includes('parent') && (
            <TableCell>
              <span
                className="block max-w-32 truncate text-xs text-muted-foreground"
                title={parentLabel || rootLabel}
              >
                {parentLabel || <span className="text-muted-foreground">{rootLabel}</span>}
              </span>
            </TableCell>
          )}
          {!hiddenKeys.includes('url') && (
            <TableCell>
              <span
                className="block max-w-52 truncate font-mono text-xs text-muted-foreground"
                title={item.url}
              >
                {item.url}
              </span>
            </TableCell>
          )}
          {canUpdate && (
            <TableCell className="whitespace-nowrap text-right">
              <TableRowActions
                primaryActions={[
                  {
                    key: 'edit',
                    label: t('menus.editItemTitle', { defaultValue: 'Chỉnh sửa mục này' }),
                    ariaLabel: t('menus.editItemAria', {
                      name: itemName,
                      defaultValue: 'Sửa mục {{name}}',
                    }),
                    icon: Pencil,
                    disabled: isDeleting,
                    onSelect: () => onEdit(item),
                  },
                ]}
                menuActions={[
                  {
                    key: 'delete',
                    label: t('menus.deleteItemActionTitle', { defaultValue: 'Xoá mục này' }),
                    icon: Trash2,
                    tone: 'danger',
                    disabled: isDeleting,
                    onSelect: () => onDelete(item.id),
                  },
                ]}
              />
            </TableCell>
          )}
        </TableRow>
      )}
    </SortableRow>
  )
}
