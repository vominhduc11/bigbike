/* Bigbike UI Kit — Product Detail Page (PDP) */
const { useState: useStatePdp } = React;

function ProductDetailPage({ product, onAdd, onBack }) {
  const [size, setSize] = useStatePdp("L");
  const [color, setColor] = useStatePdp("Matte Black");
  const [qty, setQty] = useStatePdp(1);
  const [thumb, setThumb] = useStatePdp(0);

  const p = product ?? window.BB_PRODUCTS[0];
  const stock = window.stockLabel(p.stock);

  return (
    <>
      <div className="wp-breadcrumb">
        <a onClick={onBack}>Trang chủ</a>
        <span className="sep">/</span>
        <a onClick={onBack}>Sản phẩm</a>
        <span className="sep">/</span>
        <a>{p.category}</a>
        <span className="sep">/</span>
        <span style={{ color: "#fff" }}>{p.name}</span>
      </div>

      <div className="wp-pdp">
        <div className="wp-pdp-gallery">
          <div className="wp-pdp-main">
            {p.tag && <span className="wp-product-tag" style={{ top: 16, left: 16 }}>{p.tag}</span>}
            <span className="wp-product-image-placeholder" style={{ fontSize: 56 }}>{p.category.split(" ")[0]}</span>
          </div>
          <div className="wp-pdp-thumbs">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`wp-pdp-thumb ${thumb === i ? "active" : ""}`}
                onClick={() => setThumb(i)}
              >
                <span className="wp-product-image-placeholder" style={{ fontSize: 14 }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="wp-pdp-info">
          <div className="wp-pdp-info-brand">{p.brand} · {p.category}</div>
          <h1 className="wp-pdp-info-title">{p.name}</h1>
          <div className="wp-pdp-rating">
            <span className="stars">{"★".repeat(Math.round(p.rating))}{"☆".repeat(5 - Math.round(p.rating))}</span>
            <span>{p.rating.toFixed(1)} · {p.reviews} đánh giá</span>
            <span>·</span>
            <span>SKU: BB-{String(p.id).padStart(5, "0")}</span>
            <span>·</span>
            <span className={`wp-stock-badge ${stock.cls}`} style={{ marginTop: 0 }}>{stock.label}</span>
          </div>

          <div className="wp-pdp-price">
            <b>{window.formatVnd(p.price)}</b>
            {p.old && <s>{window.formatVnd(p.old)}</s>}
            {p.old && <span className="save">Tiết kiệm {window.formatVnd(p.old - p.price)}</span>}
          </div>

          <div className="wp-pdp-opt-group">
            <h6>Màu sắc</h6>
            <div className="wp-pdp-chips">
              {["Matte Black", "Gloss White", "Racing Red", "Titanium"].map((c) => (
                <button
                  key={c}
                  className={`wp-pdp-chip ${color === c ? "active" : ""}`}
                  onClick={() => setColor(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="wp-pdp-opt-group">
            <h6>Kích cỡ · Size chart →</h6>
            <div className="wp-pdp-chips">
              {["S", "M", "L", "XL", "XXL"].map((s) => (
                <button
                  key={s}
                  className={`wp-pdp-chip ${size === s ? "active" : ""} ${s === "XXL" ? "oos" : ""}`}
                  onClick={() => s !== "XXL" && setSize(s)}
                  disabled={s === "XXL"}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="wp-pdp-qty">
            <h6 style={{ fontFamily: "var(--bb-font-body)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", margin: 0 }}>Số lượng</h6>
            <div className="wp-pdp-qty-stepper">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <input value={qty} readOnly />
              <button onClick={() => setQty(qty + 1)}>+</button>
            </div>
          </div>

          <div className="wp-pdp-actions">
            <button className="wp-btn-primary" onClick={() => onAdd && onAdd(p)}>Thêm vào giỏ</button>
            <button className="wp-btn-secondary">Mua ngay</button>
          </div>

          <div className="wp-pdp-features">
            <div className="wp-pdp-feat"><span className="dot"></span>100% Chính hãng</div>
            <div className="wp-pdp-feat"><span className="dot"></span>Bảo hành 12 tháng</div>
            <div className="wp-pdp-feat"><span className="dot"></span>Miễn phí giao từ 2tr</div>
            <div className="wp-pdp-feat"><span className="dot"></span>Đổi size trong 7 ngày</div>
            <div className="wp-pdp-feat"><span className="dot"></span>Đạt chuẩn ECE 22.05</div>
            <div className="wp-pdp-feat"><span className="dot"></span>Hotline 0903 123 456</div>
          </div>
        </div>
      </div>

      <section className="wp-section">
        <div className="wp-section-head">
          <div>
            <span className="wp-kicker">Liên quan</span>
            <h2 className="wp-section-title">Rider cũng mua</h2>
          </div>
        </div>
        <div className="wp-product-grid">
          {window.BB_PRODUCTS.filter((x) => x.id !== p.id).slice(0, 4).map((rp) => (
            <ProductCard key={rp.id} product={rp} onAdd={onAdd} />
          ))}
        </div>
      </section>
    </>
  );
}

Object.assign(window, { ProductDetailPage });
