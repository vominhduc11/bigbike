import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import { PublishStatusBadge } from '../../components/StatusBadge'
import { AdminTable } from '../../components/AdminTable'
import { DetailSection } from '../../components/DetailSection'
import { ScreenSkeleton } from '../../components/ScreenSkeleton'
import { StatePanel } from '../../components/StatePanel'
import { Button } from '@/components/ui/button'

export function ProductsInCategoryCard({ item, productsList, productsTotal, navigate, isLoading = false, isError = false, onRetry, permissionDenied = false }) {
  const { t } = useTranslation()

  const openProduct = (p) => navigate(`/admin/products/${p.id}`)

  // Thumbnail dùng chung cho bảng (desktop) và thẻ (mobile). Kích thước/bo/cover
  // do CSS `.bb-product-thumb` + `.bb-product-thumb img` lo — không cần inline style.
  const productThumb = (p, extraClass) => (
    <span className={`bb-product-thumb${extraClass ? ` ${extraClass}` : ''}`}>
      {p.image?.url ? (
        <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" referrerPolicy="no-referrer" />
      ) : <Package size={16} />}
    </span>
  )

  const columns = [
    {
      key: 'product',
      label: t('categories.detail.productsColName', { defaultValue: 'Sản phẩm' }),
      render: (p) => (
        <div className="product-cell">
          {productThumb(p)}
          <div className="info">
            <div className="name">{p.name}</div>
            <div className="sku">{p.sku || p.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('categories.detail.productsColStatus', { defaultValue: 'Trạng thái' }),
      align: 'right',
      render: (p) => <PublishStatusBadge value={p.publishStatus} />,
    },
  ]

  const mobileCard = (p) => ({
    title: (
      <span className="flex items-center gap-1.5">
        {productThumb(p, 'shrink-0')}
        {p.name}
      </span>
    ),
    subtitle: p.sku || p.slug,
    status: <PublishStatusBadge value={p.publishStatus} />,
    onClick: () => openProduct(p),
  })

  return (
    <DetailSection
      className="mb-4"
      headingLevel={3}
      title={t('categories.detail.productsSectionTitle', { count: productsTotal })}
      description={t('categories.detail.productsSectionDesc')}
      noPadding
      action={productsTotal > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/products?categoryId=${item.id}`)}
          >
            {t('categories.detail.productsViewAll', { count: productsTotal })}
          </Button>
      ) : null}
    >
        {permissionDenied ? (
          <div className="p-4">
            <StatePanel
              tone="neutral"
              title="Chưa được cấp quyền xem sản phẩm"
              description="Cần quyền products.read để tải danh sách và mở sản phẩm thuộc danh mục này."
            />
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <ScreenSkeleton variant="table" count={3} showHeader={false} />
          </div>
        ) : isError ? (
          // Trước đây lỗi tải danh sách sản phẩm bị hiểu nhầm thành "Chưa có sản
          // phẩm". Hiện trạng thái lỗi rõ ràng + nút thử lại để không đọc sai.
          <div className="p-4">
            <StatePanel
              tone="danger"
              title={t('categories.detail.productsLoadError', { defaultValue: 'Không tải được sản phẩm của danh mục.' })}
              description={t('categories.detail.productsLoadErrorDesc', { defaultValue: 'Danh sách có thể chưa đầy đủ. Vui lòng thử lại.' })}
              actionLabel={onRetry ? t('common.retry') : undefined}
              onAction={onRetry}
            />
          </div>
        ) : productsList.length === 0 ? (
          <div className="text-center px-4 py-6 text-muted-foreground">
            <p>{t('categories.detail.productsEmpty')}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => navigate(`/admin/products?categoryId=${item.id}`)}
            >
              {t('categories.detail.productsEmptyAddLink')}
            </Button>
          </div>
        ) : (
          <AdminTable
            columns={columns}
            rows={productsList}
            onRowClick={openProduct}
            mobileCard={mobileCard}
          />
        )}
    </DetailSection>
  )
}
