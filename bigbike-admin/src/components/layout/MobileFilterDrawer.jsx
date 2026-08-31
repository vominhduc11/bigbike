import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

/** Khung drawer dùng chung; nội dung filter và cách áp dụng vẫn do từng màn sở hữu. */
export function MobileFilterDrawer({ open, onClose, title, description, children, actions }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || t('common.filters')}
      description={description}
      closeLabel={t('common.close')}
      actions={actions}
      contentClassName="max-w-lg sm:max-w-lg"
    >
      {children}
    </Modal>
  )
}
