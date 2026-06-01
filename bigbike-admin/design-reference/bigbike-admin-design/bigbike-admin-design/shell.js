/* ════════════════════════════════════════════════════════════════════════
   BigBike Admin — shared shell + prototype chrome for Phase-2 mockups.
   Injects: prototype preview bar (Desktop/Mobile + theme), product sidebar,
   product topbar, breadcrumb. Wires drawer, toasts, generic UI behaviours.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  const I = {
    dash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    pos:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 9h18M7 21h10M9 17v4M15 17v4"/></svg>',
    orders:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    bike:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 8h5l3 5h1.5M9 8h6M13 8l1.5 3"/></svg>',
    tag:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
    brand:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/></svg>',
    coupon:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M15 5v14" stroke-dasharray="2 3"/></svg>',
    content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    media:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.7"/><path d="m21 15-5-5L5 21"/></svg>',
    review:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9z"/></svg>',
    cust:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1M17 4a4 4 0 0 1 0 8"/></svg>',
    roles:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    admins:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/><path d="M18 8h4M20 6v4"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  };

  const NAV = [
    { label:"Bán hàng", items:[
      { key:"dashboard", t:"Tổng quan", ic:I.dash },
      { key:"pos",       t:"Bán tại quầy", ic:I.pos },
      { key:"orders",    t:"Đơn hàng", ic:I.orders, badge:"7" },
    ]},
    { label:"Danh mục", items:[
      { key:"products",   t:"Sản phẩm", ic:I.bike },
      { key:"categories", t:"Danh mục", ic:I.tag },
      { key:"brands",     t:"Thương hiệu", ic:I.brand },
      { key:"coupons",    t:"Mã giảm giá", ic:I.coupon },
    ]},
    { label:"Nội dung", items:[
      { key:"content", t:"Bài viết", ic:I.content },
      { key:"media",   t:"Thư viện ảnh", ic:I.media },
      { key:"reviews", t:"Đánh giá", ic:I.review, badge:"3", muted:true },
    ]},
    { label:"Hệ thống", items:[
      { key:"customers", t:"Khách hàng", ic:I.cust },
      { key:"roles",     t:"Phân quyền", ic:I.roles },
      { key:"admins",    t:"Người dùng admin", ic:I.admins },
      { key:"settings",  t:"Cấu hình", ic:I.settings },
    ]},
  ];

  function sidebarHTML(active) {
    let groups = NAV.map(g => {
      const links = g.items.map(it => {
        const badge = it.badge ? `<span class="sb-badge${it.muted?' muted':''}">${it.badge}</span>` : "";
        return `<a class="sb-link${it.key===active?' active':''}" href="${it.key==='products'?'product-list.html':'#'}">${it.ic}<span>${it.t}</span>${badge}</a>`;
      }).join("");
      return `<div class="sb-group"><div class="sb-label">${g.label}</div>${links}</div>`;
    }).join("");
    return `
      <div class="sb-brand">
        <div class="sb-logo"><img src="assets/bigbike-logo.png" alt="BigBike" /></div>
        <div class="bt"><div class="nm">BIGBIKE</div><div class="sub">Admin</div></div>
      </div>
      <nav class="sb-nav">${groups}</nav>
      <div class="sb-foot">
        <div class="sb-user">
          <div class="sb-avatar">TH</div>
          <div class="ut"><div class="un">Trần Hùng</div><div class="ur">Quản lý cửa hàng</div></div>
        </div>
      </div>`;
  }

  function topbarHTML(cfg) {
    return `
      <div class="ptopbar-left">
        <button class="hamburger" data-open-nav aria-label="Mở menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
        <span class="ptopbar-title">${cfg.pageTitle||""}</span>
        <label class="ptopbar-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Tìm sản phẩm, đơn hàng, khách…" /><kbd>⌘K</kbd></label>
      </div>
      <div class="ptopbar-actions">
        <span class="mode-pill"><span class="d"></span>Đang hoạt động</span>
        <button class="tbar-icon" aria-label="Thông báo"><span class="pip"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>
      </div>`;
  }

  function crumbHTML(crumb) {
    return crumb.map((c,i) => {
      const last = i===crumb.length-1;
      const sep = i>0 ? '<span class="sep">/</span>' : '';
      return sep + (last ? `<span class="cur">${c}</span>` : `<a href="#">${c}</a>`);
    }).join("");
  }

  function mountShell(cfg) {
    cfg = cfg || {};
    const root = document.documentElement;
    document.getElementById("sidebar").innerHTML = sidebarHTML(cfg.active);
    document.getElementById("ptopbar").innerHTML = topbarHTML(cfg);
    if (document.getElementById("pcrumb")) document.getElementById("pcrumb").innerHTML = crumbHTML(cfg.crumb || []);

    // proto preview bar
    const bar = document.getElementById("protoBar");
    bar.innerHTML = `
      <div class="pb-left">
        <span class="pb-mark">BIG<span class="dot">●</span>BIKE</span>
        <span class="pb-title">${cfg.protoTitle||""}</span>
      </div>
      <div class="pb-controls">
        <div class="pb-seg" role="group" aria-label="Kích thước">
          <button data-view="desktop" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Desktop</button>
          <button data-view="mobile" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>Mobile</button>
        </div>
        <div class="pb-seg seg-theme" role="group" aria-label="Theme">
          <button data-theme-btn="light" aria-pressed="true">Sáng</button>
          <button data-theme-btn="dark" aria-pressed="false">Tối</button>
        </div>
      </div>`;

    const stage = document.getElementById("stage");
    bar.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.view;
      bar.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-pressed", x===b));
      stage.classList.toggle("is-mobile", v==="mobile");
      // close drawer when switching
      document.getElementById("shell").classList.remove("nav-open");
    }));
    bar.querySelectorAll("[data-theme-btn]").forEach(b => b.addEventListener("click", () => {
      root.setAttribute("data-theme", b.dataset.themeBtn);
      bar.querySelectorAll("[data-theme-btn]").forEach(x => x.setAttribute("aria-pressed", x===b));
    }));

    // drawer
    const shell = document.getElementById("shell");
    document.addEventListener("click", e => {
      if (e.target.closest("[data-open-nav]")) shell.classList.add("nav-open");
      else if (e.target.closest("[data-close-nav]")) shell.classList.remove("nav-open");
    });
  }

  // ─── Toast + undo helper ───────────────────────────────────────────────
  let toastTimer;
  function toast(opts) {
    opts = opts || {};
    const region = document.getElementById("toast-region");
    if (!region) return;
    region.innerHTML = "";
    const el = document.createElement("div");
    el.className = "toast enter";
    const ico = opts.danger
      ? '<svg class="t-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="color:var(--danger-solid)"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
      : '<svg class="t-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
    const undo = opts.undo !== false ? '<button class="t-undo">Hoàn tác</button>' : '';
    el.innerHTML = `${ico}<span class="t-msg">${opts.msg||""}</span>${undo}<button class="t-close" aria-label="Đóng"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    const close = () => { region.innerHTML=""; clearTimeout(toastTimer); };
    if (el.querySelector(".t-undo")) el.querySelector(".t-undo").onclick = () => { close(); opts.onUndo && opts.onUndo(); };
    el.querySelector(".t-close").onclick = close;
    region.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(close, opts.duration || 5000);
  }

  window.BB = { mountShell, toast };
})();
