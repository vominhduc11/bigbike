/* Cart page — line items, quantity steppers, promo, summary */

function CartPage({ items, onQty, onRemove, onCheckout, onContinue }) {
  const [promo, setPromo] = React.useState("");
  const [applied, setApplied] = React.useState({ code: "RIDER20", amount: 0.08 });

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const savings = items.reduce((s, it) => s + ((it.old || it.price) - it.price) * it.qty, 0);
  const discount = applied ? Math.round(subtotal * applied.amount) : 0;
  const shipping = subtotal >= 2000000 ? 0 : 45000;
  const total = subtotal - discount + shipping;

  return (
    <>
      <div className="wp-breadcrumb">
        <a onClick={onContinue}>Trang chủ</a>
        <span className="sep">/</span>
        <span>Giỏ hàng</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Bước 1 / 3 · Xem lại đơn</span>
        <h1>Giỏ hàng của anh em</h1>
        <div className="sub">{items.length} sản phẩm · kiểm tra size, màu và số lượng trước khi thanh toán</div>
      </div>

      {items.length === 0 ? (
        <div style={{ maxWidth: 1440, margin: "0 auto 40px", padding: "0 24px" }}>
          <div className="wp-cart-list">
            <div className="wp-cart-empty">
              <b>Giỏ hàng còn trống</b>
              <p>Chưa có sản phẩm nào. Bắt đầu sắm gear cho chuyến đi tiếp theo thôi!</p>
              <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 32px" }} onClick={onContinue}>Khám phá sản phẩm</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="wp-cart-layout">
          <div className="wp-cart-list">
            <div className="wp-cart-header-row">
              <div>Sản phẩm</div>
              <div>Đơn giá</div>
              <div>Số lượng</div>
              <div>Thành tiền</div>
              <div></div>
            </div>
            {items.map((it) => (
              <div className="wp-cart-item" key={it.id}>
                <div className="wp-cart-item-prod">
                  <div className="wp-cart-item-thumb">{it.category.split(" ")[0]}</div>
                  <div className="wp-cart-item-info">
                    <div className="wp-cart-item-brand">{it.brand}</div>
                    <div className="wp-cart-item-name">{it.name}</div>
                    <div className="wp-cart-item-variant">
                      {it.size && <span>Size: <b style={{ color: "#fff" }}>{it.size}</b></span>}
                      {it.color && <span>Màu: <b style={{ color: "#fff" }}>{it.color}</b></span>}
                    </div>
                  </div>
                </div>
                <div className="wp-cart-price">
                  {window.formatVnd(it.price)}
                  {it.old && <s>{window.formatVnd(it.old)}</s>}
                </div>
                <div>
                  <div className="wp-qty-stepper">
                    <button onClick={() => onQty(it.id, Math.max(1, it.qty - 1))}>−</button>
                    <input value={it.qty} readOnly />
                    <button onClick={() => onQty(it.id, it.qty + 1)}>+</button>
                  </div>
                </div>
                <div className="wp-cart-subtotal">{window.formatVnd(it.price * it.qty)}</div>
                <button className="wp-cart-remove" onClick={() => onRemove(it.id)} aria-label="Xoá">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                </button>
              </div>
            ))}
            <div className="wp-cart-footer">
              <button className="link" onClick={onContinue}>← Tiếp tục mua sắm</button>
              <button className="link">Lưu giỏ hàng</button>
            </div>
          </div>

          <div className="wp-summary-card">
            <h3>Tóm tắt đơn hàng</h3>

            {applied ? (
              <div className="wp-promo-applied">
                <div>
                  <b>✓ {applied.code}</b>
                  <div style={{ color: "var(--bb-text-muted)", fontSize: 11, marginTop: 2 }}>Giảm {applied.amount * 100}% cho đơn này</div>
                </div>
                <button onClick={() => setApplied(null)} aria-label="Huỷ mã">×</button>
              </div>
            ) : (
              <div className="wp-promo-input">
                <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Mã giảm giá" />
                <button onClick={() => { if (promo) setApplied({ code: promo.toUpperCase(), amount: 0.05 }); setPromo(""); }}>Áp dụng</button>
              </div>
            )}

            <div className="wp-summary-row">
              <span>Tạm tính ({items.reduce((s, it) => s + it.qty, 0)} sản phẩm)</span>
              <b>{window.formatVnd(subtotal)}</b>
            </div>
            {savings > 0 && (
              <div className="wp-summary-row discount">
                <span>Đã tiết kiệm</span>
                <b>− {window.formatVnd(savings)}</b>
              </div>
            )}
            {discount > 0 && (
              <div className="wp-summary-row discount">
                <span>Mã giảm giá</span>
                <b>− {window.formatVnd(discount)}</b>
              </div>
            )}
            <div className={`wp-summary-row ${shipping === 0 ? "free" : ""}`}>
              <span>Phí vận chuyển</span>
              <b>{shipping === 0 ? "MIỄN PHÍ" : window.formatVnd(shipping)}</b>
            </div>

            <div className="wp-summary-total">
              <span>Tổng cộng</span>
              <b>{window.formatVnd(total)}</b>
            </div>

            <button className="wp-summary-cta" onClick={onCheckout}>Tiến hành thanh toán →</button>

            <div className="wp-summary-trust">
              <div><span className="dot"></span>Chính hãng 100%</div>
              <div><span className="dot"></span>Đổi trả 7 ngày</div>
              <div><span className="dot"></span>Bảo hành chính hãng</div>
              <div><span className="dot"></span>Giao hàng toàn quốc</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

window.CartPage = CartPage;
