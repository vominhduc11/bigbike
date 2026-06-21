import { useTranslation } from 'react-i18next'

// Shared colgroup + thead for the tree-shaped category table (no sort-order
// column). Extracted verbatim from CategoryListScreen so the skeleton and the
// real table stay in sync.
export function CategoryTreeTableHead({ canUpdate, selectAllCheckbox }) {
  const { t } = useTranslation()
  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        <col className="col-desc" />
        <col className="col-vis" />
        <col className="col-updated" />
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          {selectAllCheckbox}
          <th>{t('categories.colCategory')}</th>
          <th>{t('categories.colDescription')}</th>
          <th>{t('categories.colVisibility')}</th>
          <th>{t('categories.colUpdated')}</th>
          <th className="align-right">{t('categories.colActions')}</th>
        </tr>
      </thead>
    </>
  )
}

// Colgroup + thead for the flat (filtered) category table, which adds a
// sort-order column.
export function CategoryFlatTableHead({ canUpdate, selectAllCheckbox }) {
  const { t } = useTranslation()
  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        <col className="col-desc" />
        <col className="col-vis" />
        <col className="col-sort" />
        <col className="col-updated" />
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          {selectAllCheckbox}
          <th>{t('categories.colCategory')}</th>
          <th>{t('categories.colDescription')}</th>
          <th>{t('categories.colVisibility')}</th>
          <th className="align-right">{t('categories.colSortOrder')}</th>
          <th>{t('categories.colUpdated')}</th>
          <th className="align-right">{t('categories.colActions')}</th>
        </tr>
      </thead>
    </>
  )
}
