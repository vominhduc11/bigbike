/* Bigbike UI Kit — Catalog (product listing) */
const { useState: useStateCat } = React;

function CatalogPage({ onAdd, onOpenProduct, category }) {
  const [sort, setSort] = useStateCat("popular");
  const [brandFilter, setBrandFilter] = useStateCat(new Set());

  const toggleBrand = (b) => {
    const next = new Set(brandFilter);
    if (next.has(b)) next.delete(b); else next.add(b);
    setBrandFilter(next);
  };

  let products = window.BB_PRODUCTS;
  if (brandFilter.size > 0) {
    products = products.filter((p) => brandFilter.has(p.brand));
  }
  if (sort === "price-asc") products = [...products].sort((a, b) => a.price - b.price);
  if (sort === "price-desc") products = [...products].sort((a, b) => b.price - a.price);
  if (sort === "rating") products = [...products].sort((a, b) => b.rating - a.rating);

  const catName = category?.name ?? "Tất cả sản phẩm";

  return (
    <>
      <div className="wp-breadcrumb">
        <a>Trang chủ</a>
        <span className="sep">/</span>
        <a>Sản phẩm</a>
        <span className="sep">/</span>
        <span style={{ color: "#fff" }}>{catName}</span>
      </div>

      <div className="wp-cat-layout">
        <aside className="wp-filters">
          <div className="wp-filter-group">
            <h5>Thương hiệu</h5>
            {window.BB_BRANDS.slice(0, 7).map((b) => (
              <label className="wp-filter-row" key={b}>
                <input type="checkbox" checked={brandFilter.has(b)} onChange={() => toggleBrand(b)} />
                {b}
                <span className="count">{window.BB_PRODUCTS.filter((p) => p.brand === b).length}</span>
              </label>
            ))}
          </div>
          <div className="wp-filter-group">
            <h5>Danh mục</h5>
            {window.BB_CATEGORIES.slice(0, 5).map((c) => (
              <label className="wp-filter-row" key={c.id}>
                <input type="checkbox" /> {c.name}
                <span className="count">{Math.floor(Math.random() * 40) + 8}</span>
              </label>
            ))}
          </div>
          <div className="wp-filter-group">
            <h5>Khoảng giá</h5>
            <label className="wp-filter-row"><input type="checkbox" /> Dưới 1 triệu</label>
            <label className="wp-filter-row"><input type="checkbox" /> 1 – 3 triệu</label>
            <label className="wp-filter-row"><input type="checkbox" /> 3 – 8 triệu</label>
            <label className="wp-filter-row"><input type="checkbox" /> Trên 8 triệu</label>
          </div>
          <div className="wp-filter-group">
            <h5>Tình trạng</h5>
            <label className="wp-filter-row"><input type="checkbox" defaultChecked /> Còn hàng</label>
            <label className="wp-filter-row"><input type="checkbox" /> Đặt trước</label>
            <label className="wp-filter-row"><input type="checkbox" /> Khuyến mãi</label>
          </div>
        </aside>

        <div>
          <div style={{ marginBottom: 20 }}>
            <span className="wp-kicker" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--bb-brand-primary)", fontWeight: 700, display: "block", marginBottom: 8 }}>Shop gear biker</span>
            <h2 style={{ fontFamily: "var(--bb-font-display)", textTransform: "uppercase", fontSize: 36, letterSpacing: "0.01em", margin: 0, lineHeight: 1.05 }}>{catName}</h2>
          </div>

          <div className="wp-catalog-head">
            <div className="wp-catalog-count">Hiển thị <b style={{ color: "#fff" }}>{products.length}</b> / {window.BB_PRODUCTS.length} sản phẩm{brandFilter.size > 0 ? ` · lọc: ${[...brandFilter].join(", ")}` : ""}</div>
            <div className="wp-catalog-sort">
              <label>Sắp xếp</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="popular">Nổi bật</option>
                <option value="price-asc">Giá: Thấp → Cao</option>
                <option value="price-desc">Giá: Cao → Thấp</option>
                <option value="rating">Đánh giá cao</option>
              </select>
            </div>
          </div>

          <div className="wp-product-grid">
            {products.map((p) => (
              <div key={p.id} onClick={(e) => { e.preventDefault(); onOpenProduct && onOpenProduct(p); }}>
                <ProductCard product={p} onAdd={onAdd} />
              </div>
            ))}
          </div>
          {products.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--bb-text-muted)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8 }}>
              Không tìm thấy sản phẩm phù hợp bộ lọc. <a style={{ color: "var(--bb-brand-primary)" }} onClick={() => setBrandFilter(new Set())}>Xoá bộ lọc</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { CatalogPage });
