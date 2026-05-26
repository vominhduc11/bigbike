// home-app.jsx — BigBike Vietnam mobile homepage prototype
// LIGHT-FIRST per styleguide: white page sections, dark header / footer / drawers / bottom-nav.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────
// Mock data (Vietnamese e-comm catalog)
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "helmet",  label: "Mũ bảo hiểm",   en: "HELMETS",     count: 248, tag: "MŨ",        tone: "light" },
  { id: "jacket",  label: "Áo giáp",        en: "JACKETS",     count: 132, tag: "ÁO",        tone: "warm" },
  { id: "glove",   label: "Găng tay",       en: "GLOVES",      count:  86, tag: "GĂNG",      tone: "chrome" },
  { id: "boot",    label: "Giày moto",      en: "BOOTS",       count:  54, tag: "GIÀY",      tone: "light2" },
  { id: "pant",    label: "Quần bảo hộ",    en: "PANTS",       count:  41, tag: "QUẦN",      tone: "warm" },
  { id: "acc",     label: "Phụ kiện",       en: "ACCESSORIES", count: 197, tag: "PHỤ KIỆN",  tone: "chrome" },
];

const FEATURED = [
  { id: "p1", name: "Shoei X-Fifteen Marquez 7",   brand: "SHOEI",       cat: "Mũ Full-face",  price: 28_900_000, was: 32_500_000, tag: "HELMET / FULL-FACE",  tone: "light",  badge: "-11%", rating: 4.9, stock: "IN_STOCK" },
  { id: "p2", name: "Alpinestars GP Plus R V4",    brand: "ALPINESTARS", cat: "Áo giáp da",    price: 18_500_000, was: null,        tag: "JACKET / LEATHER",   tone: "warm",   badge: "NEW",  rating: 4.8, stock: "IN_STOCK" },
  { id: "p3", name: "Dainese Carbon 4 Long Black", brand: "DAINESE",     cat: "Găng tay",      price:  6_990_000, was:  8_490_000, tag: "GLOVE / CARBON",     tone: "chrome", badge: "-18%", rating: 4.7, stock: "IN_STOCK" },
  { id: "p4", name: "Arai RX-7V Evo Diamond White",brand: "ARAI",        cat: "Mũ Full-face",  price: 31_200_000, was: null,        tag: "HELMET / RACE",      tone: "light2", badge: "HOT",  rating: 5.0, stock: "LOW_STOCK" },
  { id: "p5", name: "Rev'It Tornado 4 Touring",    brand: "REV'IT",      cat: "Áo touring",    price: 12_400_000, was: 14_900_000, tag: "JACKET / TOURING",   tone: "warm",   badge: "-17%", rating: 4.6, stock: "IN_STOCK" },
  { id: "p6", name: "Sidi Crossfire 3 SRS",        brand: "SIDI",        cat: "Giày off-road", price: 19_800_000, was: null,        tag: "BOOT / MX",          tone: "chrome", badge: "PRO", rating: 4.9, stock: "IN_STOCK" },
];

const BRANDS = ["SHOEI", "ARAI", "ALPINESTARS", "DAINESE", "REV'IT", "SIDI", "AGV", "KOMINE"];

const TRUST = [
  { icon: "shield",  title: "100% Chính hãng",     sub: "Tem hologram đầy đủ" },
  { icon: "rotate",  title: "Đổi trả 7 ngày",      sub: "Miễn phí vận chuyển" },
  { icon: "headset", title: "Tư vấn size",          sub: "Hotline 24/7" },
  { icon: "truck",   title: "Giao toàn quốc",       sub: "Nội thành 2h" },
  { icon: "spark",   title: "Bảo hành chính hãng", sub: "Tới 5 năm" },
];

const BLOG = [
  { id: "b1", kicker: "CẨM NANG", title: "Cách chọn mũ bảo hiểm theo khuôn đầu cho biker Việt", date: "15/05/2026", read: "8 phút", tag: "MŨ", tone: "warm",  cat: "Hướng dẫn" },
  { id: "b2", kicker: "AN TOÀN",  title: "Áo giáp da vs textile — Khi nào nên chọn loại nào?",  date: "08/05/2026", read: "6 phút", tag: "ÁO", tone: "light", cat: "Tư vấn"   },
  { id: "b3", kicker: "REVIEW",   title: "Trên tay Shoei X-Fifteen — flagship đua xe 2026",     date: "01/05/2026", read: "12 phút", tag: "MŨ", tone: "chrome",cat: "Đánh giá" },
];

