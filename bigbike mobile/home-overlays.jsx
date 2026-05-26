// home-overlays.jsx — Menu drawer, Search overlay, Cart bottom-sheet, Toast.
// Per styleguide: drawers / overlays / toasts use dark surfaces (#141414).
// Cart bottom sheet is dark; tap-throughs to product cards go light.

const { useState: useStateO, useEffect: useEffectO, useRef: useRefO } = React;

// ─────────────────────────────────────────────────────────────
// Menu drawer — dark, slides from left
// ─────────────────────────────────────────────────────────────
function MenuDrawer({ open, onClose, accent, onCategory, onAccount }) {
  const t = bbTokens;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: open ? "rgba(0,0,0,0.55)" : "transparent",
          pointerEvents: open ? "auto" : "none",
          transition: "background 220ms",
        }}
      />
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 51,
        width: "86%", maxWidth: 340,
        background: t.dark, color: t.textInv,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        display: "flex", flexDirection: "column",
        boxShadow: open ? "0 0 40px rgba(0,0,0,0.5)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 14px",
          background: t.dark2,
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <BigBikeMark size={20} color="#fff" dot={accent} />
          <button onClick={onClose} style={iconBtn("#fff")} aria-label="Đóng">
            <BBI.close s={22} />
          </button>
        </div>

        {/* Account row */}
        <a onClick={() => { onAccount && onAccount(); onClose(); }} style={{
          padding: "16px 14px",
          display: "flex", alignItems: "center", gap: 12,
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          textDecoration: "none", color: "#fff", cursor: "pointer",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid rgba(255,255,255,0.15)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><BBI.user s={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
              color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em",
            }}>Đăng nhập / Đăng ký</div>
            <div style={{
              fontFamily: t.fontBody, fontSize: 12, color: "#cecece", marginTop: 2,
            }}>Thành viên BigBike — ưu đãi riêng</div>
          </div>
          <BBI.chev s={16} />
        </a>

        {/* Category list — WP-parity .bb-cat-list-item */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            padding: "16px 14px 6px",
            fontFamily: t.fontCond, fontSize: 12, color: "#abb8c3",
            letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600,
          }}>DANH MỤC SẢN PHẨM</div>
          {CATEGORIES.map((c) => (
            <a key={c.id}
               onClick={() => { onCategory && onCategory(c); onClose(); }}
               style={{
              display: "flex", alignItems: "center", gap: 14, minHeight: 56,
              padding: "0 14px",
              borderBottom: `1px solid rgba(255,255,255,0.08)`,
              textDecoration: "none", color: "#fff", cursor: "pointer",
            }}>
              <div style={{
                width: 44, height: 44, background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.10)`, overflow: "hidden",
                flexShrink: 0,
              }}>
                <ProductPlaceholder tag="" h={44} tone="dark" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: t.fontCond, fontWeight: 500, fontSize: 15,
                  letterSpacing: "0.02em",
                }}>{c.label}</div>
                <div style={{
                  fontFamily: t.fontBody, fontSize: 12, color: "#abb8c3", marginTop: 1,
                }}>{c.count} sản phẩm</div>
              </div>
              <BBI.chev s={14} />
            </a>
          ))}

          <div style={{
            padding: "20px 14px 6px",
            fontFamily: t.fontCond, fontSize: 12, color: "#abb8c3",
            letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600,
          }}>HỖ TRỢ KHÁCH HÀNG</div>
          {[
            { label: "Tra cứu đơn hàng", icon: "package" },
            { label: "Hướng dẫn chọn size", icon: "headset" },
            { label: "Cửa hàng gần bạn", icon: "pin" },
            { label: "Bảo hành & đổi trả", icon: "shield" },
          ].map((row, i) => {
            const Icon = BBI[row.icon];
            return (
              <a key={i} style={{
                display: "flex", alignItems: "center", gap: 14, minHeight: 50, padding: "0 14px",
                borderBottom: `1px solid rgba(255,255,255,0.08)`,
                fontFamily: t.fontBody, fontSize: 14, color: "#fff",
                textDecoration: "none",
              }}>
                <Icon s={18} />
                <span style={{ flex: 1 }}>{row.label}</span>
                <BBI.chev s={14} />
              </a>
            );
          })}
        </div>

        {/* Hotline */}
        <a style={{
          padding: "14px",
          background: t.dark2,
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none", color: "#fff",
        }}>
          <span style={{
            width: 36, height: 36, border: `2px solid ${accent}`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><BBI.phone s={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 11, color: "#abb8c3",
              letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
            }}>HOTLINE 24/7</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18,
              color: "#fff", letterSpacing: "0.04em",
            }}>1900.6789</div>
          </div>
        </a>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Search overlay — light page (search is a page)
// ─────────────────────────────────────────────────────────────
function SearchOverlay({ open, onClose, accent, onProduct, onCategory }) {
  const t = bbTokens;
  const [q, setQ] = useStateO("");
  useEffectO(() => { if (!open) setQ(""); }, [open]);
  const inputRef = useRefO(null);
  useEffectO(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current.focus(), 100);
  }, [open]);
  if (!open) return null;

  const recent = ["shoei x-fifteen", "alpinestars gp", "găng tay carbon", "áo touring chống nước"];
  const trending = ["Marquez 7", "Helmet đua", "Touring chống nước", "Giày off-road", "Găng tay summer"];

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: "#fff", display: "flex", flexDirection: "column",
    }}>
      {/* Dark input row */}
      <div style={{
        padding: "10px 8px",
        background: t.dark, color: "#fff",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <button onClick={onClose} style={iconBtn("#fff")} aria-label="Đóng">
          <BBI.close s={22} />
        </button>
        <div style={{
          flex: 1, height: 44, background: "#fff", color: t.text,
          border: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        }}>
          <BBI.search s={18} />
          <input
            ref={inputRef}
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mũ, áo giáp, găng tay..."
            style={{
              flex: 1, height: "100%", border: "none", outline: "none",
              background: "transparent", color: t.text,
              fontFamily: t.fontBody, fontSize: 15,
            }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{
              background: "transparent", border: "none", color: t.textSec,
              cursor: "pointer", display: "flex", padding: 4,
            }}><BBI.close s={16} /></button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px", background: "#fff" }}>
        {q.length === 0 ? (
          <>
            <SearchSection title="TÌM KIẾM GẦN ĐÂY">
              {recent.map((r, i) => (
                <a key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                  borderBottom: `1px solid ${t.borderSubtle}`,
                  fontFamily: t.fontBody, fontSize: 14, color: t.text,
                  textDecoration: "none",
                }}>
                  <span style={{ color: t.textSec }}><BBI.search s={16} /></span>
                  <span style={{ flex: 1 }}>{r}</span>
                  <span style={{ color: t.textSec, transform: "rotate(-45deg)" }}><BBI.arrow s={14} /></span>
                </a>
              ))}
            </SearchSection>

            <SearchSection title="XU HƯỚNG TÌM KIẾM">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {trending.map((tr, i) => (
                  <a key={i} style={{
                    padding: "8px 14px",
                    border: `1px solid ${t.border}`,
                    background: "#fff",
                    fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
                    color: t.text, textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    letterSpacing: "0.02em", textTransform: "uppercase",
                  }}>
                    <span style={{ color: accent }}><BBI.bolt s={12} /></span>
                    {tr}
                  </a>
                ))}
              </div>
            </SearchSection>

            <SearchSection title="DANH MỤC PHỔ BIẾN">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CATEGORIES.slice(0, 4).map((c) => (
                  <a key={c.id} onClick={() => { onCategory && onCategory(c); onClose(); }} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${t.borderSubtle}`,
                    background: "#fff", cursor: "pointer",
                    textDecoration: "none",
                  }}>
                    <div style={{ width: 44, height: 44, flexShrink: 0 }}>
                      <ProductPlaceholder tag="" h={44} tone={c.tone} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                        color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
                      }}>{c.label}</div>
                      <div style={{
                        fontFamily: t.fontBody, fontSize: 11, color: t.textSec, marginTop: 1,
                      }}>{c.count} sản phẩm</div>
                    </div>
                  </a>
                ))}
              </div>
            </SearchSection>
          </>
        ) : (
          <SearchResults q={q} accent={accent} onProduct={(p) => { onProduct && onProduct(p); onClose(); }} />
        )}
      </div>
    </div>
  );
}

