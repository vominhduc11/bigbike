import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared drag-and-drop reorder primitives for bigbike-admin.
//
// Every reorderable surface (sliders, home videos, featured products, related
// products, menu/category trees, product gallery, shipping methods, content
// blocks) wires the same @dnd-kit boilerplate — sensors, transform styling,
// arrayMove. This module is the single source so screens only describe WHAT to
// reorder, not HOW.
//
//   - useDragSensors(): the standard pointer + keyboard sensor pair.
//   - <SortableRow>:    render-prop wrapper around useSortable for one row/card.
//   - <SortableList>:   full flat-list reorder (owns DndContext + overlay).
//
// Tree screens (category/menu) keep their own DndContext + handleDragEnd because
// of same-parent constraints, but reuse useDragSensors() + <SortableRow>.

const STRATEGIES = {
  list: verticalListSortingStrategy,
  grid: rectSortingStrategy,
}

// Pointer + keyboard sensors with the project-standard activation distance.
// Shared drag primitives intentionally co-locate this hook with the components.
// eslint-disable-next-line react-refresh/only-export-components
export function useDragSensors(distance = 5) {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/**
 * Render-prop wrapper around useSortable for a single row/card.
 * Hands the child everything it needs: `setNodeRef` + `style` on the root,
 * `handleProps` (attributes + listeners) on the grip handle, plus `isDragging`.
 * The base `style` only carries transform/transition — merge in opacity/zIndex
 * as needed.
 */
export function SortableRow({ id, disabled = false, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return children({
    setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
    handleProps: { ...attributes, ...listeners },
  })
}

/**
 * Standard grip handle for a sortable row. Spread `handleProps` from a
 * <SortableRow>/<SortableList> child onto it — that's where the drag listeners
 * live. When `disabled`, the listeners are dropped and the handle renders as a
 * muted, non-interactive placeholder so the row layout stays aligned.
 */
export function DragHandle({ handleProps, label, disabled = false, className }) {
  return (
    <button
      type="button"
      {...(disabled ? {} : handleProps)}
      disabled={disabled}
      className={cn(
        'flex h-9 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
        disabled
          ? 'opacity-40'
          : 'cursor-grab touch-none hover:bg-muted hover:text-foreground active:cursor-grabbing',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  )
}

/**
 * Full flat-list reorder. Owns DndContext, SortableContext and an optional
 * DragOverlay, computes the reordered array with arrayMove, and hands it back
 * via `onReorder(nextItems, meta)`.
 *
 * @param items         array to reorder
 * @param getId         (item) => stable id (default `item.id`)
 * @param onReorder     (nextItems, { oldIndex, newIndex, activeId, overId }) => void
 * @param disabled      when true the list is read-only (no drag)
 * @param renderItem    (item, sortable, index) => node — apply sortable.setNodeRef
 *                      + sortable.style to the root, sortable.handleProps to the grip
 * @param renderOverlay (item) => node — optional floating drag preview
 * @param layout        'list' (vertical, default) | 'grid' (wrapping grid)
 * @param as            wrapper element/component for the rows (default 'div';
 *                      use 'tbody' for table rows)
 * @param footer        node rendered inside the wrapper after the rows (e.g. an
 *                      "add" tile that should stay part of the grid/list)
 */
export function SortableList({
  items,
  getId = (it) => it.id,
  onReorder,
  disabled = false,
  renderItem,
  renderOverlay,
  layout = 'list',
  as = 'div',
  className,
  footer = null,
  sensorDistance = 5,
}) {
  // Capitalised local so JSX treats it as a component; also keeps no-unused-vars
  // happy (the project has no eslint-plugin-react to mark JSX-only param usage).
  const Wrapper = as
  const [activeId, setActiveId] = useState(null)
  const sensors = useDragSensors(sensorDistance)
  const ids = items.map(getId)
  const strategy = STRATEGIES[layout] ?? verticalListSortingStrategy

  function handleDragStart(event) {
    if (disabled) return
    setActiveId(event.active.id)
  }

  function handleDragEnd(event) {
    setActiveId(null)
    if (disabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex), {
      oldIndex,
      newIndex,
      activeId: active.id,
      overId: over.id,
    })
  }

  const activeItem = activeId != null ? items.find((it) => getId(it) === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={strategy}>
        <Wrapper className={className}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
              {(sortable) => renderItem(item, sortable, index)}
            </SortableRow>
          ))}
          {footer}
        </Wrapper>
      </SortableContext>
      {renderOverlay ? (
        <DragOverlay>{activeItem ? renderOverlay(activeItem) : null}</DragOverlay>
      ) : null}
    </DndContext>
  )
}
