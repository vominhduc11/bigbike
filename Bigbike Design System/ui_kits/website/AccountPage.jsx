/* Account dashboard — overview, orders, addresses, profile, wishlist */

const BB_ORDERS = [
  { code: "BB238419", date: "12.06.2026", status: "shipping", statusLabel: "Đang giao", total: 9780000, items: [
    { brand: "Sena", name: "Sena 50S Mesh Intercom", category: "Intercom", qty: 1 },
    { brand: "Scoyco", name: "Scoyco MC08 Găng Tay", category: "Găng tay", qty: 1 },
  ]},
  { code: "BB238201", date: "02.06.2026", status: "delivered", statusLabel: "Đã giao", total: 2590000, items: [
    { brand: "LS2", name: "LS2 MX436 Pioneer Dual Sport", category: "Mũ bảo hiểm", qty: 1 },
  ]},
  { code: "BB237944", date: "18.05.2026", status: "delivered", statusLabel: "Đã giao", total: 14200000, items: [
    { brand: "Helite", name: "Helite Turtle 2 Airbag Vest", category: "Áo giáp", qty: 1 },
  ]},
  { code: "BB237612", date: "04.05.2026", status: "processing", statusLabel: "Đang xử lý", total: 7450000, items: [
    { brand: "Alpinestars", name: "Alpinestars SMX-6 V2 Vented", category: "Giày moto", qty: 1 },
  ]},
  { code: "BB237188", date: "21.04.2026", status: "cancelled", statusLabel: "Đã huỷ", total: 1690000, items: [
    { brand: "LS2", name: "LS2 FF353 Rapid Solid", category: "Mũ bảo hiểm", qty: 1 },
  ]},
];