function SearchSection({ title, children }) {
  const t = bbTokens;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
        letterSpacing: "0.10em", fontWeight: 600, marginBottom: 10,
        textTransform: "uppercase",
      }}>{title}</div>
      {children}
    </div>
  );
}

function SearchResults({ q, accent, onProduct }) {
  const t = bbTokens;
  const matches = FEATURED.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.brand.toLowerCase().includes(q.toLowerCase()) ||
    p.cat.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div>
      <div style={{
        fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
        letterSpacing: "0.05em", marginBottom: 12, fontWeight: 600, textTransform: "uppercase",
      }}>{matches.length} KẾT QUẢ CHO "{q}"</div>
      {matches.length === 0 ? (
        <div style={{
          padding: "40px 0", textAlign: "center",
          color: t.textSec, fontFamily: t.fontBody, fontSize: 14,
        }}>Không tìm thấy sản phẩm phù hợp. Thử từ khoá khác?</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {matches.map((p) => (
            <a key={p.id} onClick={() => onProduct(p)} style={{
              display: "flex", gap: 12,
              background: "#fff", border: `1px solid ${t.borderSubtle}`,
              textDecoration: "none", cursor: "pointer",
            }}>
              <div style={{ width: 88, flexShrink: 0 }}>
                <ProductPlaceholder tag={p.tag} h={88} tone={p.tone} aspect="1/1" />
              </div>
              <div style={{ flex: 1, padding: "10px 10px 10px 0" }}>
                <div style={{
                  fontFamily: t.fontCond, fontSize: 11, color: t.textSec,
                  letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                }}>{p.brand}</div>
                <div style={{
                  fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 15,
                  color: t.text, lineHeight: 1.25, marginTop: 2,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>{p.name}</div>
                <div style={{
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                  color: t.brandActive, marginTop: 4,
                }}>{vnd(p.price)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cart bottom sheet — dark surface (drawer)
// ─────────────────────────────────────────────────────────────
function CartSheet({ open, onClose, accent, items, onRemove, onQty, onGoToCartPage }) {
  const t = bbTokens;
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: open ? "rgba(0,0,0,0.55)" : "transparent",
        pointerEvents: open ? "auto" : "none",
        transition: "background 200ms",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 51,
        background: t.dark, color: "#fff",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        maxHeight: "85%",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "8px 0 0", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 36, height: 4, background: "rgba(255,255,255,0.25)" }} />
        </div>
        <div style={{
          padding: "12px 16px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
        }}>
          <div>
            <div style={{
              fontFamily: t.fontCond, fontSize: 12, color: "#abb8c3",
              letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
            }}>GIỎ HÀNG</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
              color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em",
            }}>{items.length} sản phẩm</div>
          </div>
          <button onClick={onClose} style={iconBtn("#fff")} aria-label="Đóng">
            <BBI.close s={22} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
          {items.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.10)`,
                color: "#abb8c3",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}><BBI.cart s={28} /></div>
              <div style={{
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18,
                color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em",
              }}>Giỏ hàng trống</div>
              <div style={{
                fontFamily: t.fontBody, fontSize: 13, color: "#abb8c3",
                marginTop: 6,
              }}>Thêm sản phẩm để bắt đầu mua sắm</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((it) => (
                <div key={it.id} style={{
                  display: "flex", gap: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(255,255,255,0.08)`,
                  padding: 10,
                }}>
                  <div style={{ width: 72, height: 72, flexShrink: 0 }}>
                    <ProductPlaceholder tag={it.tag} h={72} tone="dark" aspect="1/1" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: t.fontCond, fontSize: 11, color: "#abb8c3",
                      letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
                    }}>{it.brand}</div>
                    <div style={{
                      fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 14,
                      color: "#fff", lineHeight: 1.25, marginTop: 2,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>{it.name}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center",
                        border: `1px solid rgba(255,255,255,0.20)`,
                      }}>
                        <button onClick={() => onQty(it.id, -1)} style={qtyBtn("#fff")}>−</button>
                        <span style={{
                          minWidth: 28, textAlign: "center",
                          fontFamily: t.fontBody, fontSize: 14, color: "#fff",
                        }}>{it.qty}</span>
                        <button onClick={() => onQty(it.id, +1)} style={qtyBtn("#fff")}>+</button>
                      </div>
                      <div style={{
                        fontFamily: t.fontCond, fontWeight: 600, fontSize: 15,
                        color: accent,
                      }}>{vnd(it.price * it.qty)}</div>
                    </div>
                  </div>
                  <button onClick={() => onRemove(it.id)} style={{
                    width: 28, height: 28, background: "transparent",
                    border: "none", color: "#abb8c3", cursor: "pointer",
                    alignSelf: "flex-start",
                  }} aria-label="Xoá"><BBI.close s={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 14px",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          background: t.dark2,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <span style={{
              fontFamily: t.fontCond, fontSize: 12, color: "#abb8c3",
              letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
            }}>TỔNG TẠM TÍNH</span>
            <span style={{
              fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 24,
              color: "#fff", letterSpacing: "0.005em",
            }}>{vnd(total)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onGoToCartPage && onGoToCartPage(); onClose(); }} disabled={items.length === 0} style={{
              flex: 1, minHeight: 48,
              background: "transparent", color: "#fff",
              border: `1px solid rgba(255,255,255,0.30)`,
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
              letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              opacity: items.length === 0 ? 0.4 : 1,
            }}>Xem giỏ hàng</button>
            <button disabled={items.length === 0} style={{
              flex: 1.3, minHeight: 48,
              background: items.length === 0 ? "#444" : accent,
              color: items.length === 0 ? "#888" : "#fff",
              border: "none",
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
              letterSpacing: "0.08em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              cursor: items.length === 0 ? "not-allowed" : "pointer",
            }}>
              Thanh toán <BBI.arrow s={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function qtyBtn(color) {
  return {
    width: 30, height: 30, background: "transparent",
    border: "none", color, cursor: "pointer",
    fontFamily: bbTokens.fontDisplay, fontSize: 16, fontWeight: 500,
  };
}

// ─────────────────────────────────────────────────────────────
// Toast — dark surface
// ─────────────────────────────────────────────────────────────
function Toast({ message, accent }) {
  const t = bbTokens;
  if (!message) return null;
  return (
    <div style={{
      position: "absolute", left: "50%", transform: "translateX(-50%)",
      bottom: 92, zIndex: 70,
      background: t.dark, color: "#fff",
      borderLeft: `3px solid ${accent}`,
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: t.fontBody, fontSize: 13,
      boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
      animation: "toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      maxWidth: "85%",
    }}>
      <span style={{ color: accent }}><BBI.check s={16} /></span>
      {message}
    </div>
  );
}

Object.assign(window, {
  MenuDrawer, SearchOverlay, CartSheet, Toast, qtyBtn,
});
