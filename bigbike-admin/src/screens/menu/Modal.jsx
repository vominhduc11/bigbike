import { Modal as LayoutModal } from '../../components/layout'

// Bọc mỏng quanh Modal dùng chung (Radix Dialog: focus-trap, Escape, close label
// i18n). `description` nối vào DialogDescription để Radix tự gắn aria-describedby.
export function Modal({ title, description, onClose, children, footer }) {
  return (
    <LayoutModal open title={title} description={description} onClose={onClose} actions={footer}>
      {children}
    </LayoutModal>
  )
}
