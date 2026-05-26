// home-screens.jsx — Additional mobile screens (light WP-parity):
//   /gio-hang/        — Cart page
//   /thanh-toan/      — Checkout
//   /tai-khoan/       — Account hub
//   /tai-khoan/don-hang/ — Orders + detail
//   /tai-khoan/yeu-thich/ — Wishlist
//   /dang-nhap/       — Login + register
//   /tin-tuc/         — News list
//   /tin-tuc/[slug]/  — Article page

const { useState: useStateX, useEffect: useEffectX, useMemo: useMemoX } = React;

// ═════════════════════════════════════════════════════════════
// SHARED: ScreenHeader — dark bar with back + title
// ═════════════════════════════════════════════════════════════
function ScreenHeader({ title, kicker, onClose, right, accent, breadcrumb }) {
  const t = bbTokens;
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{
        background: t.dark, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 6px", minHeight: 60,
      }}>
        <button onClick={onClose} style={iconBtn("#fff")} aria-label="Quay lại">
          <BBI.chevL s={22} />
        </button>
        <div style={{ flex: 1, padding: "0 6px", textAlign: "center", minWidth: 0 }}>
          {kicker && (
            <div style={{
              fontFamily: t.fontCond, fontSize: 11, color: accent || t.brand,
              letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
            }}>{kicker}</div>
          )}
          <div style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 18,
            color: "#fff", letterSpacing: "0.02em", textTransform: "uppercase",
            lineHeight: 1.15,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{title}</div>
        </div>
        <div style={{ width: 44, display: "flex", justifyContent: "flex-end" }}>
          {right}
        </div>
      </div>
      {breadcrumb && (
        <div style={{
          background: "#fff", padding: "10px 16px",
          fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
          display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
          borderBottom: `1px solid ${t.borderSubtle}`,
        }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <BBI.chev s={11} />}
              <span style={{ color: i === breadcrumb.length - 1 ? t.text : t.blue }}>{b}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CART PAGE — /gio-hang/
// ═════════════════════════════════════════════════════════════
function CartPage({ items, onRemove, onQty, onCheckout, onClose, onContinue, accent }) {
  const t = bbTokens;
  const [coupon, setCoupon] = useStateX("");
  const [applied, setApplied] = useStateX(null);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal === 0 ? 0 : (subtotal >= 2_000_000 ? 0 : 35_000);
  const discount = applied ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal + shipping - discount;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 75,
      background: t.bgRaised, color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader
        title="Giỏ hàng"
        kicker={`${items.length} SẢN PHẨM`}
        onClose={onClose}
        accent={accent}
        breadcrumb={["Bigbike.vn", "Giỏ hàng"]}
      />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <EmptyCart t={t} onContinue={onContinue} accent={accent} />
        ) : (
          <>
            {/* Free-ship progress */}
            <div style={{
              margin: "12px 16px 0",
              background: "#fff",
              border: `1px solid ${t.borderSubtle}`,
              padding: "14px",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: t.fontBody, fontSize: 13, color: t.text,
                marginBottom: 8,
              }}>
                <span style={{ color: accent }}><BBI.truck s={18} /></span>
                {subtotal >= 2_000_000 ? (
                  <span><strong>Miễn phí vận chuyển</strong> cho đơn hàng này 🎉</span>
                ) : (
                  <span>Mua thêm <strong style={{ color: accent }}>{vnd(2_000_000 - subtotal)}</strong> để được free ship</span>
                )}
              </div>
              <div style={{ height: 6, background: t.borderSubtle, position: "relative" }}>
                <div style={{
                  position: "absolute", inset: 0, right: "auto",
                  width: `${Math.min(100, (subtotal / 2_000_000) * 100)}%`,
                  background: accent,
                  transition: "width 220ms",
                }} />
              </div>
            </div>

            {/* Items */}
            <div style={{ padding: "12px 16px", display: "grid", gap: 10 }}>
              {items.map((it) => (
                <CartItemRow key={it.id} item={it} onRemove={onRemove} onQty={onQty} accent={accent} t={t} />
              ))}
            </div>

            {/* Coupon */}
            <div style={{
              margin: "0 16px 12px", background: "#fff",
              border: `1px solid ${t.borderSubtle}`,
              padding: "14px",
            }}>
              <div style={{
                fontFamily: t.fontCond, fontSize: 13, color: t.text,
                fontWeight: 600, marginBottom: 10, letterSpacing: "0.04em",
                textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <BBI.ticket s={16} /> Mã khuyến mãi
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Nhập mã giảm giá"
                  style={{
                    flex: 1, height: 44,
                    border: `1px solid ${t.border}`,
                    background: "#fff", padding: "0 12px",
                    fontFamily: t.fontBody, fontSize: 14, color: t.text,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => coupon && setApplied(coupon)}
                  disabled={!coupon}
                  style={{
                    minWidth: 100, height: 44,
                    background: !coupon ? t.bgRaised : t.text,
                    color: !coupon ? t.textSec : "#fff",
                    border: "none",
                    fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    cursor: !coupon ? "not-allowed" : "pointer",
                  }}
                >Áp dụng</button>
              </div>
              {applied && (
                <div style={{
                  marginTop: 10, padding: "10px 12px",
                  background: t.brandSoftBg, border: `1px solid ${t.borderBrand}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8,
                }}>
                  <span style={{
                    fontFamily: t.fontBody, fontSize: 13, color: t.text,
                  }}>
                    Đã áp dụng <strong style={{ color: accent }}>{applied}</strong> — giảm {vnd(discount)}
                  </span>
                  <button onClick={() => setApplied(null)} style={{
                    background: "transparent", border: "none", color: t.textSec, cursor: "pointer",
                    display: "inline-flex", padding: 4,
                  }}><BBI.close s={14} /></button>
                </div>
              )}
              {/* Suggested codes */}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {["SUMMER10", "BIKE50K", "FREESHIP"].map((c) => (
                  <button key={c} onClick={() => setCoupon(c)} style={{
                    padding: "6px 10px",
                    background: t.bgRaised, border: `1px dashed ${t.border}`,
                    color: t.text, cursor: "pointer",
                    fontFamily: t.fontMono, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                  }}>{c}</button>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div style={{
              margin: "0 16px 12px", background: "#fff",
              border: `1px solid ${t.borderSubtle}`,
              padding: "14px",
            }}>
              <div style={{
                fontFamily: t.fontCond, fontSize: 13, color: t.text,
                fontWeight: 600, marginBottom: 12, letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>Tổng cộng giỏ hàng</div>
              <div style={{ display: "grid", gap: 8 }}>
                <RowLine label="Tạm tính" value={vnd(subtotal)} t={t} />
                {discount > 0 && <RowLine label="Khuyến mãi" value={"−" + vnd(discount)} t={t} color={t.discount} />}
                <RowLine
                  label="Phí vận chuyển"
                  value={shipping === 0 ? "Miễn phí" : vnd(shipping)}
                  t={t}
                  color={shipping === 0 ? t.ok : t.text}
                />
                <div style={{ height: 1, background: t.borderSubtle, margin: "4px 0" }} />
                <div style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                }}>
                  <span style={{
                    fontFamily: t.fontCond, fontSize: 14, color: t.text,
                    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>Tổng</span>
                  <span style={{
                    fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 24,
                    color: t.brandActive,
                  }}>{vnd(total)}</span>
                </div>
              </div>
            </div>

            {/* Continue shopping link */}
            <div style={{ padding: "0 16px 16px" }}>
              <a onClick={onContinue} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: t.fontCond, fontSize: 14, color: t.blue,
                fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase",
                cursor: "pointer",
              }}>
                <BBI.chevL s={14} /> Tiếp tục mua hàng
              </a>
            </div>
          </>
        )}
      </div>

      {/* Sticky CTA */}
      {items.length > 0 && (
        <div style={{
          background: "#fff", borderTop: `1px solid ${t.borderSubtle}`,
          padding: "12px 14px",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          flexShrink: 0,
        }}>
          <button onClick={onCheckout} style={{
            width: "100%", minHeight: 52,
            background: accent, color: "#fff", border: "none",
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 15,
            letterSpacing: "0.06em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: "pointer",
          }}>
            Thanh toán · {vnd(total)} <BBI.arrow s={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function CartItemRow({ item, onRemove, onQty, accent, t }) {
  return (
    <div style={{
      display: "flex", gap: 12,
      background: "#fff", border: `1px solid ${t.borderSubtle}`,
      padding: 12, position: "relative",
    }}>
      <div style={{ width: 88, height: 88, flexShrink: 0 }}>
        <ProductPlaceholder tag={item.tag} h={88} tone={item.tone} aspect="1/1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: t.fontCond, fontSize: 11, color: t.textSec,
              letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
            }}>{item.brand}</div>
            <div style={{
              fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 15,
              color: t.text, lineHeight: 1.25, marginTop: 2,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>{item.name}</div>
          </div>
          <button onClick={() => onRemove(item.id)} style={{
            width: 26, height: 26, background: "transparent",
            border: "none", color: t.textSec, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }} aria-label="Xoá"><BBI.trash s={16} /></button>
        </div>
        {(item.color || item.size) && (
          <div style={{
            fontFamily: t.fontBody, fontSize: 11, color: t.textSec, marginTop: 4,
          }}>
            {item.color && <span>Màu: {item.color}</span>}
            {item.color && item.size && <span>  ·  </span>}
            {item.size && <span>Size: {item.size}</span>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{
            display: "inline-flex", alignItems: "center",
            border: `1px solid ${t.border}`, background: "#fff",
          }}>
            <button onClick={() => onQty(item.id, -1)} style={qtyBtn(t.text)}>−</button>
            <span style={{
              minWidth: 32, textAlign: "center",
              fontFamily: t.fontBody, fontSize: 14, color: t.text, fontWeight: 600,
            }}>{item.qty}</span>
            <button onClick={() => onQty(item.id, +1)} style={qtyBtn(t.text)}>+</button>
          </div>
          <div style={{
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 16,
            color: t.brandActive,
          }}>{vnd(item.price * item.qty)}</div>
        </div>
      </div>
    </div>
  );
}

function RowLine({ label, value, t, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSec }}>{label}</span>
      <span style={{
        fontFamily: t.fontCond, fontSize: 15, fontWeight: 600,
        color: color || t.text,
      }}>{value}</span>
    </div>
  );
}

function EmptyCart({ t, onContinue, accent }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "#fff", border: `1px solid ${t.borderSubtle}`,
        color: t.textSec,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}><BBI.cart s={36} /></div>
      <div style={{
        fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 22,
        color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
      }}>Giỏ hàng trống</div>
      <div style={{
        fontFamily: t.fontBody, fontSize: 14, color: t.textSec,
        marginTop: 8, lineHeight: 1.5, maxWidth: 280, margin: "8px auto 0",
        textWrap: "pretty",
      }}>Chưa có sản phẩm nào trong giỏ. Khám phá các sản phẩm bảo hộ chính hãng tại BigBike.</div>
      <button onClick={onContinue} style={{
        marginTop: 20, minHeight: 48, padding: "0 28px",
        background: accent, color: "#fff", border: "none",
        fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
        letterSpacing: "0.06em", textTransform: "uppercase",
        cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 10,
      }}>QUAY LẠI CỬA HÀNG <BBI.arrow s={15} /></button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CHECKOUT PAGE — /thanh-toan/
// ═════════════════════════════════════════════════════════════
function CheckoutPage({ items, onClose, onPlaceOrder, accent }) {
  const t = bbTokens;
  const [step, setStep] = useStateX(1); // 1 info, 2 ship, 3 pay, 4 done
  const [form, setForm] = useStateX({
    name: "Nguyễn Minh Tuấn",
    phone: "0901 234 567",
    email: "tuan@email.com",
    address: "Số 12, Đường Lê Lợi",
    ward: "Phường Bến Nghé",
    district: "Quận 1",
    city: "TP. Hồ Chí Minh",
    note: "",
  });
  const [ship, setShip] = useStateX("standard");
  const [pay, setPay] = useStateX("cod");

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = ship === "express" ? 60_000 : (subtotal >= 2_000_000 ? 0 : 35_000);
  const total = subtotal + shipping;

  if (step === 4) {
    return <OrderSuccess onClose={onClose} accent={accent} total={total} />;
  }

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 76,
      background: t.bgRaised, color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader
        title="Thanh toán"
        kicker={`BƯỚC ${step} / 3`}
        onClose={onClose}
        accent={accent}
        breadcrumb={["Bigbike.vn", "Giỏ hàng", "Thanh toán"]}
      />

      {/* Stepper */}
      <div style={{
        background: "#fff", padding: "14px 16px",
        borderBottom: `1px solid ${t.borderSubtle}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {[
          { n: 1, label: "Thông tin" },
          { n: 2, label: "Vận chuyển" },
          { n: 3, label: "Thanh toán" },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            }}>
              <div style={{
                width: 28, height: 28,
                background: s.n <= step ? accent : "#fff",
                color: s.n <= step ? "#fff" : t.textSec,
                border: s.n <= step ? `1px solid ${accent}` : `1px solid ${t.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 13,
              }}>
                {s.n < step ? <BBI.check s={14} /> : s.n}
              </div>
              <span style={{
                fontFamily: t.fontCond, fontSize: 12, fontWeight: 600,
                color: s.n === step ? t.text : t.textSec,
                textTransform: "uppercase", letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ flex: 1, height: 1, background: s.n < step ? accent : t.borderSubtle }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {step === 1 && (
          <div style={{ padding: "16px" }}>
            <CheckoutCard title="Thông tin liên hệ" t={t}>
              <Field label="Họ và tên *" value={form.name} onChange={(v) => setF("name", v)} t={t} />
              <Field label="Số điện thoại *" value={form.phone} onChange={(v) => setF("phone", v)} t={t} />
              <Field label="Email" value={form.email} onChange={(v) => setF("email", v)} t={t} />
            </CheckoutCard>

            <CheckoutCard title="Địa chỉ giao hàng" t={t}>
              <Field label="Địa chỉ *" value={form.address} onChange={(v) => setF("address", v)} t={t} />
              <Field label="Tỉnh / Thành phố *" value={form.city} onChange={(v) => setF("city", v)} t={t} selectish />
              <Field label="Quận / Huyện *" value={form.district} onChange={(v) => setF("district", v)} t={t} selectish />
              <Field label="Phường / Xã *" value={form.ward} onChange={(v) => setF("ward", v)} t={t} selectish />
              <Field label="Ghi chú (không bắt buộc)" value={form.note} onChange={(v) => setF("note", v)} t={t} textarea placeholder="Ví dụ: Giao giờ hành chính..." />
            </CheckoutCard>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: "16px" }}>
            <CheckoutCard title="Phương thức vận chuyển" t={t}>
              <RadioRow
                checked={ship === "standard"}
                onChange={() => setShip("standard")}
                accent={accent} t={t}
                title="Giao hàng tiêu chuẩn"
                sub="2–4 ngày làm việc · Toàn quốc"
                right={subtotal >= 2_000_000 ? <span style={{ color: t.ok, fontFamily: t.fontCond, fontWeight: 600, fontSize: 13 }}>MIỄN PHÍ</span> : <span style={{ fontFamily: t.fontCond, fontWeight: 600, fontSize: 14, color: t.text }}>{vnd(35_000)}</span>}
              />
              <RadioRow
                checked={ship === "express"}
                onChange={() => setShip("express")}
                accent={accent} t={t}
                title="Giao nhanh nội thành"
                sub="Trong vòng 2 giờ · TP.HCM & Hà Nội"
                right={<span style={{ fontFamily: t.fontCond, fontWeight: 600, fontSize: 14, color: t.text }}>{vnd(60_000)}</span>}
              />
              <RadioRow
                checked={ship === "pickup"}
                onChange={() => setShip("pickup")}
                accent={accent} t={t}
                title="Nhận tại cửa hàng"
                sub="Sẵn sàng trong 30 phút sau khi đặt"
                right={<span style={{ color: t.ok, fontFamily: t.fontCond, fontWeight: 600, fontSize: 13 }}>MIỄN PHÍ</span>}
              />
            </CheckoutCard>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: "16px" }}>
            <CheckoutCard title="Phương thức thanh toán" t={t}>
              <RadioRow
                checked={pay === "cod"} onChange={() => setPay("cod")}
                accent={accent} t={t}
                title="Thanh toán khi nhận hàng (COD)"
                sub="Kiểm tra hàng trước khi thanh toán"
              />
              <RadioRow
                checked={pay === "bank"} onChange={() => setPay("bank")}
                accent={accent} t={t}
                title="Chuyển khoản ngân hàng"
                sub="VietinBank · Techcombank · Vietcombank"
              />
              <RadioRow
                checked={pay === "momo"} onChange={() => setPay("momo")}
                accent={accent} t={t}
                title="Ví MoMo"
                sub="Thanh toán qua app MoMo"
              />
              <RadioRow
                checked={pay === "card"} onChange={() => setPay("card")}
                accent={accent} t={t}
                title="Thẻ tín dụng / ATM"
                sub="Visa · Mastercard · JCB · ATM Nội địa"
              />
              <RadioRow
                checked={pay === "installment"} onChange={() => setPay("installment")}
                accent={accent} t={t}
                title="Trả góp 0% qua thẻ"
                sub={`12 tháng — chỉ từ ${vnd(Math.round(total / 12))}/tháng`}
              />
            </CheckoutCard>

            <CheckoutCard title="Tóm tắt đơn hàng" t={t}>
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((it) => (
                  <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 56, height: 56, flexShrink: 0 }}>
                      <ProductPlaceholder tag="" h={56} tone={it.tone} aspect="1/1" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 500,
                        color: t.text, lineHeight: 1.25,
                        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>{it.name}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textSec, marginTop: 2 }}>
                        SL: {it.qty}
                      </div>
                    </div>
                    <div style={{ fontFamily: t.fontCond, fontWeight: 600, fontSize: 14, color: t.brandActive }}>
                      {vnd(it.price * it.qty)}
                    </div>
                  </div>
                ))}
                <div style={{ height: 1, background: t.borderSubtle, margin: "4px 0" }} />
                <RowLine label="Tạm tính" value={vnd(subtotal)} t={t} />
                <RowLine label="Vận chuyển" value={shipping === 0 ? "Miễn phí" : vnd(shipping)} t={t} />
              </div>
            </CheckoutCard>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div style={{
        background: "#fff", borderTop: `1px solid ${t.borderSubtle}`,
        padding: "10px 14px",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <span style={{
            fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
          }}>Tổng thanh toán</span>
          <span style={{
            fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 22,
            color: t.brandActive,
          }}>{vnd(total)}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{
              flex: 0.8, minHeight: 50,
              background: "transparent", color: t.text,
              border: `2px solid ${t.text}`,
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
              letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: "pointer",
            }}>Quay lại</button>
          )}
          <button onClick={() => step < 3 ? setStep(step + 1) : (onPlaceOrder && onPlaceOrder(), setStep(4))} style={{
            flex: 1.4, minHeight: 50,
            background: accent, color: "#fff", border: "none",
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 14,
            letterSpacing: "0.06em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: "pointer",
          }}>
            {step < 3 ? "Tiếp tục" : "Đặt hàng"} <BBI.arrow s={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutCard({ title, t, children }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${t.borderSubtle}`,
      marginBottom: 12,
    }}>
      <div style={{
        padding: "12px 14px", borderBottom: `1px solid ${t.borderSubtle}`,
        fontFamily: t.fontCond, fontSize: 14, fontWeight: 600,
        color: t.text, letterSpacing: "0.04em", textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ padding: "12px 14px", display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, t, textarea, selectish, placeholder, type }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
        display: "block", marginBottom: 4,
      }}>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          placeholder={placeholder}
          style={{
            width: "100%", minHeight: 72, padding: "10px 12px",
            border: `1px solid ${t.border}`, background: "#fff", color: t.text,
            fontFamily: t.fontBody, fontSize: 14, outline: "none",
            resize: "vertical",
          }} />
      ) : (
        <div style={{ position: "relative" }}>
          <input value={value} onChange={(e) => onChange(e.target.value)} type={type || "text"}
            placeholder={placeholder}
            style={{
              width: "100%", height: 44, padding: selectish ? "0 36px 0 12px" : "0 12px",
              border: `1px solid ${t.border}`, background: "#fff", color: t.text,
              fontFamily: t.fontBody, fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }} />
          {selectish && (
            <span style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              color: t.textSec, pointerEvents: "none",
            }}><BBI.chevDown s={16} /></span>
          )}
        </div>
      )}
    </label>
  );
}

function RadioRow({ checked, onChange, accent, t, title, sub, right }) {
  return (
    <button onClick={onChange} style={{
      width: "100%", padding: "12px 0",
      background: "transparent", border: "none",
      borderTop: `1px solid ${t.borderSubtle}`,
      display: "flex", alignItems: "center", gap: 12,
      cursor: "pointer", textAlign: "left",
      color: t.text,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        border: checked ? `5px solid ${accent}` : `1px solid ${t.border}`,
        background: "#fff", flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
          color: t.text,
        }}>{title}</div>
        {sub && <div style={{
          fontFamily: t.fontBody, fontSize: 12, color: t.textSec, marginTop: 2,
        }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </button>
  );
}

function OrderSuccess({ onClose, accent, total }) {
  const t = bbTokens;
  const orderId = "BB" + Math.floor(100000 + Math.random() * 900000);
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 76,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Đặt hàng thành công" onClose={onClose} accent={accent} />
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "32px 22px 22px",
        textAlign: "center",
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%",
          background: t.brandSoftBg, color: accent,
          border: `1px solid ${t.borderBrand}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 18,
        }}><BBI.check s={42} /></div>

        <div style={{
          fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 26,
          color: t.text, textTransform: "uppercase",
        }}>Cảm ơn bạn!</div>
        <div style={{
          fontFamily: t.fontBody, fontSize: 14, color: t.textSec,
          margin: "8px auto 24px", maxWidth: 300, lineHeight: 1.5,
          textWrap: "pretty",
        }}>Đơn hàng đã được tiếp nhận. BigBike sẽ liên hệ xác nhận trong vòng 15 phút.</div>

        <div style={{
          background: t.bgRaised, padding: "16px",
          border: `1px solid ${t.borderSubtle}`,
          textAlign: "left", margin: "0 auto", maxWidth: 320,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSec }}>Mã đơn</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 13, color: t.text, fontWeight: 600 }}>{orderId}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSec }}>Trạng thái</span>
            <span style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.ok, fontWeight: 600,
              padding: "2px 8px", background: t.okBg, border: `1px solid ${t.okBorder}`,
              textTransform: "uppercase",
            }}>Đã tiếp nhận</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSec }}>Tổng thanh toán</span>
            <span style={{ fontFamily: t.fontCond, fontSize: 16, color: t.brandActive, fontWeight: 700 }}>{vnd(total)}</span>
          </div>
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "22px auto 0" }}>
          <button onClick={onClose} style={{
            minHeight: 48, padding: "0 24px",
            background: accent, color: "#fff", border: "none",
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
          }}>Theo dõi đơn hàng</button>
          <button onClick={onClose} style={{
            minHeight: 48, padding: "0 24px",
            background: "transparent", color: t.text,
            border: `2px solid ${t.text}`,
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
          }}>Tiếp tục mua hàng</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ACCOUNT HUB — /tai-khoan/
// ═════════════════════════════════════════════════════════════
const MOCK_ORDERS = [
  { id: "BB820134", date: "10/05/2026", status: "delivered", statusLabel: "Đã giao", total: 28_900_000, items: 1, productName: "Shoei X-Fifteen Marquez 7", tone: "light",  tag: "HELMET / FULL-FACE" },
  { id: "BB819876", date: "02/05/2026", status: "shipping",  statusLabel: "Đang giao",  total:  6_990_000, items: 1, productName: "Dainese Carbon 4 Long Black", tone: "chrome", tag: "GLOVE / CARBON" },
  { id: "BB818553", date: "21/04/2026", status: "processing",statusLabel: "Đang xử lý", total: 18_500_000, items: 1, productName: "Alpinestars GP Plus R V4",    tone: "warm",   tag: "JACKET / LEATHER" },
];

const ACCOUNT_LINKS = [
  { id: "orders",   label: "Đơn hàng của tôi",  icon: "package", badge: "3" },
  { id: "wishlist", label: "Sản phẩm yêu thích",icon: "heart",   badge: "12" },
  { id: "address",  label: "Sổ địa chỉ",         icon: "pin" },
  { id: "voucher",  label: "Mã giảm giá",        icon: "ticket", badge: "5" },
  { id: "warranty", label: "Bảo hành sản phẩm",  icon: "shield" },
  { id: "compare",  label: "So sánh sản phẩm",   icon: "grid" },
];

const SETTING_LINKS = [
  { id: "info",       label: "Thông tin tài khoản",     icon: "edit" },
  { id: "password",   label: "Đổi mật khẩu",            icon: "shield" },
  { id: "newsletter", label: "Nhận tin & ưu đãi",       icon: "mail" },
  { id: "support",    label: "Hỗ trợ khách hàng",       icon: "headset" },
  { id: "logout",     label: "Đăng xuất",               icon: "rotate" },
];

function AccountHub({ user, onClose, onSubScreen, accent, onLogin }) {
  const t = bbTokens;
  if (!user) {
    return <LoginScreen onClose={onClose} onLogin={onLogin} accent={accent} />;
  }
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 75,
      background: t.bgRaised, color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Tài khoản" onClose={onClose} accent={accent} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Profile card */}
        <div style={{
          background: t.dark, color: "#fff",
          padding: "20px 16px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: `2px solid ${accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff",
            }}><BBI.user s={26} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
                color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em",
                lineHeight: 1.15,
              }}>{user.name}</div>
              <div style={{
                fontFamily: t.fontBody, fontSize: 13, color: "#cecece", marginTop: 2,
              }}>{user.phone} · {user.email}</div>
            </div>
            <button onClick={() => onSubScreen && onSubScreen("info")} style={{
              ...iconBtn("#fff"), border: `1px solid rgba(255,255,255,0.2)`,
              width: 38, height: 38,
            }} aria-label="Chỉnh sửa">
              <BBI.edit s={16} />
            </button>
          </div>

          {/* Rank */}
          <div style={{
            marginTop: 16, padding: "10px 12px",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid rgba(255,255,255,0.10)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10,
          }}>
            <div>
              <div style={{
                fontFamily: t.fontCond, fontSize: 10, color: accent,
                letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
              }}>HẠNG THÀNH VIÊN</div>
              <div style={{
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 17,
                color: "#fff", textTransform: "uppercase",
              }}>BIKER GOLD</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: "#abb8c3", letterSpacing: "0.06em" }}>ĐIỂM</div>
              <div style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 18, color: "#fff" }}>2,450</div>
            </div>
          </div>
        </div>

        {/* Recent orders snapshot */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 600,
              color: t.text, textTransform: "uppercase", letterSpacing: "0.02em",
            }}>Đơn hàng gần đây</div>
            <a onClick={() => onSubScreen && onSubScreen("orders")} style={{
              fontFamily: t.fontBody, fontSize: 13, color: t.blue,
              display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
            }}>Tất cả <BBI.chev s={11} /></a>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {MOCK_ORDERS.slice(0, 2).map((o) => (
              <OrderCard key={o.id} order={o} accent={accent} t={t} compact onClick={() => onSubScreen && onSubScreen("orders")} />
            ))}
          </div>
        </div>

        {/* Account menu */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
            letterSpacing: "0.10em", fontWeight: 600, marginBottom: 8,
            textTransform: "uppercase",
          }}>QUẢN LÝ TÀI KHOẢN</div>
          <div style={{ background: "#fff", border: `1px solid ${t.borderSubtle}` }}>
            {ACCOUNT_LINKS.map((row, i) => {
              const Icon = BBI[row.icon];
              return (
                <a key={row.id} onClick={() => onSubScreen && onSubScreen(row.id)} style={{
                  display: "flex", alignItems: "center", gap: 14, minHeight: 56,
                  padding: "0 14px",
                  borderBottom: i < ACCOUNT_LINKS.length - 1 ? `1px solid ${t.borderSubtle}` : "none",
                  textDecoration: "none", cursor: "pointer", color: t.text,
                }}>
                  <span style={{ color: accent, display: "inline-flex" }}><Icon s={20} /></span>
                  <span style={{
                    flex: 1, fontFamily: t.fontBody, fontSize: 14, color: t.text,
                  }}>{row.label}</span>
                  {row.badge && (
                    <span style={{
                      background: t.bgRaised, color: t.text,
                      padding: "2px 8px", fontFamily: t.fontMono, fontSize: 11, fontWeight: 600,
                    }}>{row.badge}</span>
                  )}
                  <BBI.chev s={14} />
                </a>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div style={{ padding: "20px 16px 16px" }}>
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
            letterSpacing: "0.10em", fontWeight: 600, marginBottom: 8,
            textTransform: "uppercase",
          }}>CÀI ĐẶT</div>
          <div style={{ background: "#fff", border: `1px solid ${t.borderSubtle}` }}>
            {SETTING_LINKS.map((row, i) => {
              const Icon = BBI[row.icon];
              const isLogout = row.id === "logout";
              return (
                <a key={row.id} onClick={() => onSubScreen && onSubScreen(row.id)} style={{
                  display: "flex", alignItems: "center", gap: 14, minHeight: 52,
                  padding: "0 14px",
                  borderBottom: i < SETTING_LINKS.length - 1 ? `1px solid ${t.borderSubtle}` : "none",
                  textDecoration: "none", cursor: "pointer",
                  color: isLogout ? accent : t.text,
                }}>
                  <span style={{ color: isLogout ? accent : t.textSec, display: "inline-flex" }}><Icon s={18} /></span>
                  <span style={{
                    flex: 1, fontFamily: t.fontBody, fontSize: 14,
                    fontWeight: isLogout ? 600 : 400,
                  }}>{row.label}</span>
                  <BBI.chev s={14} />
                </a>
              );
            })}
          </div>
        </div>

        <div style={{
          textAlign: "center",
          fontFamily: t.fontMono, fontSize: 11, color: t.textSec,
          padding: "8px 16px 24px",
        }}>BigBike v2.4.1 · iOS</div>
      </div>
    </div>
  );
}

