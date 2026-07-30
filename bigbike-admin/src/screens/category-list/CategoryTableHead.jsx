import { useTranslation } from 'react-i18next'
import { TableHeader, TableHead, TableRow } from '@/components/ui/table'

function CategoryTableHead({ canUpdate, selectAllCheckbox }) {
  const { t } = useTranslation()
  const headerClassName = 'uppercase tracking-wide'

  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        <col className="col-vis" />
        <col className="col-homepage" />
        <col className="col-updated" />
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
          <TableHead className={headerClassName}>{t('categories.colVisibility')}</TableHead>
          <TableHead className={headerClassName}>{t('categories.colHomepage')}</TableHead>
          <TableHead className={`${headerClassName} text-right`}>{t('categories.colUpdated')}</TableHead>
          <TableHead className={`${headerClassName} text-right`}>{t('categories.colActions')}</TableHead>
        </TableRow>
      </TableHeader>
    </>
  )
}

export const CategoryTreeTableHead = CategoryTableHead
export const CategoryFlatTableHead = CategoryTableHead
