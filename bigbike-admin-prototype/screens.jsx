/* global React */
// ─────────────────────────────────────────────────────────────────────────
// screens.jsx — high-fidelity screen mocks for BigBike Admin redesign
// All copy is Vietnamese, lifted from src/locales/vi.json terminology.
// Screens are static snapshots of real routes that exist in App.jsx —
// no invented modules.
// ─────────────────────────────────────────────────────────────────────────

const { useState, useMemo, useEffect } = React;

// ── Tiny icon helpers (lucide-style stroke) ─────────────────────────────
const Icon = ({ d, size = 14, stroke = 1.75, fill = "none", children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children || (typeof d === "string" ? <path d={d} /> : d)}
  </svg>
);
const I = {
  search:    (p) => <Icon size={p?.size||14}><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></Icon>,
  plus:      (p) => <Icon size={p?.size||14}><path d="M12 5v14M5 12h14"/></Icon>,
  download:  (p) => <Icon size={p?.size||14}><path d="M12 3v12M6 11l6 6 6-6M5 21h14"/></Icon>,
  upload:    (p) => <Icon size={p?.size||14}><path d="M12 21V9M6 13l6-6 6 6M5 3h14"/></Icon>,
  more:      (p) => <Icon size={p?.size||14}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></Icon>,
  edit:      (p) => <Icon size={p?.size||14}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></Icon>,
  trash:     (p) => <Icon size={p?.size||14}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></Icon>,
  filter:    (p) => <Icon size={p?.size||14}><path d="M3 6h18M6 12h12M10 18h4"/></Icon>,
  check:     (p) => <Icon size={p?.size||14}><path d="M20 6 9 17l-5-5"/></Icon>,
  x:         (p) => <Icon size={p?.size||14}><path d="M18 6 6 18M6 6l12 12"/></Icon>,
  chevDown:  (p) => <Icon size={p?.size||14}><path d="m6 9 6 6 6-6"/></Icon>,
  chevLeft:  (p) => <Icon size={p?.size||14}><path d="m15 18-6-6 6-6"/></Icon>,
  chevRight: (p) => <Icon size={p?.size||14}><path d="m9 18 6-6-6-6"/></Icon>,
  bell:      (p) => <Icon size={p?.size||14}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/></Icon>,
  user:      (p) => <Icon size={p?.size||14}><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></Icon>,
  package:   (p) => <Icon size={p?.size||14}><path d="m7.5 4.27 9 5.15M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></Icon>,
  cart:      (p) => <Icon size={p?.size||14}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></Icon>,
  dollar:    (p) => <Icon size={p?.size||14}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Icon>,
  clock:     (p) => <Icon size={p?.size||14}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Icon>,
  alert:     (p) => <Icon size={p?.size||14}><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></Icon>,
  trend:     (p) => <Icon size={p?.size||14}><path d="m22 7-9.5 9.5-5-5L1 18"/><path d="M16 7h6v6"/></Icon>,
  trendDown: (p) => <Icon size={p?.size||14}><path d="m22 17-9.5-9.5-5 5L1 6"/><path d="M16 17h6v-6"/></Icon>,
  sort:      (p) => <Icon size={p?.size||14}><path d="m8 6 4-4 4 4M16 18l-4 4-4-4"/></Icon>,
  refresh:   (p) => <Icon size={p?.size||14}><path d="M21 12a9 9 0 0 1-15.5 6.3L1 14"/><path d="M3 12a9 9 0 0 1 15.5-6.3L23 10"/><path d="M23 4v6h-6M1 20v-6h6"/></Icon>,
  eye:       (p) => <Icon size={p?.size||14}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></Icon>,
  copy:      (p) => <Icon size={p?.size||14}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Icon>,
  print:     (p) => <Icon size={p?.size||14}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></Icon>,
  star:      (p) => <Icon size={p?.size||14} fill={p?.filled ? "currentColor" : "none"}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>,
};