function OrderCard({ order, accent, t, compact, onClick }) {
  const statusColors = {
    delivered:  { bg: t.okBg,        text: t.ok,           border: t.okBorder },
    shipping:   { bg: "rgba(0,123,255,0.08)", text: t.blue, border: "rgba(0,123,255,0.32)" },
    processing: { bg: "rgba(252,185,0,0.16)", text: "#7a5800", border: "rgba(252,185,0,0.4)" },
    cancelled:  { bg: t.bgRaised,   text: t.textSec,      border: t.border },
  };
  const sc = statusColors[order.status] || statusColors.processing;
  return (
    <div onClick={onClick} style={{
      background: "#fff", border: `1px solid ${t.borderSubtle}`,
      padding: "12px",
      display: "flex", gap: 12, alignItems: "stretch",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ width: 72, height: 72, flexShrink: 0 }}>
        <ProductPlaceholder tag={order.tag} h={72} tone={order.tone} aspect="1/1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{
            fontFamily: t.fontMono, fontSize: 11, color: t.textSec,
            letterSpacing: "0.06em", fontWeight: 600,
          }}>#{order.id}</div>
          <div style={{
            fontFamily: t.fontCond, fontSize: 10, fontWeight: 600,
            color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`,
            padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.04em",
          }}>{order.statusLabel}</div>
        </div>
        <div style={{
          fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 500, color: t.text,
          lineHeight: 1.25, marginTop: 4,
          display: "-webkit-box", WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{order.productName}</div>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8,
        }}>
          <span style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSec }}>
            {order.date} · {order.items} sản phẩm
          </span>
          <span style={{
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 15, color: t.brandActive,
          }}>{vnd(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ORDERS LIST / WISHLIST / SIMPLE SUBSCREEN
// ═════════════════════════════════════════════════════════════
function OrdersScreen({ onClose, onLogout, accent }) {
  const t = bbTokens;
  const [tab, setTab] = useStateX("all");
  const tabs = [
    { id: "all", label: "Tất cả" },
    { id: "processing", label: "Đang xử lý" },
    { id: "shipping",   label: "Đang giao" },
    { id: "delivered",  label: "Đã giao" },
  ];
  const visible = tab === "all" ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === tab);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 76,
      background: t.bgRaised, color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Đơn hàng" onClose={onClose} accent={accent} />

      {/* Tabs */}
      <div style={{
        background: "#fff", borderBottom: `1px solid ${t.borderSubtle}`,
        display: "flex", overflowX: "auto", scrollbarWidth: "none",
      }}>
        {tabs.map((x) => {
          const active = x.id === tab;
          return (
            <button key={x.id} onClick={() => setTab(x.id)} style={{
              flexShrink: 0, padding: "14px 16px",
              background: "transparent", border: "none",
              color: active ? t.text : t.textSec,
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
              letterSpacing: "0.04em", textTransform: "uppercase",
              cursor: "pointer", position: "relative",
            }}>
              {x.label}
              {active && <span style={{
                position: "absolute", bottom: -1, left: 16, right: 16,
                height: 2, background: accent,
              }} />}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "grid", gap: 8 }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: t.textSec, fontFamily: t.fontBody }}>
            Chưa có đơn hàng trong nhóm này.
          </div>
        ) : (
          visible.map((o) => <OrderCard key={o.id} order={o} accent={accent} t={t} onClick={() => {}} />)
        )}
      </div>
    </div>
  );
}

function WishlistScreen({ onClose, onOpenProduct, onAddToCart, accent }) {
  const t = bbTokens;
  const items = FEATURED.slice(0, 4);
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 76,
      background: t.bgRaised, color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Yêu thích" kicker={`${items.length} SẢN PHẨM`} onClose={onClose} accent={accent} />
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "12px 16px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      }}>
        {items.map((p) => (
          <ProductCard key={p.id} p={p} accent={accent} width="100%" full
            onAddToCart={onAddToCart} onOpen={onOpenProduct} />
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// LOGIN / REGISTER — /dang-nhap/
// ═════════════════════════════════════════════════════════════
function LoginScreen({ onClose, onLogin, accent }) {
  const t = bbTokens;
  const [mode, setMode] = useStateX("login"); // login | register
  const [phone, setPhone] = useStateX("");
  const [pw, setPw] = useStateX("");
  const [show, setShow] = useStateX(false);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 76,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title={mode === "login" ? "Đăng nhập" : "Đăng ký"} onClose={onClose} accent={accent} />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>
        <div style={{ marginBottom: 22 }}>
          <BigBikeMark size={26} color={t.text} dot={accent} />
          <h2 style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 24,
            color: t.text, margin: "16px 0 4px",
            textTransform: "uppercase", letterSpacing: "0.02em",
            lineHeight: 1.15,
          }}>{mode === "login" ? "Chào mừng quay lại" : "Tham gia BigBike"}</h2>
          <p style={{
            fontFamily: t.fontBody, fontSize: 14, color: t.textSec, margin: 0,
            lineHeight: 1.5, textWrap: "pretty",
          }}>
            {mode === "login"
              ? "Đăng nhập để theo dõi đơn hàng, nhận ưu đãi riêng cho thành viên."
              : "Tạo tài khoản trong 30 giây — nhận voucher 100K cho đơn đầu tiên."}
          </p>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex", background: t.bgRaised,
          padding: 3, marginBottom: 20,
        }}>
          {[
            { id: "login", label: "Đăng nhập" },
            { id: "register", label: "Đăng ký" },
          ].map((o) => {
            const active = mode === o.id;
            return (
              <button key={o.id} onClick={() => setMode(o.id)} style={{
                flex: 1, minHeight: 42,
                background: active ? "#fff" : "transparent",
                color: t.text, border: "none",
                fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                letterSpacing: "0.04em", textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{o.label}</button>
            );
          })}
        </div>

        {/* Form */}
        <div style={{ display: "grid", gap: 12 }}>
          {mode === "register" && (
            <Field label="Họ và tên" value="" onChange={() => {}} t={t} placeholder="Nhập họ tên" />
          )}
          <Field label="Số điện thoại" value={phone} onChange={setPhone} t={t} placeholder="0xxx xxx xxx" />
          <div>
            <label style={{
              fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
              display: "block", marginBottom: 4,
            }}>Mật khẩu</label>
            <div style={{ position: "relative" }}>
              <input value={pw} onChange={(e) => setPw(e.target.value)}
                type={show ? "text" : "password"}
                placeholder="Tối thiểu 8 ký tự"
                style={{
                  width: "100%", height: 46, padding: "0 44px 0 12px",
                  border: `1px solid ${t.border}`, background: "#fff", color: t.text,
                  fontFamily: t.fontBody, fontSize: 14, outline: "none",
                  boxSizing: "border-box",
                }} />
              <button onClick={() => setShow(!show)} style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: t.textSec,
                cursor: "pointer", padding: 8,
              }} aria-label="Hiện mật khẩu">
                <BBI.eye s={18} />
              </button>
            </div>
          </div>

          {mode === "login" && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <a style={{
                fontFamily: t.fontBody, fontSize: 13, color: t.blue, cursor: "pointer",
              }}>Quên mật khẩu?</a>
            </div>
          )}

          <button onClick={() => onLogin && onLogin({ name: "Nguyễn Minh Tuấn", phone: phone || "0901 234 567", email: "tuan@email.com" })} style={{
            minHeight: 52,
            background: accent, color: "#fff", border: "none",
            fontFamily: t.fontCond, fontWeight: 700, fontSize: 15,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer", marginTop: 4,
          }}>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, margin: "12px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: t.borderSubtle }} />
            <span style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hoặc</span>
            <div style={{ flex: 1, height: 1, background: t.borderSubtle }} />
          </div>

          {/* Social login */}
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { label: "Tiếp tục với Facebook", icon: "fb",   color: "#1877f2" },
              { label: "Tiếp tục với Google",   icon: "mail", color: "#222" },
              { label: "Tiếp tục với Zalo",     icon: "zalo", color: "#0068ff" },
            ].map((s, i) => {
              const Icon = BBI[s.icon];
              return (
                <button key={i} style={{
                  minHeight: 48, padding: "0 16px",
                  background: "#fff", color: t.text,
                  border: `1px solid ${t.border}`,
                  fontFamily: t.fontCond, fontWeight: 600, fontSize: 14,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ color: s.color }}><Icon s={20} /></span>
                  <span style={{ flex: 1, textAlign: "left" }}>{s.label}</span>
                  <BBI.chev s={14} />
                </button>
              );
            })}
          </div>

          {mode === "register" && (
            <div style={{
              fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
              lineHeight: 1.5, marginTop: 12, textWrap: "pretty",
            }}>
              Bằng việc đăng ký, bạn đồng ý với <a style={{ color: t.blue, textDecoration: "underline" }}>Điều khoản sử dụng</a> và <a style={{ color: t.blue, textDecoration: "underline" }}>Chính sách bảo mật</a> của BigBike.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// NEWS LIST + ARTICLE — /tin-tuc/
// ═════════════════════════════════════════════════════════════
const NEWS_LIST = [
  ...BLOG,
  { id: "b4", kicker: "REVIEW",   title: "5 mẫu mũ bảo hiểm half-face cho đi phố trong tầm giá 2 triệu", date: "20/04/2026", read: "9 phút", tag: "MŨ", tone: "warm",   cat: "Đánh giá" },
  { id: "b5", kicker: "TƯ VẤN",   title: "Bảo dưỡng đồ bảo hộ moto sau mùa mưa — checklist 7 bước",       date: "12/04/2026", read: "7 phút", tag: "AN TOÀN", tone: "chrome",cat: "Bảo dưỡng" },
  { id: "b6", kicker: "TRẢI NGHIỆM", title: "10.000 km cùng Alpinestars Tech-Air 10 — đáng đầu tư hay không?", date: "01/04/2026", read: "15 phút", tag: "ÁO", tone: "light", cat: "Đánh giá" },
];

const NEWS_CATEGORIES = ["Tất cả", "Hướng dẫn", "Tư vấn", "Đánh giá", "Bảo dưỡng"];

function NewsListScreen({ onClose, onOpenArticle, accent }) {
  const t = bbTokens;
  const [cat, setCat] = useStateX("Tất cả");
  const visible = cat === "Tất cả" ? NEWS_LIST : NEWS_LIST.filter((a) => a.cat === cat);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 75,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Tin tức" kicker="CẨM NANG BIKER" onClose={onClose} accent={accent} />

      {/* Featured */}
      {visible.length > 0 && (
        <div style={{ padding: "16px 16px 0" }}>
          <a onClick={() => onOpenArticle && onOpenArticle(visible[0])} style={{
            display: "block", textDecoration: "none", color: t.text, cursor: "pointer",
            border: `1px solid ${t.borderSubtle}`,
          }}>
            <div style={{ position: "relative" }}>
              <ProductPlaceholder tag={visible[0].tag} h={180} tone={visible[0].tone} />
              <span style={{
                position: "absolute", top: 12, left: 12,
                background: accent, color: "#fff",
                fontFamily: t.fontCond, fontWeight: 600, fontSize: 11,
                padding: "4px 9px", letterSpacing: "0.04em", textTransform: "uppercase",
              }}>NỔI BẬT · {visible[0].cat}</span>
            </div>
            <div style={{ padding: "14px 16px 18px" }}>
              <div style={{
                fontFamily: t.fontCond, fontSize: 11, letterSpacing: "0.10em",
                color: accent, fontWeight: 600, textTransform: "uppercase",
              }}>{visible[0].kicker}</div>
              <h3 style={{
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20,
                color: t.text, lineHeight: 1.2, margin: "6px 0 10px",
                textWrap: "pretty",
              }}>{visible[0].title}</h3>
              <div style={{
                fontFamily: t.fontBody, fontSize: 12, color: t.textSec,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>{visible[0].date}</span>
                <span style={{ color: t.border }}>•</span>
                <span>{visible[0].read}</span>
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Category pills */}
      <div style={{
        display: "flex", gap: 6, overflowX: "auto", padding: "16px 16px 6px",
        scrollbarWidth: "none",
      }}>
        {NEWS_CATEGORIES.map((c) => {
          const active = c === cat;
          return (
            <button key={c} onClick={() => setCat(c)} style={{
              flexShrink: 0, height: 34,
              padding: "0 14px",
              background: active ? t.text : "#fff",
              color: active ? "#fff" : t.text,
              border: active ? `1px solid ${t.text}` : `1px solid ${t.border}`,
              fontFamily: t.fontCond, fontWeight: 600, fontSize: 13,
              letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}>{c}</button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
        <div style={{ display: "grid", gap: 12 }}>
          {visible.slice(1).map((a) => (
            <a key={a.id} onClick={() => onOpenArticle && onOpenArticle(a)} style={{
              display: "flex", gap: 12,
              background: "#fff", border: `1px solid ${t.borderSubtle}`,
              cursor: "pointer", textDecoration: "none", color: t.text,
            }}>
              <div style={{ width: 110, flexShrink: 0 }}>
                <ProductPlaceholder tag={a.tag} h={110} tone={a.tone} aspect="1/1" />
              </div>
              <div style={{ flex: 1, padding: "10px 12px 10px 0", display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{
                  fontFamily: t.fontCond, fontSize: 11, color: accent,
                  letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase",
                }}>{a.cat}</div>
                <h4 style={{
                  fontFamily: t.fontDisplay, fontWeight: 500, fontSize: 15, color: t.text,
                  lineHeight: 1.25, margin: "3px 0 0",
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                  overflow: "hidden", textWrap: "pretty",
                }}>{a.title}</h4>
                <div style={{
                  marginTop: "auto", paddingTop: 8,
                  fontFamily: t.fontBody, fontSize: 11, color: t.textSec,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>{a.date}</span>
                  <span style={{ color: t.border }}>•</span>
                  <span>{a.read}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArticleScreen({ article, onClose, accent }) {
  const t = bbTokens;
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 80,
      background: "#fff", color: t.text,
      display: "flex", flexDirection: "column",
      animation: "pdp-slide-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      overflow: "hidden",
    }}>
      <ScreenHeader title="Bài viết" onClose={onClose} accent={accent} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Cover */}
        <div style={{ position: "relative", height: 220 }}>
          <ProductPlaceholder tag={article.tag} h={220} tone={article.tone} />
          <span style={{
            position: "absolute", top: 14, left: 14,
            background: accent, color: "#fff",
            fontFamily: t.fontCond, fontWeight: 600, fontSize: 11,
            padding: "4px 9px", letterSpacing: "0.04em", textTransform: "uppercase",
          }}>{article.cat}</span>
        </div>

        <div style={{ padding: "20px 18px 28px" }}>
          <div style={{
            fontFamily: t.fontCond, fontSize: 12, color: accent,
            letterSpacing: "0.10em", fontWeight: 600, textTransform: "uppercase",
          }}>{article.kicker}</div>
          <h1 style={{
            fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 26,
            color: t.text, lineHeight: 1.2, margin: "8px 0 12px",
            textWrap: "balance",
          }}>{article.title}</h1>
          <div style={{
            fontFamily: t.fontBody, fontSize: 13, color: t.textSec,
            display: "flex", alignItems: "center", gap: 12,
            paddingBottom: 16, borderBottom: `1px solid ${t.borderSubtle}`, marginBottom: 18,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: t.bgRaised, color: t.textSec,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 600,
            }}>BB</div>
            <span>BigBike Team</span>
            <span style={{ color: t.border }}>•</span>
            <span>{article.date}</span>
            <span style={{ color: t.border }}>•</span>
            <span>{article.read}</span>
          </div>

          <div style={{
            fontFamily: t.fontBody, fontSize: 16, color: t.text,
            lineHeight: 1.65,
          }}>
            <p style={{ margin: "0 0 16px", fontWeight: 500, fontSize: 17 }}>
              Chọn được một bộ đồ bảo hộ phù hợp không chỉ đảm bảo an toàn mà còn quyết định trải nghiệm cầm lái của bạn trên mỗi chuyến đi.
            </p>
            <p style={{ margin: "0 0 16px", color: t.textSec }}>
              Trong bài viết này, BigBike sẽ cùng bạn đi qua những điểm cần lưu ý khi mua sắm đồ bảo hộ moto, từ mũ bảo hiểm, áo giáp đến găng tay và giày moto.
            </p>
            <h2 style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 22,
              color: t.text, margin: "24px 0 12px",
              textTransform: "uppercase", letterSpacing: "0.01em",
            }}>1. Đo khuôn đầu chính xác</h2>
            <p style={{ margin: "0 0 16px", color: t.textSec }}>
              Việc đầu tiên là dùng thước dây mềm đo vòng đầu, vị trí cao nhất quanh trán, qua chân mày. Chia khuôn đầu thành 3 loại chính: tròn (round), oval dài (long oval), và oval trung gian (intermediate oval).
            </p>
            <div style={{
              background: t.bgRaised, padding: "14px 16px",
              borderLeft: `3px solid ${accent}`,
              margin: "16px 0",
              fontFamily: t.fontBody, fontSize: 15, color: t.text,
              fontStyle: "italic", textWrap: "pretty",
            }}>"Đầu tròn — chọn Arai. Đầu oval — chọn Shoei. Khẩu quyết của dân chơi helmet đã có hơn 20 năm vẫn còn nguyên giá trị."</div>
            <h2 style={{
              fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 22,
              color: t.text, margin: "24px 0 12px",
              textTransform: "uppercase", letterSpacing: "0.01em",
            }}>2. Kiểm tra chuẩn an toàn</h2>
            <p style={{ margin: "0 0 16px", color: t.textSec }}>
              Tại Việt Nam, mũ bảo hiểm hợp pháp cần đạt QCVN 2:2008/BKHCN. Tuy nhiên cho riders đi tốc độ cao, hãy chọn chuẩn quốc tế cao hơn như DOT (Mỹ), ECE 22.06 (châu Âu), hoặc FIM (đua chuyên nghiệp).
            </p>
          </div>

          {/* Share */}
          <div style={{
            marginTop: 24, padding: "16px 0",
            borderTop: `1px solid ${t.borderSubtle}`, borderBottom: `1px solid ${t.borderSubtle}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              fontFamily: t.fontCond, fontSize: 12, color: t.textSec,
              letterSpacing: "0.05em", fontWeight: 600, textTransform: "uppercase",
            }}>Chia sẻ</span>
            {[ "fb", "zalo", "tt"].map((n) => {
              const Icon = BBI[n];
              return (
                <a key={n} style={{
                  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#fff", border: `1px solid ${t.border}`,
                  color: t.text, cursor: "pointer",
                }}><Icon s={16} /></a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CartPage, CheckoutPage, OrderSuccess, AccountHub, OrdersScreen, WishlistScreen,
  LoginScreen, NewsListScreen, ArticleScreen, MOCK_ORDERS,
});
