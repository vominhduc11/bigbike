import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, History, PackagePlus } from 'lucide-react'
import { StockStatusBadge } from '../../components/StatusBadge'
import { formatCurrencyVnd } from '../../lib/formatters'
import { cn } from '@/lib/utils'
import { ProductThumbnail } from './shared'
import { groupVariantsByColor, aggregateVariantState } from './constants'

function InventoryGroupRow({ group, isExpanded, onToggle, onStockIn, onSerialManage, onViewHistory, canUpdate, serialOnlyMode }) {
  const hasVariants = !group.isNoVariant && group.variants.length > 0
  const [expandedColors, setExpandedColors] = useState(() => new Set())

  function toggleColor(key) {
    setExpandedColors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function buildVariantItem(variant) {
    return {
      productId: group.productId,
      productName: group.productName,
      variantId: variant.variantId,
      variantName: variant.variantName,
      variantSku: variant.variantSku,
      quantityOnHand: variant.quantityOnHand,
      retailPrice: variant.retailPrice,
      trackSerials: variant.trackSerials,
      forceOutOfStock: group.forceOutOfStock,
      productImage: group.productImage,
    }
  }

  function buildProductItem() {
    return {
      productId: group.productId,
      productName: group.productName,
      productSku: group.productSku,
      variantId: null,
      variantName: null,
      variantSku: null,
      quantityOnHand: group.totalQuantity,
      retailPrice: group.minRetailPrice,
      trackSerials: group.trackSerials,
      forceOutOfStock: group.forceOutOfStock,
      productImage: group.productImage,
    }
  }

  // Một dòng biến thể cụ thể (size). `label` là nhãn hiển thị (size trong chế độ
  // gom màu, tên đầy đủ trong chế độ phẳng); `indentClass` quyết định độ thụt.
  function renderVariantRow(variant, label, indentClass) {
    const item = buildVariantItem(variant)
    return (
      <tr key={variant.variantId} className="border-b border-border">
        <td className="p-0 w-8" />

        <td className={cn('py-1.5 px-3 align-middle', indentClass)}>
          <p className="font-medium text-sm m-0">{label || '—'}</p>
          {variant.variantSku && (
            <p className="text-xs text-muted-foreground m-0 font-mono">
              {variant.variantSku}
            </p>
          )}
        </td>

        <td className="hidden md:table-cell py-1.5 px-3" />

        <td className="py-1.5 px-3 align-middle">
          <StockStatusBadge value={variant.stockState} />
        </td>

        <td className="py-1.5 px-3 text-right align-middle">
          <strong className={cn(variant.quantityOnHand === 0 && 'text-danger')}>{variant.quantityOnHand}</strong>
          {variant.trackSerials && (
            <span className="block text-primary font-semibold text-xs">
              Serial
            </span>
          )}
        </td>

        <td className="hidden sm:table-cell py-1.5 px-3 text-right text-xs text-muted-foreground align-middle">
          {formatCurrencyVnd(variant.retailPrice)}
        </td>

        <td className="py-1.5 px-3 align-middle">
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm whitespace-nowrap"
              onClick={() => onViewHistory({
                scope: 'variant',
                variantId: variant.variantId,
                productName: group.productName,
                variantName: variant.variantName,
              })}>
              <History size={13} />Lịch sử
            </button>
            {canUpdate && ((variant.trackSerials || serialOnlyMode) ? (
              <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm whitespace-nowrap"
                onClick={() => onSerialManage(item)}>
                <Hash size={13} />Quản lý serial
              </button>
            ) : (
              <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm whitespace-nowrap"
                onClick={() => onStockIn(item)}>
                <PackagePlus size={13} />Nhập hàng
              </button>
            ))}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr className="h-11 border-b border-border bg-surface-raised">
        <td className="py-1.5 px-2 w-8 align-middle">
          {hasVariants ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              className="bg-transparent border-none cursor-pointer text-muted-foreground flex items-center justify-center p-0 w-5 h-5 text-xs"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="inline-block w-5" aria-hidden="true" />
          )}
        </td>

        <td className="py-2 px-3 align-middle">
          <span className="flex items-center gap-2.5">
            <ProductThumbnail image={group.productImage} alt={group.productName} size={36} />
            <span>
              <p className="font-semibold m-0">{group.productName}</p>
              {group.productSku && (
                <p className="text-xs text-muted-foreground m-0 font-mono">
                  {group.productSku}
                </p>
              )}
            </span>
          </span>
        </td>

        <td className="hidden md:table-cell py-2 px-3 text-sm text-muted-foreground align-middle">
          {group.isNoVariant ? <em>Không có biến thể</em> : `${group.variants.length} biến thể`}
        </td>

        <td className="py-2 px-3 align-middle">
          <StockStatusBadge value={group.aggregateStockState} />
          {group.forceOutOfStock && (
            <span className="ml-1.5 text-xs text-warning font-semibold">
              Khoá
            </span>
          )}
        </td>

        <td className="py-2 px-3 text-right align-middle">
          <strong className={cn('text-base', group.totalQuantity === 0 && 'text-danger')}>{group.totalQuantity}</strong>
        </td>

        <td className="hidden sm:table-cell py-2 px-3 text-right text-sm align-middle">
          {formatCurrencyVnd(group.minRetailPrice)}
        </td>

        <td className="py-2 px-3 align-middle">
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm whitespace-nowrap"
              onClick={() => onViewHistory({
                scope: 'product',
                productId: group.productId,
                productName: group.productName,
                variantName: null,
              })}>
              <History size={13} />Lịch sử
            </button>
            {canUpdate && group.isNoVariant && (
              (group.trackSerials || serialOnlyMode) ? (
                <button type="button" className="bb-btn bb-btn-primary bb-btn-sm whitespace-nowrap"
                  onClick={() => onSerialManage(buildProductItem())}>
                  <Hash size={13} />Quản lý serial
                </button>
              ) : (
                <button type="button" className="bb-btn bb-btn-primary bb-btn-sm whitespace-nowrap"
                  onClick={() => onStockIn(buildProductItem())}>
                  <PackagePlus size={13} />Nhập hàng
                </button>
              )
            )}
          </div>
        </td>
      </tr>

      {hasVariants && isExpanded && (() => {
        const grouping = groupVariantsByColor(group.variants)
        if (!grouping.grouped) {
          return group.variants.map((variant) => renderVariantRow(variant, variant.variantName, 'pl-10'))
        }
        return grouping.groups.map((cg) => {
          const colorKey = `${group.productId}::${cg.key}`
          const colorExpanded = expandedColors.has(colorKey)
          const colorQty = cg.variants.reduce((sum, v) => sum + (v.quantityOnHand || 0), 0)
          const sizeHint = cg.variants.map((v) => v.subLabel).filter(Boolean).join(' · ')
          return (
            <Fragment key={colorKey}>
              <tr className="border-b border-border bg-surface">
                <td className="p-0 w-8" />

                <td className="py-1.5 px-3 pl-7 align-middle">
                  <button
                    type="button"
                    onClick={() => toggleColor(colorKey)}
                    aria-expanded={colorExpanded}
                    aria-label={colorExpanded ? 'Thu gọn màu' : 'Mở rộng màu'}
                    className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-left p-0 w-full"
                  >
                    <span className="text-muted-foreground text-xs w-3 shrink-0">{colorExpanded ? '▼' : '▶'}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-sm">{cg.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {cg.variants.length} size{sizeHint ? ` · ${sizeHint}` : ''}
                      </span>
                    </span>
                  </button>
                </td>

                <td className="hidden md:table-cell py-1.5 px-3" />

                <td className="py-1.5 px-3 align-middle">
                  <StockStatusBadge value={aggregateVariantState(cg.variants)} />
                </td>

                <td className="py-1.5 px-3 text-right align-middle">
                  <strong className={cn(colorQty === 0 && 'text-danger')}>{colorQty}</strong>
                </td>

                <td className="hidden sm:table-cell py-1.5 px-3" />
                <td className="py-1.5 px-3" />
              </tr>
              {colorExpanded && cg.variants.map((variant) => renderVariantRow(variant, variant.subLabel || variant.variantName, 'pl-16'))}
            </Fragment>
          )
        })
      })()}
    </>
  )
}

export function InventoryGroupedTable({ groups, loading, pageSize, canUpdate, serialOnlyMode, onStockIn, onSerialManage, onViewHistory }) {
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const prevGroupsRef = useRef(null)

  useEffect(() => {
    if (prevGroupsRef.current !== null && prevGroupsRef.current !== groups) {
      setExpandedIds(new Set())
    }
    prevGroupsRef.current = groups
  }, [groups])

  function toggleGroup(productId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const colCount = 7

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full border-collapse text-sm min-w-[480px] sm:min-w-[600px] md:min-w-[700px]">
        <thead>
          <tr className="border-b-2 border-border">
            <th scope="col" className="w-8 py-2 px-1" />
            <th scope="col" className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colProduct')}
            </th>
            <th scope="col" className="hidden md:table-cell py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colVariant')}
            </th>
            <th scope="col" className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colStockState')}
            </th>
            <th scope="col" className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">
              {t('inventory.colQty')}
            </th>
            <th scope="col" className="hidden sm:table-cell py-2 px-3 text-right text-xs font-semibold text-muted-foreground">
              {t('inventory.colPrice')}
            </th>
            <th scope="col" className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: pageSize }, (_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={colCount} className="py-2.5 px-3">
                    <div className="skeleton h-3.5 w-full" />
                  </td>
                </tr>
              ))
            : groups.map((group) => (
                <InventoryGroupRow
                  key={group.productId}
                  group={group}
                  isExpanded={expandedIds.has(group.productId)}
                  onToggle={() => toggleGroup(group.productId)}
                  onStockIn={onStockIn}
                  onSerialManage={onSerialManage}
                  onViewHistory={onViewHistory}
                  canUpdate={canUpdate}
                  serialOnlyMode={serialOnlyMode}
                />
              ))
          }
        </tbody>
      </table>
    </div>
  )
}