function AccountPage({ onLogout, onShop }) {
  const [tab, setTab] = React.useState("overview");
  const [orderFilter, setOrderFilter] = React.useState("all");

  const filtered = orderFilter === "all" ? BB_ORDERS : BB_ORDERS.filter((o) => o.status === orderFilter);

  const navItems = [
    { id: "overview", label: "Tổng quan" },
    { id: "orders", label: "Đơn hàng", count: BB_ORDERS.length },
    { id: "wishlist", label: "Sản phẩm yêu thích", count: 8 },
    { id: "addresses", label: "Sổ địa chỉ", count: 3 },
    { id: "profile", label: "Thông tin cá nhân" },
    { id: "vouchers", label: "Mã giảm giá", count: 4 },
    { id: "reviews", label: "Đánh giá sản phẩm" },
  ];

  return (
    <>
      <div className="wp-breadcrumb">
        <a onClick={onShop}>Trang chủ</a>
        <span className="sep">/</span>
        <span>Tài khoản</span>
      </div>

      <div className="wp-account-layout">
        {/* Sidebar */}
        <aside className="wp-account-sidebar">
          <div className="wp-account-user">
            <div className="wp-account-avatar">NH</div>
            <b>Nguyễn Văn Hùng</b>
            <span>hungnv@gmail.com</span>
            <div className="wp-account-tier">★ Rider Gold · 12.480 điểm</div>
          </div>
          <nav className="wp-account-nav">
            {navItems.map((n) => (
              <a key={n.id} className={tab === n.id ? "active" : ""} onClick={() => setTab(n.id)}>
                {n.label}
                {n.count && <span className="count-pill">{n.count}</span>}
              </a>
            ))}
            <a className="logout" onClick={onLogout}>Đăng xuất</a>
          </nav>
        </aside>

        {/* Main */}
        <main className="wp-account-main">
          {tab === "overview" && (
            <>
              <div className="wp-account-header">
                <div>
                  <h2>Chào anh Hùng 👋</h2>
                  <div className="sub">Thành viên BigBike từ 03.2023 · hạng Rider Gold</div>
                </div>
              </div>

              <div className="wp-kpi-row">
                <div className="wp-kpi">
                  <div className="label">Tổng đơn hàng</div>
                  <b>{BB_ORDERS.length}<span className="unit">đơn</span></b>
                  <div className="trend">+2 trong 30 ngày qua</div>
                </div>
                <div className="wp-kpi">
                  <div className="label">Đã chi tiêu</div>
                  <b>35,7<span className="unit">triệu ₫</span></b>
                  <div className="trend">Hạng Platinum còn 14,3tr</div>
                </div>
                <div className="wp-kpi">
                  <div className="label">Điểm thưởng</div>
                  <b>12.480</b>
                  <div className="trend">Đổi được 6 voucher · ≈ 500k</div>
                </div>
                <div className="wp-kpi">
                  <div className="label">Mã giảm giá</div>
                  <b>4<span className="unit">mã khả dụng</span></b>
                  <div className="trend">RIDER20 sắp hết hạn</div>
                </div>
              </div>

              <h3 style={{ fontFamily: "var(--bb-font-display)", textTransform: "uppercase", fontSize: 18, letterSpacing: "0.02em", margin: "0 0 14px", color: "#fff" }}>Đơn hàng gần đây</h3>
              {BB_ORDERS.slice(0, 3).map((o) => <OrderCard key={o.code} order={o} />)}

              <button className="wp-link-back" style={{ marginTop: 8, color: "var(--bb-brand-primary)" }} onClick={() => setTab("orders")}>Xem tất cả đơn hàng →</button>
            </>
          )}

          {tab === "orders" && (
            <>
              <div className="wp-account-header">
                <div>
                  <h2>Đơn hàng của tôi</h2>
                  <div className="sub">Theo dõi, huỷ hoặc mua lại các đơn trước đây</div>
                </div>
              </div>

              <div className="wp-tabs">
                {[
                  { k: "all", label: "Tất cả", count: BB_ORDERS.length },
                  { k: "shipping", label: "Đang giao", count: BB_ORDERS.filter((o) => o.status === "shipping").length },
                  { k: "processing", label: "Đang xử lý", count: BB_ORDERS.filter((o) => o.status === "processing").length },
                  { k: "delivered", label: "Đã giao", count: BB_ORDERS.filter((o) => o.status === "delivered").length },
                  { k: "cancelled", label: "Đã huỷ", count: BB_ORDERS.filter((o) => o.status === "cancelled").length },
                ].map((t) => (
                  <button key={t.k} className={`wp-tab ${orderFilter === t.k ? "active" : ""}`} onClick={() => setOrderFilter(t.k)}>
                    {t.label}
                    <span className="count-pill">{t.count}</span>
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--bb-text-muted)" }}>Không có đơn nào trong mục này.</div>
              ) : (
                filtered.map((o) => <OrderCard key={o.code} order={o} />)
              )}
            </>
          )}

          {tab === "addresses" && <AddressesPanel />}
          {tab === "profile" && <ProfilePanel />}
          {tab === "wishlist" && <WishlistPanel />}
          {tab === "vouchers" && <VouchersPanel />}
          {tab === "reviews" && (
            <>
              <div className="wp-account-header">
                <h2>Đánh giá sản phẩm</h2>
              </div>
              <div style={{ padding: 40, textAlign: "center", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--bb-text-muted)" }}>
                Chưa có đánh giá nào — mua sản phẩm và chia sẻ cảm nhận để nhận thêm 50 điểm / đánh giá.
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

function OrderCard({ order }) {
  return (
    <div className="wp-order-card">
      <div className="wp-order-head">
        <div className="meta">
          <div>Mã đơn<b>#{order.code}</b></div>
          <div>Ngày đặt<b>{order.date}</b></div>
        </div>
        <span className={`wp-order-status ${order.status}`}>{order.statusLabel}</span>
      </div>
      <div className="wp-order-body">
        <div className="wp-order-thumbs">
          {order.items.slice(0, 3).map((it, i) => (
            <div key={i} className="wp-order-thumb">{it.category.split(" ")[0]}</div>
          ))}
        </div>
        <div className="wp-order-summary-text">
          <b>{order.items[0].name}{order.items.length > 1 && ` + ${order.items.length - 1} sản phẩm khác`}</b>
          <span>{order.items.reduce((s, it) => s + it.qty, 0)} sản phẩm</span>
        </div>
        <div className="wp-order-total">
          <b>{window.formatVnd(order.total)}</b>
          <span>Đã bao gồm VAT</span>
        </div>
      </div>
      <div className="wp-order-actions">
        {order.status === "shipping" && <button className="primary">Theo dõi đơn</button>}
        {order.status === "processing" && <button>Huỷ đơn</button>}
        {order.status === "delivered" && <>
          <button className="primary">Mua lại</button>
          <button>Đánh giá · +50đ</button>
        </>}
        <button>Xem chi tiết</button>
        <button>Liên hệ hỗ trợ</button>
      </div>
    </div>
  );
}

function AddressesPanel() {
  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Sổ địa chỉ</h2>
          <div className="sub">Quản lý các địa chỉ giao hàng của anh em</div>
        </div>
      </div>

      <div className="wp-address-grid">
        <div className="wp-address-card default">
          <span className="default-tag">Mặc định</span>
          <b>Nhà riêng</b>
          <div className="phone">Nguyễn Văn Hùng · 0903 123 456</div>
          <p>123 Nguyễn Đình Chiểu, Phường 7<br />Quận 3, TP. Hồ Chí Minh</p>
          <div className="actions">
            <button>Chỉnh sửa</button>
            <span className="sep">·</span>
            <button>Xoá</button>
          </div>
        </div>

        <div className="wp-address-card">
          <span className="tag">Công ty</span>
          <b>Văn phòng</b>
          <div className="phone">Nguyễn Văn Hùng · 0903 123 456</div>
          <p>Tầng 8, tòa Bitexco, 2 Hải Triều<br />Phường Bến Nghé, Quận 1, TP.HCM</p>
          <div className="actions">
            <button>Đặt mặc định</button>
            <span className="sep">·</span>
            <button>Chỉnh sửa</button>
            <span className="sep">·</span>
            <button>Xoá</button>
          </div>
        </div>

        <div className="wp-address-card">
          <span className="tag">Nhà ba mẹ</span>
          <b>Đà Nẵng</b>
          <div className="phone">Nguyễn Văn Hoà · 0236 555 777</div>
          <p>45 Lê Duẩn, Phường Thạch Thang<br />Quận Hải Châu, Đà Nẵng</p>
          <div className="actions">
            <button>Đặt mặc định</button>
            <span className="sep">·</span>
            <button>Chỉnh sửa</button>
            <span className="sep">·</span>
            <button>Xoá</button>
          </div>
        </div>

        <button className="wp-address-add">+ Thêm địa chỉ mới</button>
      </div>
    </>
  );
}

function ProfilePanel() {
  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Thông tin cá nhân</h2>
          <div className="sub">Những thông tin này chỉ anh em và BigBike thấy</div>
        </div>
      </div>

      <div className="wp-checkout-section">
        <h3>Thông tin cơ bản</h3>
        <div className="wp-form-grid">
          <div className="wp-field">
            <label>Họ và tên</label>
            <input className="wp-input filled" defaultValue="Nguyễn Văn Hùng" />
          </div>
          <div className="wp-field">
            <label>Ngày sinh</label>
            <input className="wp-input filled" defaultValue="15/08/1989" />
          </div>
          <div className="wp-field">
            <label>Email</label>
            <input className="wp-input filled" defaultValue="hungnv@gmail.com" />
          </div>
          <div className="wp-field">
            <label>Số điện thoại</label>
            <input className="wp-input filled" defaultValue="0903 123 456" />
          </div>
          <div className="wp-field">
            <label>Giới tính</label>
            <select className="wp-input filled" defaultValue="m">
              <option value="m">Nam</option>
              <option value="f">Nữ</option>
              <option value="o">Khác</option>
            </select>
          </div>
          <div className="wp-field">
            <label>Loại xe đang chạy</label>
            <select className="wp-input filled" defaultValue="big">
              <option value="scooter">Xe tay ga</option>
              <option value="underbone">Xe số</option>
              <option value="big">Big bike (400cc+)</option>
              <option value="adv">Adventure / Touring</option>
            </select>
          </div>
        </div>
      </div>

      <div className="wp-checkout-section">
        <h3>Bảo mật</h3>
        <div className="wp-form-grid">
          <div className="wp-field full">
            <label>Mật khẩu</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input className="wp-input filled" type="password" defaultValue="••••••••••" style={{ flex: 1 }} readOnly />
              <button className="wp-btn-secondary" style={{ padding: "11px 18px", fontSize: 11 }}>Đổi mật khẩu</button>
            </div>
          </div>
          <div className="wp-field">
            <label>Xác thực 2 bước</label>
            <div style={{ padding: "11px 14px", background: "#0d0d0d", borderRadius: 4, fontSize: 12, color: "var(--bb-text-muted)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>Chưa kích hoạt</span>
              <button className="wp-link-back" style={{ color: "var(--bb-brand-primary)", padding: 0 }}>Bật ngay →</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="wp-btn-secondary" style={{ padding: "14px 24px" }}>Huỷ</button>
        <button className="wp-btn-primary" style={{ flex: "none", padding: "14px 32px" }}>Lưu thay đổi</button>
      </div>
    </>
  );
}

function WishlistPanel() {
  const items = window.BB_PRODUCTS.slice(0, 4);
  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Sản phẩm yêu thích</h2>
          <div className="sub">{items.length} sản phẩm · Lưu lại để mua sau</div>
        </div>
      </div>
      <div className="wp-product-grid">
        {items.map((p) => <ProductCard key={p.id} product={p} onAdd={() => {}} />)}
      </div>
    </>
  );
}

function VouchersPanel() {
  const vouchers = [
    { code: "RIDER20", desc: "Giảm 20% cho thành viên Rider Gold", min: "Đơn từ 1.000.000 ₫", expires: "30.06.2026", urgent: true },
    { code: "FREESHIP", desc: "Miễn phí vận chuyển toàn quốc", min: "Đơn từ 500.000 ₫", expires: "15.07.2026" },
    { code: "SENA500", desc: "Giảm 500k cho intercom Sena", min: "Áp dụng dòng Sena 50 series", expires: "31.07.2026" },
    { code: "NEWBIE", desc: "Giảm 100k cho khách hàng mới", min: "Đơn đầu tiên · đơn từ 800.000 ₫", expires: "31.12.2026" },
  ];
  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Mã giảm giá</h2>
          <div className="sub">{vouchers.length} mã đang khả dụng</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {vouchers.map((v) => (
          <div key={v.code} style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "3px solid var(--bb-brand-primary)", borderRadius: 6, padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 84, height: 84, background: "var(--bb-brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--bb-font-display)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 4, flexShrink: 0, textAlign: "center", padding: 6, lineHeight: 1.1 }}>{v.code}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.02em" }}>{v.desc}</b>
              <div style={{ fontSize: 11, color: "var(--bb-text-muted)", marginBottom: 4 }}>{v.min}</div>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: v.urgent ? "var(--bb-brand-primary)" : "var(--bb-text-muted)", fontWeight: 700 }}>HSD · {v.expires}{v.urgent && " · SẮP HẾT"}</div>
            </div>
            <button style={{ padding: "10px 14px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 3, fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>Dùng ngay</button>
          </div>
        ))}
      </div>
    </>
  );
}

window.AccountPage = AccountPage;
