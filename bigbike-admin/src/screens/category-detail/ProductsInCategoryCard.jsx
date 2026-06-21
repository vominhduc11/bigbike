import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import { PublishStatusBadge } from '../../components/StatusBadge'
import { MobileCardList, MobileCard } from '../../components/layout/MobileCardList'

export function ProductsInCategoryCard({ item, productsList, productsTotal, navigate }) {
  const { t } = useTranslation()
  return (
    <div className="bb-card mb-4">
      <div className="bb-card-header">
        <div>
          <h2>{t('categories.detail.productsSectionTitle', { count: productsTotal })}</h2>
          <p className="sub">{t('categories.detail.productsSectionDesc')}</p>
        </div>
        {productsTotal > 0 && (
          <button
            type="button"
            className="bb-btn bb-btn-ghost bb-btn-sm"
            onClick={() => navigate(`/admin/products?categoryId=${item.id}`)}
          >
            {t('categories.detail.productsViewAll', { count: productsTotal })}
          </button>
        )}
      </div>
      <div className="bb-card-body bb-card-body--flush">
        {productsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--bb-text-muted)' }}><p>{t('categories.detail.productsEmpty')}</p></div>
        ) : (
          <>
            <div className="hide-on-mobile">
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <tbody>
                    {productsList.map((p) => (
                      <tr key={p.id} onClick={() => navigate(`/admin/products/${p.id}`)}>
                        <td>
                          <div className="product-cell">
                            <span className="thumb">
                              {p.image?.url ? (
                                <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" referrerPolicy="no-referrer"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : <Package size={16} />}
                            </span>
                            <div className="info">
                              <div className="name">{p.name}</div>
                              <div className="sku">{p.sku || p.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="col-actions"><PublishStatusBadge value={p.publishStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <MobileCardList>
              {productsList.map((p) => (
                <MobileCard
                  key={p.id}
                  title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="thumb" style={{ width: 32, height: 32, flexShrink: 0 }}>
                        {p.image?.url ? (
                          <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <Package size={16} />}
                      </span>
                      {p.name}
                    </span>
                  )}
                  subtitle={p.sku || p.slug}
                  status={<PublishStatusBadge value={p.publishStatus} />}
                  onClick={() => navigate(`/admin/products/${p.id}`)}
                />
              ))}
            </MobileCardList>
          </>
        )}
      </div>
    </div>
  )
}
