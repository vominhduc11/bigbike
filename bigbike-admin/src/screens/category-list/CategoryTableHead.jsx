import { useTranslation } from 'react-i18next'

function CategoryTableHead({ canUpdate, selectAllCheckbox }) {
  const { t } = useTranslation()
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
      <thead>
        <tr>
          {selectAllCheckbox}
          <th scope="col">{t('categories.colCategory')}</th>
          <th scope="col">{t('categories.colVisibility')}</th>
          <th scope="col">{t('categories.colHomepage')}</th>
          <th scope="col" className="align-right">{t('categories.colUpdated')}</th>
          <th scope="col" className="align-right">{t('categories.colActions')}</th>
        </tr>
      </thead>
    </>
  )
}

export const CategoryTreeTableHead = CategoryTableHead
export const CategoryFlatTableHead = CategoryTableHead