const HERO_SLIDES = [
  { kicker: "MARQUEZ COLLECTION 2026", title: "ĐI ĐỂ\nCHIẾN THẮNG",    sub: "Shoei X-Fifteen Marquez 7 — bản giới hạn vừa cập bến.", cta: "MUA NGAY",        code: "SHOEI / X-FIFTEEN",     tint: "dark" },
  { kicker: "TOURING SEASON",          title: "ĐƯỜNG DÀI\nKHÔNG THỎA HIỆP",   sub: "Bộ touring chống nước GORE-TEX — giảm 22% trong tháng 5.",     cta: "KHÁM PHÁ",        code: "REV'IT / TORNADO 4",    tint: "light" },
  { kicker: "TRACK READY",             title: "ĐUA THỰC THỤ\nCẦN GEAR THỰC THỤ", sub: "Bộ sưu tập Alpinestars GP — đã kiểm chuẩn FIM.",     cta: "XEM BỘ SƯU TẬP",  code: "ALPINESTARS / GP",      tint: "dark" },
];

// ─────────────────────────────────────────────────────────────
// Promo strip + Dark sticky header
// ─────────────────────────────────────────────────────────────
function PromoStrip({ accent }) {
  const t = bbTokens;
  return (
    <div style={{
      background: accent, color: "#fff",
      fontFamily: t.fontCond, fontWeight: 600,
      fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase",
      textAlign: "center", padding: "5px 12px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      whiteSpace: "nowrap", overflow: "hidden",
    }}>
      <BBI.bolt s={11} />
      <span>Free ship đơn từ 500K · Trả góp 0% · Hotline 1900.6789</span>
    </div>
  );
}

