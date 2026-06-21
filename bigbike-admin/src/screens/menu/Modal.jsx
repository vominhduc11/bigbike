import { Modal as LayoutModal } from '../../components/layout'

export function Modal({ title, onClose, children, footer }) {
  return (
    <LayoutModal open title={title} onClose={onClose} actions={footer}>
      {children}
    </LayoutModal>
  )
}
