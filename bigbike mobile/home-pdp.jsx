// home-pdp.jsx — Product Detail Page (LIGHT theme per WP-parity).
// White page, black text, dark sticky bottom bar with brand-red CTA.

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

// ─────────────────────────────────────────────────────────────
// Mock PDP data
// ─────────────────────────────────────────────────────────────
const PDP_DETAIL = {
  shots: [
    { tone: "light",  tag: "FRONT 3/4" },
    { tone: "warm",   tag: "SIDE PROFILE" },
    { tone: "chrome", tag: "REAR DETAIL" },
    { tone: "light2", tag: "INTERIOR" },
    { tone: "warm",   tag: "LIFESTYLE" },
  ],
  colors: [
    { id: "matte",  label: "Matte Black",     swatch: "#1a1a1a", border: "#2a2a2a" },
    { id: "carbon", label: "Carbon Raw",      swatch: "#3a3a3a", border: "#5a5a5a" },
    { id: "mm93",   label: "MM93 Replica",    swatch: "#ff0c09", border: "#cc0906", popular: true },
    { id: "white",  label: "Diamond White",   swatch: "#ffffff", border: "#cecece" },
  ],
  sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  sizesAvail: { XS: false, S: true, M: true, L: true, XL: true, XXL: false },
  features: [
    { icon: "shield",  title: "FIM Homologation",   sub: "Đạt chuẩn đua chuyên nghiệp FIM Racing #FRHPhe-02" },
    { icon: "spark",   title: "AIM+ Multi-Composite",sub: "Vỏ sợi hữu cơ + carbon — siêu nhẹ, hấp thụ xung lực vượt trội" },
    { icon: "rotate",  title: "EQRS Emergency Release", sub: "Tháo má phụ khẩn cấp khi gặp tai nạn" },
    { icon: "headset", title: "Pinlock EVO Ready",  sub: "Kính chống đọng sương + tab khoá kính khẩn cấp" },
  ],
  specs: [
    ["Trọng lượng",   "1.420g (± 50g)"],
    ["Chuẩn an toàn", "DOT · ECE 22.06 · FIM"],
    ["Vật liệu vỏ",   "AIM+ Multi-Composite Fiber"],
    ["Lớp lót",       "Removable, washable, 3D"],
    ["Hệ thống quạt", "Top vent + Chin vent (6 đường khí)"],
    ["Bảo hành",      "5 năm chính hãng"],
    ["Xuất xứ",       "Nhật Bản"],
  ],
  reviews: [
    { name: "Minh Tuấn", date: "12/05/2026", rating: 5, body: "Đội rất nhẹ, gió lùa ít so với X-Fourteen. Form ôm head Asian Fit chuẩn. Đáng tiền." },
    { name: "Quốc Anh",  date: "03/05/2026", rating: 5, body: "Màu MM93 đẹp xuất sắc, sơn matte không đùa được. Shop tư vấn size rất kỹ." },
    { name: "Hà Linh",   date: "28/04/2026", rating: 4, body: "Cách âm ổn, nhưng cần thêm pad má size XS cho mặt nhỏ. Nhìn chung rất ưng." },
  ],
};

