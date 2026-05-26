// home-plp.jsx — Product Listing Page / Archive (LIGHT per WP-parity).
// Matches bb-archive-product / bb-product-archive structures from globals.css.

const { useState: useStateL, useEffect: useEffectL, useMemo: useMemoL, useRef: useRefL } = React;

// ─────────────────────────────────────────────────────────────
// Extended catalog
// ─────────────────────────────────────────────────────────────
const PLP_CATALOG = (() => {
  const variants = [
    { suffix: "Replica MotoGP",    delta:  -2_000_000, badge: "-12%" },
    { suffix: "Solid Matte Black", delta:  -3_500_000, badge: "-18%" },
    { suffix: "Carbon Edition",    delta:  +4_200_000, badge: "PRO" },
    { suffix: "Track Pack",        delta:  +1_800_000, badge: null },
    { suffix: "Touring Spec",      delta:    -800_000, badge: null },
    { suffix: "Limited Run",       delta:  +6_500_000, badge: "HOT" },
  ];
  const list = [];
  FEATURED.forEach((p) => {
    list.push(p);
    variants.slice(0, 3).forEach((v, vi) => {
      const np = {
        ...p,
        id: `${p.id}_v${vi}`,
        name: p.name.split(" ").slice(0, 3).join(" ") + " " + v.suffix,
        price: Math.max(1_200_000, p.price + v.delta),
        was: v.delta < 0 ? p.price : null,
        badge: v.badge,
        rating: Math.round((4.4 + Math.random() * 0.6) * 10) / 10,
      };
      list.push(np);
    });
  });
  return list;
})();

const PLP_BRANDS = ["Tất cả", "SHOEI", "ARAI", "ALPINESTARS", "DAINESE", "REV'IT", "SIDI", "AGV"];

const PLP_SORTS = [
  { id: "popular", label: "Phổ biến nhất" },
  { id: "newest",  label: "Mới nhất" },
  { id: "low",     label: "Giá thấp → cao" },
  { id: "high",    label: "Giá cao → thấp" },
  { id: "rating",  label: "Đánh giá tốt nhất" },
  { id: "sale",    label: "Khuyến mãi nhiều nhất" },
];

const PRICE_RANGES = [
  { id: "all",  label: "Tất cả",            min: 0,           max: Infinity },
  { id: "p1",   label: "Dưới 5 triệu",      min: 0,           max:  5_000_000 },
  { id: "p2",   label: "5 – 10 triệu",       min: 5_000_000,  max: 10_000_000 },
  { id: "p3",   label: "10 – 20 triệu",      min: 10_000_000, max: 20_000_000 },
  { id: "p4",   label: "Trên 20 triệu",      min: 20_000_000, max: Infinity },
];