function Header({ accent, onMenu, onSearch, onCart, cartCount }) {
  const t = bbTokens;
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 30,
      background: t.dark, color: t.textInv,
    }}>
      <PromoStrip accent={accent} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 8px", height: 60, gap: 4,
      }}>
        <button onClick={onMenu} style={iconBtn(t.textInv)} aria-label="Menu">
          <BBI.menu s={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center" }}>
          <BigBikeMark size={22} color={t.textInv} dot={accent} />
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          <button onClick={onSearch} style={iconBtn(t.textInv)} aria-label="Tìm kiếm">
            <BBI.search s={21} />
          </button>
          <button onClick={onCart} style={{ ...iconBtn(t.textInv), position: "relative" }} aria-label="Giỏ hàng">
            <BBI.cart s={22} />
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: 6, right: 4,
                minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 8, background: accent, color: "#fff",
                fontFamily: t.fontBody, fontWeight: 700, fontSize: 10, lineHeight: "16px",
                textAlign: "center", border: `2px solid ${t.dark}`,
              }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function iconBtn(color) {
  return {
    width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "none", color, cursor: "pointer",
    padding: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────
function HeroSlider({ accent, variant }) {
  const t = bbTokens;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setIdx((x) => (x + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(i);
  }, []);
  const slide = HERO_SLIDES[idx];

  if (variant === "split") {
    return (
      <div style={{ background: "#fff" }}>
        <div style={{ position: "relative", height: 220 }}>
          <HeroPlaceholder tag={slide.code} tint={slide.tint} />
        </div>
        <div style={{ padding: "20px 16px 22px", background: "#fff", borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, letterSpacing: "0.10em",
            color: accent, fontWeight: 600, marginBottom: 8, textTransform: "uppercase",
          }}>{slide.kicker}</div>
          <h2 style={{
            fontFamily: t.fontDisplay, fontWeight: 600,
            fontSize: 30, lineHeight: 1.08,
            color: t.text, margin: 0, whiteSpace: "pre-line",
            textTransform: "uppercase",
          }}>{slide.title}</h2>
          <p style={{
            fontFamily: t.fontBody, fontSize: 15, lineHeight: 1.5,
            color: t.textSec, margin: "12px 0 18px", textWrap: "pretty",
          }}>{slide.sub}</p>
          <CTAButton accent={accent}>{slide.cta}</CTAButton>
        </div>
        <Pagination count={HERO_SLIDES.length} active={idx} accent={accent} onSelect={setIdx} />
      </div>
    );
  }

  // bold / slider — full-bleed dark hero with overlay text (WP-parity)
  return (
    <div style={{ position: "relative", height: variant === "bold" ? 520 : 460, overflow: "hidden" }}>
      <HeroPlaceholder tag={slide.code} tint="dark" />
      <div style={{
        position: "absolute", inset: 0,
        padding: "0 18px 28px",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        alignItems: "flex-start",
      }}>
        <div style={{
          fontFamily: t.fontCond, fontSize: 12, letterSpacing: "0.12em",
          color: accent, fontWeight: 600, marginBottom: 10,
          textTransform: "uppercase",
        }}>{slide.kicker}</div>
        <h1 style={{
          fontFamily: t.fontDisplay, fontWeight: 600,
          fontSize: variant === "bold" ? 44 : 38, lineHeight: 1.05,
          color: "#fff", margin: 0, whiteSpace: "pre-line",
          textTransform: "uppercase",
        }}>{slide.title}</h1>
        <p style={{
          fontFamily: t.fontBody, fontSize: 15, lineHeight: 1.5,
          color: "rgba(255,255,255,0.92)", margin: "14px 0 18px", maxWidth: 320,
          textWrap: "pretty",
        }}>{slide.sub}</p>
        <CTAButton accent={accent}>{slide.cta}</CTAButton>
      </div>
      <Pagination count={HERO_SLIDES.length} active={idx} accent={accent} onSelect={setIdx} overlay />
    </div>
  );
}

function CTAButton({ children, accent, variant = "solid", size = "md", onClick, full }) {
  const t = bbTokens;
  const isLg = size === "lg";
  const styles = variant === "solid"
    ? { background: accent || t.brand, color: "#fff", border: `1px solid ${accent || t.brand}` }
    : variant === "outline-light"
      ? { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.7)" }
      : { background: "transparent", color: accent || t.brand, border: `2px solid ${accent || t.brand}` };
  return (
    <button onClick={onClick} style={{
      ...styles,
      width: full ? "100%" : "auto",
      minHeight: isLg ? 52 : 48,
      padding: isLg ? "0 28px" : "0 22px",
      fontFamily: t.fontCond, fontWeight: 600,
      fontSize: 15, letterSpacing: "0.04em",
      textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
      cursor: "pointer", whiteSpace: "nowrap",
    }}>
      {children}
      <BBI.arrow s={16} />
    </button>
  );
}

function Pagination({ count, active, accent, onSelect, overlay }) {
  const t = bbTokens;
  if (overlay) {
    return (
      <div style={{
        position: "absolute", bottom: 16, right: 14,
        background: "rgba(0,0,0,0.55)",
        padding: "6px 10px",
        fontFamily: t.fontMono, fontSize: 11, color: "#fff", letterSpacing: "0.10em",
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <span>{String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "10px 14px 16px", background: "#fff",
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} onClick={() => onSelect(i)} style={{
          width: i === active ? 24 : 8, height: 3,
          background: i === active ? accent : t.border,
          border: "none", padding: 0, cursor: "pointer",
          transition: "width 200ms, background 200ms",
        }} aria-label={`Slide ${i+1}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section header — WP-parity kicker (red, uppercase, Barlow Condensed)
//   + Oswald title in black
// ─────────────────────────────────────────────────────────────
function SectionHeader({ kicker, title, accent, link = "Xem tất cả", onClick, dark }) {
  const t = bbTokens;
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      padding: "0 16px", marginBottom: 16, gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, letterSpacing: "0.08em",
            color: accent, fontWeight: 600, marginBottom: 4, textTransform: "uppercase",
          }}>{kicker}</div>
        )}
        <h2 style={{
          fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 24,
          color: dark ? "#fff" : t.text, margin: 0,
          lineHeight: 1.1, textTransform: "uppercase",
        }}>{title}</h2>
      </div>
      {link && (
        <button onClick={onClick} style={{
          background: "transparent", border: "none",
          color: dark ? "#fff" : t.textSec,
          fontFamily: t.fontBody, fontSize: 13, fontWeight: 500,
          display: "inline-flex", alignItems: "center", gap: 4,
          cursor: "pointer", padding: "6px 0", whiteSpace: "nowrap",
        }}>{link}<BBI.chev s={13} /></button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Categories — WP-parity: white card + image + category name + Mua ngay →
// ─────────────────────────────────────────────────────────────
function Categories({ accent, variant, onOpen }) {
  const t = bbTokens;
  if (variant === "scroll") {
    return (
      <section style={{ padding: "32px 0 8px", background: "#fff" }}>
        <SectionHeader kicker="DANH MỤC SẢN PHẨM" title="MUA SẮM THEO LOẠI" accent={accent} />
        <div style={{
          display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 6px",
          scrollbarWidth: "none",
        }}>
          {CATEGORIES.map((c) => (
            <a key={c.id} onClick={() => onOpen && onOpen(c)} style={{
              flex: "0 0 138px",
              border: `1px solid ${t.borderSubtle}`,
              background: "#fff", textDecoration: "none",
              cursor: "pointer",
            }}>
              <ProductPlaceholder tag={c.tag} h={120} tone={c.tone} />
              <div style={{ padding: "12px 14px 14px", borderTop: `1px solid ${t.borderSubtle}` }}>
                <div style={{
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                  color: t.text, textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}>{c.label}</div>
                <div style={{
                  fontFamily: t.fontCond, fontSize: 12, color: accent,
                  marginTop: 6, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  textTransform: "uppercase",
                }}>MUA NGAY <BBI.chev s={11} /></div>
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  if (variant === "stack") {
    return (
      <section style={{ padding: "32px 16px 8px", background: "#fff" }}>
        <SectionHeader kicker="DANH MỤC SẢN PHẨM" title="MUA SẮM THEO LOẠI" accent={accent} />
        <div style={{ display: "grid", gap: 10 }}>
          {CATEGORIES.slice(0, 4).map((c) => (
            <a key={c.id} onClick={() => onOpen && onOpen(c)} style={{
              border: `1px solid ${t.borderSubtle}`,
              background: "#fff", overflow: "hidden",
              display: "flex", alignItems: "stretch", cursor: "pointer",
            }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <ProductPlaceholder tag={c.tag} h={104} tone={c.tone} aspect="1/1" />
              </div>
              <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{
                  fontFamily: t.fontCond, fontSize: 11, color: accent,
                  letterSpacing: "0.10em", fontWeight: 600, marginBottom: 4,
                }}>{c.en}</div>
                <div style={{
                  fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
                  color: t.text, lineHeight: 1.1, textTransform: "uppercase",
                }}>{c.label}</div>
                <div style={{
                  fontFamily: t.fontBody, fontSize: 13, color: t.textSec,
                  marginTop: 4,
                }}>{c.count} sản phẩm</div>
              </div>
              <div style={{ paddingRight: 14, color: t.textSec, alignSelf: "center" }}>
                <BBI.chev s={18} />
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  // grid default — 2 columns
  return (
    <section style={{ padding: "32px 16px 8px", background: "#fff" }}>
      <SectionHeader kicker="DANH MỤC SẢN PHẨM" title="MUA SẮM THEO LOẠI" accent={accent} />
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      }}>
        {CATEGORIES.map((c) => (
          <a key={c.id} onClick={() => onOpen && onOpen(c)} style={{
            border: `1px solid ${t.borderSubtle}`,
            background: "#fff", textDecoration: "none",
            display: "block", cursor: "pointer",
            transition: "border-color 180ms, box-shadow 180ms",
          }}>
            <ProductPlaceholder tag={c.tag} h={120} tone={c.tone} />
            <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${t.borderSubtle}` }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 6,
              }}>
                <div style={{
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                  color: t.text, textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{c.label}</div>
              </div>
              <div style={{
                fontFamily: t.fontCond, fontSize: 12, color: accent,
                marginTop: 4, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 4,
                textTransform: "uppercase",
              }}>MUA NGAY <BBI.chev s={11} /></div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Featured Products (carousel) — WP-parity bb-fp-item style
// White card, 20px padding, 1px #ddd border, image 1:1, hover red border + shadow
// ─────────────────────────────────────────────────────────────
function FeaturedProducts({ accent, onAddToCart, onOpen }) {
  const t = bbTokens;
  return (
    <section style={{ padding: "32px 0 8px", background: "#fff" }}>
      <SectionHeader kicker="SẢN PHẨM NỔI BẬT" title="SẢN PHẨM NỔI BẬT TẠI BIGBIKE" accent={accent} />
      <div style={{
        display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 6px",
        scrollbarWidth: "none",
      }}>
        {FEATURED.map((p) => (
          <ProductCard key={p.id} p={p} accent={accent} width={200} onAddToCart={onAddToCart} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

// Product card — WP-parity .bb-product-card / .bb-fp-item
function ProductCard({ p, accent, width, onAddToCart, onOpen, full, compact }) {
  const t = bbTokens;
  const [liked, setLiked] = useState(false);
  const cardH = compact ? 140 : (full ? 180 : 200);
  return (
    <article
      onClick={() => onOpen && onOpen(p)}
      style={{
        flex: full ? "1 1 auto" : `0 0 ${width}px`,
        width: full ? "100%" : width,
        background: "#fff",
        border: `1px solid ${t.borderSubtle}`,
        position: "relative",
        display: "flex", flexDirection: "column",
        cursor: "pointer",
        padding: compact ? 12 : 16,
      }}
    >
      <div style={{ position: "relative", marginBottom: 12 }}>
        <ProductPlaceholder tag={p.tag} h={cardH} tone={p.tone} aspect="1/1" />
        {p.badge && (
          <div style={{
            position: "absolute", top: 0, left: 0,
            background: p.badge.startsWith("-") ? accent : (p.badge === "NEW" ? t.text : (p.badge === "HOT" ? accent : t.text)),
            color: "#fff",
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 12,
            letterSpacing: "0.02em", padding: "4px 9px",
            textTransform: "uppercase",
          }}>{p.badge}</div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          style={{
            position: "absolute", top: 6, right: 6,
            width: 32, height: 32, background: "rgba(255,255,255,0.9)",
            border: `1px solid ${t.borderSubtle}`,
            color: liked ? accent : t.textSec,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="Yêu thích"
        >
          <BBI.heart s={15} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{
          fontFamily: t.fontCond, fontSize: 11, letterSpacing: "0.08em",
          color: t.textSec, textTransform: "uppercase", fontWeight: 600,
        }}>{p.brand}</div>
        <h3 style={{
          fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 16,
          color: t.text, margin: 0, lineHeight: 1.2,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", minHeight: 38,
          textWrap: "pretty",
        }}>{p.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <StarRow value={p.rating} size={11} />
          <span style={{
            fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
          }}>({p.rating})</span>
        </div>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 6, marginTop: 4,
          flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 16,
            color: t.brandActive,
          }}>{vnd(p.price)}</span>
          {p.was && (
            <span style={{
              fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
              textDecoration: "line-through",
            }}>{vnd(p.was)}</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart && onAddToCart(p); }}
          style={{
            marginTop: 10,
            minHeight: 38, padding: "0 10px",
            background: t.text, color: "#fff",
            border: "none",
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
            letterSpacing: "0.06em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          <BBI.cart s={14} /> Thêm vào giỏ
        </button>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Hot deal — promo banner with countdown
// ─────────────────────────────────────────────────────────────
function PromoBanner({ accent }) {
  const t = bbTokens;
  return (
    <section style={{ padding: "32px 16px 8px", background: "#fff" }}>
      <div style={{
        position: "relative", overflow: "hidden",
        background: t.dark, color: "#fff",
        padding: "26px 22px 26px",
        border: `1px solid ${t.dark}`,
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: "55%",
          background: "linear-gradient(115deg, transparent 0%, rgba(255,12,9,0.32) 100%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, letterSpacing: "0.10em",
            color: accent, fontWeight: 600, marginBottom: 8, textTransform: "uppercase",
          }}>FLASH SALE</div>
          <h3 style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 28, lineHeight: 1.08,
            color: "#fff", margin: 0, textTransform: "uppercase",
          }}>GIẢM ĐẾN 40%<br/>BỘ SƯU TẬP MÙA HÈ</h3>
          <p style={{
            fontFamily: t.fontBody, fontSize: 14, color: "rgba(255,255,255,0.78)",
            margin: "10px 0 16px", textWrap: "pretty", maxWidth: 280,
          }}>Áo giáp thoáng khí, găng tay summer & helmet đua xe — số lượng có hạn.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {[
              { v: "02", l: "NGÀY" },
              { v: "14", l: "GIỜ" },
              { v: "38", l: "PHÚT" },
              { v: "12", l: "GIÂY" },
            ].map((x, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 22,
                  color: "#fff", lineHeight: 1,
                  background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.15)`,
                  padding: "6px 10px", minWidth: 38,
                }}>{x.v}</div>
                <div style={{
                  fontFamily: t.fontCond, fontSize: 10, letterSpacing: "0.10em",
                  color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: 600,
                }}>{x.l}</div>
              </div>
            ))}
          </div>
          <CTAButton accent={accent}>MUA NGAY</CTAButton>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Best Sellers — ranked list with rank badge
// ─────────────────────────────────────────────────────────────
function BestSellers({ accent, onAddToCart, onOpen }) {
  const t = bbTokens;
  const list = FEATURED.slice(0, 4);
  return (
    <section style={{ padding: "32px 16px 8px", background: "#fff" }}>
      <SectionHeader kicker="TOP TUẦN" title="BÁN CHẠY NHẤT" accent={accent} />
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((p, i) => (
          <a key={p.id} onClick={() => onOpen && onOpen(p)} style={{
            display: "flex", alignItems: "stretch", gap: 12,
            background: "#fff", border: `1px solid ${t.borderSubtle}`,
            textDecoration: "none", cursor: "pointer",
          }}>
            <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
              <ProductPlaceholder tag={p.tag} h={110} tone={p.tone} aspect="1/1" />
              <div style={{
                position: "absolute", top: 6, left: 6,
                width: 24, height: 24, background: accent,
                fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 14,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{i + 1}</div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px 10px 0", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                fontFamily: t.fontCond, fontSize: 11, letterSpacing: "0.08em",
                color: t.textSec, textTransform: "uppercase", fontWeight: 600,
              }}>{p.brand} · {p.cat}</div>
              <h3 style={{
                fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 16, color: t.text,
                lineHeight: 1.2, margin: 0,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textWrap: "pretty",
              }}>{p.name}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <StarRow value={p.rating} size={11} />
                <span style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textSec }}>(238 đã bán)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{
                    fontFamily: t.fontCond, fontWeight: 600, fontSize: 16,
                    color: t.brandActive,
                  }}>{vnd(p.price)}</span>
                  {p.was && (
                    <span style={{
                      fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                      textDecoration: "line-through",
                    }}>{vnd(p.was)}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart && onAddToCart(p); }}
                  style={{
                    width: 36, height: 36, background: t.text,
                    border: "none", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    marginRight: 10,
                  }} aria-label="Thêm vào giỏ"
                >
                  <BBI.cart s={15} />
                </button>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Trust Signals — on light-gray section
// ─────────────────────────────────────────────────────────────
function TrustSignals({ accent }) {
  const t = bbTokens;
  return (
    <section style={{
      marginTop: 32, padding: "24px 0",
      background: t.bgRaised,
      borderTop: `1px solid ${t.borderSubtle}`,
      borderBottom: `1px solid ${t.borderSubtle}`,
    }}>
      <div style={{
        display: "flex", gap: 10, overflowX: "auto", padding: "0 16px",
        scrollbarWidth: "none",
      }}>
        {TRUST.map((tr, i) => {
          const Icon = BBI[tr.icon];
          return (
            <div key={i} style={{
              flex: "0 0 150px",
              border: `1px solid ${t.borderSubtle}`,
              background: "#fff",
              padding: "16px 14px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{
                width: 40, height: 40,
                background: t.brandSoftBg,
                color: accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${t.borderBrand}`,
              }}>
                <Icon s={20} />
              </div>
              <div style={{
                fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                color: t.text, lineHeight: 1.2,
                textTransform: "uppercase", letterSpacing: "0.02em",
              }}>{tr.title}</div>
              <div style={{
                fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
                lineHeight: 1.3,
              }}>{tr.sub}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Brand Spotlight — sharp grid, no rounding
// ─────────────────────────────────────────────────────────────
function BrandSpotlight({ accent }) {
  const t = bbTokens;
  return (
    <section style={{ padding: "32px 16px 12px", background: "#fff" }}>
      <SectionHeader kicker="THƯƠNG HIỆU CHÍNH HÃNG" title="ĐỐI TÁC PHÂN PHỐI" accent={accent} link={null} />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
        border: `1px solid ${t.borderSubtle}`,
      }}>
        {BRANDS.map((b, i) => (
          <div key={i} style={{
            aspectRatio: "1 / 1",
            background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 6,
            borderRight: (i + 1) % 4 === 0 ? "none" : `1px solid ${t.borderSubtle}`,
            borderBottom: i < 4 ? `1px solid ${t.borderSubtle}` : "none",
          }}>
            <span style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 13,
              color: t.textSec, letterSpacing: "0.04em",
              textTransform: "uppercase", textAlign: "center", lineHeight: 1.05,
            }}>{b}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Blog preview (news cards)
// ─────────────────────────────────────────────────────────────
function BlogPreview({ accent, onOpenNews }) {
  const t = bbTokens;
  return (
    <section style={{ padding: "32px 0 8px", background: "#fff" }}>
      <SectionHeader kicker="KIẾN THỨC BIKER" title="CẨM NANG MUA SẮM" accent={accent} link="Xem tin tức" onClick={onOpenNews} />
      <div style={{
        display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 6px",
        scrollbarWidth: "none",
      }}>
        {BLOG.map((b) => (
          <a key={b.id} onClick={() => onOpenNews && onOpenNews(b)} style={{
            flex: "0 0 260px",
            background: "#fff",
            border: `1px solid ${t.borderSubtle}`,
            textDecoration: "none", cursor: "pointer",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ position: "relative" }}>
              <ProductPlaceholder tag={b.tag} h={150} tone={b.tone} />
              <span style={{
                position: "absolute", top: 10, left: 10,
                background: accent, color: "#fff",
                fontFamily: t.fontCond, fontWeight: 600, fontSize: 11,
                padding: "3px 8px", letterSpacing: "0.04em", textTransform: "uppercase",
              }}>{b.cat}</span>
            </div>
            <div style={{ padding: "14px 14px 16px" }}>
              <div style={{
                fontFamily: t.fontCond, fontSize: 11, letterSpacing: "0.10em",
                color: accent, fontWeight: 600, textTransform: "uppercase",
              }}>{b.kicker}</div>
              <h4 style={{
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 17,
                color: t.text, lineHeight: 1.25, margin: "8px 0 12px",
                textWrap: "pretty",
              }}>{b.title}</h4>
              <div style={{
                fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>{b.date}</span>
                <span style={{ color: t.border }}>•</span>
                <span>{b.read}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer — dark per WP parity
// Top zone #3a3a3a with big Barlow Condensed slogan + collapsibles
// Bottom zone #000 with logo + copyright
// ─────────────────────────────────────────────────────────────
function Footer({ accent }) {
  const t = bbTokens;
  const groups = [
    { id: "info",    title: "Về BigBike",        items: ["Giới thiệu", "Cửa hàng", "Tuyển dụng", "Liên hệ"] },
    { id: "support", title: "Hỗ trợ khách hàng", items: ["Hướng dẫn mua hàng", "Chính sách bảo hành", "Đổi trả & hoàn tiền", "Vận chuyển"] },
    { id: "policy",  title: "Chính sách",        items: ["Bảo mật thông tin", "Điều khoản sử dụng", "Quy định chung", "Cookies"] },
  ];
  const [open, setOpen] = useState({});

  return (
    <footer style={{
      background: "#000", color: "#fff",
      marginTop: 32,
    }}>
      {/* Top — dark grey */}
      <div style={{ background: t.footerTop, padding: "32px 18px 0" }}>
        {/* Slogan */}
        <h2 style={{
          fontFamily: t.fontCond, fontWeight: 500, fontSize: 38,
          lineHeight: 1.15, color: "#fff", margin: "0 0 24px",
          textTransform: "uppercase",
        }}>
          ĐỒ BẢO HỘ BIKER<br/>CHÍNH HÃNG<br/>SỐ 1 VIỆT NAM
        </h2>

        {/* Hotline + email */}
        <div style={{ display: "grid", gap: 12, marginBottom: 28 }}>
          {[
            { icon: "phone", v: "0901 234 567" },
            { icon: "phone", v: "0987 654 321" },
            { icon: "mail",  v: "info@bigbike.vn" },
          ].map((c, i) => {
            const Icon = BBI[c.icon];
            return (
              <a key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                color: "#fff", textDecoration: "none",
                fontFamily: t.fontCond, fontWeight: 500, fontSize: 22,
                lineHeight: 1.2,
              }}>
                <span style={{
                  width: 36, height: 36, flexShrink: 0,
                  border: `2px solid ${accent}`, color: accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Icon s={18} /></span>
                {c.v}
              </a>
            );
          })}
        </div>

        {/* Description */}
        <p style={{
          fontFamily: t.fontBody, fontSize: 14, color: "#fff",
          lineHeight: 1.65, margin: "0 0 24px", textWrap: "pretty",
        }}>BigBike Vietnam — chuyên phân phối đồ bảo hộ moto chính hãng: mũ bảo hiểm, áo giáp, găng tay, giày moto từ các thương hiệu hàng đầu thế giới như Shoei, Arai, Alpinestars, Dainese.</p>

        {/* Collapsible groups */}
        <div style={{ borderTop: `1px solid #555` }}>
          {groups.map((g) => (
            <div key={g.id} style={{ borderBottom: `1px solid #555` }}>
              <button
                onClick={() => setOpen({ ...open, [g.id]: !open[g.id] })}
                style={{
                  width: "100%", minHeight: 52, padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "transparent", border: "none", color: "#fff",
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                  letterSpacing: "0.02em", textTransform: "uppercase", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span>{g.title}</span>
                <span style={{
                  color: "#cecece",
                  transform: open[g.id] ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 180ms",
                }}><BBI.chevDown s={18} /></span>
              </button>
              {open[g.id] && (
                <div style={{ padding: "0 0 16px", display: "grid", gap: 10 }}>
                  {g.items.map((it, i) => (
                    <a key={i} style={{
                      fontFamily: t.fontBody, fontSize: 14, color: "#cecece",
                      textDecoration: "none", display: "block", padding: "4px 0",
                    }}>{it}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Social row */}
        <div style={{ padding: "20px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: t.fontCond, fontSize: 13, color: "#cecece",
            letterSpacing: "0.05em", marginRight: 4, fontWeight: 600,
            textTransform: "uppercase",
          }}>Theo dõi</span>
          {[ "fb", "ig", "yt", "tt", "zalo"].map((n) => {
            const Icon = BBI[n];
            return (
              <a key={n} style={{
                width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: `1px solid rgba(255,255,255,0.25)`,
                color: "#fff", cursor: "pointer",
              }}><Icon s={16} /></a>
            );
          })}
        </div>
      </div>

      {/* Bottom — pure black */}
      <div style={{
        background: "#000", padding: "16px 18px",
        fontFamily: t.fontBody, fontSize: 12, color: "#fff",
        lineHeight: 1.6,
        display: "flex", flexDirection: "column", gap: 6,
        borderTop: `1px solid #1a1a1a`,
      }}>
        <BigBikeMark size={18} color="#fff" dot={accent} />
        <span>© 2026 BIGBIKE VIETNAM · GPDKKD 0123456789</span>
        <span style={{ color: "#cecece" }}>Đã thông báo Bộ Công Thương</span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom tab bar — dark per MobileBottomNav.tsx
// ─────────────────────────────────────────────────────────────
function TabBar({ accent, active, onChange, cartCount }) {
  const t = bbTokens;
  const tabs = [
    { id: "home",  icon: "home",   label: "Trang chủ" },
    { id: "cat",   icon: "grid",   label: "Danh mục" },
    { id: "search",icon: "search", label: "Tìm kiếm" },
    { id: "cart",  icon: "cart",   label: "Giỏ hàng", badge: cartCount },
    { id: "user",  icon: "user",   label: "Tài khoản" },
  ];
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 30,
      background: "rgba(20,20,20,0.94)", backdropFilter: "blur(14px)",
      borderTop: `1px solid rgba(255,255,255,0.08)`,
      paddingBottom: "max(6px, env(safe-area-inset-bottom))",
    }}>
      <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 4px 4px" }}>
        {tabs.map((tab) => {
          const Icon = BBI[tab.icon];
          const isActive = tab.id === active;
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)} style={{
              minWidth: 56, minHeight: 56,
              background: "transparent", border: "none",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 4, cursor: "pointer", padding: "4px 2px",
              color: isActive ? accent : "#cecece", position: "relative",
            }}>
              <div style={{ position: "relative" }}>
                <Icon s={22} />
                {tab.badge > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -8,
                    minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 8, background: accent, color: "#fff",
                    fontFamily: t.fontBody, fontWeight: 700, fontSize: 9, lineHeight: "16px",
                    textAlign: "center", border: `2px solid #141414`,
                  }}>{tab.badge}</span>
                )}
              </div>
              <span style={{
                fontFamily: t.fontBody, fontSize: 10, fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
              }}>{tab.label}</span>
              {isActive && (
                <span style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 24, height: 2, background: accent,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  CATEGORIES, FEATURED, BRANDS, TRUST, BLOG, HERO_SLIDES,
  Header, HeroSlider, Categories, FeaturedProducts, ProductCard,
  PromoBanner, BestSellers, TrustSignals, BrandSpotlight, BlogPreview,
  Footer, TabBar, SectionHeader, CTAButton, iconBtn,
});
