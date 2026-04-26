/* Checkout page — shipping, payment, review with stepper */

function CheckoutPage({ items, onBack, onComplete }) {
  const [step, setStep] = React.useState(1); // 1 shipping, 2 payment, 3 review
  const [shipMethod, setShipMethod] = React.useState("express");
  const [payMethod, setPayMethod] = React.useState("momo");

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const discount = Math.round(subtotal * 0.08);
  const shippingOptions = {
    standard: { label: "Giao tiêu chuẩn", sub: "3 – 5 ngày · toàn quốc", price: 45000 },
    express: { label: "Giao nhanh 24h", sub: "Nội thành TP.HCM · nhận trong ngày", price: 60000 },
    free: { label: "Miễn phí vận chuyển", sub: "Đơn từ 2.000.000 ₫ · 3 – 5 ngày", price: 0, free: true },
  };
  const shipping = shippingOptions[shipMethod].price;
  const total = subtotal - discount + shipping;

  const steps = [
    { n: 1, label: "Thông tin giao hàng", sub: "Họ tên · địa chỉ · SĐT" },
    { n: 2, label: "Phương thức thanh toán", sub: "Momo · VNPay · COD" },
    { n: 3, label: "Xác nhận đơn hàng", sub: "Kiểm tra & đặt hàng" },
  ];

  return (
    <>
      <div className="wp-breadcrumb">
        <a onClick={onBack}>Giỏ hàng</a>
        <span className="sep">/</span>
        <span>Thanh toán</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Bước {step} / 3 · An toàn & bảo mật</span>
        <h1>Hoàn tất đơn hàng</h1>
      </div>

      <div className="wp-checkout-layout">
        <div>
          <div className="wp-stepper">
            {steps.map((s) => (
              <div key={s.n} className={`wp-step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`} onClick={() => step > s.n && setStep(s.n)}>
                <div className="wp-step-num">{step > s.n ? "✓" : s.n}</div>
                <div className="wp-step-label">{s.label}<span>{s.sub}</span></div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              <div className="wp-checkout-section">
                <h3>Thông tin người nhận <span className="badge">Bắt buộc</span></h3>
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Họ và tên<span className="req">*</span></label>
                    <input className="wp-input filled" defaultValue="Nguyễn Văn Hùng" />
                  </div>
                  <div className="wp-field">
                    <label>Số điện thoại<span className="req">*</span></label>
                    <input className="wp-input filled" defaultValue="0903 123 456" />
                  </div>
                  <div className="wp-field full">
                    <label>Email</label>
                    <input className="wp-input filled" defaultValue="hungnv@gmail.com" />
                  </div>
                </div>
              </div>

              <div className="wp-checkout-section">
                <h3>Địa chỉ giao hàng</h3>
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Tỉnh / Thành phố<span className="req">*</span></label>
                    <select className="wp-input filled" defaultValue="hcm">
                      <option value="hcm">TP. Hồ Chí Minh</option>
                      <option value="hn">Hà Nội</option>
                      <option value="dn">Đà Nẵng</option>
                    </select>
                  </div>
                  <div className="wp-field">
                    <label>Quận / Huyện<span className="req">*</span></label>
                    <select className="wp-input filled" defaultValue="q3">
                      <option value="q3">Quận 3</option>
                      <option value="q1">Quận 1</option>
                      <option value="q10">Quận 10</option>
                    </select>
                  </div>
                  <div className="wp-field">
                    <label>Phường / Xã<span className="req">*</span></label>
                    <select className="wp-input filled" defaultValue="p7">
                      <option value="p7">Phường 7</option>
                      <option value="p1">Phường 1</option>
                    </select>
                  </div>
                  <div className="wp-field">
                    <label>Mã bưu điện</label>
                    <input className="wp-input" placeholder="700000" />
                  </div>
                  <div className="wp-field full">
                    <label>Địa chỉ chi tiết<span className="req">*</span></label>
                    <input className="wp-input filled" defaultValue="123 Nguyễn Đình Chiểu, tòa nhà Garage Moto" />
                  </div>
                  <div className="wp-field full">
                    <label>Ghi chú cho shipper</label>
                    <textarea className="wp-input" rows={2} placeholder="Ví dụ: gọi trước khi giao 15 phút…" style={{ resize: "vertical", fontFamily: "inherit" }}></textarea>
                  </div>
                </div>
              </div>

              <div className="wp-checkout-section">
                <h3>Phương thức vận chuyển</h3>
                <div className="wp-radio-stack">
                  {Object.entries(shippingOptions).map(([k, v]) => (
                    <label key={k} className={`wp-radio-tile ${shipMethod === k ? "active" : ""}`}>
                      <input type="radio" name="ship" checked={shipMethod === k} onChange={() => setShipMethod(k)} />
                      <div className="wp-radio-tile-body">
                        <b>{v.label}</b>
                        <span>{v.sub}</span>
                      </div>
                      <div className={`price ${v.free ? "free" : ""}`}>{v.free ? "MIỄN PHÍ" : window.formatVnd(v.price)}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="wp-checkout-nav">
                <button className="wp-link-back" onClick={onBack}>← Quay lại giỏ hàng</button>
                <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 36px" }} onClick={() => setStep(2)}>Tiếp tục → Thanh toán</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="wp-checkout-section">
                <h3>Chọn phương thức thanh toán</h3>
                <div className="wp-radio-stack">
                  {[
                    { k: "momo", logo: "MoMo", logoCls: "momo", label: "Ví điện tử MoMo", sub: "Quét QR · thanh toán tức thì · hoàn tiền 1%" },
                    { k: "vnpay", logo: "VNPay", logoCls: "vnpay", label: "VNPay QR", sub: "Hỗ trợ ATM, Internet Banking, thẻ Visa/Master" },
                    { k: "card", logo: "VISA", logoCls: "", label: "Thẻ tín dụng / ghi nợ", sub: "Visa · MasterCard · JCB · bảo mật 3D Secure" },
                    { k: "bank", logo: "CK", logoCls: "cod", label: "Chuyển khoản ngân hàng", sub: "Thông tin TK sẽ gửi qua email & SMS" },
                    { k: "cod", logo: "COD", logoCls: "cod", label: "Thanh toán khi nhận hàng (COD)", sub: "Áp dụng cho đơn dưới 5.000.000 ₫" },
                  ].map((p) => (
                    <label key={p.k} className={`wp-radio-tile ${payMethod === p.k ? "active" : ""}`}>
                      <input type="radio" name="pay" checked={payMethod === p.k} onChange={() => setPayMethod(p.k)} />
                      <div className={`pay-logo ${p.logoCls}`}>{p.logo}</div>
                      <div className="wp-radio-tile-body">
                        <b>{p.label}</b>
                        <span>{p.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="wp-checkout-section">
                <h3>Hoá đơn VAT (tuỳ chọn)</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--bb-text-muted)" }}>
                  <input type="checkbox" style={{ accentColor: "var(--bb-brand-primary)" }} />
                  Tôi cần xuất hoá đơn VAT cho đơn hàng này
                </label>
              </div>

              <div className="wp-checkout-nav">
                <button className="wp-link-back" onClick={() => setStep(1)}>← Quay lại giao hàng</button>
                <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 36px" }} onClick={() => setStep(3)}>Tiếp tục → Xác nhận</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="wp-checkout-section">
                <h3>Giao đến</h3>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.85)" }}>
                  <b style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>Nguyễn Văn Hùng</b> · 0903 123 456<br />
                  123 Nguyễn Đình Chiểu, Phường 7, Quận 3<br />
                  TP. Hồ Chí Minh · 700000
                </div>
                <button className="wp-link-back" style={{ marginTop: 12 }} onClick={() => setStep(1)}>✏️ Chỉnh sửa</button>
              </div>

              <div className="wp-checkout-section">
                <h3>Phương thức thanh toán</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <div className={`pay-logo ${payMethod}`} style={{ width: 42, height: 28, background: "#fff", color: "#000", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>
                    {{ momo: "MoMo", vnpay: "VNPay", card: "VISA", bank: "CK", cod: "COD" }[payMethod]}
                  </div>
                  <span>{{ momo: "Ví MoMo", vnpay: "VNPay QR", card: "Thẻ tín dụng / ghi nợ", bank: "Chuyển khoản ngân hàng", cod: "COD — thanh toán khi nhận hàng" }[payMethod]}</span>
                </div>
                <button className="wp-link-back" style={{ marginTop: 12 }} onClick={() => setStep(2)}>✏️ Chỉnh sửa</button>
              </div>

              <div className="wp-checkout-section">
                <h3>Sản phẩm ({items.reduce((s, it) => s + it.qty, 0)})</h3>
                {items.map((it) => (
                  <div key={it.id} className="wp-mini-item">
                    <div className="wp-mini-thumb">
                      {it.category.split(" ")[0]}
                      <span className="qty-badge">{it.qty}</span>
                    </div>
                    <div className="wp-mini-body">
                      <div className="brand">{it.brand}</div>
                      <div className="name">{it.name}</div>
                      <div className="variant">{[it.size && "Size " + it.size, it.color].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="wp-mini-price">{window.formatVnd(it.price * it.qty)}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "rgba(249,6,6,0.06)", border: "1px solid var(--bb-brand-primary-border)", borderRadius: 6, padding: "14px 18px", fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 18 }}>
                Bằng việc đặt hàng, anh em đồng ý với <a style={{ color: "var(--bb-brand-primary)", cursor: "pointer" }}>Điều khoản dịch vụ</a> và <a style={{ color: "var(--bb-brand-primary)", cursor: "pointer" }}>Chính sách đổi trả</a> của BigBike.
              </div>

              <div className="wp-checkout-nav">
                <button className="wp-link-back" onClick={() => setStep(2)}>← Quay lại</button>
                <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 40px" }} onClick={() => onComplete({ total, items })}>Đặt hàng · {window.formatVnd(total)}</button>
              </div>
            </>
          )}
        </div>

        {/* Order summary rail */}
        <div className="wp-order-summary">
          <h3>Đơn hàng của bạn</h3>
          {items.map((it) => (
            <div key={it.id} className="wp-mini-item">
              <div className="wp-mini-thumb">
                {it.category.split(" ")[0]}
                <span className="qty-badge">{it.qty}</span>
              </div>
              <div className="wp-mini-body">
                <div className="brand">{it.brand}</div>
                <div className="name">{it.name}</div>
                <div className="variant">{[it.size && "Size " + it.size, it.color].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="wp-mini-price">{window.formatVnd(it.price * it.qty)}</div>
            </div>
          ))}
          <div className="wp-summary-row"><span>Tạm tính</span><b>{window.formatVnd(subtotal)}</b></div>
          <div className="wp-summary-row discount"><span>Mã RIDER20</span><b>− {window.formatVnd(discount)}</b></div>
          <div className={`wp-summary-row ${shipping === 0 ? "free" : ""}`}><span>Vận chuyển</span><b>{shipping === 0 ? "MIỄN PHÍ" : window.formatVnd(shipping)}</b></div>
          <div className="wp-summary-total"><span>Tổng thanh toán</span><b>{window.formatVnd(total)}</b></div>
        </div>
      </div>
    </>
  );
}

/* Order-complete success screen */
function CheckoutSuccess({ order, onGoHome, onTrack }) {
  const orderCode = "BB" + (100000 + Math.floor(Math.random() * 900000));
  return (
    <div className="wp-success">
      <div className="wp-success-icon">✓</div>
      <div className="kicker">Thanh toán thành công</div>
      <h1>Cảm ơn anh em đã tin BigBike!</h1>
      <p>Đơn hàng đã được xác nhận. Email và SMS theo dõi đơn sẽ gửi đến anh trong vài phút.</p>

      <div className="order-card">
        <div>
          <div className="label">Mã đơn hàng</div>
          <b className="red">#{orderCode}</b>
        </div>
        <div>
          <div className="label">Tổng giá trị</div>
          <b>{window.formatVnd(order?.total || 0)}</b>
        </div>
        <div>
          <div className="label">Giao dự kiến</div>
          <b>24 – 48 giờ</b>
        </div>
      </div>

      <div className="cta-row">
        <button className="wp-btn-secondary" style={{ padding: "14px 24px" }} onClick={onGoHome}>Về trang chủ</button>
        <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 28px" }} onClick={onTrack}>Theo dõi đơn hàng →</button>
      </div>
    </div>
  );
}

window.CheckoutPage = CheckoutPage;
window.CheckoutSuccess = CheckoutSuccess;
