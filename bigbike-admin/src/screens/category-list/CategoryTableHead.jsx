import { useTranslation } from 'react-i18next'
import { TableHeader, TableHead, TableRow } from '@/components/ui/table'

function CategoryTableHead({ canUpdate, selectAllCheckbox, hiddenKeys = [] }) {
  const { t } = useTranslation()
  const headerClassName = 'uppercase tracking-wide'
  const isVisible = (key) => !hiddenKeys.includes(key)

  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        {isVisible('visibility') && <col className="col-vis" />}
        {isVisible('homepage') && <col className="col-homepage" />}
        {isVisible('updatedAt') && <col className="col-updated" />}
        <col className="col-actions" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {canUpdate ? (
            <TableHead className="w-12 text-center">
              {selectAllCheckbox}
            </TableHead>
          ) : null}
          <TableHead className={headerClassName}>{t('categories.colCategory')}</TableHead>
          {isVisible('visibility') && <TableHead className={headerClassName}>{t('categories.colVisibility')}</TableHead>}
          {isVisible('homepage') && <TableHead className={headerClassName}>{t('categories.colHomepage')}</TableHead>}
          {isVisible('updatedAt') && <TableHead className={`${headerClassName} text-right`}>{t('categories.colUpdated')}</TableHead>}
          <TableHead className={`${headerClassName} text-right`}>{t('categories.colActions')}</TableHead>
        </TableRow>
      </TableHeader>
    </>
  )
}

export const CategoryTreeTableHead = CategoryTableHead
export const CategoryFlatTableHead = CategoryTableHead