// ── Status badge map ─────────────────────────────────────────────────────
const STATUS = {
  // Order
  PENDING:    { label: "Chờ xác nhận",  tone: "warning" },
  PROCESSING: { label: "Đang xử lý",    tone: "info" },
  ON_HOLD:    { label: "Tạm giữ",       tone: "neutral" },
  COMPLETED:  { label: "Hoàn thành",    tone: "success" },
  CANCELLED:  { label: "Đã huỷ",        tone: "neutral" },
  FAILED:     { label: "Thất bại",      tone: "danger" },
  REFUNDED:   { label: "Đã hoàn tiền",  tone: "neutral" },
  // Payment
  PAID:       { label: "Đã thanh toán", tone: "success" },
  UNPAID:     { label: "Chưa thanh toán", tone: "warning" },
  SUCCEEDED:  { label: "Thành công",    tone: "success" },
  // Stock
  IN_STOCK:   { label: "Còn hàng",      tone: "success" },
  LOW_STOCK:  { label: "Sắp hết",       tone: "warning" },
  OUT_OF_STOCK:{label: "Hết hàng",      tone: "danger" },
  // Publish
  PUBLISHED:  { label: "Đã xuất bản",   tone: "success" },
  DRAFT:      { label: "Nháp",          tone: "neutral" },
  HIDDEN:     { label: "Ẩn",            tone: "neutral" },
  // Customer
  ACTIVE:     { label: "Hoạt động",     tone: "success" },
  DISABLED:   { label: "Tạm khoá",      tone: "neutral" },
  // Receivables
  OPEN:       { label: "Còn nợ",        tone: "warning" },
  OVERDUE:    { label: "Quá hạn",       tone: "danger" },
  PAID_FULL:  { label: "Đã thanh toán", tone: "success" },
};
const Badge = ({ status, label, tone }) => {
  const s = status ? STATUS[status] : { label, tone };
  if (!s) return <span className="bb-badge bb-badge-neutral">{status || label}</span>;
  return (
    <span className={`bb-badge bb-badge-${s.tone}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
};

// ── Inline pieces ────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }) => (
  <label className="bb-label">{children}{required && <span className="req">*</span>}</label>
);

const Field = ({ label, required, help, error, children }) => (
  <div className="bb-field">
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    {children}
    {(help || error) && <div className={"bb-help" + (error ? " error" : "")}>{error || help}</div>}
  </div>
);

const PageHeader = ({ eyebrow, title, desc, actions }) => (
  <div className="bb-screen-header">
    <div className="bb-screen-title">
      {eyebrow && <div style={{fontSize:11, fontWeight:600, color:"var(--bb-text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4}}>{eyebrow}</div>}
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
    {actions && <div className="bb-screen-actions">{actions}</div>}
  </div>
);

const Pagination = ({ page = 1, total = 5 }) => (
  <div className="bb-pagination">
    <button disabled={page<=1}><I.chevLeft /></button>
    {Array.from({length: Math.min(total,5)}, (_,i)=>i+1).map(p =>
      <button key={p} className={p===page?"active":""}>{p}</button>
    )}
    {total>5 && <span className="bb-muted" style={{padding:"0 4px"}}>… {total}</span>}
    <button disabled={page>=total}><I.chevRight /></button>
  </div>
);

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════
function DashboardScreen() {
  return (
    <div data-screen-label="Dashboard">
      <PageHeader
        eyebrow="Tổng quan"
        title="Chào buổi chiều, Nguyễn Văn An 👋"
        desc="Hôm nay là Thứ ba, 26/05/2026. Đây là tình hình kinh doanh của BigBike."
        actions={
          <>
            <div className="bb-seg">
              <button>7 ngày</button>
              <button className="active">30 ngày</button>
              <button>90 ngày</button>
            </div>
            <button className="bb-btn bb-btn-secondary"><I.refresh /> Làm mới</button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="bb-kpi-grid">
        <button className="bb-kpi">
          <div className="bb-kpi-head">Doanh thu hôm nay <span className="bb-kpi-icon brand"><I.dollar size={14}/></span></div>
          <div className="bb-kpi-value">₫ 48.250.000</div>
          <div className="bb-kpi-trend up"><I.trend size={11}/> Tăng 12,4% so hôm qua</div>
        </button>
        <button className="bb-kpi">
          <div className="bb-kpi-head">Đơn hàng hôm nay <span className="bb-kpi-icon info"><I.cart size={14}/></span></div>
          <div className="bb-kpi-value">37</div>
          <div className="bb-kpi-trend up"><I.trend size={11}/> Thêm 5 đơn so hôm qua</div>
        </button>
        <button className="bb-kpi">
          <div className="bb-kpi-head">Đơn chờ xử lý <span className="bb-kpi-icon warning"><I.clock size={14}/></span></div>
          <div className="bb-kpi-value">12</div>
          <div className="bb-kpi-trend"><span className="bb-muted">cần xử lý ngay</span></div>
        </button>
        <button className="bb-kpi">
          <div className="bb-kpi-head">Sản phẩm đang bán <span className="bb-kpi-icon success"><I.package size={14}/></span></div>
          <div className="bb-kpi-value">486</div>
          <div className="bb-kpi-trend"><span className="bb-muted">đang xuất bản</span></div>
        </button>
        <button className="bb-kpi">
          <div className="bb-kpi-head">Tồn kho cảnh báo <span className="bb-kpi-icon danger"><I.alert size={14}/></span></div>
          <div className="bb-kpi-value">8</div>
          <div className="bb-kpi-trend down"><I.trendDown size={11}/> Tăng 2 mã so hôm qua</div>
        </button>
        <button className="bb-kpi">
          <div className="bb-kpi-head">Công nợ quá hạn <span className="bb-kpi-icon warning"><I.alert size={14}/></span></div>
          <div className="bb-kpi-value">₫ 12.4M</div>
          <div className="bb-kpi-trend"><span className="bb-muted">4 phiếu quá hạn</span></div>
        </button>
      </div>

      {/* Việc cần xử lý */}
      <div className="bb-card" style={{marginBottom:16}}>
        <div className="bb-card-header">
          <div>
            <h3>Việc cần xử lý</h3>
            <p>Các đầu việc đang chờ bạn quyết định</p>
          </div>
          <span className="bb-badge bb-badge-warning"><span className="dot"/>4 đầu việc</span>
        </div>
        <div className="bb-card-body" style={{padding:0}}>
          {[
            {sev:"danger", label:"Đơn chờ xác nhận", value:"12 đơn", hint:"Đơn mới chưa được xác nhận, có 3 đơn quá 4 giờ", action:"Xử lý ngay"},
            {sev:"danger", label:"Công nợ quá hạn", value:"4 phiếu", hint:"Đã quá hạn — ₫ 12.400.000", action:"Xử lý ngay"},
            {sev:"warn",   label:"Đổi trả chờ duyệt", value:"3 yêu cầu", hint:"Khách yêu cầu xử lý — chờ 2 ngày", action:"Xem yêu cầu"},
            {sev:"warn",   label:"Tồn kho cảnh báo", value:"8 mã hàng", hint:"Sắp hết hoặc đã hết — Xem chi tiết kho", action:"Mở danh sách"},
          ].map((row,i)=>(
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:16,
              padding:"12px 16px",
              borderBottom: i<3 ? "1px solid var(--bb-border-faint)" : "0",
            }}>
              <span className={`bb-badge bb-badge-${row.sev === 'danger' ? 'danger':'warning'}`} style={{minWidth:60, justifyContent:"center"}}>
                {row.sev === 'danger' ? 'Khẩn' : 'Cần lưu ý'}
              </span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:600, fontSize:13, marginBottom:2}}>{row.label} · <span style={{color: row.sev==='danger'?'var(--bb-danger)':'var(--bb-warning)'}}>{row.value}</span></div>
                <div style={{fontSize:12, color:"var(--bb-text-muted)"}}>{row.hint}</div>
              </div>
              <button className="bb-btn bb-btn-secondary bb-btn-sm">{row.action} <I.chevRight size={12}/></button>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue chart + pie */}
      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:16}} className="dash-charts">
        <div className="bb-card">
          <div className="bb-card-header">
            <div>
              <h3>Doanh thu theo ngày</h3>
              <p>Đơn vị: triệu ₫ · 30 ngày qua</p>
            </div>
            <div className="bb-row" style={{gap:12, fontSize:12}}>
              <span className="bb-row" style={{gap:6}}><span style={{width:10,height:10,borderRadius:2,background:"var(--bb-brand)"}}/>Doanh thu</span>
              <span className="bb-row" style={{gap:6}}><span style={{width:10,height:10,borderRadius:2,background:"var(--bb-info)"}}/>Đơn</span>
            </div>
          </div>
          <div className="bb-card-body">
            <RevenueChart />
          </div>
        </div>

        <div className="bb-card">
          <div className="bb-card-header">
            <div>
              <h3>Cơ cấu đơn hàng</h3>
              <p>Tổng 248 đơn · 30 ngày</p>
            </div>
          </div>
          <div className="bb-card-body">
            <Donut />
            <div style={{marginTop:16, display:"flex", flexDirection:"column", gap:6, fontSize:12.5}}>
              {[
                ["Hoàn thành", 168, "var(--bb-success)"],
                ["Đang xử lý", 42,  "var(--bb-info)"],
                ["Chờ xác nhận", 12, "var(--bb-warning)"],
                ["Đã huỷ", 18,      "var(--bb-text-muted)"],
                ["Thất bại", 8,     "var(--bb-danger)"],
              ].map(([name,n,c]) => (
                <div key={name} className="bb-row" style={{justifyContent:"space-between"}}>
                  <span className="bb-row" style={{gap:8}}>
                    <span style={{width:8,height:8,borderRadius:2,background:c}}/>{name}
                  </span>
                  <span className="bb-muted" style={{fontVariantNumeric:"tabular-nums"}}>{n} đơn · {Math.round(n/248*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders + Top products */}
      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16}} className="dash-bottom">
        <div className="bb-card">
          <div className="bb-card-header">
            <div><h3>Đơn hàng gần nhất</h3></div>
            <button className="bb-btn bb-btn-ghost bb-btn-sm">Xem tất cả <I.chevRight size={11}/></button>
          </div>
          <table className="bb-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th className="num">Tổng tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["BB-25-04823","Nguyễn Văn B", 4_250_000, "PROCESSING"],
                ["BB-25-04822","Trần Thị C",   12_900_000,"PENDING"],
                ["BB-25-04821","Lê Văn D",      890_000,  "COMPLETED"],
                ["BB-25-04820","Phạm Quốc E",  2_150_000, "COMPLETED"],
                ["BB-25-04819","Hoàng Thị F",  18_300_000,"PROCESSING"],
                ["BB-25-04818","Vũ Văn G",       650_000, "CANCELLED"],
              ].map(([id,cust,amt,st],i)=>(
                <tr key={i}>
                  <td className="mono">{id}</td>
                  <td>{cust}</td>
                  <td className="num">₫ {amt.toLocaleString("vi-VN")}</td>
                  <td><Badge status={st}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bb-card">
          <div className="bb-card-header">
            <div><h3>Sản phẩm bán chạy</h3></div>
            <button className="bb-btn bb-btn-ghost bb-btn-sm">Xem tất cả <I.chevRight size={11}/></button>
          </div>
          <div style={{padding:"4px 8px 12px"}}>
            {[
              ["Nón fullface AGV K1S Diablo", "K1S-DBL-RD-M", 32, 19_200_000],
              ["Găng tay Five RFX2 Carbon",   "F-RFX2-BLK-L",  24,  6_840_000],
              ["Áo giáp Komine JK-006",       "JK006-XL",      18, 10_800_000],
              ["Yếm cổ Komine AK-022",        "AK022-FREE",    14,    980_000],
              ["Giày Sidi Crossfire 3",       "SDI-CF3-42",     9, 13_500_000],
            ].map(([name, sku, units, rev], i) => (
              <div key={i} style={{
                display:"grid",
                gridTemplateColumns:"24px 1fr auto",
                gap:10, alignItems:"center",
                padding:"8px 4px",
                borderBottom: i<4 ? "1px solid var(--bb-border-faint)" : "0",
              }}>
                <div style={{
                  width:22, height:22, borderRadius:6,
                  background: i===0?"#fef3c7": i===1?"#f3f4f6": i===2?"#ffedd5": "var(--bb-surface-raised)",
                  color: i===0?"#d97706": i===1?"#6b7280": i===2?"#c2410c": "var(--bb-text-muted)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                }}>{i+1}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12.5, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:11, color:"var(--bb-text-muted)", fontFamily:"var(--bb-font-mono)"}}>{sku}</div>
                </div>
                <div style={{textAlign:"right", fontSize:12, fontVariantNumeric:"tabular-nums"}}>
                  <div style={{fontWeight:600}}>{units} đơn vị</div>
                  <div className="bb-muted">₫ {(rev/1_000_000).toFixed(1)}M</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini SVG chart (no recharts to keep prototype self-contained)
function RevenueChart() {
  const data = [22,28,30,26,34,42,38,32,40,52,48,44,50,58,62,54,60,68,72,64,70,78,72,80,88,82,90,84,96,104];
  const max = Math.max(...data);
  const w = 720, h = 220, pad = 28;
  const stepX = (w - pad*2) / (data.length-1);
  const pts = data.map((v,i)=>`${pad+i*stepX},${h-pad-(v/max)*(h-pad*2)}`).join(" ");
  const area = `M${pad},${h-pad} L${pts.replaceAll(" "," L")} L${pad+(data.length-1)*stepX},${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="220" style={{display:"block"}}>
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8281e" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#e8281e" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0,1,2,3,4].map(i => {
        const y = pad + ((h-pad*2)/4)*i;
        return <line key={i} x1={pad} y1={y} x2={w-pad} y2={y} stroke="var(--bb-border-faint)" strokeDasharray="2 4"/>;
      })}
      {/* x labels */}
      {data.map((_,i)=> i%5===0 && (
        <text key={i} x={pad+i*stepX} y={h-8} fontSize="10" fill="var(--bb-text-muted)" textAnchor="middle">{i+1}/05</text>
      ))}
      {/* y labels (millions) */}
      {[0,1,2,3,4].map(i => {
        const y = h-pad - ((h-pad*2)/4)*i;
        const v = Math.round(max*(i/4));
        return <text key={i} x={6} y={y+3} fontSize="10" fill="var(--bb-text-muted)">{v}</text>;
      })}
      <path d={area} fill="url(#rev-grad)"/>
      <polyline points={pts} fill="none" stroke="#e8281e" strokeWidth="2"/>
      {data.map((v,i)=>(
        <circle key={i} cx={pad+i*stepX} cy={h-pad-(v/max)*(h-pad*2)} r={i===data.length-1?3:0} fill="#e8281e"/>
      ))}
    </svg>
  );
}

