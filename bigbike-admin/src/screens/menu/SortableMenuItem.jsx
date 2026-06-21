import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { SortableRow } from '../../components/Sortable'
import { Button } from '@/components/ui/button'

export function SortableMenuItem({ item, displayLabel, parentLabel, rootLabel, canUpdate, onEdit, onDelete, isDeleting }) {
  const isInactive = item.status === 'INACTIVE'

  return (
    <SortableRow id={item.id}>
      {(sortable) => (
    <tr
      ref={sortable.setNodeRef}
      style={{ ...sortable.style, opacity: sortable.isDragging ? 0.4 : 1 }}
      className={isInactive ? 'is-inactive' : ''}
    >
      <td className="menu-grip-cell">
        {canUpdate && (
          <button
            type="button"
            className="menu-grab-btn"
            title="Kéo để sắp xếp (cùng cấp)"
            {...sortable.handleProps}
          >
            <GripVertical size={15} />
          </button>
        )}
      </td>
      <td style={{ paddingLeft: `${8 + item.depth * 18}px` }}>
        <div className="menu-item-label-cell">
          {item.depth > 0 && (
            <span className="menu-item-depth">L{item.depth + 1}</span>
          )}
          <span className="menu-item-name">{displayLabel ?? item.label}</span>
          {isInactive && <span className="menu-item-badge-inactive">Ẩn</span>}
        </div>
      </td>
      <td>
        <span className="menu-item-parent-cell">
          {parentLabel || <span className="text-muted-foreground">{rootLabel}</span>}
        </span>
      </td>
      <td>
        <span className="menu-item-url-cell" title={item.url}>{item.url}</span>
      </td>
      {canUpdate && (
        <td className="menu-item-actions-cell">
          <div className="menu-row-actions">
            <Button variant="outline" size="icon" onClick={() => onEdit(item)} title="Chỉnh sửa mục này" disabled={isDeleting}>
              <Pencil size={13} />
            </Button>
            <Button variant="danger" size="icon" onClick={() => onDelete(item.id)} title="Xoá mục này" loading={isDeleting}>
              <Trash2 size={13} />
            </Button>
          </div>
        </td>
      )}
    </tr>
      )}
    </SortableRow>
  )
}
