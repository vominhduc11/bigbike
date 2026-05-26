/* global React */
// ─────────────────────────────────────────────────────────────────────────
// prototype.jsx — App shell (sidebar + topbar + breadcrumb) + screen switcher.
// Mirrors the real route → screen mapping from src/App.jsx.
// ─────────────────────────────────────────────────────────────────────────

const { useState: useStateP, useMemo: useMemoP, useEffect: useEffectP } = React;

// Icons used in sidebar nav (lucide-style stroke paths)
const NI = {
  dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  cart:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>,
  store:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 1.5-4h17L22 7M2 7v13a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7M2 7h20M8 21V12h8v9"/></svg>,
  users:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  send:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>,
  rotate:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  wallet:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13.5a.5.5 0 0 1 .5.5V6M20 12v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4M22 12h-4a2 2 0 1 0 0 4h4v-4z"/></svg>,
  star:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  ticket:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM13 5v14"/></svg>,
  package:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  hash:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  shield:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  tag:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  award:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  palette:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  file:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  bar:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  arrows:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  menu:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  image:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  truck:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  settings:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  shieldUser:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  key:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2 19 4M15 8l-7 7H5v3H2v-3l7-7M15 8l4-4M15 8a3 3 0 1 0 4-4 3 3 0 0 0-4 4z"/></svg>,
  activity:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
};