function Donut() {
  const segs = [
    [168, "var(--bb-success)"],
    [42,  "var(--bb-info)"],
    [12,  "var(--bb-warning)"],
    [18,  "var(--bb-text-muted)"],
    [8,   "var(--bb-danger)"],
  ];
  const total = segs.reduce((a,[v])=>a+v,0);
  const r = 56, c = 70, circ = 2*Math.PI*r;
  let offset = 0;
  return (
    <div style={{display:"flex", justifyContent:"center", position:"relative"}}>
      <svg width="160" height="160" viewBox="0 0 140 140">
        {segs.map(([v,col],i) => {
          const len = (v/total)*circ;
          const el = (
            <circle key={i} cx={c} cy={c} r={r}
              fill="none" stroke={col} strokeWidth="18"
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}/>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{position:"absolute", top:0, bottom:0, left:0, right:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center"}}>
        <div style={{fontSize:22, fontWeight:700}}>248</div>
        <div style={{fontSize:11, color:"var(--bb-text-muted)"}}>Tổng đơn</div>
      </div>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;

// ════════════════════════════════════════════════════════════════════════
// ORDERS LIST
// ════════════════════════════════════════════════════════════════════════
function OrderListScreen({ navigate }) {
  const [tab, setTab] = useState("PENDING");
  const [selected, setSelected] = useState(new Set([1,3]));
  const rows = [
    ["BB-25-04823", "26/05 15:42", "Nguyễn Văn B", "0901 234 567", 4_250_000, "PROCESSING", "PAID",   "VNPAY",     "GHN"],
    ["BB-25-04822", "26/05 15:18", "Trần Thị C",   "0987 654 321", 12_900_000,"PENDING",    "UNPAID", "COD",       "—"],
    ["BB-25-04821", "26/05 14:55", "Lê Văn D",     "0902 111 222",   890_000, "COMPLETED",  "PAID",   "Momo",      "Tự lấy"],
    ["BB-25-04820", "26/05 14:32", "Phạm Quốc E",  "0987 333 444", 2_150_000, "COMPLETED",  "PAID",   "Tiền mặt",  "Tự lấy"],
    ["BB-25-04819", "26/05 13:20", "Hoàng Thị F",  "0911 222 333", 18_300_000,"PROCESSING", "PAID",   "Chuyển khoản","GHN"],
    ["BB-25-04818", "26/05 12:48", "Vũ Văn G",     "0918 555 666",   650_000, "CANCELLED",  "UNPAID", "COD",       "—"],
    ["BB-25-04817", "26/05 11:30", "Đỗ Thị H",     "0903 777 888", 3_400_000, "PENDING",    "UNPAID", "COD",       "GHTK"],
    ["BB-25-04816", "26/05 10:12", "Bùi Văn I",    "0905 999 000", 9_600_000, "ON_HOLD",    "PAID",   "VNPAY",     "Viettel Post"],
    ["BB-25-04815", "26/05 09:48", "Tô Thị K",     "0907 111 333",   480_000, "COMPLETED",  "PAID",   "Momo",      "GHN"],
    ["BB-25-04814", "26/05 09:22", "Mai Văn L",    "0908 444 555", 5_200_000, "PROCESSING", "UNPAID", "COD",       "GHN"],
  ];
  const toggleSel = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };
  return (
    <div data-screen-label="Đơn hàng">
      <PageHeader
        eyebrow="Bán hàng"
        title="Đơn hàng"
        desc="Quản lý đơn hàng online và POS"
        actions={
          <>
            <button className="bb-btn bb-btn-secondary"><I.download/> Export CSV</button>
            <button className="bb-btn bb-btn-primary"><I.plus/> Tạo đơn POS</button>
          </>
        }
      />

      {/* Status tabs */}
      <div className="bb-seg" style={{marginBottom:12, flexWrap:"wrap"}}>
        {[
          ["ALL","Tất cả",  248],
          ["PENDING","Chờ xác nhận", 12],
          ["PROCESSING","Đang xử lý", 42],
          ["ON_HOLD","Tạm giữ", 3],
          ["COMPLETED","Hoàn thành", 168],
          ["CANCELLED","Đã huỷ", 18],
          ["FAILED","Thất bại", 8],
          ["REFUNDED","Đã hoàn tiền", 4],
        ].map(([k,label,n])=>(
          <button key={k} className={tab===k?"active":""} onClick={()=>setTab(k)}>
            {label} <span className="count">{n}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder="Tìm mã đơn, tên khách, SĐT…" />
        </div>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả thanh toán</option>
          <option>Đã thanh toán</option>
          <option>Chưa thanh toán</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả vận chuyển</option>
          <option>GHN</option>
          <option>GHTK</option>
          <option>Viettel Post</option>
          <option>Tự lấy</option>
        </select>
        <button className="bb-btn bb-btn-secondary"><I.filter/> Lọc nâng cao</button>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Mới nhất</option>
          <option>Cũ nhất</option>
          <option>Giá trị cao nhất</option>
        </select>
        <button className="bb-btn bb-btn-ghost">Xoá bộ lọc</button>
      </div>

      {/* Table */}
      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th className="col-checkbox"><input type="checkbox" className="bb-checkbox"/></th>
              <th className="sortable active">Mã đơn <span className="sort-ind">↓</span></th>
              <th>Thời gian</th>
              <th>Khách hàng</th>
              <th className="num sortable">Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Thanh toán</th>
              <th>Vận chuyển</th>
              <th className="col-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className={selected.has(i)?"selected":""}>
                <td className="col-checkbox"><input type="checkbox" className="bb-checkbox" checked={selected.has(i)} onChange={()=>toggleSel(i)}/></td>
                <td>
                  <a className="bb-cell-strong" style={{color:"var(--bb-brand)", cursor:"pointer"}} onClick={() => navigate && navigate("order-detail")}>
                    {r[0]}
                  </a>
                </td>
                <td><div>{r[1].split(" ")[0]}</div><div className="bb-cell-sub">{r[1].split(" ")[1]}</div></td>
                <td><div className="bb-cell-strong">{r[2]}</div><div className="bb-cell-sub">{r[3]}</div></td>
                <td className="num bb-cell-strong">₫ {r[4].toLocaleString("vi-VN")}</td>
                <td><Badge status={r[5]}/></td>
                <td><Badge status={r[6]}/><div className="bb-cell-sub">{r[7]}</div></td>
                <td>{r[8]}</td>
                <td className="col-actions">
                  <button className="bb-row-action" title="Xem"><I.eye/></button>
                  <button className="bb-row-action" title="In"><I.print/></button>
                  <button className="bb-row-action" title="Thêm"><I.more/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bb-table-foot">
          <div>Hiển thị 1–10 / 248 đơn</div>
          <Pagination page={1} total={25}/>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bb-bulk-bar" style={{marginTop:12}}>
          <span className="count">Đã chọn {selected.size} đơn</span>
          <span className="sep"/>
          <button className="bulk-btn"><I.check size={12}/> Xác nhận đơn</button>
          <button className="bulk-btn"><I.print size={12}/> In phiếu giao</button>
          <button className="bulk-btn"><I.download size={12}/> Xuất CSV</button>
          <span className="sep"/>
          <button className="bulk-btn danger"><I.x size={12}/> Huỷ đơn</button>
          <span style={{flex:1}}/>
          <button className="bulk-btn" onClick={()=>setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}
    </div>
  );
}
window.OrderListScreen = OrderListScreen;

// ════════════════════════════════════════════════════════════════════════
// ORDER DETAIL
// ════════════════════════════════════════════════════════════════════════
function OrderDetailScreen({ navigate }) {
  const items = [
    ["Nón fullface AGV K1S Diablo", "K1S-DBL-RD-M",  1, 6_400_000],
    ["Găng tay Five RFX2 Carbon",   "F-RFX2-BLK-L",  2,   285_000],
    ["Áo giáp Komine JK-006",       "JK006-XL",      1, 4_800_000],
  ];
  const subtotal = items.reduce((s,r)=>s+r[2]*r[3], 0);
  const shipping = 45_000, discount = 320_000;
  return (
    <div data-screen-label="Chi tiết đơn hàng">
      <PageHeader
        eyebrow={<a style={{color:"inherit", cursor:"pointer"}} onClick={()=>navigate && navigate("orders")}>← Danh sách đơn</a>}
        title={<>Đơn hàng <span style={{fontFamily:"var(--bb-font-mono)", color:"var(--bb-text-muted)", fontSize:18}}>BB-25-04822</span></>}
        desc={<>Tạo lúc 15:18 · 26/05/2026 · Kênh <strong>BigBike.vn</strong></>}
        actions={
          <>
            <Badge status="PENDING"/>
            <button className="bb-btn bb-btn-secondary"><I.print/> In phiếu giao</button>
            <button className="bb-btn bb-btn-secondary"><I.copy/> Sao chép</button>
            <button className="bb-btn bb-btn-primary"><I.check/> Xác nhận đơn</button>
          </>
        }
      />

      {/* Status flow */}
      <div className="bb-card" style={{marginBottom:16}}>
        <div className="bb-card-body" style={{paddingTop:14, paddingBottom:14}}>
          <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:0, position:"relative"}}>
            {[
              ["Tạo đơn", "15:18", true,  "success"],
              ["Chờ xác nhận", "—", true,  "warning"],
              ["Đang xử lý", "—", false, "muted"],
              ["Giao vận", "—", false, "muted"],
              ["Hoàn thành", "—", false, "muted"],
            ].map(([label,time,done,tone],i,arr)=>(
              <div key={i} style={{position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6}}>
                {i<arr.length-1 && (
                  <div style={{position:"absolute", top:11, left:"calc(50% + 14px)", right:"calc(-50% + 14px)", height:2, background: done && arr[i+1][2] ? "var(--bb-success)":"var(--bb-border)"}}/>
                )}
                <div style={{
                  width:24, height:24, borderRadius:"50%",
                  background: tone==="success"?"var(--bb-success)":tone==="warning"?"var(--bb-warning)":"var(--bb-surface-raised)",
                  border: `2px solid ${tone==="success"?"var(--bb-success)":tone==="warning"?"var(--bb-warning)":"var(--bb-border-strong)"}`,
                  color: tone==="muted"?"var(--bb-text-muted)":"#fff",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11, fontWeight:700, zIndex:1,
                }}>{done ? "✓" : i+1}</div>
                <div style={{fontSize:12.5, fontWeight:600, color: tone==="muted"?"var(--bb-text-muted)":"var(--bb-text)"}}>{label}</div>
                <div style={{fontSize:11, color:"var(--bb-text-muted)"}}>{time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bb-detail-grid">
        {/* Left column */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>

          {/* Items */}
          <div className="bb-card">
            <div className="bb-card-header">
              <h3>Sản phẩm ({items.length})</h3>
              <button className="bb-btn bb-btn-ghost bb-btn-sm"><I.plus size={11}/> Thêm sản phẩm</button>
            </div>
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="num">Đơn giá</th>
                  <th className="num">SL</th>
                  <th className="num">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r,i)=>(
                  <tr key={i}>
                    <td>
                      <div className="bb-product-cell">
                        <div className="bb-product-thumb">{r[0].charAt(0)}</div>
                        <div>
                          <div className="bb-cell-strong">{r[0]}</div>
                          <div className="bb-cell-sub mono" style={{fontFamily:"var(--bb-font-mono)"}}>{r[1]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">₫ {r[3].toLocaleString("vi-VN")}</td>
                    <td className="num">{r[2]}</td>
                    <td className="num bb-cell-strong">₫ {(r[2]*r[3]).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{padding:"12px 16px", borderTop:"1px solid var(--bb-border-faint)", fontSize:13}}>
              <div className="bb-row" style={{justifyContent:"space-between", padding:"3px 0"}}>
                <span className="bb-muted">Tạm tính</span>
                <span className="num">₫ {subtotal.toLocaleString("vi-VN")}</span>
              </div>
              <div className="bb-row" style={{justifyContent:"space-between", padding:"3px 0"}}>
                <span className="bb-muted">Phí vận chuyển</span>
                <span className="num">₫ {shipping.toLocaleString("vi-VN")}</span>
              </div>
              <div className="bb-row" style={{justifyContent:"space-between", padding:"3px 0"}}>
                <span className="bb-muted">Giảm giá <span className="bb-badge bb-badge-brand" style={{marginLeft:6}}>BIKER25</span></span>
                <span className="num" style={{color:"var(--bb-success)"}}>− ₫ {discount.toLocaleString("vi-VN")}</span>
              </div>
              <div className="bb-row" style={{justifyContent:"space-between", padding:"8px 0 0", borderTop:"1px solid var(--bb-border-faint)", marginTop:6, fontSize:15, fontWeight:700}}>
                <span>Tổng cộng</span>
                <span className="num">₫ {(subtotal+shipping-discount).toLocaleString("vi-VN")}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>Ghi chú khách hàng</h3></div>
            <div className="bb-card-body" style={{fontSize:13, color:"var(--bb-text-secondary)"}}>
              "Giao buổi chiều sau 14h. Gọi trước khi giao. Cảm ơn shop."
            </div>
          </div>

          {/* Activity */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>Lịch sử thao tác</h3></div>
            <div className="bb-card-body">
              <div className="bb-timeline">
                {[
                  ["success","Khách hàng","đã đặt đơn qua bigbike.vn","26/05 15:18"],
                  ["warning","Hệ thống","đã gửi email xác nhận đơn hàng","26/05 15:18"],
                  ["",       "—","Đơn đang chờ admin xác nhận","đang chờ"],
                ].map(([tone, who, what, when], i)=>(
                  <div key={i} className={`bb-timeline-item ${tone}`}>
                    <span className="who">{who}</span> <span>{what}</span>
                    <div className="when">{when}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — meta */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Khách hàng</h3></div>
            <div className="bb-card-body" style={{fontSize:13}}>
              <div className="bb-product-cell" style={{marginBottom:10}}>
                <div className="bb-product-thumb" style={{width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg, #e8281e, #b01810)", color:"#fff"}}>TC</div>
                <div>
                  <div style={{fontWeight:600}}>Trần Thị C</div>
                  <div className="bb-muted" style={{fontSize:11.5}}>Khách hàng · 8 đơn</div>
                </div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"60px 1fr", gap:"6px 8px", fontSize:12.5}}>
                <span className="bb-muted">SĐT</span><span>0987 654 321</span>
                <span className="bb-muted">Email</span><span>tranthic@gmail.com</span>
                <span className="bb-muted">Tổng chi</span><span><strong>₫ 24.560.000</strong></span>
              </div>
              <a style={{display:"inline-block", marginTop:10, fontSize:12, color:"var(--bb-brand)", fontWeight:600, cursor:"pointer"}}>Xem hồ sơ →</a>
            </div>
          </div>

          <div className="bb-card">
            <div className="bb-card-header">
              <h3>Giao hàng</h3>
              <button className="bb-btn bb-btn-ghost bb-btn-sm"><I.edit size={11}/></button>
            </div>
            <div className="bb-card-body" style={{fontSize:12.5}}>
              <div style={{fontWeight:600, marginBottom:4}}>Trần Thị C · 0987 654 321</div>
              <div style={{color:"var(--bb-text-secondary)"}}>123 Lê Văn Sỹ, P.13, Q.3<br/>TP. Hồ Chí Minh</div>
              <div className="bb-divider"/>
              <div style={{display:"grid", gridTemplateColumns:"100px 1fr", gap:"6px 8px"}}>
                <span className="bb-muted">Đơn vị</span><span>Giao Hàng Nhanh</span>
                <span className="bb-muted">Tracking</span><span style={{fontFamily:"var(--bb-font-mono)"}}>—</span>
                <span className="bb-muted">Phí</span><span>₫ 45.000</span>
              </div>
            </div>
          </div>

          <div className="bb-card">
            <div className="bb-card-header"><h3>Thanh toán</h3></div>
            <div className="bb-card-body" style={{fontSize:12.5}}>
              <div style={{display:"grid", gridTemplateColumns:"100px 1fr", gap:"6px 8px"}}>
                <span className="bb-muted">Phương thức</span><span>COD</span>
                <span className="bb-muted">Trạng thái</span><span><Badge status="UNPAID"/></span>
                <span className="bb-muted">Đã trả</span><span>₫ 0</span>
                <span className="bb-muted">Cần thu</span><span style={{fontWeight:700, color:"var(--bb-brand)"}}>₫ {(subtotal+shipping-discount).toLocaleString("vi-VN")}</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bb-card" style={{borderColor:"var(--bb-danger-border)"}}>
            <div className="bb-card-header" style={{borderBottomColor:"var(--bb-danger-border)"}}>
              <h3 style={{color:"var(--bb-danger)"}}>Thao tác nguy hiểm</h3>
            </div>
            <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:6}}>
              <button className="bb-btn bb-btn-danger-ghost" style={{justifyContent:"flex-start"}}><I.x/> Huỷ đơn hàng</button>
              <button className="bb-btn bb-btn-danger-ghost" style={{justifyContent:"flex-start"}}><I.refresh/> Hoàn tiền</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.OrderDetailScreen = OrderDetailScreen;

// ════════════════════════════════════════════════════════════════════════
// PRODUCT LIST
// ════════════════════════════════════════════════════════════════════════
function ProductListScreen({ navigate }) {
  const rows = [
    ["Nón fullface AGV K1S Diablo",  "K1S-DBL-RD",   "AGV",    "Nón bảo hiểm",    6_400_000, "PUBLISHED", "IN_STOCK",   42, "26/05"],
    ["Găng tay Five RFX2 Carbon",    "F-RFX2-BLK",   "Five",   "Phụ kiện",          285_000, "PUBLISHED", "LOW_STOCK",   4, "25/05"],
    ["Áo giáp Komine JK-006",        "JK006",         "Komine","Giáp / Áo bảo hộ", 4_800_000, "PUBLISHED", "IN_STOCK",   18, "25/05"],
    ["Giày Sidi Crossfire 3",        "SDI-CF3",       "Sidi",  "Giày",            15_000_000, "PUBLISHED", "OUT_OF_STOCK",0, "24/05"],
    ["Yếm cổ Komine AK-022",         "AK022",         "Komine","Phụ kiện",            70_000, "DRAFT",     "IN_STOCK",   95, "24/05"],
    ["Quần Komine PK-916",           "PK916",         "Komine","Quần bảo hộ",      2_400_000, "PUBLISHED", "IN_STOCK",   12, "23/05"],
    ["Áo mưa Givi Rain Jacket",      "GVR-RJ",        "Givi",  "Phụ kiện",         1_200_000, "HIDDEN",    "IN_STOCK",   28, "22/05"],
    ["Thùng giữa Givi B33N",         "GVI-B33N",      "Givi",  "Phụ kiện",         2_100_000, "PUBLISHED", "LOW_STOCK",   3, "22/05"],
  ];
  return (
    <div data-screen-label="Sản phẩm">
      <PageHeader
        eyebrow="Danh mục"
        title="Sản phẩm"
        desc="Quản lý danh mục sản phẩm — 486 sản phẩm đang xuất bản"
        actions={
          <>
            <button className="bb-btn bb-btn-secondary"><I.download/> Export</button>
            <button className="bb-btn bb-btn-primary" onClick={() => navigate && navigate("product-detail")}><I.plus/> Tạo sản phẩm</button>
          </>
        }
      />

      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder="Tên sản phẩm, SKU, slug…" />
        </div>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả trạng thái</option>
          <option>Đã xuất bản</option>
          <option>Nháp</option>
          <option>Ẩn</option>
          <option>Thùng rác</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả thương hiệu</option>
          <option>AGV</option><option>Five</option><option>Komine</option><option>Sidi</option><option>Givi</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả danh mục</option>
          <option>Nón bảo hiểm</option><option>Giáp / Áo bảo hộ</option><option>Phụ kiện</option><option>Giày</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả tồn kho</option>
          <option>Còn hàng</option>
          <option>Sắp hết</option>
          <option>Hết hàng</option>
        </select>
        <button className="bb-btn bb-btn-ghost">Xoá bộ lọc</button>
      </div>

      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th className="col-checkbox"><input type="checkbox" className="bb-checkbox"/></th>
              <th>Sản phẩm</th>
              <th>Thương hiệu</th>
              <th>Danh mục</th>
              <th className="num sortable">Giá</th>
              <th>Xuất bản</th>
              <th>Tồn kho</th>
              <th className="sortable active">Cập nhật <span className="sort-ind">↓</span></th>
              <th className="col-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td className="col-checkbox"><input type="checkbox" className="bb-checkbox"/></td>
                <td>
                  <div className="bb-product-cell">
                    <div className="bb-product-thumb">{r[0].charAt(0)}</div>
                    <div>
                      <div className="bb-cell-strong" style={{cursor:"pointer"}} onClick={() => navigate && navigate("product-detail")}>{r[0]}</div>
                      <div className="bb-cell-sub" style={{fontFamily:"var(--bb-font-mono)"}}>{r[1]}</div>
                    </div>
                  </div>
                </td>
                <td>{r[2]}</td>
                <td>{r[3]}</td>
                <td className="num bb-cell-strong">₫ {r[4].toLocaleString("vi-VN")}</td>
                <td><Badge status={r[5]}/></td>
                <td>
                  <Badge status={r[6]}/>
                  <div className="bb-cell-sub" style={{marginTop:2}}>{r[7]} đơn vị</div>
                </td>
                <td>{r[8]}</td>
                <td className="col-actions">
                  <button className="bb-row-action" title="Sửa" onClick={() => navigate && navigate("product-detail")}><I.edit/></button>
                  <button className="bb-row-action" title="Sao chép"><I.copy/></button>
                  <button className="bb-row-action" title="Xoá"><I.trash/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bb-table-foot">
          <div>Hiển thị 1–8 / 486 sản phẩm</div>
          <div className="bb-row" style={{gap:12}}>
            <span className="bb-muted">Số hàng/trang</span>
            <select className="bb-select" style={{width:"auto", height:26, padding:"0 24px 0 8px", fontSize:12}}>
              <option>20</option><option>50</option><option>100</option>
            </select>
            <Pagination page={1} total={25}/>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ProductListScreen = ProductListScreen;

// ════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL / EDIT
// ════════════════════════════════════════════════════════════════════════
function ProductDetailScreen({ navigate }) {
  return (
    <div data-screen-label="Sửa sản phẩm">
      <PageHeader
        eyebrow={<a style={{color:"inherit", cursor:"pointer"}} onClick={() => navigate && navigate("products")}>← Danh sách sản phẩm</a>}
        title="Sửa sản phẩm"
        desc="Cập nhật thông tin và trạng thái xuất bản"
        actions={
          <>
            <Badge status="PUBLISHED"/>
            <button className="bb-btn bb-btn-secondary"><I.eye/> Xem trên site</button>
            <button className="bb-btn bb-btn-secondary">Lưu nháp</button>
            <button className="bb-btn bb-btn-primary"><I.check/> Lưu thay đổi</button>
          </>
        }
      />

      <div className="bb-alert info">
        <I.alert size={16}/>
        <div className="alert-body">
          <span className="alert-title">Checklist trước khi đăng:</span> Còn <strong>2</strong> mục chưa hoàn chỉnh (Mô tả SEO, Ảnh OG). Bạn vẫn có thể đăng.
        </div>
      </div>

      <div className="bb-detail-grid">
        {/* Left: form */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>

          <div className="bb-card">
            <div className="bb-card-header"><h3>Thông tin cơ bản</h3></div>
            <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:12}}>
              <div className="bb-grid-2">
                <Field label="Tên sản phẩm" required>
                  <input className="bb-input" defaultValue="Nón fullface AGV K1S Diablo"/>
                </Field>
                <Field label="Slug" required help="Đường dẫn URL: /san-pham/non-fullface-agv-k1s-diablo">
                  <input className="bb-input" defaultValue="non-fullface-agv-k1s-diablo"/>
                </Field>
              </div>
              <div className="bb-grid-3">
                <Field label="Mã model" help="Tuỳ chọn — SKU bán hàng nằm ở biến thể">
                  <input className="bb-input" defaultValue="K1S-DBL"/>
                </Field>
                <Field label="Danh mục" required>
                  <select className="bb-select" defaultValue="Nón bảo hiểm fullface">
                    <option>Nón bảo hiểm fullface</option>
                    <option>Nón bảo hiểm 3/4</option>
                    <option>Nón bảo hiểm cào cào</option>
                  </select>
                </Field>
                <Field label="Thương hiệu">
                  <select className="bb-select" defaultValue="AGV">
                    <option>— Không chọn —</option>
                    <option>AGV</option><option>Shoei</option><option>Arai</option>
                  </select>
                </Field>
              </div>
              <Field label="Mô tả ngắn" help="Hiển thị trên trang sản phẩm, tối thiểu 20 ký tự">
                <textarea className="bb-textarea" rows={3} defaultValue="Nón fullface AGV K1S phiên bản Diablo Red — nhẹ, êm, đạt chuẩn ECE 22.06. Phù hợp đi phượt và đường trường."/>
              </Field>
            </div>
          </div>

          <div className="bb-card">
            <div className="bb-card-header">
              <h3>Giá & trạng thái</h3>
            </div>
            <div className="bb-card-body">
              <div className="bb-grid-3">
                <Field label="Giá niêm yết (VND)" required>
                  <input className="bb-input" defaultValue="6.400.000"/>
                </Field>
                <Field label="Giá so sánh (VND)" help="Giá gốc trước khi giảm">
                  <input className="bb-input" defaultValue="7.200.000"/>
                </Field>
                <Field label="Giá sale (VND)" help="Phải thấp hơn giá niêm yết" error={null}>
                  <input className="bb-input" defaultValue=""/>
                </Field>
              </div>
              <div className="bb-divider"/>
              <div className="bb-grid-2">
                <Field label="Trạng thái xuất bản" required>
                  <select className="bb-select" defaultValue="PUBLISHED">
                    <option value="DRAFT">Nháp</option>
                    <option value="PUBLISHED">Đã xuất bản</option>
                    <option value="HIDDEN">Ẩn</option>
                  </select>
                </Field>
                <Field label="Vị trí trên trang chủ">
                  <select className="bb-select">
                    <option>Không hiển thị trang chủ</option>
                    <option>Sản phẩm nổi bật (grid)</option>
                    <option>Gợi ý dành cho bạn (carousel)</option>
                  </select>
                </Field>
              </div>
              <div className="bb-divider"/>
              <label className="bb-row" style={{gap:8, cursor:"pointer", fontSize:13}}>
                <input type="checkbox" className="bb-checkbox"/>
                <span>Khoá bán (buộc hết hàng)</span>
                <span className="bb-muted" style={{fontSize:11.5}}>Sản phẩm vẫn xuất bản nhưng khách không đặt được</span>
              </label>
            </div>
          </div>

          <div className="bb-card">
            <div className="bb-card-header">
              <h3>Biến thể (3)</h3>
              <button className="bb-btn bb-btn-ghost bb-btn-sm"><I.plus size={11}/> Thêm biến thể</button>
            </div>
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Tên biến thể</th>
                  <th>SKU</th>
                  <th className="num">Giá</th>
                  <th className="num">Tồn kho</th>
                  <th>Trạng thái</th>
                  <th className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Đỏ Diablo · S",  "K1S-DBL-RD-S", 6_400_000, 14, "IN_STOCK"],
                  ["Đỏ Diablo · M",  "K1S-DBL-RD-M", 6_400_000, 22, "IN_STOCK"],
                  ["Đỏ Diablo · L",  "K1S-DBL-RD-L", 6_400_000,  6, "IN_STOCK"],
                  ["Đỏ Diablo · XL", "K1S-DBL-RD-XL", 6_400_000, 0, "OUT_OF_STOCK"],
                ].map((r,i)=>(
                  <tr key={i}>
                    <td className="bb-cell-strong">{r[0]}</td>
                    <td className="mono">{r[1]}</td>
                    <td className="num">₫ {r[2].toLocaleString("vi-VN")}</td>
                    <td className="num">{r[3]}</td>
                    <td><Badge status={r[4]}/></td>
                    <td className="col-actions">
                      <button className="bb-row-action"><I.edit/></button>
                      <button className="bb-row-action"><I.trash/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bb-card">
            <div className="bb-card-header"><h3>Media & SEO</h3></div>
            <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:12}}>
              <Field label="Ảnh đại diện" help="Khuyến nghị 1200×1200px, JPG/PNG/WebP, dưới 1MB">
                <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8}}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{
                      aspectRatio:"1/1", borderRadius:6, background:"var(--bb-surface-raised)",
                      border:"1px solid var(--bb-border)", position:"relative",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:"var(--bb-text-muted)", fontSize:11
                    }}>
                      Ảnh {i}
                      <button style={{position:"absolute", top:4, right:4, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.6)", color:"#fff", border:0, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"}}>
                        <I.x size={10}/>
                      </button>
                    </div>
                  ))}
                  <div style={{
                    aspectRatio:"1/1", borderRadius:6,
                    border:"1px dashed var(--bb-border-strong)", background:"transparent",
                    display:"flex",flexDirection:"column", alignItems:"center",justifyContent:"center", gap:4,
                    color:"var(--bb-text-muted)", fontSize:11.5, cursor:"pointer",
                  }}>
                    <I.plus size={16}/>
                    Thêm ảnh
                  </div>
                </div>
              </Field>
              <div className="bb-grid-2">
                <Field label="SEO title" help="Khuyến nghị 50-60 ký tự">
                  <input className="bb-input" defaultValue="Mua nón fullface AGV K1S Diablo chính hãng | BigBike"/>
                </Field>
                <Field label="SEO canonical URL">
                  <input className="bb-input" placeholder="https://bigbike.vn/..."/>
                </Field>
              </div>
              <Field label="SEO description" help="Khuyến nghị 150-160 ký tự" error="Mô tả SEO chưa được điền — sẽ ảnh hưởng SEO">
                <textarea className="bb-textarea error" rows={2} placeholder="Nhập mô tả ngắn cho công cụ tìm kiếm…"/>
              </Field>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Checklist đăng bán</h3></div>
            <div className="bb-card-body" style={{padding:"4px 0"}}>
              {[
                ["Tên sản phẩm", true],
                ["Đã gán thương hiệu", true],
                ["Đã gán danh mục", true],
                ["Ảnh đại diện", true],
                ["Giá bán (> 0)", true],
                ["Mô tả ngắn", true],
                ["Tiêu đề SEO", true],
                ["Mô tả SEO", false],
                ["Ảnh OG", false],
                ["Mô tả chi tiết", true],
              ].map(([label, ok], i)=>(
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"6px 16px", fontSize:12.5,
                }}>
                  <span style={{
                    width:18, height:18, borderRadius:"50%",
                    background: ok ? "var(--bb-success-bg)" : "var(--bb-warning-bg)",
                    color:    ok ? "var(--bb-success)"    : "var(--bb-warning)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    {ok ? <I.check size={11}/> : <I.alert size={11}/>}
                  </span>
                  <span style={{color: ok ? "var(--bb-text)" : "var(--bb-text-muted)"}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Phân công</h3></div>
            <div className="bb-card-body" style={{fontSize:12.5}}>
              <div style={{marginBottom:8}}><strong>Content</strong> · Mai (Content)<br/><span className="bb-muted">Thông tin · Ảnh · Biến thể · Mô tả</span></div>
              <div style={{marginBottom:8}}><strong>SEO</strong> · Hoàng (SEO)<br/><span className="bb-muted">Title · Meta · OG · Slug</span></div>
              <div><strong>Quản lý</strong> · An<br/><span className="bb-muted">Giá · Duyệt đăng</span></div>
            </div>
          </div>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Thông tin</h3></div>
            <div className="bb-card-body" style={{fontSize:12.5, color:"var(--bb-text-secondary)"}}>
              <div style={{display:"grid", gridTemplateColumns:"110px 1fr", gap:"6px 8px"}}>
                <span className="bb-muted">ID</span><span style={{fontFamily:"var(--bb-font-mono)"}}>prd_8f4a2c1e</span>
                <span className="bb-muted">Tạo lúc</span><span>12/03/2026 · 09:42</span>
                <span className="bb-muted">Cập nhật</span><span>26/05/2026 · 11:18</span>
                <span className="bb-muted">Bởi</span><span>Mai (Content)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ProductDetailScreen = ProductDetailScreen;

// ════════════════════════════════════════════════════════════════════════
// CUSTOMER LIST
// ════════════════════════════════════════════════════════════════════════
function CustomerListScreen() {
  const rows = [
    ["KH-2240","Nguyễn Văn An",      "an.nguyen@gmail.com",  "0901 234 567", 18, 32_400_000, "12/03/2025","ACTIVE"],
    ["KH-2241","Trần Thị Bích",      "bich.tran@yahoo.com",  "0907 111 333", 12, 24_560_000, "14/03/2025","ACTIVE"],
    ["KH-2242","Lê Quốc Cường",      "cuong.le@hotmail.com", "0918 555 666", 4,  6_800_000,  "20/03/2025","ACTIVE"],
    ["KH-2243","Phạm Văn Đức",       "duc.pham@gmail.com",   "0905 999 000", 1,    480_000,  "01/04/2025","DISABLED"],
    ["KH-2244","Hoàng Thị Em",       "em.hoang@gmail.com",   "0908 444 555", 9,  18_300_000, "08/04/2025","ACTIVE"],
    ["KH-2245","Đỗ Văn Phong",       "phong.do@gmail.com",   "0917 888 999", 2,  4_200_000,  "11/04/2025","ACTIVE"],
  ];
  return (
    <div data-screen-label="Khách hàng">
      <PageHeader
        eyebrow="Bán hàng"
        title="Khách hàng"
        desc="Quản lý hồ sơ khách hàng và lịch sử giao dịch"
        actions={
          <>
            <button className="bb-btn bb-btn-secondary"><I.download/> Export</button>
            <button className="bb-btn bb-btn-primary"><I.plus/> Thêm khách hàng</button>
          </>
        }
      />
      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder="Tên, SĐT, email…"/>
        </div>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả trạng thái</option>
          <option>Hoạt động</option>
          <option>Tạm khoá</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tổng chi tiêu</option>
          <option>{'>'} 10 triệu</option>
          <option>{'>'} 50 triệu</option>
        </select>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Mới nhất</option>
          <option>Chi tiêu cao nhất</option>
        </select>
      </div>
      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th>Mã KH</th>
              <th>Khách hàng</th>
              <th>Liên hệ</th>
              <th className="num">Số đơn</th>
              <th className="num">Tổng chi</th>
              <th>Đăng ký</th>
              <th>Trạng thái</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td className="mono">{r[0]}</td>
                <td>
                  <div className="bb-product-cell">
                    <div className="bb-product-thumb" style={{borderRadius:"50%", background:`hsl(${(i*53)%360},45%,55%)`, color:"#fff"}}>{r[1].split(" ").pop().charAt(0)}</div>
                    <div>
                      <div className="bb-cell-strong">{r[1]}</div>
                      <div className="bb-cell-sub">Khách hàng</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>{r[2]}</div>
                  <div className="bb-cell-sub">{r[3]}</div>
                </td>
                <td className="num">{r[4]}</td>
                <td className="num bb-cell-strong">₫ {r[5].toLocaleString("vi-VN")}</td>
                <td>{r[6]}</td>
                <td><Badge status={r[7]}/></td>
                <td className="col-actions">
                  <button className="bb-row-action"><I.eye/></button>
                  <button className="bb-row-action"><I.more/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bb-table-foot">
          <div>Hiển thị 1–6 / 2.240 khách hàng</div>
          <Pagination page={1} total={20}/>
        </div>
      </div>
    </div>
  );
}
window.CustomerListScreen = CustomerListScreen;

// ════════════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════════════
function InventoryScreen() {
  const rows = [
    ["K1S-DBL-RD-S",   "Nón AGV K1S Diablo · Đỏ · S",  "AGV", 22, 5,  "IN_STOCK"],
    ["K1S-DBL-RD-M",   "Nón AGV K1S Diablo · Đỏ · M",  "AGV", 14, 5,  "IN_STOCK"],
    ["K1S-DBL-RD-L",   "Nón AGV K1S Diablo · Đỏ · L",   "AGV", 4,  5,  "LOW_STOCK"],
    ["K1S-DBL-RD-XL",  "Nón AGV K1S Diablo · Đỏ · XL",  "AGV", 0,  5,  "OUT_OF_STOCK"],
    ["F-RFX2-BLK-L",   "Găng tay Five RFX2 · L",        "Five", 3, 10, "LOW_STOCK"],
    ["F-RFX2-BLK-XL",  "Găng tay Five RFX2 · XL",       "Five", 8, 10, "LOW_STOCK"],
    ["JK006-XL",       "Áo giáp Komine JK-006 · XL",    "Komine",18, 5,  "IN_STOCK"],
    ["SDI-CF3-42",     "Giày Sidi Crossfire 3 · 42",    "Sidi", 0,  3,  "OUT_OF_STOCK"],
    ["AK022-FREE",     "Yếm cổ Komine AK-022",          "Komine",95, 20, "IN_STOCK"],
  ];
  return (
    <div data-screen-label="Kho hàng">
      <PageHeader
        eyebrow="Sản phẩm"
        title="Kho hàng"
        desc="Theo dõi tồn kho theo SKU. 8 mã đang cảnh báo."
        actions={
          <>
            <button className="bb-btn bb-btn-secondary"><I.download/> Export</button>
            <button className="bb-btn bb-btn-secondary"><I.upload/> Nhập kho</button>
            <button className="bb-btn bb-btn-primary"><I.plus/> Điều chỉnh tồn</button>
          </>
        }
      />

      <div className="bb-kpi-grid">
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Tổng SKU <span className="bb-kpi-icon"><I.package size={14}/></span></div>
          <div className="bb-kpi-value">1.248</div>
          <div className="bb-kpi-trend bb-muted">Đang theo dõi</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Còn hàng <span className="bb-kpi-icon success"><I.check size={14}/></span></div>
          <div className="bb-kpi-value">1.184</div>
          <div className="bb-kpi-trend bb-muted">94,9% danh mục</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Sắp hết <span className="bb-kpi-icon warning"><I.alert size={14}/></span></div>
          <div className="bb-kpi-value" style={{color:"var(--bb-warning)"}}>52</div>
          <div className="bb-kpi-trend bb-muted">Dưới mức cảnh báo</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Hết hàng <span className="bb-kpi-icon danger"><I.alert size={14}/></span></div>
          <div className="bb-kpi-value" style={{color:"var(--bb-danger)"}}>12</div>
          <div className="bb-kpi-trend bb-muted">Cần đặt thêm</div>
        </div>
      </div>

      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder="SKU hoặc tên biến thể…"/>
        </div>
        <div className="bb-seg">
          <button className="active">Tất cả</button>
          <button>Sắp hết</button>
          <button>Hết hàng</button>
        </div>
        <select className="bb-select" style={{width:"auto"}}>
          <option>Tất cả thương hiệu</option>
        </select>
      </div>

      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Biến thể</th>
              <th>Thương hiệu</th>
              <th className="num">Tồn hiện tại</th>
              <th className="num">Ngưỡng cảnh báo</th>
              <th>Trạng thái</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td className="mono">{r[0]}</td>
                <td className="bb-cell-strong">{r[1]}</td>
                <td>{r[2]}</td>
                <td className="num" style={{color: r[3]===0?"var(--bb-danger)": r[3]<=r[4]?"var(--bb-warning)":"var(--bb-text)", fontWeight:600}}>{r[3]}</td>
                <td className="num bb-muted">{r[4]}</td>
                <td><Badge status={r[5]}/></td>
                <td className="col-actions">
                  <button className="bb-btn bb-btn-ghost bb-btn-sm">Điều chỉnh</button>
                  <button className="bb-row-action"><I.more/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bb-table-foot">
          <div>Hiển thị 1–9 / 1.248 SKU</div>
          <Pagination page={1} total={42}/>
        </div>
      </div>
    </div>
  );
}
window.InventoryScreen = InventoryScreen;

// ════════════════════════════════════════════════════════════════════════
// RECEIVABLES
// ════════════════════════════════════════════════════════════════════════
function ReceivablesScreen() {
  const rows = [
    ["PHN-25-0142","Trần Thị Bích",  4_200_000, 4_200_000, 0,           "20/05/2026", -6, "OVERDUE"],
    ["PHN-25-0141","Bùi Văn Inh",    8_600_000, 4_300_000, 4_300_000,   "28/05/2026",  2, "OPEN"],
    ["PHN-25-0140","Mai Văn Lâm",   12_400_000, 0,        12_400_000,   "02/06/2026",  7, "OPEN"],
    ["PHN-25-0139","Đỗ Thị Hà",      3_400_000, 3_400_000, 0,           "18/05/2026", -8, "OVERDUE"],
    ["PHN-25-0138","Vũ Văn Giàu",   18_900_000, 18_900_000, 0,          "15/05/2026",-11, "OVERDUE"],
    ["PHN-25-0137","Lê Quốc Cường",  2_400_000, 0,         2_400_000,   "10/06/2026", 15, "OPEN"],
    ["PHN-25-0136","Phạm Văn Đức",   1_200_000, 1_200_000, 0,           "25/04/2026",-32, "PAID_FULL"],
  ];
  return (
    <div data-screen-label="Công nợ">
      <PageHeader
        eyebrow="Bán hàng"
        title="Công nợ"
        desc="Theo dõi và thu hồi công nợ khách hàng"
        actions={
          <>
            <button className="bb-btn bb-btn-secondary"><I.download/> Export</button>
            <button className="bb-btn bb-btn-primary"><I.plus/> Phiếu thu</button>
          </>
        }
      />
      <div className="bb-kpi-grid">
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Tổng phải thu <span className="bb-kpi-icon"><I.dollar size={14}/></span></div>
          <div className="bb-kpi-value">₫ 124M</div>
          <div className="bb-kpi-trend bb-muted">42 phiếu mở</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Quá hạn <span className="bb-kpi-icon danger"><I.alert size={14}/></span></div>
          <div className="bb-kpi-value" style={{color:"var(--bb-danger)"}}>₫ 31.7M</div>
          <div className="bb-kpi-trend bb-muted">4 phiếu — trung bình quá 12 ngày</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Đến hạn 7 ngày <span className="bb-kpi-icon warning"><I.clock size={14}/></span></div>
          <div className="bb-kpi-value" style={{color:"var(--bb-warning)"}}>₫ 18.2M</div>
          <div className="bb-kpi-trend bb-muted">6 phiếu</div>
        </div>
        <div className="bb-kpi" style={{cursor:"default"}}>
          <div className="bb-kpi-head">Thu trong tháng <span className="bb-kpi-icon success"><I.check size={14}/></span></div>
          <div className="bb-kpi-value" style={{color:"var(--bb-success)"}}>₫ 86.4M</div>
          <div className="bb-kpi-trend up"><I.trend size={11}/> +18% so tháng trước</div>
        </div>
      </div>
      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder="Mã phiếu, khách hàng…"/>
        </div>
        <div className="bb-seg">
          <button className="active">Tất cả <span className="count">42</span></button>
          <button>Quá hạn <span className="count">4</span></button>
          <button>Đến hạn <span className="count">6</span></button>
          <button>Đã thu <span className="count">128</span></button>
        </div>
      </div>
      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Khách hàng</th>
              <th className="num">Tổng nợ</th>
              <th className="num">Đã trả</th>
              <th className="num">Còn lại</th>
              <th>Đến hạn</th>
              <th>Trạng thái</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>{
              const daysHint = r[6] < 0 ? `Quá ${Math.abs(r[6])} ngày` : `Còn ${r[6]} ngày`;
              return (
                <tr key={i}>
                  <td className="mono"><a style={{color:"var(--bb-brand)", cursor:"pointer"}}>{r[0]}</a></td>
                  <td className="bb-cell-strong">{r[1]}</td>
                  <td className="num">₫ {r[2].toLocaleString("vi-VN")}</td>
                  <td className="num">₫ {r[3].toLocaleString("vi-VN")}</td>
                  <td className="num bb-cell-strong" style={{color: r[7]==='OVERDUE' ? "var(--bb-danger)":"var(--bb-text)"}}>₫ {r[4].toLocaleString("vi-VN")}</td>
                  <td>
                    <div>{r[5]}</div>
                    <div className="bb-cell-sub" style={{color: r[6]<0 ? "var(--bb-danger)": r[6]<=7 ? "var(--bb-warning)" : "var(--bb-text-muted)"}}>{daysHint}</div>
                  </td>
                  <td><Badge status={r[7]}/></td>
                  <td className="col-actions">
                    <button className="bb-btn bb-btn-ghost bb-btn-sm">Ghi nhận thu</button>
                    <button className="bb-row-action"><I.more/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="bb-table-foot">
          <div>Hiển thị 1–7 / 174 phiếu</div>
          <Pagination page={1} total={25}/>
        </div>
      </div>
    </div>
  );
}
window.ReceivablesScreen = ReceivablesScreen;

// ════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════
function SettingsScreen() {
  return (
    <div data-screen-label="Cài đặt">
      <PageHeader
        eyebrow="Hệ thống"
        title="Cài đặt"
        desc="Cấu hình chung cho toàn hệ thống BigBike"
        actions={<button className="bb-btn bb-btn-primary"><I.check/> Lưu cài đặt</button>}
      />
      <div className="bb-tabs">
        <button className="active">Thông tin shop</button>
        <button>Cửa hàng & POS</button>
        <button>Thanh toán</button>
        <button>Vận chuyển</button>
        <button>Email</button>
        <button>SEO mặc định</button>
      </div>

      <div className="bb-detail-grid">
        <div className="bb-card">
          <div className="bb-card-header"><h3>Thông tin doanh nghiệp</h3></div>
          <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:12}}>
            <Field label="Tên cửa hàng" required>
              <input className="bb-input" defaultValue="BigBike Motors"/>
            </Field>
            <Field label="Slogan" help="Hiển thị trên trang chủ và metadata">
              <input className="bb-input" defaultValue="Đồ chơi xe máy chính hãng"/>
            </Field>
            <div className="bb-grid-2">
              <Field label="Hotline">
                <input className="bb-input" defaultValue="1900 0123"/>
              </Field>
              <Field label="Email liên hệ">
                <input className="bb-input" defaultValue="support@bigbike.vn"/>
              </Field>
            </div>
            <Field label="Địa chỉ">
              <input className="bb-input" defaultValue="123 Lê Văn Sỹ, P.13, Q.3, TP. Hồ Chí Minh"/>
            </Field>
            <Field label="Mã số thuế">
              <input className="bb-input" defaultValue="0312345678"/>
            </Field>
            <div className="bb-divider"/>
            <Field label="Đồng tiền & múi giờ">
              <div className="bb-grid-2">
                <select className="bb-select"><option>VND (₫)</option></select>
                <select className="bb-select"><option>(GMT+7) Asia/Ho_Chi_Minh</option></select>
              </div>
            </Field>
          </div>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Tuỳ chỉnh website</h3></div>
            <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:12}}>
              <div className="bb-row" style={{justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>Chế độ bảo trì</div>
                  <div className="bb-muted" style={{fontSize:11.5}}>Ẩn website khỏi khách hàng</div>
                </div>
                <label className="bb-switch"><input type="checkbox"/><span className="track"/><span className="thumb"/></label>
              </div>
              <div className="bb-row" style={{justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>Cho phép đăng ký</div>
                  <div className="bb-muted" style={{fontSize:11.5}}>Khách có thể tự tạo tài khoản</div>
                </div>
                <label className="bb-switch"><input type="checkbox" defaultChecked/><span className="track"/><span className="thumb"/></label>
              </div>
              <div className="bb-row" style={{justifyContent:"space-between"}}>
                <div>
                  <div style={{fontWeight:600, fontSize:13}}>Hiển thị giá khi hết hàng</div>
                  <div className="bb-muted" style={{fontSize:11.5}}>Sản phẩm hết hàng vẫn hiện giá</div>
                </div>
                <label className="bb-switch"><input type="checkbox" defaultChecked/><span className="track"/><span className="thumb"/></label>
              </div>
            </div>
          </div>
          <div className="bb-card">
            <div className="bb-card-header"><h3>Dữ liệu & sao lưu</h3></div>
            <div className="bb-card-body" style={{display:"flex", flexDirection:"column", gap:8, fontSize:12.5}}>
              <button className="bb-btn bb-btn-secondary" style={{justifyContent:"flex-start"}}><I.download/> Xuất toàn bộ dữ liệu</button>
              <button className="bb-btn bb-btn-secondary" style={{justifyContent:"flex-start"}}><I.refresh/> Sao lưu thủ công</button>
              <div className="bb-muted">Sao lưu tự động lần cuối: 26/05/2026 02:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.SettingsScreen = SettingsScreen;

// ════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  return (
    <div style={{
      minHeight:"100vh",
      display:"grid",
      gridTemplateColumns:"1fr 1fr",
      background:"var(--bb-bg)",
    }} className="bb-login">
      <div style={{
        background:"#0d1117",
        color:"#fff",
        display:"flex",
        flexDirection:"column",
        justifyContent:"space-between",
        padding:"48px",
        position:"relative",
        overflow:"hidden",
      }}>
        <div style={{position:"absolute", inset:0, background:"radial-gradient(ellipse at 30% 20%, rgba(232,40,30,0.18), transparent 60%)"}}/>
        <div style={{position:"relative", display:"flex", alignItems:"center", gap:10}}>
          <span style={{width:14, height:14, background:"var(--bb-brand)", borderRadius:3, boxShadow:"0 0 0 4px rgba(232,40,30,0.2)"}}/>
          <div style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em"}}>BigBike Motors</div>
        </div>
        <div style={{position:"relative"}}>
          <div style={{fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em", color:"#7d8590", marginBottom:14}}>Admin Console</div>
          <div style={{fontSize:34, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1.15, maxWidth:480}}>Vận hành toàn bộ BigBike Motors trên một bảng điều khiển.</div>
          <div style={{marginTop:16, fontSize:14, color:"#c9d1d9", maxWidth:460, lineHeight:1.6}}>
            Đơn hàng, kho, công nợ, nội dung và POS — tất cả trong một workspace duy nhất, đồng bộ thời gian thực.
          </div>
          <div style={{marginTop:32, display:"flex", flexDirection:"column", gap:10, fontSize:13, color:"#8b949e"}}>
            <div className="bb-row" style={{gap:10}}><I.check size={14}/>Đồng bộ đơn hàng từ website & POS</div>
            <div className="bb-row" style={{gap:10}}><I.check size={14}/>Quản lý tồn kho theo SKU & serial</div>
            <div className="bb-row" style={{gap:10}}><I.check size={14}/>Báo cáo doanh thu thời gian thực</div>
          </div>
        </div>
        <div style={{position:"relative", fontSize:11, color:"#7d8590", fontFamily:"var(--bb-font-mono)"}}>v2.6.0 · production</div>
      </div>
      <div style={{display:"flex", alignItems:"center", justifyContent:"center", padding:"48px"}}>
        <form style={{width:"100%", maxWidth:360}} onSubmit={(e)=>{e.preventDefault(); onLogin && onLogin();}}>
          <h1 style={{fontSize:24, fontWeight:700, letterSpacing:"-0.01em", margin:"0 0 6px"}}>Đăng nhập</h1>
          <p style={{fontSize:13, color:"var(--bb-text-muted)", margin:"0 0 24px"}}>Nhập email quản trị và mật khẩu để truy cập bảng điều khiển.</p>
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <Field label="Email" required>
              <input className="bb-input" placeholder="admin@bigbike.vn" defaultValue="an.nguyen@bigbike.vn"/>
            </Field>
            <Field label="Mật khẩu" required>
              <input className="bb-input" type="password" placeholder="••••••••" defaultValue="••••••••••"/>
            </Field>
            <label className="bb-row" style={{justifyContent:"space-between", fontSize:12.5, marginTop:2}}>
              <span className="bb-row" style={{gap:6}}><input type="checkbox" className="bb-checkbox" defaultChecked/>Duy trì đăng nhập</span>
              <a style={{color:"var(--bb-brand)", cursor:"pointer", fontWeight:500}}>Quên mật khẩu?</a>
            </label>
            <button type="submit" className="bb-btn bb-btn-primary bb-btn-lg" style={{width:"100%"}}>Đăng nhập</button>
          </div>
          <div style={{marginTop:24, paddingTop:16, borderTop:"1px solid var(--bb-border-faint)", fontSize:11.5, color:"var(--bb-text-muted)", textAlign:"center"}}>
            Liên hệ <strong style={{color:"var(--bb-text)"}}>Hỗ trợ kỹ thuật</strong> nếu không truy cập được.
          </div>
        </form>
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;

// Stub screens used for less-detailed routes — preserve placement
function StubScreen({ title, eyebrow, desc, children }) {
  return (
    <div data-screen-label={title}>
      <PageHeader eyebrow={eyebrow} title={title} desc={desc}
        actions={<button className="bb-btn bb-btn-primary"><I.plus/> Tạo mới</button>}/>
      <div className="bb-filter-bar">
        <div className="bb-search grow" style={{maxWidth:"none"}}>
          <span className="icon"><I.search/></span>
          <input placeholder={`Tìm trong ${title.toLowerCase()}…`}/>
        </div>
        <button className="bb-btn bb-btn-secondary"><I.filter/> Lọc</button>
      </div>
      {children || (
        <div className="bb-state">
          <div className="bb-state-icon info"><I.package size={20}/></div>
          <h4>Module "{title}"</h4>
          <p>Layout cho module này tuân theo cùng pattern: filter bar, segmented status tabs, bảng dữ liệu, pagination. Xem tab Spec để biết chi tiết.</p>
          <button className="bb-btn bb-btn-secondary">Xem spec</button>
        </div>
      )}
    </div>
  );
}
window.StubScreen = StubScreen;

// Confirm dialog example
function ConfirmDeleteModal({ onClose }) {
  return (
    <div className="bb-modal-overlay" onClick={onClose}>
      <div className="bb-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="bb-modal-header">
          <h3>Huỷ đơn hàng BB-25-04822?</h3>
          <p>Đơn sẽ chuyển sang trạng thái "Đã huỷ" và không thể hoàn tác. Khách hàng sẽ nhận email thông báo.</p>
        </div>
        <div className="bb-modal-body">
          <Field label="Lý do huỷ" required>
            <select className="bb-select">
              <option>— Chọn lý do —</option>
              <option>Khách yêu cầu huỷ</option>
              <option>Hết hàng</option>
              <option>Không liên hệ được khách</option>
              <option>Khác</option>
            </select>
          </Field>
          <div style={{height:8}}/>
          <Field label="Ghi chú nội bộ" help="Không hiển thị cho khách hàng">
            <textarea className="bb-textarea" rows={2}/>
          </Field>
        </div>
        <div className="bb-modal-footer">
          <button className="bb-btn bb-btn-ghost" onClick={onClose}>Đóng</button>
          <button className="bb-btn bb-btn-danger">Huỷ đơn hàng</button>
        </div>
      </div>
    </div>
  );
}
window.ConfirmDeleteModal = ConfirmDeleteModal;