// ─────────────────────────────────────────────────────────────
// PLP main component
// ─────────────────────────────────────────────────────────────
function ProductListing({ category, onClose, onOpenProduct, onAddToCart, accent }) {
  const t = bbTokens;
  const cat = category || CATEGORIES[0];

  const [view, setView] = useStateL("grid");
  const [sort, setSort] = useStateL("popular");
  const [brand, setBrand] = useStateL("Tất cả");
  const [priceId, setPriceId] = useStateL("all");
  const [onlySale, setOnlySale] = useStateL(false);
  const [inStock, setInStock] = useStateL(true);
  const [filterOpen, setFilterOpen] = useStateL(false);
  const [sortOpen, setSortOpen] = useStateL(false);

  const filtered = useMemoL(() => {
    let arr = PLP_CATALOG.slice();
    if (brand !== "Tất cả") arr = arr.filter((p) => p.brand === brand);
    const range = PRICE_RANGES.find((r) => r.id === priceId);
    if (range && priceId !== "all") arr = arr.filter((p) => p.price >= range.min && p.price <= range.max);
    if (onlySale) arr = arr.filter((p) => p.was);
    switch (sort) {
      case "low":    arr.sort((a, b) => a.price - b.price); break;
      case "high":   arr.sort((a, b) => b.price - a.price); break;
      case "rating": arr.sort((a, b) => b.rating - a.rating); break;
      case "sale":   arr.sort((a, b) => (b.was ? (b.was-b.price)/b.was : 0) - (a.was ? (a.was-a.price)/a.was : 0)); break;
      case "newest": arr.reverse(); break;
      default: break;
    }
    return arr;
  }, [brand, priceId, onlySale, sort]);

  const activeFilterCount = (brand !== "Tất cả" ? 1 : 0) + (priceId !== "all" ? 1 : 0) + (onlySale ? 1 : 0);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 75,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      {/* Dark header bar */}
      <div style={{
        flexShrink: 0,
        background: t.dark, color: "#fff",
        zIndex: 5,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 6px", height: 60,
        }}>
          <button onClick={onClose} style={iconBtn("#fff")} aria-label="Quay lại">
            <BBI.chevL s={22} />
          </button>
          <div style={{ flex: 1, padding: "0 6px", textAlign: "center" }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 11, color: accent,
              letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
            }}>{cat.en}</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 19,
              color: "#fff", letterSpacing: "0.02em",
              textTransform: "uppercase", lineHeight: 1.1,
              marginTop: 2,
            }}>{cat.label}</div>
          </div>
          <button style={iconBtn("#fff")} aria-label="Tìm kiếm">
            <BBI.search s={20} />
          </button>
        </div>
      </div>

      {/* Light archive hero banner */}
      <div style={{ flexShrink: 0, background: "#fff" }}>
        <div style={{
          padding: "12px 16px 10px",
          fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
        }}>
          <span style={{ color: t.blue }}>Bigbike.vn</span>
          <BBI.chev s={11} />
          <span style={{ color: t.text }}>{cat.label}</span>
        </div>

        <div style={{
          position: "relative", height: 110,
          margin: "0 16px 14px",
          overflow: "hidden",
          border: `1px solid ${t.borderSubtle}`,
        }}>
          <ProductPlaceholder tag={cat.tag + " · COLLECTION"} h={110} tone={cat.tone} />
          <div style={{
            position: "absolute", inset: 0,
            padding: "14px 16px",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            background: "linear-gradient(90deg, rgba(0,0,0,0.6) 0%, transparent 70%)",
          }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 11, color: accent,
              letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
            }}>SUMMER COLLECTION 2026</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
              color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em",
              marginTop: 2,
            }}>Giảm tới 40% — Free ship</div>
          </div>
        </div>

        {/* Brand pills */}
        <div style={{
          display: "flex", gap: 6, overflowX: "auto", padding: "0 16px 12px",
          scrollbarWidth: "none",
        }}>
          {PLP_BRANDS.map((b) => {
            const active = b === brand;
            return (
              <button key={b} onClick={() => setBrand(b)} style={{
                flexShrink: 0, height: 36,
                padding: "0 16px",
                background: active ? t.text : "#fff",
                color: active ? "#fff" : t.text,
                border: active ? `1px solid ${t.text}` : `1px solid ${t.border}`,
                fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
                letterSpacing: "0.04em", textTransform: "uppercase",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>{b}</button>
            );
          })}
        </div>
      </div>

      {/* Sticky toolbar — light */}
      <div style={{
        flexShrink: 0, background: "#fff",
        borderTop: `1px solid ${t.borderSubtle}`,
        borderBottom: `1px solid ${t.borderSubtle}`,
        display: "flex", alignItems: "stretch",
      }}>
        <button onClick={() => setFilterOpen(true)} style={toolBtn(t)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Bộ lọc
          {activeFilterCount > 0 && (
            <span style={{
              background: accent, color: "#fff",
              width: 18, height: 18, borderRadius: 9,
              fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{activeFilterCount}</span>
          )}
        </button>
        <div style={{ width: 1, background: t.borderSubtle }} />
        <button onClick={() => setSortOpen(true)} style={toolBtn(t)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 4v16M7 20l-3-3M7 4l-3 3M17 20V4M17 4l3 3M17 20l3-3" />
          </svg>
          <span style={{
            maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textTransform: "none", letterSpacing: "0.01em", fontWeight: 500,
            fontFamily: t.fontBody, fontSize: 13,
          }}>{PLP_SORTS.find((s) => s.id === sort)?.label}</span>
        </button>
        <div style={{ width: 1, background: t.borderSubtle }} />
        <div style={{ display: "flex", padding: "0 4px" }}>
          <button onClick={() => setView("grid")} style={viewBtn(t, view === "grid", accent)} aria-label="Lưới">
            <BBI.grid s={16} />
          </button>
          <button onClick={() => setView("list")} style={viewBtn(t, view === "list", accent)} aria-label="Danh sách">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Applied filter row */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px",
        background: t.bgRaised,
        borderBottom: `1px solid ${t.borderSubtle}`,
        overflowX: "auto", scrollbarWidth: "none",
      }}>
        <span style={{
          fontFamily: t.fontCond, fontSize: 12, color: t.text,
          letterSpacing: "0.04em", flexShrink: 0, fontWeight: 600,
          textTransform: "uppercase",
        }}>{filtered.length} sản phẩm</span>
        {brand !== "Tất cả" && <FilterChip label={brand} onRemove={() => setBrand("Tất cả")} t={t} />}
        {priceId !== "all" && (
          <FilterChip label={PRICE_RANGES.find((r) => r.id === priceId)?.label} onRemove={() => setPriceId("all")} t={t} />
        )}
        {onlySale && <FilterChip label="Đang khuyến mãi" onRemove={() => setOnlySale(false)} t={t} accent={accent} />}
        {(brand === "Tất cả" && priceId === "all" && !onlySale) && (
          <span style={{
            fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
            fontStyle: "italic",
          }}>Chưa có bộ lọc</span>
        )}
      </div>

      {/* Results */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        background: "#fff",
      }}>
        {filtered.length === 0 ? (
          <EmptyState t={t} onReset={() => { setBrand("Tất cả"); setPriceId("all"); setOnlySale(false); }} accent={accent} />
        ) : view === "grid" ? (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            padding: "12px 16px",
          }}>
            {filtered.slice(0, 12).map((p) => (
              <ProductCard
                key={p.id} p={p} accent={accent} width="100%" full
                onAddToCart={onAddToCart} onOpen={onOpenProduct}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: "12px 16px", display: "grid", gap: 10 }}>
            {filtered.slice(0, 12).map((p) => (
              <ListRow key={p.id} p={p} accent={accent} onOpen={onOpenProduct} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{
            padding: "20px 16px 28px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <button style={{
              minHeight: 48, padding: "0 32px",
              background: "transparent", color: t.text,
              border: `2px solid ${t.text}`,
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
              letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10,
            }}>
              Xem thêm <BBI.chevDown s={14} />
            </button>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
              letterSpacing: "0.04em", fontWeight: 600,
            }}>HIỂN THỊ 12 / {filtered.length} SẢN PHẨM</div>
          </div>
        )}
      </div>

      {/* Filter sheet */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        accent={accent}
        priceId={priceId} setPriceId={setPriceId}
        onlySale={onlySale} setOnlySale={setOnlySale}
        inStock={inStock} setInStock={setInStock}
        resultCount={filtered.length}
      />

      <SortSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        accent={accent}
        sort={sort} setSort={setSort}
      />
    </div>
  );
}

function toolBtn(t) {
  return {
    flex: 1, minHeight: 48,
    background: "transparent", border: "none",
    color: t.text,
    fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
    letterSpacing: "0.04em", textTransform: "uppercase",
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "0 8px",
  };
}
function viewBtn(t, active, accent) {
  return {
    width: 36, height: 48,
    background: "transparent", border: "none",
    color: active ? accent : t.textSec,
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
}

function FilterChip({ label, onRemove, t, accent }) {
  return (
    <button onClick={onRemove} style={{
      flexShrink: 0,
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 8px 5px 10px",
      background: accent || "#fff",
      color: accent ? "#fff" : t.text,
      border: accent ? `1px solid ${accent}` : `1px solid ${t.border}`,
      fontFamily: t.fontCond, fontWeight: 500, fontSize: 12,
      letterSpacing: "0.02em",
      cursor: "pointer",
    }}>
      {label}
      <BBI.close s={12} />
    </button>
  );
}

function ListRow({ p, accent, onOpen, onAddToCart }) {
  const t = bbTokens;
  return (
    <div onClick={() => onOpen && onOpen(p)} style={{
      display: "flex", gap: 12,
      background: "#fff", border: `1px solid ${t.borderSubtle}`,
      cursor: "pointer",
    }}>
      <div style={{ width: 124, flexShrink: 0, position: "relative" }}>
        <ProductPlaceholder tag={p.tag} h={124} tone={p.tone} aspect="1/1" />
        {p.badge && (
          <div style={{
            position: "absolute", top: 0, left: 0,
            background: p.badge.startsWith("-") ? accent : (p.badge === "NEW" ? t.text : accent),
            color: "#fff",
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 11,
            letterSpacing: "0.04em", padding: "3px 8px",
            textTransform: "uppercase",
          }}>{p.badge}</div>
        )}
      </div>
      <div style={{ flex: 1, padding: "10px 12px 10px 0", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{
            fontFamily: t.fontCond, fontSize: 11, letterSpacing: "0.08em",
            color: t.textSec, textTransform: "uppercase", fontWeight: 600,
          }}>{p.brand}</span>
          <StarRow value={p.rating} size={11} />
        </div>
        <h3 style={{
          fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 15, color: t.text,
          lineHeight: 1.2, margin: "4px 0 0", textWrap: "pretty",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{p.name}</h3>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 8 }}>
          <div>
            <div style={{
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 16,
              color: t.brandActive, lineHeight: 1,
            }}>{vnd(p.price)}</div>
            {p.was && (
              <div style={{
                fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                textDecoration: "line-through", marginTop: 3,
              }}>{vnd(p.was)}</div>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onAddToCart && onAddToCart(p); }} style={{
            width: 38, height: 38, background: t.text,
            border: "none", color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginRight: 10,
          }} aria-label="Thêm vào giỏ">
            <BBI.cart s={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ t, onReset, accent }) {
  return (
    <div style={{ padding: "60px 30px", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: t.bgRaised, border: `1px solid ${t.borderSubtle}`,
        color: t.textSec,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        <BBI.search s={32} />
      </div>
      <div style={{
        fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
        color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
      }}>Không có sản phẩm phù hợp</div>
      <div style={{
        fontFamily: t.fontBody, fontSize: 14, color: t.textSec,
        marginTop: 6, lineHeight: 1.5, maxWidth: 280, marginLeft: "auto", marginRight: "auto",
        textWrap: "pretty",
      }}>Thử bỏ bớt bộ lọc hoặc chọn dải giá khác để tìm sản phẩm phù hợp với bạn.</div>
      <button onClick={onReset} style={{
        marginTop: 18, minHeight: 46, padding: "0 26px",
        background: accent, color: "#fff", border: "none",
        fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
        letterSpacing: "0.06em", textTransform: "uppercase",
        cursor: "pointer",
      }}>Đặt lại bộ lọc</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter bottom sheet — LIGHT
// ─────────────────────────────────────────────────────────────
function FilterSheet({ open, onClose, accent, priceId, setPriceId, onlySale, setOnlySale, inStock, setInStock, resultCount }) {
  const t = bbTokens;
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 90,
        background: open ? "rgba(0,0,0,0.55)" : "transparent",
        pointerEvents: open ? "auto" : "none",
        transition: "background 200ms",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 91,
        background: "#fff",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        maxHeight: "88%",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "8px 0 0", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 36, height: 4, background: t.border }} />
        </div>
        <div style={{
          padding: "12px 16px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${t.borderSubtle}`,
        }}>
          <div>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
              letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
            }}>BỘ LỌC</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
              color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
            }}>Tinh chỉnh kết quả</div>
          </div>
          <button onClick={onClose} style={iconBtn(t.text)} aria-label="Đóng">
            <BBI.close s={22} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
          <FilterGroup title="Khoảng giá" t={t}>
            <div style={{ display: "grid", gap: 8 }}>
              {PRICE_RANGES.map((r) => {
                const active = r.id === priceId;
                return (
                  <button key={r.id} onClick={() => setPriceId(r.id)} style={{
                    minHeight: 46, padding: "0 14px",
                    background: active ? t.brandSoftBg : "#fff",
                    color: t.text,
                    border: active ? `1px solid ${accent}` : `1px solid ${t.borderSubtle}`,
                    fontFamily: t.fontBody, fontSize: 14,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span>{r.label}</span>
                    {active && <span style={{ color: accent }}><BBI.check s={18} /></span>}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Tùy chọn" t={t}>
            <div style={{ display: "grid", gap: 8 }}>
              <ToggleRow label="Chỉ hiển thị sản phẩm khuyến mãi" value={onlySale} onChange={setOnlySale} t={t} accent={accent} />
              <ToggleRow label="Chỉ hiển thị còn hàng" value={inStock} onChange={setInStock} t={t} accent={accent} />
            </div>
          </FilterGroup>

          <FilterGroup title="Đánh giá tối thiểu" t={t}>
            <div style={{ display: "flex", gap: 6 }}>
              {[5, 4, 3].map((n) => (
                <button key={n} style={{
                  flex: 1, minHeight: 46,
                  background: "#fff", border: `1px solid ${t.borderSubtle}`,
                  color: t.text, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                  textTransform: "uppercase",
                }}>
                  <BBI.star s={13} />
                  {n}.0+
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Size" t={t}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["XS","S","M","L","XL","XXL","3XL"].map((s) => (
                <button key={s} style={{
                  minWidth: 50, minHeight: 42,
                  background: "#fff", border: `1px solid ${t.borderSubtle}`,
                  color: t.text, cursor: "pointer",
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                  letterSpacing: "0.04em", padding: "0 14px",
                }}>{s}</button>
              ))}
            </div>
          </FilterGroup>
        </div>

        <div style={{
          padding: "12px 14px",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          borderTop: `1px solid ${t.borderSubtle}`,
          background: t.bgRaised,
          display: "flex", gap: 10,
        }}>
          <button onClick={() => { setPriceId("all"); setOnlySale(false); }} style={{
            flex: 0.8, minHeight: 50,
            background: "transparent", color: t.text,
            border: `2px solid ${t.text}`,
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
          }}>Đặt lại</button>
          <button onClick={onClose} style={{
            flex: 1.4, minHeight: 50,
            background: accent, color: "#fff", border: "none",
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>Xem {resultCount} sản phẩm</button>
        </div>
      </div>
    </>
  );
}

function FilterGroup({ title, t, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: t.fontCond, fontSize: 13, color: t.text,
        letterSpacing: "0.06em", fontWeight: 600, marginBottom: 10,
        textTransform: "uppercase",
      }}>{title}</div>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange, t, accent }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      minHeight: 50, padding: "0 14px",
      background: "#fff", border: `1px solid ${t.borderSubtle}`,
      cursor: "pointer", color: t.text,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      fontFamily: t.fontBody, fontSize: 14,
      textAlign: "left",
    }}>
      <span>{label}</span>
      <span style={{
        width: 42, height: 24, borderRadius: 12,
        background: value ? accent : t.border,
        position: "relative", flexShrink: 0,
        transition: "background 160ms",
      }}>
        <span style={{
          position: "absolute", top: 2,
          left: value ? 20 : 2,
          width: 20, height: 20, borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 160ms",
        }} />
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Sort sheet — LIGHT
// ─────────────────────────────────────────────────────────────
function SortSheet({ open, onClose, accent, sort, setSort }) {
  const t = bbTokens;
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 90,
        background: open ? "rgba(0,0,0,0.55)" : "transparent",
        pointerEvents: open ? "auto" : "none",
        transition: "background 200ms",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 91,
        background: "#fff",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}>
        <div style={{ padding: "8px 0 0", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 36, height: 4, background: t.border }} />
        </div>
        <div style={{
          padding: "12px 16px 10px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${t.borderSubtle}`,
        }}>
          <div style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
            color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
          }}>Sắp xếp theo</div>
          <button onClick={onClose} style={iconBtn(t.text)} aria-label="Đóng">
            <BBI.close s={22} />
          </button>
        </div>
        <div style={{ padding: "8px 0" }}>
          {PLP_SORTS.map((s) => {
            const active = s.id === sort;
            return (
              <button key={s.id} onClick={() => { setSort(s.id); onClose(); }} style={{
                width: "100%", minHeight: 52, padding: "0 18px",
                background: active ? t.brandSoftBg : "transparent", border: "none",
                color: t.text, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: t.fontBody, fontSize: 15,
                textAlign: "left",
                borderBottom: `1px solid ${t.borderSubtle}`,
                fontWeight: active ? 600 : 400,
              }}>
                <span>{s.label}</span>
                {active && (
                  <span style={{ color: accent }}><BBI.check s={20} /></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  ProductListing, PLP_CATALOG, PLP_BRANDS, PLP_SORTS, PRICE_RANGES,
});