// Nav definition — mirrors NAV_GROUP_DEFS in src/App.jsx exactly
const NAV_GROUPS = [
  {
    label: "Bán hàng",
    items: [
      { key: "dashboard",   label: "Tổng quan",       icon: NI.dashboard, path: "/admin/dashboard" },
      { key: "orders",      label: "Đơn hàng",        icon: NI.cart,      path: "/admin/orders", badge: 12, badgeColor: "brand" },
      { key: "pos",         label: "Bán tại shop",    icon: NI.store,     path: "/admin/pos" },
      { key: "customers",   label: "Khách hàng",      icon: NI.users,     path: "/admin/customers" },
      { key: "newsletter",  label: "Email đăng ký",   icon: NI.send,      path: "/admin/newsletter-subscribers" },
      { key: "returns",     label: "Đổi trả",         icon: NI.rotate,    path: "/admin/returns", badge: 3 },
      { key: "receivables", label: "Công nợ",         icon: NI.wallet,    path: "/admin/receivables", badge: 4, badgeColor:"brand" },
      { key: "reviews",     label: "Đánh giá",        icon: NI.star,      path: "/admin/reviews" },
      { key: "coupons",     label: "Mã giảm giá",     icon: NI.ticket,    path: "/admin/coupons" },
    ],
  },
  {
    label: "Sản phẩm",
    items: [
      { key: "products",         label: "Sản phẩm",       icon: NI.package, path: "/admin/products" },
      { key: "featured-products",label: "Sản phẩm nổi bật",icon: NI.star,    path: "/admin/featured-products" },
      { key: "inventory",        label: "Kho hàng",       icon: NI.package, path: "/admin/inventory", badge: 8 },
      { key: "serials",          label: "Quản lý serial", icon: NI.hash,    path: "/admin/serials" },
      { key: "warranties",       label: "Bảo hành",       icon: NI.shield,  path: "/admin/warranties" },
      { key: "categories",       label: "Danh mục",       icon: NI.tag,     path: "/admin/categories" },
      { key: "brands",           label: "Thương hiệu",    icon: NI.award,   path: "/admin/brands" },
      { key: "attributes",       label: "Thuộc tính",     icon: NI.palette, path: "/admin/attributes" },
    ],
  },
  {
    label: "Nội dung & Marketing",
    items: [
      { key: "content",         label: "Nội dung",          icon: NI.file,   path: "/admin/content" },
      { key: "sliders",         label: "Banner",            icon: NI.bar,    path: "/admin/sliders" },
      { key: "home-videos",     label: "Video trang chủ",   icon: NI.bar,    path: "/admin/home-videos" },
      { key: "home-highlights", label: "Highlights trang chủ", icon: NI.dashboard, path: "/admin/home-highlights" },
      { key: "redirects",       label: "Chuyển hướng",      icon: NI.arrows, path: "/admin/redirects" },
      { key: "menus",           label: "Menu",              icon: NI.menu,   path: "/admin/menus" },
      { key: "media",           label: "Thư viện",          icon: NI.image,  path: "/admin/media" },
    ],
  },
  {
    label: "Báo cáo",
    items: [
      { key: "reports", label: "Báo cáo", icon: NI.bar, path: "/admin/reports" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { key: "shipping",    label: "Vận chuyển",     icon: NI.truck,      path: "/admin/shipping" },
      { key: "settings",    label: "Cài đặt",        icon: NI.settings,   path: "/admin/settings" },
      { key: "admin-users", label: "Quản trị viên",  icon: NI.shieldUser, path: "/admin/admin-users" },
      { key: "roles",       label: "Phân quyền",     icon: NI.key,        path: "/admin/roles" },
      { key: "audit-logs",  label: "Nhật ký",        icon: NI.activity,   path: "/admin/audit-logs" },
    ],
  },
];

// Pages with bespoke screens (the rest use StubScreen)
const SCREEN_MAP = {
  "dashboard":      "DashboardScreen",
  "orders":         "OrderListScreen",
  "order-detail":   "OrderDetailScreen",
  "products":       "ProductListScreen",
  "product-detail": "ProductDetailScreen",
  "customers":      "CustomerListScreen",
  "inventory":      "InventoryScreen",
  "receivables":    "ReceivablesScreen",
  "settings":       "SettingsScreen",
};

// Breadcrumb path mapping
const BREADCRUMB_LABEL = {
  "order-detail":   { parent: "orders",   parentLabel: "Đơn hàng",  label: "Chi tiết đơn" },
  "product-detail": { parent: "products", parentLabel: "Sản phẩm",  label: "Sửa sản phẩm" },
};

function PrototypeApp({ onShowLogin, sidebarCollapsed, onToggleSidebarCollapse }) {
  const [active, setActive] = useStateP("dashboard");
  const [toasts, setToasts] = useStateP([]);
  const [modalOpen, setModalOpen] = useStateP(false);
  const [sidebarOpen, setSidebarOpen] = useStateP(false); // mobile

  // Find current item / group
  const allItems = useMemoP(() => NAV_GROUPS.flatMap(g => g.items), []);
  const currentNavKey = (BREADCRUMB_LABEL[active]?.parent) || active;
  const currentNav = allItems.find(i => i.key === currentNavKey);
  const detailInfo = BREADCRUMB_LABEL[active];

  function pushToast(t) {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, ...t }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4200);
  }

  function navigate(key) {
    setActive(key);
    setSidebarOpen(false);
    window.scrollTo({top: 0, behavior: "instant"});
  }

  function renderScreen() {
    const name = SCREEN_MAP[active];
    const Comp = name && window[name];
    if (Comp) return <Comp navigate={navigate}/>;
    // Stub for routes that don't have a bespoke mock
    const found = allItems.find(i => i.key === active);
    return <window.StubScreen
      title={found?.label || active}
      eyebrow={NAV_GROUPS.find(g => g.items.some(i => i.key === active))?.label || ""}
      desc={`Module ${found?.label || active} — pattern chung: filter, segmented status, bảng dữ liệu, pagination.`}
    />;
  }

  return (
    <>
      <div className={"bb-app" + (sidebarOpen ? " sidebar-open" : "") + (sidebarCollapsed ? " bb-sidebar-collapsed" : "")}>
        {/* Sidebar */}
        <aside className="bb-sidebar">
          <div className="bb-sidebar-brand">
            <p className="eyebrow">BigBike Motors</p>
            <h1><span className="brand-dot"/>Admin</h1>
            <div className="build">v2.6.0 · production</div>
          </div>
          <nav className="bb-sidebar-nav">
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="bb-nav-group">
                <div className="bb-nav-group-label">{group.label}</div>
                {group.items.map(item => (
                  <a key={item.key}
                     className={"bb-nav-link" + (item.key === currentNavKey ? " active" : "")}
                     onClick={() => navigate(item.key)}>
                    {item.icon}
                    <span className="label">{item.label}</span>
                    {item.badge && (
                      <span className={"bb-nav-badge" + (item.badgeColor === "brand" ? "" : " muted")}>
                        {item.badge}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <div className="bb-sidebar-foot">
            <span className="dot"/>
            <div style={{minWidth:0}}>
              <strong>Nguyễn Văn An</strong><br/>
              Owner · Đang kết nối
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="bb-main">
          <header className="bb-topbar">
            <button
              className="bb-icon-btn"
              style={{display:"none"}}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Mở menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="bb-search">
              <span className="icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
              </span>
              <input placeholder="Tìm đơn hàng, sản phẩm, khách hàng…"/>
              <span className="kbd">⌘K</span>
            </div>
            <div className="bb-topbar-spacer"/>
            <span className="bb-pill-live"><span className="dot"/>Đang kết nối</span>
            <button className="bb-icon-btn" title="Thông báo">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/></svg>
              <span className="badge-dot"/>
            </button>
            <button className="bb-icon-btn" title="Trợ giúp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
            </button>
            <div className="bb-user-chip">
              <span className="avatar">NA</span>
              <div style={{display:"flex", flexDirection:"column", textAlign:"left"}}>
                <span className="name">Nguyễn Văn An</span>
                <span className="role">Owner</span>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </header>

          {/* Breadcrumb */}
          <nav className="bb-breadcrumb">
            <a onClick={() => navigate("dashboard")}>Tổng quan</a>
            {currentNav && currentNav.key !== "dashboard" && (
              <>
                <span className="sep">/</span>
                {detailInfo ? (
                  <>
                    <a onClick={() => navigate(detailInfo.parent)}>{detailInfo.parentLabel}</a>
                    <span className="sep">/</span>
                    <span className="current">{detailInfo.label}</span>
                  </>
                ) : (
                  <span className="current">{currentNav.label}</span>
                )}
              </>
            )}
          </nav>

          <main className="bb-page-content">
            {renderScreen()}
          </main>
        </div>
      </div>

      {/* Toast region — demo of consistent feedback */}
      <div className="bb-toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`bb-toast ${t.tone || "info"}`}>
            <span className="toast-icon">
              {t.tone === "success" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              : t.tone === "danger"  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              : t.tone === "warning" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
            </span>
            <div className="toast-body">
              <p className="toast-title">{t.title}</p>
              <p className="toast-msg">{t.msg}</p>
            </div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
      </div>

      {modalOpen && <window.ConfirmDeleteModal onClose={() => setModalOpen(false)}/>}

      {/* Floating debug bar — visible only in prototype tab. Lets reviewer
          jump straight to specific states. */}
      <PrototypeFab
        onPushToast={pushToast}
        onShowModal={() => setModalOpen(true)}
        onShowLogin={onShowLogin}
        active={active}
        navigate={navigate}
      />
    </>
  );
}

function PrototypeFab({ onPushToast, onShowModal, onShowLogin, active, navigate }) {
  const [open, setOpen] = useStateP(false);
  const demoToasts = [
    { tone: "success", title: "Đã lưu thay đổi", msg: "Cập nhật sản phẩm thành công." },
    { tone: "warning", title: "Cảnh báo tồn kho", msg: "8 SKU đang dưới ngưỡng cảnh báo." },
    { tone: "danger",  title: "Lỗi khi xác nhận đơn", msg: "API trả về 500 — vui lòng thử lại." },
    { tone: "info",    title: "Đơn hàng mới", msg: "BB-25-04824 vừa được tạo bởi khách hàng." },
  ];
  return (
    <div style={{position:"fixed", bottom:24, right:24, zIndex:500, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8}}>
      {open && (
        <div style={{
          background:"var(--bb-surface)", border:"1px solid var(--bb-border)", borderRadius:10,
          boxShadow:"var(--bb-sh-md)", padding:14, width: 280,
        }}>
          <div style={{fontSize:11.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--bb-text-muted)", marginBottom:8}}>Demo states</div>
          <div style={{display:"flex", flexDirection:"column", gap:6, fontSize:12.5}}>
            {demoToasts.map((t,i)=>(
              <button key={i} className={`bb-btn bb-btn-secondary bb-btn-sm`} style={{justifyContent:"flex-start"}} onClick={()=>onPushToast(t)}>
                <span className={`bb-badge bb-badge-${t.tone}`} style={{padding:"0 6px"}}><span className="dot"/></span>
                Toast — {t.tone}
              </button>
            ))}
            <button className="bb-btn bb-btn-secondary bb-btn-sm" style={{justifyContent:"flex-start"}} onClick={onShowModal}>Mở confirm dialog (huỷ đơn)</button>
            <button className="bb-btn bb-btn-secondary bb-btn-sm" style={{justifyContent:"flex-start"}} onClick={onShowLogin}>Xem trang đăng nhập</button>
          </div>
          <div style={{height:1, background:"var(--bb-border-faint)", margin:"10px 0"}}/>
          <div style={{fontSize:11.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--bb-text-muted)", marginBottom:6}}>Jump to screen</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, fontSize:12}}>
            {[
              ["dashboard","Dashboard"],
              ["orders","Đơn hàng"],
              ["order-detail","Chi tiết đơn"],
              ["products","Sản phẩm"],
              ["product-detail","Sửa SP"],
              ["customers","Khách hàng"],
              ["inventory","Kho"],
              ["receivables","Công nợ"],
              ["settings","Cài đặt"],
              ["returns","Đổi trả"],
              ["reviews","Đánh giá"],
              ["pos","POS"],
            ].map(([k,l])=>(
              <button key={k} className={"bb-btn bb-btn-sm " + (active===k?"bb-btn-primary":"bb-btn-ghost")} onClick={()=>navigate(k)} style={{justifyContent:"flex-start", height:24}}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <button className="bb-btn bb-btn-primary" onClick={()=>setOpen(v=>!v)} style={{boxShadow:"var(--bb-sh-md)"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg>
        Demo controls
      </button>
    </div>
  );
}

window.PrototypeApp = PrototypeApp;
