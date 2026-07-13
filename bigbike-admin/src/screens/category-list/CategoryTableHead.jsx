import { useTranslation } from 'react-i18next'

// Shared colgroup + thead for the tree-shaped category table (no sort-order
// column). Extracted verbatim from CategoryListScreen so the skeleton and the
// real table stay in sync.
// T7: `hiddenKeys` (từ useColumnVisibility) ẩn/hiện cột Mô tả/Cập nhật theo
// lựa chọn admin đã lưu — mặc định (mảng rỗng) hiện đủ như trước.
export function CategoryTreeTableHead({ canUpdate, selectAllCheckbox, hiddenKeys = [] }) {
  const { t } = useTranslation()
  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        {!hiddenKeys.includes('description') && <col className="col-desc" />}
        <col className="col-vis" />
        {!hiddenKeys.includes('updatedAt') && <col className="col-updated" />}
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          {selectAllCheckbox}
          <th scope="col">{t('categories.colCategory')}</th>
          {!hiddenKeys.includes('description') && <th scope="col">{t('categories.colDescription')}</th>}
          <th scope="col">{t('categories.colVisibility')}</th>
          {!hiddenKeys.includes('updatedAt') && <th scope="col">{t('categories.colUpdated')}</th>}
          <th scope="col" className="align-right">{t('categories.colActions')}</th>
        </tr>
      </thead>
    </>
  )
}

// Colgroup + thead for the flat (filtered) category table, which adds a
// sort-order column.
export function CategoryFlatTableHead({ canUpdate, selectAllCheckbox, hiddenKeys = [] }) {
  const { t } = useTranslation()
  return (
    <>
      <colgroup>
        {canUpdate && <col className="col-select" />}
        <col className="col-name" />
        {!hiddenKeys.includes('description') && <col className="col-desc" />}
        <col className="col-vis" />
        <col className="col-sort" />
        {!hiddenKeys.includes('updatedAt') && <col className="col-updated" />}
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          {selectAllCheckbox}
          <th scope="col">{t('categories.colCategory')}</th>
          {!hiddenKeys.includes('description') && <th scope="col">{t('categories.colDescription')}</th>}
          <th scope="col">{t('categories.colVisibility')}</th>
          <th scope="col" className="align-right">{t('categories.colSortOrder')}</th>
          {!hiddenKeys.includes('updatedAt') && <th scope="col">{t('categories.colUpdated')}</th>}
          <th scope="col" className="align-right">{t('categories.colActions')}</th>
        </tr>
      </thead>
    </>
  )
}