// ─────────────────────────────────────────────────────────────
// PDP component (light)
// ─────────────────────────────────────────────────────────────
function ProductDetail({ product, onClose, onAddToCart, accent }) {
  const t = bbTokens;
  const p = product || FEATURED[0];

  const [shotIdx, setShotIdx] = useStateP(0);
  const [colorId, setColorId] = useStateP("mm93");
  const [size, setSize] = useStateP("M");
  const [qty, setQty] = useStateP(1);
  const [liked, setLiked] = useStateP(false);
  const [scrolled, setScrolled] = useStateP(false);
  const [tab, setTab] = useStateP("desc");
  const [openSpec, setOpenSpec] = useStateP(false);
  const galleryRef = useRefP(null);

  const onGalleryScroll = (e) => {
    const w = e.target.clientWidth;
    const idx = Math.round(e.target.scrollLeft / w);
    if (idx !== shotIdx) setShotIdx(idx);
  };

  const handleAdd = () => onAddToCart({ ...p, color: colorId, size, qty });
  const stock = 7;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 80,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      {/* Sticky dark header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        height: 54,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6px",
        background: scrolled ? t.dark : "rgba(0,0,0,0.4)",
        backdropFilter: scrolled ? "none" : "blur(8px)",
        transition: "background 200ms",
      }}>
        <button onClick={onClose} style={iconBtn("#fff")} aria-label="Quay lại">
          <BBI.chevL s={22} />
        </button>
        {scrolled && (
          <div style={{
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
            color: "#fff", letterSpacing: "0.02em", textTransform: "uppercase",
            flex: 1, textAlign: "center", padding: "0 8px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{p.brand}</div>
        )}
        <div style={{ display: "flex", gap: 0 }}>
          <button onClick={() => setLiked(!liked)} style={{
            ...iconBtn("#fff"),
            color: liked ? accent : "#fff",
          }} aria-label="Yêu thích">
            <BBI.heart s={20} fill={liked ? "currentColor" : "none"} />
          </button>
          <button style={iconBtn("#fff")} aria-label="Chia sẻ">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" />
              <path d="M8 11l8-4M8 13l8 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scroll body */}
      <div
        onScroll={(e) => setScrolled(e.target.scrollTop > 100)}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 88,
          overflowY: "auto", overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: "#fff",
        }}
      >
        {/* Gallery on light-gray background */}
        <div style={{ position: "relative", background: t.bgRaised }}>
          <div
            ref={galleryRef}
            onScroll={onGalleryScroll}
            style={{
              display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
            }}
          >
            {PDP_DETAIL.shots.map((s, i) => (
              <div key={i} style={{
                flex: "0 0 100%", scrollSnapAlign: "start",
                position: "relative", aspectRatio: "1 / 1",
              }}>
                <div style={{ position: "absolute", inset: 0 }}>
                  <ProductPlaceholder tag={s.tag + " · " + p.tag} h={"100%"} tone={s.tone} aspect="1/1" />
                </div>
              </div>
            ))}
          </div>
          {p.badge && (
            <div style={{
              position: "absolute", top: 64, left: 14,
              background: p.badge.startsWith("-") ? accent : (p.badge === "NEW" ? t.text : accent),
              color: "#fff",
              fontFamily: t.fontCond, fontWeight: 700, fontSize: 13,
              letterSpacing: "0.04em", padding: "5px 12px",
              textTransform: "uppercase",
            }}>{p.badge}</div>
          )}
          <div style={{
            position: "absolute", bottom: 12, left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: 6,
          }}>
            {PDP_DETAIL.shots.map((_, i) => (
              <button key={i} onClick={() => {
                if (galleryRef.current) {
                  galleryRef.current.scrollTo({ left: i * galleryRef.current.clientWidth, behavior: "smooth" });
                }
              }} style={{
                width: i === shotIdx ? 22 : 6, height: 6,
                background: i === shotIdx ? t.text : "rgba(0,0,0,0.25)",
                border: "none", padding: 0, cursor: "pointer",
                transition: "width 200ms, background 200ms",
              }} aria-label={`Ảnh ${i+1}`} />
            ))}
          </div>
          <div style={{
            position: "absolute", bottom: 24, right: 12,
            background: "rgba(0,0,0,0.55)", padding: "3px 8px",
            fontFamily: t.fontMono, fontSize: 10, color: "#fff", letterSpacing: "0.10em",
          }}>{shotIdx + 1} / {PDP_DETAIL.shots.length}</div>
        </div>

        {/* Breadcrumb */}
        <div style={{
          padding: "10px 16px 0",
          fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
        }}>
          <span style={{ color: t.blue }}>Trang chủ</span>
          <BBI.chev s={11} />
          <span style={{ color: t.blue }}>Sản phẩm</span>
          <BBI.chev s={11} />
          <span style={{ color: t.blue }}>{p.cat || "Gear"}</span>
          <BBI.chev s={11} />
          <span style={{ color: t.text }}>{p.brand}</span>
        </div>

        {/* Header info */}
        <div style={{ padding: "12px 16px 16px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8, gap: 10,
          }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, letterSpacing: "0.10em",
              color: accent, fontWeight: 600, textTransform: "uppercase",
            }}>{p.brand} · {p.cat?.toUpperCase() || "GEAR"}</div>
            <div style={{
              fontFamily: t.fontMono, fontSize: 10, color: t.textSec,
              letterSpacing: "0.05em",
            }}>SKU: {p.id.toUpperCase()}-{colorId.toUpperCase()}</div>
          </div>
          <h1 style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 26,
            color: t.text, margin: "0 0 10px", lineHeight: 1.15,
            textTransform: "uppercase",
            textWrap: "balance",
          }}>{p.name}</h1>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            fontFamily: t.fontBody, fontSize: 13, color: t.textSec,
            flexWrap: "wrap",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <StarRow value={p.rating} size={13} />
              <span style={{ color: t.text, marginLeft: 4, fontWeight: 600 }}>{p.rating}</span>
            </span>
            <span style={{ color: t.border }}>|</span>
            <span>238 đánh giá</span>
            <span style={{ color: t.border }}>|</span>
            <span>1.4K đã bán</span>
          </div>
        </div>

        {/* Price block (light red soft bg) */}
        <div style={{
          padding: "16px",
          margin: "0 16px 4px",
          background: t.brandSoftBg,
          border: `1px solid ${t.borderBrand}`,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
          }}>
            <span style={{
              fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 32,
              color: t.brandActive, lineHeight: 1,
            }}>{vnd(p.price)}</span>
            {p.was && (
              <>
                <span style={{
                  fontFamily: t.fontBody, fontSize: 14, color: t.textSec,
                  textDecoration: "line-through",
                }}>{vnd(p.was)}</span>
                <span style={{
                  fontFamily: t.fontCond, fontWeight: 700, fontSize: 12,
                  background: accent, color: "#fff",
                  padding: "3px 8px", letterSpacing: "0.04em",
                }}>TIẾT KIỆM {vnd(p.was - p.price)}</span>
              </>
            )}
          </div>
          <div style={{
            fontFamily: t.fontBody, fontSize: 13, color: t.textSec, marginTop: 8,
          }}>
            Trả góp 0% qua thẻ — chỉ từ <span style={{ color: t.text, fontWeight: 600 }}>{vnd(Math.round(p.price / 12))}/tháng</span>
          </div>
        </div>

        {/* Color picker */}
        <div style={{ padding: "22px 16px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.text,
              letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
            }}>MÀU SẮC: <span style={{ color: t.textSec, fontWeight: 500 }}>{PDP_DETAIL.colors.find((c) => c.id === colorId)?.label}</span></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {PDP_DETAIL.colors.map((c) => (
              <button key={c.id} onClick={() => setColorId(c.id)} style={{
                width: 56, height: 56,
                background: "#fff",
                border: c.id === colorId ? `2px solid ${accent}` : `1px solid ${t.border}`,
                padding: 4, cursor: "pointer", position: "relative",
              }} aria-label={c.label}>
                <div style={{
                  width: "100%", height: "100%",
                  background: c.swatch,
                  border: `1px solid ${c.border}`,
                }} />
                {c.popular && (
                  <div style={{
                    position: "absolute", top: -7, right: -7,
                    background: accent, color: "#fff",
                    fontFamily: t.fontCond, fontSize: 9, fontWeight: 700,
                    padding: "2px 5px", letterSpacing: "0.04em",
                  }}>HOT</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Size picker */}
        <div style={{ padding: "22px 16px 0" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.text,
              letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
            }}>SIZE: <span style={{ color: accent, fontWeight: 700 }}>{size}</span></div>
            <a style={{
              fontFamily: t.fontBody, fontSize: 13, color: t.blue,
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>Hướng dẫn chọn size <BBI.chev s={11} /></a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {PDP_DETAIL.sizes.map((sz) => {
              const avail = PDP_DETAIL.sizesAvail[sz];
              const active = sz === size;
              return (
                <button key={sz} onClick={() => avail && setSize(sz)}
                  disabled={!avail}
                  style={{
                    height: 46,
                    background: active ? t.text : "#fff",
                    color: active ? "#fff" : (avail ? t.text : t.textMute),
                    border: active
                      ? `1px solid ${t.text}`
                      : `1px solid ${avail ? t.border : t.borderSubtle}`,
                    fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                    letterSpacing: "0.04em",
                    cursor: avail ? "pointer" : "not-allowed",
                    opacity: avail ? 1 : 0.5,
                    textDecoration: avail ? "none" : "line-through",
                  }}
                >{sz}</button>
              );
            })}
          </div>
        </div>

        {/* Stock + qty */}
        <div style={{
          padding: "22px 16px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            background: t.okBg,
            border: `1px solid ${t.okBorder}`,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: t.ok,
            }} />
            <span style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.ok,
              letterSpacing: "0.04em", fontWeight: 600, textTransform: "uppercase",
            }}>Còn {stock} sản phẩm</span>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center",
            border: `1px solid ${t.border}`,
            background: "#fff",
          }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn(t.text)}>−</button>
            <span style={{
              minWidth: 30, textAlign: "center",
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 16, color: t.text,
            }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(stock, q + 1))} style={qtyBtn(t.text)}>+</button>
          </div>
        </div>

        {/* Features */}
        <div style={{ padding: "32px 0 0" }}>
          <SectionHeader kicker="ĐIỂM NỔI BẬT" title="CÔNG NGHỆ & AN TOÀN" accent={accent} link={null} />
          <div style={{ display: "grid", gap: 10, padding: "0 16px" }}>
            {PDP_DETAIL.features.map((f, i) => {
              const Icon = BBI[f.icon];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  background: "#fff", border: `1px solid ${t.borderSubtle}`,
                  padding: "14px",
                }}>
                  <div style={{
                    width: 42, height: 42, flexShrink: 0,
                    background: t.brandSoftBg, color: accent,
                    border: `1px solid ${t.borderBrand}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Icon s={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                      color: t.text, textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}>{f.title}</div>
                    <div style={{
                      fontFamily: t.fontBody, fontSize: 13, color: t.textSec,
                      lineHeight: 1.5, marginTop: 3, textWrap: "pretty",
                    }}>{f.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabbed info */}
        <div style={{ padding: "32px 0 0" }}>
          <div style={{
            display: "flex", padding: "0 16px",
            borderBottom: `1px solid ${t.borderSubtle}`,
            gap: 4,
          }}>
            {[
              { id: "desc",    label: "Mô tả" },
              { id: "specs",   label: "Thông số" },
              { id: "reviews", label: "Đánh giá" },
            ].map((tabItem) => {
              const active = tab === tabItem.id;
              return (
                <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{
                  padding: "12px 14px",
                  background: "transparent", border: "none",
                  color: active ? t.text : t.textSec,
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                  cursor: "pointer", position: "relative",
                }}>
                  {tabItem.label}
                  {active && (
                    <span style={{
                      position: "absolute", bottom: -1, left: 14, right: 14,
                      height: 2, background: accent,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ padding: "16px 16px 0" }}>
            {tab === "desc" && (
              <div style={{
                fontFamily: t.fontBody, fontSize: 14, color: t.text,
                lineHeight: 1.65, textWrap: "pretty",
              }}>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ fontWeight: 700 }}>{p.name}</strong> — phiên bản flagship dành cho riders chuyên nghiệp. Được phát triển cùng đội đua MotoGP, sản phẩm kế thừa toàn bộ công nghệ vỏ AIM+ Multi-Composite Fiber với khả năng hấp thụ xung lực vượt chuẩn FIM.
                </p>
                <p style={{ margin: "0 0 12px", color: t.textSec }}>
                  Thiết kế khí động học mới giảm 5% lực cản gió và 30% nhiễu âm ở tốc độ cao. Lớp lót CWR-F2 với pinlock EVO chống mờ và 5 vị trí khoá kính, cho phép đóng/mở chỉ bằng một tay khi đang chạy.
                </p>
                <p style={{ margin: 0, color: t.textSec }}>
                  Phù hợp với rider track-day, sportbike và các tour đường dài cần helmet cao cấp nhất.
                </p>
              </div>
            )}
            {tab === "specs" && (
              <div style={{
                border: `1px solid ${t.borderSubtle}`,
                background: "#fff",
              }}>
                {PDP_DETAIL.specs.map(([k, v], i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "118px 1fr",
                    padding: "12px 14px",
                    background: i % 2 ? t.bgAlt : "#fff",
                    borderBottom: i < PDP_DETAIL.specs.length - 1 ? `1px solid ${t.borderSubtle}` : "none",
                    gap: 12,
                  }}>
                    <div style={{
                      fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
                      letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
                      paddingTop: 1,
                    }}>{k}</div>
                    <div style={{
                      fontFamily: t.fontBody, fontSize: 14, color: t.text,
                      lineHeight: 1.4,
                    }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {tab === "reviews" && (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 18,
                  padding: "16px 14px",
                  background: t.bgRaised,
                  border: `1px solid ${t.borderSubtle}`,
                  marginBottom: 12,
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 40,
                      color: t.text, lineHeight: 1,
                    }}>{p.rating}</div>
                    <div style={{ marginTop: 4 }}>
                      <StarRow value={p.rating} size={12} />
                    </div>
                    <div style={{
                      fontFamily: t.fontCond, fontSize: 11, color: t.textSec,
                      letterSpacing: "0.06em", marginTop: 4, fontWeight: 600,
                    }}>238 ĐÁNH GIÁ</div>
                  </div>
                  <div style={{ flex: 1, display: "grid", gap: 5 }}>
                    {[5,4,3,2,1].map((n) => {
                      const pct = { 5: 78, 4: 16, 3: 4, 2: 1, 1: 1 }[n];
                      return (
                        <div key={n} style={{
                          display: "grid", gridTemplateColumns: "12px 1fr 32px", gap: 8,
                          alignItems: "center",
                        }}>
                          <span style={{
                            fontFamily: t.fontBody, fontSize: 11, color: t.textSec, fontWeight: 600,
                          }}>{n}</span>
                          <div style={{ height: 5, background: "#fff", border: `1px solid ${t.borderSubtle}`, position: "relative" }}>
                            <div style={{
                              position: "absolute", inset: 0, right: "auto",
                              width: `${pct}%`, background: accent,
                            }} />
                          </div>
                          <span style={{
                            fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                            textAlign: "right",
                          }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {PDP_DETAIL.reviews.map((r, i) => (
                    <div key={i} style={{
                      background: "#fff",
                      border: `1px solid ${t.borderSubtle}`,
                      padding: "12px 14px",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: t.bgRaised,
                            border: `1px solid ${t.borderSubtle}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14,
                            color: t.text,
                          }}>{r.name.charAt(0)}</div>
                          <div>
                            <div style={{
                              fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                              color: t.text,
                            }}>{r.name}</div>
                            <div style={{
                              fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                              marginTop: 1,
                            }}>{r.date} · Đã mua hàng</div>
                          </div>
                        </div>
                        <StarRow value={r.rating} size={12} />
                      </div>
                      <p style={{
                        fontFamily: t.fontBody, fontSize: 14, color: t.text,
                        lineHeight: 1.55, margin: "10px 0 0",
                        textWrap: "pretty",
                      }}>{r.body}</p>
                    </div>
                  ))}
                </div>
                <button style={{
                  width: "100%", minHeight: 46, marginTop: 12,
                  background: "transparent", color: accent,
                  border: `2px solid ${accent}`,
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  cursor: "pointer",
                }}>Xem tất cả 238 đánh giá</button>
              </div>
            )}
          </div>
        </div>

        {/* Trust mini */}
        <div style={{ padding: "28px 16px 0" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            {[
              { icon: "shield",  ti: "Chính hãng",        s: "Tem hologram" },
              { icon: "rotate",  ti: "Đổi trả 7 ngày",    s: "Miễn phí ship" },
              { icon: "truck",   ti: "Giao nội thành 2h", s: "HCM & Hà Nội" },
              { icon: "headset", ti: "Tư vấn size",       s: "Hotline 24/7" },
            ].map((tr, i) => {
              const Icon = BBI[tr.icon];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px",
                  background: "#fff", border: `1px solid ${t.borderSubtle}`,
                }}>
                  <div style={{
                    width: 32, height: 32, color: accent, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Icon s={22} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
                      color: t.text, lineHeight: 1.2,
                      textTransform: "uppercase", letterSpacing: "0.02em",
                    }}>{tr.ti}</div>
                    <div style={{
                      fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                      marginTop: 2,
                    }}>{tr.s}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Related products */}
        <div style={{ padding: "32px 0 0", background: "#fff" }}>
          <SectionHeader kicker="GỢI Ý CHO BẠN" title="SẢN PHẨM TƯƠNG TỰ" accent={accent} link="Xem thêm" />
          <div style={{
            display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 6px",
            scrollbarWidth: "none",
          }}>
            {FEATURED.filter((x) => x.id !== p.id).slice(0, 5).map((rp) => (
              <ProductCard key={rp.id} p={rp} accent={accent} width={180}
                onAddToCart={onAddToCart} onOpen={(np) => { /* nav to new pdp would go here */ }} />
            ))}
          </div>
        </div>

        <div style={{ height: 32 }} />
      </div>

      {/* Sticky bottom CTA — DARK */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 5,
        background: t.dark, color: "#fff",
        padding: "10px 10px",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button style={{
          width: 50, height: 50, flexShrink: 0,
          background: "rgba(255,255,255,0.06)", color: "#fff",
          border: `1px solid rgba(255,255,255,0.20)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }} aria-label="Chat">
          <BBI.chat s={20} />
        </button>
        <button onClick={handleAdd} style={{
          flex: 1, height: 50,
          background: "transparent", color: "#fff",
          border: `1px solid ${accent}`,
          fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
          letterSpacing: "0.06em", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          <BBI.cart s={15} /> Vào giỏ
        </button>
        <button onClick={handleAdd} style={{
          flex: 1.1, height: 50,
          background: accent, color: "#fff",
          border: `1px solid ${accent}`,
          fontFamily: t.fontCond, fontWeight: 700, fontSize: 14,
          letterSpacing: "0.06em", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          MUA NGAY <BBI.bolt s={14} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  ProductDetail, PDP_DETAIL,
});
