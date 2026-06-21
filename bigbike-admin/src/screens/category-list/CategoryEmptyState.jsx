import { useTranslation } from 'react-i18next'
import { FolderTree, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Tree-mode empty state for CategoryListScreen. Behaviour is identical to the
// inline markup it replaced; parent state/handlers are threaded via props.
export function CategoryEmptyState({ searchTerm, query, canUpdate, onResetFilters, onCreate }) {
  const { t } = useTranslation()
  return (
    <div className="cat-empty-state">
      <FolderTree size={56} aria-hidden="true" className="cat-empty-icon" />
      <h2 className="cat-empty-title">
        {searchTerm ? t('categories.emptySearchTitle') : t('categories.emptyTitle')}
      </h2>
      <p className="cat-empty-desc">
        {searchTerm
          ? t('categories.emptySearchDesc', { value: searchTerm })
          : t('categories.emptyDesc')}
      </p>
      <div className="cat-empty-actions">
        {(searchTerm || query.visibility !== 'ALL' || query.sort !== 'sortOrder:asc') && (
          <Button variant="outline" onClick={onResetFilters}>
            {t('common.resetFilters')}
          </Button>
        )}
        {canUpdate && (
          <Button onClick={onCreate}>
            <Plus size={14} />{t('categories.create')}
          </Button>
        )}
      </div>
    </div>
  )
}
