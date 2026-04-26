/* Bigbike UI Kit — shared UI components (header, footer, product card, etc) */

const { useState, useEffect, useRef } = React;

// ---------- ICONS ----------
function IconSearch(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function IconCart(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
function IconUser(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconMenu(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconChat(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ---------- PROMO STRIP ----------
function PromoStrip() {
  return (
    <div style={{ background: "#000", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="wp-promo-strip">
        <span><b>HOTLINE</b> 0903 123 456 · giao hàng toàn quốc · chính hãng 100%</span>
        <span>Zalo · Facebook · Youtube</span>
      </div>
    </div>
  );
}

// ---------- SEARCH OVERLAY (inline-styles only — immune to CSS cascade) ----------
function SearchOverlay({ open, onClose, tweaks = {} }) {
  const {
    searchLayout = "header-drop",   // "header-drop" | "centered"
    showRecent = true,
    showShortcuts = true,
    resultCount = 6,
    accentColor = "#f90606",
  } = tweaks;

  const [q, setQ] = useState("");
  const [recent, setRecent] = useState(["LS2 MX436 Pioneer", "Sena 50S intercom", "Găng tay Alpinestars"]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current && inputRef.current.focus(), 40);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => { setQ(""); }, [open]);

  if (!open) return null;

  // ── style tokens (inline, no CSS class dependency) ──────────────────────
  const C = {
    bg:        "#111111",
    bgRail:    "#0c0c0c",
    bgHover:   "rgba(255,255,255,0.05)",
    border:    "rgba(255,255,255,0.07)",
    borderHi:  accentColor,
    text:      "#ffffff",
    textSub:   "rgba(255,255,255,0.45)",
    textMuted: "rgba(255,255,255,0.32)",
    accent:    accentColor,
    kbdBg:     "rgba(255,255,255,0.08)",
    kbdBorder: "rgba(255,255,255,0.14)",
  };

  const HEADER_H = 72; // px — must match .wp-header height

  const sScrim = {
    position: "fixed", inset: 0,
    top: searchLayout === "header-drop" ? HEADER_H : 0,
    background: "rgba(0,0,0,0.68)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 98,
  };

  const sShell = searchLayout === "header-drop" ? {
    position: "fixed", left: 0, right: 0,
    top: HEADER_H, zIndex: 99,
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 2px 0 ${accentColor}80`,
    display: "flex", flexDirection: "column",
    maxHeight: `calc(100vh - ${HEADER_H}px)`,
    animation: "srch-drop 200ms cubic-bezier(.22,1,.36,1)",
  } : {
    position: "fixed", left: "50%", top: "10vh",
    transform: "translateX(-50%)",
    width: "min(860px, 94vw)", zIndex: 99,
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px ${accentColor}20`,
    display: "flex", flexDirection: "column",
    maxHeight: "80vh",
    animation: "srch-pop 200ms cubic-bezier(.22,1,.36,1)",
  };

  const sBar = {
    display: "flex", alignItems: "center", gap: 14,
    padding: "18px 32px",
    borderBottom: `1px solid ${C.border}`,
    background: C.bg,
    flexShrink: 0,
    borderTop: `2px solid ${accentColor}`,
  };

  const sInput = {
    flex: 1, background: "transparent", border: "none",
    color: C.text, fontSize: 17, outline: "none",
    letterSpacing: "0.01em", fontFamily: "inherit", fontWeight: 500,
  };

  const sBody = {
    display: "grid", gridTemplateColumns: "280px 1fr",
    overflow: "hidden",
    flex: 1, minHeight: 0,
  };

  const sRail = {
    borderRight: `1px solid ${C.border}`,
    background: C.bgRail,
    padding: "20px 16px",
    overflowY: "auto",
  };

  const sMain = {
    padding: "20px 24px",
    overflowY: "auto",
    background: C.bg,
  };

  const sSection = { marginBottom: 20 };

  const sSectionHead = {
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  };

  const sLabel = {
    fontSize: 10, fontWeight: 700,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: C.textSub,
  };

  const sRow = (hovered) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 10px", borderRadius: 5,
    cursor: "pointer", background: hovered ? C.bgHover : "transparent",
    border: "none", width: "100%", textAlign: "left",
    fontFamily: "inherit", color: C.text, transition: "background 120ms",
    listStyle: "none",
  });

  const sFooter = {
    display: "flex", alignItems: "center", gap: 20,
    padding: "11px 32px",
    borderTop: `1px solid ${C.border}`,
    background: "#0a0a0a",
    flexShrink: 0,
  };

  const sKbd = {
    fontFamily: "inherit", fontSize: 10, fontWeight: 700,
    padding: "2px 7px", background: C.kbdBg,
    border: `1px solid ${C.kbdBorder}`, borderRadius: 3,
    color: "rgba(255,255,255,0.85)", minWidth: 20, textAlign: "center",
  };

  const sChips = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 };

  const sChip = {
    background: "#1a1a1a", border: `1px solid rgba(255,255,255,0.1)`,
    color: "rgba(255,255,255,0.9)", fontSize: 12,
    padding: "7px 14px", borderRadius: 999,
    cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500,
  };

  const sThumb = {
    width: 52, height: 52, flexShrink: 0,
    background: "radial-gradient(circle at 50% 40%, #2a2a2a, #0e0e0e)",
    border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 5,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, color: "rgba(255,255,255,0.25)",
    textTransform: "uppercase", letterSpacing: "0.04em",
    fontFamily: "var(--bb-font-display, sans-serif)",
  };

  const quickCats = [
    { id: "helmet", label: "Mũ bảo hiểm", sub: "412 sản phẩm" },
    { id: "jacket", label: "Áo giáp · Jacket", sub: "186 sản phẩm" },
    { id: "gloves", label: "Găng tay", sub: "94 sản phẩm" },
    { id: "boots",  label: "Giày moto", sub: "68 sản phẩm" },
    { id: "intercom", label: "Intercom", sub: "32 sản phẩm" },
    { id: "touring", label: "Phụ kiện touring", sub: "120 sản phẩm" },
  ];
  const trending = ["LS2 MX436", "Sena 50S", "Alpinestars", "Airbag vest", "Giày SMX-6", "Mũ fullface"];
  const brands = ["LS2", "Alpinestars", "Sena", "Furygan", "AGV", "Shoei", "Scoyco", "Helite"];

  const highlight = (text, query) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const clearRecent = () => setRecent([]);

  /* Inline keyframes injected once */
  if (!document.getElementById("srch-kf")) {
    const s = document.createElement("style");
    s.id = "srch-kf";
    s.textContent = `
      @keyframes srch-drop { from { transform: translateY(-10px); opacity: 0; } to { transform: none; opacity: 1; } }
      @keyframes srch-pop  { from { transform: translateX(-50%) translateY(-14px) scale(.97); opacity: 0; } to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; } }
    `;
    document.head.appendChild(s);
  }

  const NavRow = ({ icon, label, sub, onClick: handleClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
      <div
        role="button" tabIndex={0}
        onClick={handleClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: hov ? C.bgHover : "transparent", transition: "background 120ms" }}
      >
        {icon && <span style={{ color: C.textSub, display: "flex", flexShrink: 0 }}>{icon}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: sub ? 1 : 0 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: C.textSub }}>{sub}</div>}
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={hov ? accentColor : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "stroke 120ms", transform: hov ? "translateX(2px)" : "none" }}><polyline points="9 18 15 12 9 6" /></svg>
      </div>
    );
  };

  const ProductRow = ({ p }) => {
    const [hov, setHov] = React.useState(false);
    return (
      <div
        role="button" tabIndex={0}
        onClick={onClose}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 10px", borderRadius: 6, cursor: "pointer", background: hov ? "#1a1a1a" : "transparent", border: `1px solid ${hov ? "rgba(255,255,255,0.08)" : "transparent"}`, transition: "all 140ms" }}
      >
        <div style={sThumb}>{p.category.split(" ")[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accentColor, marginBottom: 2 }}>{p.brand}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {q ? highlight(p.name, q) : p.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSub }}>
            <span style={{ color: "#f99d1c" }}>★ {p.rating}</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span>{p.category}</span>
            {p.tag && <><span style={{ color: "rgba(255,255,255,0.2)" }}>·</span><span style={{ color: accentColor, fontWeight: 700 }}>{p.tag}</span></>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--bb-font-display, sans-serif)", fontSize: 15, color: accentColor, fontWeight: 700 }}>{window.formatVnd(p.price)}</div>
          {p.old && <div style={{ fontSize: 11, color: C.textSub, textDecoration: "line-through", marginTop: 1 }}>{window.formatVnd(p.old)}</div>}
        </div>
      </div>
    );
  };

  const products = window.BB_PRODUCTS || [];
  const matchesQ = (p) => (p.name + " " + p.brand + " " + p.category).toLowerCase().includes(q.toLowerCase());
  const results = q ? products.filter(matchesQ) : [];
  const suggestedBrands = q ? brands.filter((b) => b.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : [];
  const suggestedCats = q ? quickCats.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 3) : [];
  const displayProducts = (q ? results : products).slice(0, resultCount);

  const clockIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;

  return (
    <>
      {/* Scrim */}
      <div style={sScrim} onClick={onClose} />

      {/* Shell */}
      <div style={sShell} onClick={(e) => e.stopPropagation()}>

        {/* ── Search bar ── */}
        <div style={sBar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm sản phẩm, thương hiệu, danh mục…"
            autoComplete="off"
            style={{ ...sInput, caretColor: accentColor }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{ background: "rgba(255,255,255,0.07)", border: "none", color: C.textSub, width: 24, height: 24, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
            <span style={sKbd}>ESC</span>
            <span>đóng</span>
          </div>
        </div>

        {/* ── Body 2-col ── */}
        <div style={sBody}>

          {/* LEFT RAIL */}
          <div style={sRail}>
            {!q ? (
              <>
                {showRecent && recent.length > 0 && (
                  <div style={sSection}>
                    <div style={sSectionHead}>
                      <span style={sLabel}>Gần đây</span>
                      <button onClick={clearRecent} style={{ background: "none", border: "none", color: C.textSub, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Xoá</button>
                    </div>
                    {recent.map((r) => (
                      <NavRow key={r} icon={clockIcon} label={r} onClick={() => setQ(r)} />
                    ))}
                  </div>
                )}
                <div style={sSection}>
                  <div style={sSectionHead}><span style={sLabel}>Danh mục</span></div>
                  {quickCats.map((c) => (
                    <NavRow key={c.id} label={c.label} sub={c.sub} onClick={() => setQ(c.label)} />
                  ))}
                </div>
              </>
            ) : (
              <>
                {suggestedBrands.length > 0 && (
                  <div style={sSection}>
                    <div style={sSectionHead}>
                      <span style={sLabel}>Thương hiệu</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: `${accentColor}22`, color: accentColor, borderRadius: 999 }}>{suggestedBrands.length}</span>
                    </div>
                    {suggestedBrands.map((b) => (
                      <NavRow key={b} label={<>{highlight(b, q)}</>} sub={`Xem tất cả sản phẩm ${b}`} onClick={() => setQ(b)} />
                    ))}
                  </div>
                )}
                {suggestedCats.length > 0 && (
                  <div style={sSection}>
                    <div style={sSectionHead}><span style={sLabel}>Danh mục</span></div>
                    {suggestedCats.map((c) => (
                      <NavRow key={c.id} label={<>{highlight(c.label, q)}</>} sub={c.sub} onClick={() => setQ(c.label)} />
                    ))}
                  </div>
                )}
                {suggestedBrands.length === 0 && suggestedCats.length === 0 && (
                  <div style={sSection}>
                    <div style={sSectionHead}><span style={sLabel}>Gợi ý</span></div>
                    <NavRow label="Xoá bộ lọc" sub="Xem toàn bộ catalog" onClick={() => setQ("")} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT MAIN */}
          <div style={sMain}>
            <div style={{ ...sSectionHead, marginBottom: 12 }}>
              <span style={sLabel}>{q ? `Sản phẩm · ${results.length} kết quả` : "Bán chạy tuần này"}</span>
              {q && results.length > 0 && (
                <button onClick={onClose} style={{ background: "none", border: "none", color: accentColor, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Xem tất cả →</button>
              )}
            </div>

            {q && results.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(255,255,255,0.04)", color: C.textSub, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                </div>
                <div style={{ fontFamily: "var(--bb-font-display, sans-serif)", fontSize: 17, color: C.text, textTransform: "uppercase", marginBottom: 6 }}>Không tìm thấy "{q}"</div>
                <div style={{ fontSize: 13, color: C.textSub, marginBottom: 18 }}>Thử từ khoá ngắn hơn hoặc chọn gợi ý</div>
                <div style={{ ...sChips, justifyContent: "center" }}>
                  {trending.slice(0, 4).map((t) => (
                    <button key={t} style={sChip} onClick={() => setQ(t)}>{t}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {displayProducts.map((p) => <ProductRow key={p.id} p={p} />)}
                </div>
                {!q && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ ...sSectionHead, marginBottom: 10 }}><span style={sLabel}>Xu hướng tìm kiếm</span></div>
                    <div style={sChips}>
                      {trending.map((t) => (
                        <button key={t} style={sChip} onClick={() => setQ(t)}>🔥 {t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        {showShortcuts && (
          <div style={sFooter}>
            {[["↑","↓","di chuyển"], ["↵","mở sản phẩm"], ["ESC","đóng"]].map(([k1,k2,lbl]) => lbl ? (
              <div key={k1} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <span style={sKbd}>{k1}</span>
                {!lbl.startsWith("mở") && !lbl.startsWith("đóng") && <span style={sKbd}>{k2}</span>}
                <span style={{ marginLeft: 3 }}>{lbl || k2}</span>
              </div>
            ) : (
              <div key={k1} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textSub, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <span style={sKbd}>{k1}</span>
                <span style={{ marginLeft: 3 }}>{k2}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: C.textSub }}>
              Cần tư vấn? <span style={{ color: accentColor, fontWeight: 700, cursor: "pointer" }}>Chat Zalo 0903 123 456 →</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- MOBILE DRAWER ----------
function MobileDrawer({ open, onClose, onNav, activePage, cartCount }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!document.getElementById("drawer-kf")) {
    const s = document.createElement("style");
    s.id = "drawer-kf";
    s.textContent = `
      @keyframes drawer-in  { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes drawer-out { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(s);
  }

  const nav = [
    { id: "home",     label: "Trang chủ",   icon: "⊙" },
    { id: "catalog",  label: "Sản phẩm",    icon: "◈" },
    { id: "brands",   label: "Thương hiệu", icon: "◇" },
    { id: "guide",    label: "Hướng dẫn",   icon: "◎" },
    { id: "about",    label: "Giới thiệu",  icon: "◉" },
    { id: "news",     label: "Tin tức",     icon: "▣" },
    { id: "contact",  label: "Liên hệ",     icon: "◆" },
  ];

  if (!open) return null;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, top: 72, background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(4px)", zIndex: 150,
          animation: "srch-drop 200ms ease",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed", top: 72, right: 0, bottom: 0,
          width: "min(340px, 90vw)",
          background: "#111",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 151,
          display: "flex", flexDirection: "column",
          animation: "drawer-in 260ms cubic-bezier(.22,1,.36,1)",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "#0d0d0d",
        }}>
          <img src="../../assets/logo/bigbike-logo-mono-white.png" alt="BigBike" style={{ height: 36 }} />
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", width: 32, height: 32, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          {nav.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNav(item.id); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  width: "100%", padding: "13px 14px",
                  background: isActive ? "rgba(249,6,6,0.1)" : "transparent",
                  border: "none",
                  borderLeft: isActive ? "3px solid #f90606" : "3px solid transparent",
                  borderRadius: 5,
                  color: isActive ? "#f90606" : "rgba(255,255,255,0.85)",
                  fontFamily: "var(--bb-font-body)", fontSize: 14,
                  fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase", cursor: "pointer",
                  textAlign: "left", transition: "all 140ms",
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 16, opacity: 0.5, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                <svg style={{ marginLeft: "auto", opacity: isActive ? 1 : 0.3 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            );
          })}
        </nav>

        {/* Quick actions */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={() => { onNav("cart"); onClose(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#fff", fontFamily: "var(--bb-font-body)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Giỏ ({cartCount})
          </button>
          <button
            onClick={() => { onNav("account"); onClose(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "#fff", fontFamily: "var(--bb-font-body)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Tài khoản
          </button>
        </div>

        {/* Contact strip */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0a0a0a", fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span style={{ color: "#f90606", fontWeight: 700 }}>HOTLINE</span> 0903 123 456 · T2–CN 8:30–21:00
        </div>
      </div>
    </>
  );
}
function SiteHeader({ cartCount = 2, activePage = "home", onNav = () => {}, searchTweaks = {} }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nav = [
    { id: "home",     label: "Trang chủ" },
    { id: "catalog",  label: "Sản phẩm" },
    { id: "brands",   label: "Thương hiệu" },
    { id: "guide",    label: "Hướng dẫn" },
    { id: "about",    label: "Giới thiệu" },
    { id: "news",     label: "Tin tức" },
    { id: "contact",  label: "Liên hệ" },
  ];
  return (
    <>
      <header className="wp-header">
        <div className="wp-header-inner">
          <div className="wp-logo-panel">
            <a onClick={() => onNav("home")} style={{ cursor: "pointer" }}>
              <img src="../../assets/logo/bigbike-logo-primary.png" alt="BigBike" />
            </a>
          </div>
          <nav className="wp-nav">
            {nav.map((item, i) => (
              <React.Fragment key={item.id}>
                {i > 0 && <span className="wp-nav-sep">•</span>}
                <a
                  className={`wp-nav-link ${activePage === item.id ? "active" : ""}`}
                  onClick={() => onNav(item.id)}
                >
                  {item.label}
                </a>
              </React.Fragment>
            ))}
          </nav>
          <div className="wp-header-actions">
            <button className="wp-icon-btn" aria-label="Tìm kiếm" onClick={() => setSearchOpen(true)}><IconSearch /></button>
            <button className="wp-icon-btn" aria-label="Giỏ hàng" onClick={() => onNav("cart")}>
              <IconCart />
              {cartCount > 0 && <span className="wp-cart-count">{cartCount}</span>}
            </button>
            <button className="wp-icon-btn" aria-label="Tài khoản" onClick={() => onNav("account")}><IconUser /></button>
            <button className="wp-icon-btn" aria-label="Menu" onClick={() => setDrawerOpen(true)}><IconMenu /></button>
          </div>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} tweaks={searchTweaks} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNav={onNav} activePage={activePage} cartCount={cartCount} />
    </>
  );
}

// ---------- FOOTER ----------
function SiteFooter() {
  return (
    <footer className="wp-footer">
      <div className="wp-footer-inner">
        <div>
          <img src="../../assets/logo/bigbike-logo-mono-white.png" alt="BigBike" style={{ height: 56, marginBottom: 14 }} />
          <p>Bigbike — shop bảo hộ moto &amp; phụ kiện touring chính hãng tại TP.HCM. Đồng hành cùng rider Việt Nam từ 2013.</p>
          <div className="wp-footer-social">
            <a title="Facebook">f</a>
            <a title="Youtube">Y</a>
            <a title="Zalo">Z</a>
            <a title="Instagram">IG</a>
          </div>
        </div>
        <div>
          <h4>Danh mục</h4>
          <ul>
            <li><a>Mũ bảo hiểm</a></li>
            <li><a>Áo giáp · Jacket</a></li>
            <li><a>Găng tay · Boots</a></li>
            <li><a>Intercom · Sena</a></li>
            <li><a>Phụ kiện touring</a></li>
          </ul>
        </div>
        <div>
          <h4>Hỗ trợ</h4>
          <ul>
            <li><a>Hướng dẫn mua hàng</a></li>
            <li><a>Chính sách đổi trả</a></li>
            <li><a>Chính sách bảo hành</a></li>
            <li><a>Vận chuyển &amp; giao hàng</a></li>
            <li><a>Hướng dẫn chọn size</a></li>
          </ul>
        </div>
        <div>
          <h4>Liên hệ</h4>
          <ul>
            <li>123 Nguyễn Đình Chiểu, Q.3, TP.HCM</li>
            <li>Hotline: 0903 123 456</li>
            <li>Email: shop@bigbike.vn</li>
            <li>Zalo: 0903 123 456</li>
            <li>T2 – CN · 8:30 – 21:00</li>
          </ul>
        </div>
      </div>
      <div className="wp-footer-bottom">
        © 2026 BigBike.vn · GPKD 0312345678 cấp bởi Sở KHĐT TP.HCM · Don't Let Behind
      </div>
    </footer>
  );
}

// ---------- FLOATING CHAT ----------
function FloatingChat() {
  return (
    <button className="wp-fab" aria-label="Chat với BigBike" title="Chat Zalo">
      <IconChat />
    </button>
  );
}

// ---------- PRODUCT CARD ----------
function ProductCard({ product, onAdd }) {
  const stock = window.stockLabel(product.stock);
  return (
    <a className="wp-product-card" onClick={(e) => { e.preventDefault(); onAdd && onAdd(product); }}>
      <div className="wp-product-image">
        {product.tag && (
          <span className={`wp-product-tag ${product.tag === "NEW" ? "new" : ""}`}>{product.tag}</span>
        )}
        <span className="wp-product-image-placeholder">{product.category.split(" ")[0]}</span>
        <div className="wp-product-addbar">THÊM VÀO GIỎ HÀNG</div>
      </div>
      <div className="wp-product-body">
        <div className="wp-product-brand">{product.brand}</div>
        <h3 className="wp-product-name">{product.name}</h3>
        <div className="wp-product-rating">
          {"★".repeat(Math.round(product.rating))}{"☆".repeat(5 - Math.round(product.rating))}
          <span>({product.reviews})</span>
        </div>
        <div className="wp-product-price">
          <b>{window.formatVnd(product.price)}</b>
          {product.old && <s>{window.formatVnd(product.old)}</s>}
        </div>
        <span className={`wp-stock-badge ${stock.cls}`}>{stock.label}</span>
      </div>
    </a>
  );
}

// ---------- TOAST ----------
function Toast({ product, onClose }) {
  useEffect(() => {
    if (!product) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [product, onClose]);
  if (!product) return null;
  return (
    <div className="wp-toast" role="status">
      <div>
        <b>✓ Đã thêm vào giỏ</b>
        <span>{product.name}</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  IconSearch, IconCart, IconUser, IconMenu, IconChat,
  PromoStrip, SiteHeader, SiteFooter, FloatingChat,
  ProductCard, Toast, SearchOverlay, MobileDrawer,
});
