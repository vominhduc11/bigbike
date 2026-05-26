/* global React */
// ─────────────────────────────────────────────────────────────────────────
// designsystem.jsx — Showcase: tokens, components, patterns
// ─────────────────────────────────────────────────────────────────────────

const { useState: useStateD } = React;

function Swatch({ varname, label, hex }) {
  return (
    <div className="bb-swatch">
      <span className="chip" style={{background: `var(${varname})`}}/>
      <div style={{minWidth:0}}>
        <div className="label">{label}</div>
        <div className="hex">{hex || varname}</div>
      </div>
    </div>
  );
}

function DSRow({ k, children }) {
  return (
    <div className="bb-ds-row">
      <div className="key">{k}</div>
      <div style={{flex:1, display:"flex", flexWrap:"wrap", alignItems:"center", gap:12}}>{children}</div>
    </div>
  );
}

function DesignSystem() {
  const [tabSel, setTabSel] = useStateD("Tất cả");
  return (
    <div className="bb-ds">

      <div style={{maxWidth:760, margin:"8px 0 24px"}}>
        <h1 style={{fontSize:24, fontWeight:700, letterSpacing:"-0.01em", margin:"0 0 6px"}}>Design System</h1>
        <p style={{margin:0, color:"var(--bb-text-muted)", fontSize:14}}>
          Tokens và component primitives cho BigBike Admin. Mọi screen trong tab Prototype dùng đúng những primitives này — không có "one-off styling".
        </p>
      </div>

      {/* ── Color tokens ────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Color</h2>
        <p className="desc">Brand đỏ giữ nguyên từ codebase. Neutrals lạnh hơn một chút (slate). Status palette nhất quán theo bộ {`{bg, border, text}`}.</p>

        <DSRow k="Brand">
          <Swatch varname="--bb-brand" label="Primary" hex="#e8281e"/>
          <Swatch varname="--bb-brand-hover" label="Hover" hex="#cc1f17"/>
          <Swatch varname="--bb-brand-active" label="Active" hex="#b01810"/>
          <Swatch varname="--bb-brand-subtle" label="Subtle bg" hex="#fff1f0"/>
        </DSRow>

        <DSRow k="Surfaces">
          <Swatch varname="--bb-bg" label="App bg"/>
          <Swatch varname="--bb-surface" label="Surface"/>
          <Swatch varname="--bb-surface-muted" label="Muted"/>
          <Swatch varname="--bb-surface-raised" label="Raised"/>
          <Swatch varname="--bb-sidebar" label="Sidebar"/>
        </DSRow>

        <DSRow k="Borders">
          <Swatch varname="--bb-border-faint" label="Faint"/>
          <Swatch varname="--bb-border" label="Default"/>
          <Swatch varname="--bb-border-strong" label="Strong"/>
        </DSRow>

        <DSRow k="Text">
          <Swatch varname="--bb-text" label="Primary"/>
          <Swatch varname="--bb-text-secondary" label="Secondary"/>
          <Swatch varname="--bb-text-muted" label="Muted"/>
          <Swatch varname="--bb-text-faint" label="Faint"/>
        </DSRow>

        <DSRow k="Status: success">
          <Swatch varname="--bb-success-bg" label="bg"/>
          <Swatch varname="--bb-success-border" label="border"/>
          <Swatch varname="--bb-success" label="text"/>
        </DSRow>

        <DSRow k="Status: warning">
          <Swatch varname="--bb-warning-bg" label="bg"/>
          <Swatch varname="--bb-warning-border" label="border"/>
          <Swatch varname="--bb-warning" label="text"/>
        </DSRow>

        <DSRow k="Status: danger">
          <Swatch varname="--bb-danger-bg" label="bg"/>
          <Swatch varname="--bb-danger-border" label="border"/>
          <Swatch varname="--bb-danger" label="text"/>
        </DSRow>

        <DSRow k="Status: info">
          <Swatch varname="--bb-info-bg" label="bg"/>
          <Swatch varname="--bb-info-border" label="border"/>
          <Swatch varname="--bb-info" label="text"/>
        </DSRow>

        <DSRow k="Status: neutral">
          <Swatch varname="--bb-neutral-bg" label="bg"/>
          <Swatch varname="--bb-neutral-border" label="border"/>
          <Swatch varname="--bb-neutral" label="text"/>
        </DSRow>
      </div>

      {/* ── Typography ──────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Typography</h2>
        <p className="desc">Inter — single family. Mono cho mã đơn, SKU, ID. Quy tắc đọc trên desktop: body 13.5px, label 12px, heading 22px.</p>

        {[
          ["Heading XL — 28/700",    "var(--bb-text-3xl)", 700, "Tổng quan BigBike Motors"],
          ["Heading L — 22/700",     22,                   700, "Sản phẩm"],
          ["Heading M — 16/600",     16,                   600, "Thông tin cơ bản"],
          ["Body MD — 14.5/400",     "var(--bb-text-md)",  400, "Tên sản phẩm, mô tả ngắn, các nội dung dài đọc liên tục."],
          ["Body — 13.5/400",        "var(--bb-text-base)",400, "Dữ liệu trong bảng, label nội dung phụ."],
          ["Body SM — 12.5/400",     "var(--bb-text-sm)",  400, "Helper text, breadcrumb, secondary info."],
          ["Label — 12/600 uppercase","var(--bb-text-sm)", 600, "FIELD LABEL"],
          ["Mono — 12px",            12,                   500, "BB-25-04822 · K1S-DBL-RD-M"],
        ].map(([title, size, weight, sample]) => (
          <div key={title} className="bb-ds-row" style={{alignItems:"flex-start"}}>
            <div className="key">{title}</div>
            <div style={{fontSize:size, fontWeight:weight, color:"var(--bb-text)", fontFamily: title.startsWith("Mono") ? "var(--bb-font-mono)" : undefined, letterSpacing: typeof size === "number" && size >= 22 ? "-0.01em" : undefined}}>{sample}</div>
          </div>
        ))}
      </div>

      {/* ── Spacing / radius / shadow ───────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Spacing · Radius · Shadow</h2>
        <p className="desc">Spacing scale 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40. Radius small for data UI, medium for cards, pill for badges.</p>
        <DSRow k="Spacing">
          {[4,8,12,16,20,24,32].map(n => (
            <div key={n} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
              <div style={{width:n, height:n, background:"var(--bb-brand)", borderRadius:2}}/>
              <div style={{fontSize:11, color:"var(--bb-text-muted)", fontFamily:"var(--bb-font-mono)"}}>{n}</div>
            </div>
          ))}
        </DSRow>
        <DSRow k="Radius">
          {[["xs","4px"],["sm","6px"],["md","8px"],["lg","12px"],["pill","999"]].map(([name, val]) => (
            <div key={name} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
              <div style={{width:48, height:32, background:"var(--bb-brand-subtle)", border:"1px solid rgba(232,40,30,0.18)", borderRadius: val === "999" ? 999 : val}}/>
              <div style={{fontSize:11, color:"var(--bb-text-muted)", fontFamily:"var(--bb-font-mono)"}}>{name} · {val}</div>
            </div>
          ))}
        </DSRow>
        <DSRow k="Elevation">
          {[["xs","var(--bb-sh-xs)"],["sm","var(--bb-sh-sm)"],["md","var(--bb-sh-md)"],["lg","var(--bb-sh-lg)"]].map(([name, val]) => (
            <div key={name} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
              <div style={{width:80, height:48, background:"var(--bb-surface)", borderRadius:6, boxShadow:val, border:"1px solid var(--bb-border-faint)"}}/>
              <div style={{fontSize:11, color:"var(--bb-text-muted)", fontFamily:"var(--bb-font-mono)"}}>{name}</div>
            </div>
          ))}
        </DSRow>
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Buttons</h2>
        <p className="desc">Primary cho hành động chính trên màn; secondary cho hành động phụ; ghost cho inline/utility; danger cho thao tác phá huỷ. Mỗi màn chỉ 1 primary.</p>

        <DSRow k="Primary">
          <button className="bb-btn bb-btn-primary">Lưu thay đổi</button>
          <button className="bb-btn bb-btn-primary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>Tạo mới</button>
          <button className="bb-btn bb-btn-primary" disabled>Đang lưu…</button>
        </DSRow>
        <DSRow k="Secondary">
          <button className="bb-btn bb-btn-secondary">Huỷ</button>
          <button className="bb-btn bb-btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6M5 21h14"/></svg>Export CSV</button>
        </DSRow>
        <DSRow k="Ghost">
          <button className="bb-btn bb-btn-ghost">Xoá bộ lọc</button>
          <button className="bb-btn bb-btn-ghost">Xem tất cả →</button>
        </DSRow>
        <DSRow k="Danger">
          <button className="bb-btn bb-btn-danger">Huỷ đơn hàng</button>
          <button className="bb-btn bb-btn-danger-ghost">Xoá vĩnh viễn</button>
        </DSRow>
        <DSRow k="Size">
          <button className="bb-btn bb-btn-primary bb-btn-sm">Small</button>
          <button className="bb-btn bb-btn-primary">Default</button>
          <button className="bb-btn bb-btn-primary bb-btn-lg">Large</button>
        </DSRow>
        <DSRow k="Icon button">
          <button className="bb-icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
          <button className="bb-icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg></button>
          <button className="bb-row-action"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
        </DSRow>
      </div>

      {/* ── Badges ──────────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Status badges</h2>
        <p className="desc">Mỗi loại trạng thái phải dùng cùng pattern: pill, có dot, tone phù hợp ngữ nghĩa. Không invent màu — chỉ chọn từ palette dưới.</p>

        <DSRow k="Đơn hàng">
          <span className="bb-badge bb-badge-warning"><span className="dot"/>Chờ xác nhận</span>
          <span className="bb-badge bb-badge-info"><span className="dot"/>Đang xử lý</span>
          <span className="bb-badge bb-badge-neutral"><span className="dot"/>Tạm giữ</span>
          <span className="bb-badge bb-badge-success"><span className="dot"/>Hoàn thành</span>
          <span className="bb-badge bb-badge-neutral"><span className="dot"/>Đã huỷ</span>
          <span className="bb-badge bb-badge-danger"><span className="dot"/>Thất bại</span>
          <span className="bb-badge bb-badge-neutral"><span className="dot"/>Đã hoàn tiền</span>
        </DSRow>
        <DSRow k="Thanh toán">
          <span className="bb-badge bb-badge-success"><span className="dot"/>Đã thanh toán</span>
          <span className="bb-badge bb-badge-warning"><span className="dot"/>Chưa thanh toán</span>
          <span className="bb-badge bb-badge-danger"><span className="dot"/>Thất bại</span>
        </DSRow>
        <DSRow k="Tồn kho">
          <span className="bb-badge bb-badge-success"><span className="dot"/>Còn hàng</span>
          <span className="bb-badge bb-badge-warning"><span className="dot"/>Sắp hết</span>
          <span className="bb-badge bb-badge-danger"><span className="dot"/>Hết hàng</span>
        </DSRow>
        <DSRow k="Xuất bản">
          <span className="bb-badge bb-badge-success"><span className="dot"/>Đã xuất bản</span>
          <span className="bb-badge bb-badge-neutral"><span className="dot"/>Nháp</span>
          <span className="bb-badge bb-badge-neutral"><span className="dot"/>Ẩn</span>
        </DSRow>
        <DSRow k="Công nợ">
          <span className="bb-badge bb-badge-warning"><span className="dot"/>Còn nợ</span>
          <span className="bb-badge bb-badge-danger"><span className="dot"/>Quá hạn</span>
          <span className="bb-badge bb-badge-success"><span className="dot"/>Đã thanh toán</span>
        </DSRow>
      </div>

      {/* ── Form controls ───────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Form controls</h2>
        <p className="desc">Label luôn nằm trên control. Required đánh dấu bằng dấu (*) đỏ. Helper text nằm dưới. Error thay thế helper text, viền chuyển đỏ.</p>

        <div className="bb-grid-2" style={{gap:24, maxWidth:780}}>
          <div className="bb-field">
            <label className="bb-label">Tên sản phẩm <span className="req">*</span></label>
            <input className="bb-input" defaultValue="Nón fullface AGV K1S Diablo"/>
            <div className="bb-help">Hiển thị trên trang chi tiết</div>
          </div>
          <div className="bb-field">
            <label className="bb-label">Slug <span className="req">*</span></label>
            <input className="bb-input error" defaultValue="non fullface"/>
            <div className="bb-help error">Slug chỉ gồm chữ thường, số và dấu gạch ngang.</div>
          </div>
          <div className="bb-field">
            <label className="bb-label">Danh mục <span className="req">*</span></label>
            <select className="bb-select"><option>Nón bảo hiểm fullface</option></select>
          </div>
          <div className="bb-field">
            <label className="bb-label">Mô tả ngắn</label>
            <textarea className="bb-textarea" rows={2} defaultValue="Nón fullface AGV K1S phiên bản Diablo Red."/>
            <div className="bb-help">Tối thiểu 20 ký tự</div>
          </div>
          <div className="bb-field">
            <label className="bb-label">Chế độ</label>
            <div className="bb-row" style={{gap:16, fontSize:13}}>
              <label className="bb-row" style={{gap:6, cursor:"pointer"}}><input type="radio" name="m" defaultChecked className="bb-radio"/>Auto</label>
              <label className="bb-row" style={{gap:6, cursor:"pointer"}}><input type="radio" name="m" className="bb-radio"/>Thủ công</label>
              <label className="bb-row" style={{gap:6, cursor:"pointer"}}><input type="radio" name="m" className="bb-radio"/>Tắt</label>
            </div>
          </div>
          <div className="bb-field">
            <label className="bb-label">Khoá bán</label>
            <div className="bb-row" style={{gap:10, fontSize:13}}>
              <label className="bb-switch"><input type="checkbox"/><span className="track"/><span className="thumb"/></label>
              <span className="bb-muted">Sản phẩm vẫn xuất bản nhưng khách không đặt được</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>KPI summary cards</h2>
        <p className="desc">4 hoặc 6 cột trên dashboard. Có thể click để filter table xuống. Trend pill xanh/đỏ — không vẽ chart nhỏ thừa.</p>
        <div className="bb-kpi-grid">
          <button className="bb-kpi">
            <div className="bb-kpi-head">Doanh thu hôm nay <span className="bb-kpi-icon brand"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span></div>
            <div className="bb-kpi-value">₫ 48.250.000</div>
            <div className="bb-kpi-trend up">▲ 12,4% so hôm qua</div>
          </button>
          <button className="bb-kpi">
            <div className="bb-kpi-head">Đơn chờ xử lý <span className="bb-kpi-icon warning"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span></div>
            <div className="bb-kpi-value">12</div>
            <div className="bb-kpi-trend bb-muted">cần xử lý ngay</div>
          </button>
          <button className="bb-kpi">
            <div className="bb-kpi-head">Tồn kho cảnh báo <span className="bb-kpi-icon danger"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span></div>
            <div className="bb-kpi-value" style={{color:"var(--bb-danger)"}}>8</div>
            <div className="bb-kpi-trend down">▼ Tăng 2 mã</div>
          </button>
        </div>
      </div>

      {/* ── Tables ──────────────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Data table</h2>
        <p className="desc">Header uppercase 11.5px, body 13px, row-height 44px. Hover row sáng nhẹ. Mỗi row có hover-only action cells nếu cần.</p>

        <div className="bb-seg" style={{marginBottom:12}}>
          {["Tất cả","Chờ xác nhận","Đang xử lý","Hoàn thành"].map(t => (
            <button key={t} className={tabSel===t?"active":""} onClick={()=>setTabSel(t)}>{t} <span className="count">{t==="Tất cả"?248: t==="Chờ xác nhận"?12 : t==="Đang xử lý"?42:168}</span></button>
          ))}
        </div>

        <div className="bb-table-wrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th className="col-checkbox"><input type="checkbox" className="bb-checkbox"/></th>
                <th className="sortable active">Mã đơn <span className="sort-ind">↓</span></th>
                <th>Khách hàng</th>
                <th className="num">Tổng tiền</th>
                <th>Trạng thái</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["BB-25-04823","Nguyễn Văn B", 4_250_000, "info", "Đang xử lý"],
                ["BB-25-04822","Trần Thị C",   12_900_000,"warning","Chờ xác nhận"],
                ["BB-25-04821","Lê Văn D",      890_000, "success","Hoàn thành"],
              ].map(([id, cust, amt, tone, label],i)=>(
                <tr key={i}>
                  <td className="col-checkbox"><input type="checkbox" className="bb-checkbox"/></td>
                  <td className="mono"><a style={{color:"var(--bb-brand)", cursor:"pointer"}}>{id}</a></td>
                  <td className="bb-cell-strong">{cust}</td>
                  <td className="num">₫ {amt.toLocaleString("vi-VN")}</td>
                  <td><span className={`bb-badge bb-badge-${tone}`}><span className="dot"/>{label}</span></td>
                  <td className="col-actions">
                    <button className="bb-row-action"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button className="bb-row-action"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bb-table-foot">
            <div>Hiển thị 1–3 / 248</div>
            <div className="bb-pagination">
              <button disabled>‹</button>
              <button className="active">1</button>
              <button>2</button>
              <button>3</button>
              <button>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts & toasts ─────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Inline alerts & toasts</h2>
        <p className="desc">Inline alert dùng cho cảnh báo trong page (vd checklist chưa hoàn thành). Toast cho feedback transient sau thao tác.</p>

        <div className="bb-alert info"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><div className="alert-body"><span className="alert-title">Thông tin:</span> Sao lưu tự động cuối: 26/05 02:00.</div></div>
        <div className="bb-alert success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg><div className="alert-body"><span className="alert-title">Đã lưu:</span> Cập nhật sản phẩm thành công.</div></div>
        <div className="bb-alert warning"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg><div className="alert-body"><span className="alert-title">Cảnh báo:</span> Còn 2 mục SEO chưa hoàn chỉnh.</div></div>
        <div className="bb-alert danger"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><div className="alert-body"><span className="alert-title">Lỗi:</span> API trả về 500 — vui lòng thử lại.</div></div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:16, maxWidth:780}}>
          {[
            ["success", "Đã lưu thay đổi", "Cập nhật sản phẩm thành công."],
            ["warning", "Cảnh báo tồn kho", "8 SKU đang dưới ngưỡng cảnh báo."],
            ["danger",  "Lỗi xác nhận đơn", "API trả về 500 — vui lòng thử lại."],
            ["info",    "Đơn hàng mới",    "BB-25-04824 vừa được tạo."],
          ].map(([tone, title, msg]) => (
            <div key={tone} className={`bb-toast ${tone}`} style={{position:"static", boxShadow:"none"}}>
              <span className="toast-icon">●</span>
              <div className="toast-body">
                <p className="toast-title">{title}</p>
                <p className="toast-msg">{msg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Empty / loading / error states ─────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Empty · Loading · Error states</h2>
        <p className="desc">Mọi danh sách dữ liệu phải có 3 state này. Empty state phải có CTA hoặc gợi ý hành động kế tiếp.</p>

        <div className="bb-grid-3">
          <div className="bb-state">
            <div className="bb-state-icon info">⌕</div>
            <h4>Không tìm thấy kết quả</h4>
            <p>Thử thay đổi điều kiện lọc hoặc tạo mới.</p>
            <button className="bb-btn bb-btn-secondary bb-btn-sm">Xoá bộ lọc</button>
          </div>
          <div className="bb-state">
            <div className="bb-skeleton" style={{width:"60%", height:14, marginBottom:8}}/>
            <div className="bb-skeleton" style={{width:"80%", height:14, marginBottom:6}}/>
            <div className="bb-skeleton" style={{width:"40%", height:14}}/>
          </div>
          <div className="bb-state">
            <div className="bb-state-icon danger">!</div>
            <h4>Lỗi tải dữ liệu</h4>
            <p>Không thể kết nối tới API. Vui lòng kiểm tra mạng và thử lại.</p>
            <button className="bb-btn bb-btn-primary bb-btn-sm">Thử lại</button>
          </div>
        </div>
      </div>

      {/* ── Confirm dialog ─────────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Confirm dialog</h2>
        <p className="desc">Mọi thao tác phá huỷ (huỷ đơn, xoá sản phẩm, hoàn tiền) bắt buộc qua confirm. Tiêu đề phải nêu rõ đối tượng và hậu quả.</p>

        <div className="bb-modal" style={{position:"static", boxShadow:"var(--bb-sh-sm)", maxWidth:480}}>
          <div className="bb-modal-header">
            <h3>Huỷ đơn hàng BB-25-04822?</h3>
            <p>Đơn sẽ chuyển sang trạng thái "Đã huỷ" và không thể hoàn tác.</p>
          </div>
          <div className="bb-modal-body">
            <label className="bb-label">Lý do huỷ <span className="req">*</span></label>
            <select className="bb-select" style={{marginTop:6}}>
              <option>— Chọn lý do —</option>
              <option>Khách yêu cầu huỷ</option>
            </select>
          </div>
          <div className="bb-modal-footer">
            <button className="bb-btn bb-btn-ghost">Đóng</button>
            <button className="bb-btn bb-btn-danger">Huỷ đơn hàng</button>
          </div>
        </div>
      </div>

      {/* ── Layout principles ──────────────────────────────────────── */}
      <div className="bb-ds-section">
        <h2>Layout shell</h2>
        <p className="desc">Sidebar 248px (luôn cố định trên desktop), topbar 52px, content gutter 24px. Mọi screen mở ra trong main; modal chỉ cho confirm/picker, không cho form chính.</p>

        <div style={{display:"grid", gridTemplateColumns:"180px 1fr", gap:8, border:"1px solid var(--bb-border)", borderRadius:8, overflow:"hidden", maxWidth:780}}>
          <div style={{background:"var(--bb-sidebar)", color:"#c9d1d9", padding:14, fontSize:11}}>
            <div style={{color:"#fff", fontWeight:700, marginBottom:10}}>BigBike Admin</div>
            <div style={{opacity:0.6, fontSize:9.5, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4}}>Bán hàng</div>
            <div style={{padding:"4px 6px", background:"#20293a", borderRadius:4, color:"#fff", marginBottom:2}}>● Tổng quan</div>
            <div style={{padding:"4px 6px"}}>○ Đơn hàng</div>
            <div style={{padding:"4px 6px"}}>○ Khách hàng</div>
            <div style={{opacity:0.6, fontSize:9.5, letterSpacing:"0.08em", textTransform:"uppercase", margin:"10px 0 4px"}}>Sản phẩm</div>
            <div style={{padding:"4px 6px"}}>○ Sản phẩm</div>
            <div style={{padding:"4px 6px"}}>○ Kho hàng</div>
          </div>
          <div>
            <div style={{height:28, background:"var(--bb-surface)", borderBottom:"1px solid var(--bb-border)", display:"flex", alignItems:"center", padding:"0 10px", fontSize:10, color:"var(--bb-text-muted)"}}>⌕ Tìm kiếm · Live · 🔔 · 👤 NA</div>
            <div style={{height:22, background:"var(--bb-page)", borderBottom:"1px solid var(--bb-border-faint)", display:"flex", alignItems:"center", padding:"0 10px", fontSize:10, color:"var(--bb-text-muted)"}}>Tổng quan / Đơn hàng / Chi tiết</div>
            <div style={{padding:14}}>
              <div style={{fontSize:14, fontWeight:700, marginBottom:2}}>Page title</div>
              <div style={{fontSize:10.5, color:"var(--bb-text-muted)"}}>Page description</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginTop:10}}>
                {[1,2,3].map(i=> <div key={i} style={{height:36, background:"var(--bb-surface-raised)", borderRadius:4}}/>)}
              </div>
              <div style={{height:80, background:"var(--bb-surface-raised)", borderRadius:4, marginTop:6}}/>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

window.DesignSystem = DesignSystem;
