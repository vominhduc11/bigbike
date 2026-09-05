#!/usr/bin/env python3
"""Sinh ERD (DBML + Mermaid + JSON) từ metadata đã dump ra file .psv."""
import json
import re
import unicodedata
import sys
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone, timedelta

TMP, OUT = sys.argv[1], sys.argv[2]

# --- Nhóm nghiệp vụ: (tên nhóm, [tên bảng chính xác], [tiền tố]) ---
GROUPS = [
    ("San pham & danh muc", "Sản phẩm & danh mục",
     {"products", "brands", "categories", "attributes", "attribute_values", "stock_movements",
      "legacy_discontinued_products"}, ("product_", "catalog_")),
    ("Khach hang", "Khách hàng & tài khoản",
     {"customers"}, ("customer_",)),
    ("Don hang", "Giỏ hàng, đơn hàng & thanh toán",
     {"carts", "cart_items", "checkout_idempotency_keys", "orders", "payments", "payment_events"}, ("order_",)),
    ("Danh gia", "Đánh giá sản phẩm",
     {"reviews"}, ("review_",)),
    ("Noi dung web", "Nội dung & giao diện website",
     {"articles", "article_tags", "media", "menus", "menu_items", "sliders", "site_settings", "redirects"},
     ("media_", "home_")),
    ("Quan tri", "Quản trị & phân quyền",
     {"role_permissions", "audit_logs", "inventory_out_of_stock_digest_runs"}, ("admin_",)),
    ("Tro ly chat", "Trợ lý chat",
     set(), ("chat_",)),
    ("Ky thuat", "Kỹ thuật & vận hành",
     {"flyway_schema_history", "tmp_p", "category_intro_faq_markup_backup"},
     ("live_migration_", "maintenance_", "gsc_")),
]
JUNK = re.compile(r"^(tmp_|gsc_)|_backup$|_backup_")

HILITE = ("name", "name_vi", "title", "slug", "sku", "code", "status", "email", "phone",
          "order_number", "order_code", "price", "quantity", "is_active", "published_at", "created_at")


def load(path):
    with open(f"{TMP}/{path}", encoding="utf-8") as fh:
        return [ln.rstrip("\n").split("|") for ln in fh if ln.strip()]


columns = defaultdict(list)
for t, c, typ, ln, nullable in load("columns.psv"):
    columns[t].append({"name": c, "type": typ, "len": ln, "nullable": nullable == "YES"})

pks = defaultdict(set)
for t, c in load("pks.psv"):
    pks[t].add(c)
uks = defaultdict(set)
for t, c in load("uks.psv"):
    uks[t].add(c)
counts = {t: int(n) for t, n in load("counts.psv")}

fks, fkcols = [], defaultdict(set)
seen = set()
for t, c, rt, rc in load("fks.psv"):
    fkcols[t].add(c)
    key = (t, c, rt, rc)
    if key in seen:
        continue
    seen.add(key)
    fks.append({"table": t, "column": c, "ref_table": rt, "ref_column": rc})
soft = [{"table": t, "column": c["name"]}
        for t, cols in columns.items() for c in cols
        if c["name"].endswith("_id") and c["name"] not in fkcols[t] and not c["name"].startswith("legacy")]


def group_of(table):
    for key, label, exact, prefixes in GROUPS:
        if table in exact or table.startswith(prefixes):
            return key, label
    return "Khac", "Khác"


grouped = OrderedDict((k, []) for k, _, _, _ in GROUPS)
grouped["Khac"] = []
for t in sorted(columns):
    grouped[group_of(t)[0]].append(t)
labels = {k: lb for k, lb, _, _ in GROUPS}
labels["Khac"] = "Khác"


def short_type(c):
    m = {"character varying": "varchar", "character": "char", "timestamp with time zone": "timestamptz",
         "timestamp without time zone": "timestamp", "double precision": "float8", "USER-DEFINED": "enum",
         "ARRAY": "array", "integer": "int", "boolean": "bool"}
    t = m.get(c["type"], c["type"])
    if c["len"] and t in ("varchar", "char"):
        t = f"{t}({c['len']})"
    return t


def vn(n):
    return f"{n:,}".replace(",", ".")


def base_type(c):
    return short_type(c).split("(")[0]


def safe(t):
    return re.sub(r"[^0-9A-Za-z_]", "_", t)


def ascii_fold(t):
    t = t.replace("đ", "d").replace("Đ", "D")
    t = unicodedata.normalize("NFD", t)
    return safe("".join(ch for ch in t if unicodedata.category(ch) != "Mn"))


# ---------- DBML ----------
dbml = ["// ERD BigBike - sinh tự động từ CSDL đang chạy, KHÔNG sửa tay.",
        f"// Sinh lúc: {datetime.now(timezone(timedelta(hours=7))).strftime('%Y-%m-%d %H:%M')} (giờ VN)",
        "// Dán toàn bộ file này vào https://dbdiagram.io/d để xem sơ đồ, kéo thả và xuất PNG/PDF.", ""]
for t in sorted(columns):
    note = f"{counts.get(t, 0)} dòng - nhóm: {group_of(t)[1]}"
    dbml.append(f'Table {t} {{')
    for c in columns[t]:
        attrs = []
        if c["name"] in pks[t]:
            attrs.append("pk")
        if c["name"] in uks[t]:
            attrs.append("unique")
        if not c["nullable"]:
            attrs.append("not null")
        suffix = f' [{", ".join(attrs)}]' if attrs else ""
        dbml.append(f'  "{c["name"]}" {short_type(c)}{suffix}')
    dbml.append(f'  Note: "{note}"')
    dbml.append("}\n")
for f in fks:
    dbml.append(f'Ref: {f["table"]}.{f["column"]} > {f["ref_table"]}.{f["ref_column"]}')
dbml.append("")
for key, tables in grouped.items():
    if not tables:
        continue
    dbml.append(f'TableGroup "{labels[key]}" {{')
    dbml += [f"  {t}" for t in tables]
    dbml.append("}\n")
with open(f"{OUT}/ERD.dbml", "w", encoding="utf-8") as fh:
    fh.write("\n".join(dbml))


# ---------- Mermaid ----------
ER_INIT = ('%%{init: {"theme":"base","themeVariables":{'
           '"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"14px",'
           '"primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07",'
           '"lineColor":"#9E4A45","textColor":"#1A1414",'
           '"attributeBackgroundColorOdd":"#FFFFFF","attributeBackgroundColorEven":"#FAF5F4"},'
           '"er":{"layoutDirection":"LR","entityPadding":12,"diagramPadding":16}}}%%')
FLOW_INIT = ('%%{init: {"theme":"base","themeVariables":{'
             '"fontFamily":"Inter, Segoe UI, Arial, sans-serif","fontSize":"15px",'
             '"primaryColor":"#FDEBE9","primaryTextColor":"#1A1414","primaryBorderColor":"#D40A07",'
             '"lineColor":"#9E4A45","textColor":"#1A1414"}}}%%')


def mermaid_for(tables, edges):
    lines = [ER_INIT, "erDiagram"]
    inside = set(tables)
    stubs = sorted({f["ref_table"] for f in edges if f["ref_table"] not in inside})
    for t in tables:
        shown = [c for c in columns[t]
                 if c["name"] in pks[t] or c["name"] in fkcols[t] or c["name"] in HILITE][:9]
        if not shown:
            shown = columns[t][:4]
        lines.append(f"  {safe(t)} {{")
        for c in shown:
            keys = [k for k, ok in (("PK", c["name"] in pks[t]), ("FK", c["name"] in fkcols[t])) if ok]
            lines.append(f'    {safe(base_type(c))} {safe(c["name"])} {", ".join(keys)}'.rstrip())
        lines.append("  }")
    for s in stubs:
        lines.append(f"  {safe(s)} {{")
        lines.append(f'    thuoc_nhom {ascii_fold(labels[group_of(s)[0]])}')
        lines.append("  }")
    drawn = set()
    for f in edges:
        e = (f["ref_table"], f["table"], f["column"])
        if e in drawn:
            continue
        drawn.add(e)
        lines.append(f'  {safe(f["ref_table"])} ||--o{{ {safe(f["table"])} : "{f["column"]}"')
    return "\n".join(lines)


md = ["# Sơ đồ quan hệ dữ liệu (ERD) - BigBike", "",
      "> File này được **sinh tự động** bằng `bash scripts/ops/export-erd.sh` từ cơ sở dữ liệu đang chạy.",
      "> Không sửa tay. Đây là ảnh chụp hiện trạng, không phải tài liệu hợp đồng - contract nằm ở `DATA_CONTRACT.md`.",
      f"> Sinh lúc: {datetime.now(timezone(timedelta(hours=7))).strftime('%Y-%m-%d %H:%M')} (giờ VN)", "",
      f"**Tổng quan:** {len(columns)} bảng, {sum(len(v) for v in columns.values())} cột, "
      f"{len(fks)} liên kết khoá ngoại, {vn(sum(counts.values()))} dòng dữ liệu.", "",
      "## Bản đồ nhóm nghiệp vụ", "", "```mermaid", FLOW_INIT, "flowchart LR"]
cross = defaultdict(int)
for f in fks:
    a, b = group_of(f["table"])[0], group_of(f["ref_table"])[0]
    if a != b:
        cross[(a, b)] += 1
for key, tables in grouped.items():
    if tables:
        md.append(f'  {ascii_fold(key)}["{labels[key]}<br/>{len(tables)} bảng · '
                  f'{vn(sum(counts.get(t, 0) for t in tables))} dòng"]')
for (a, b), n in sorted(cross.items()):
    md.append(f"  {ascii_fold(a)} -->|{n} liên kết| {ascii_fold(b)}")
md.append("  classDef grp fill:#FDEBE9,stroke:#D40A07,stroke-width:1.2px,color:#1A1414;")
md.append("  class " + ",".join(ascii_fold(k) for k, v in grouped.items() if v) + " grp;")
overview_mmd = "\n".join(md[md.index(FLOW_INIT):])
md += ["```", ""]

diagrams = OrderedDict()

for key, tables in grouped.items():
    if not tables:
        continue
    edges = [f for f in fks if f["table"] in set(tables)]
    md += [f"## {labels[key]}", "",
           f"{len(tables)} bảng · {vn(sum(counts.get(t, 0) for t in tables))} dòng.", "",
           "| Bảng | Số dòng | Ghi chú |", "|---|---:|---|"]
    for t in tables:
        md.append(f"| `{t}` | {vn(counts.get(t, 0))} | {'⚠️ bảng tạm/backup' if JUNK.search(t) else ''} |")
    diagrams[key] = mermaid_for(tables, edges)
    md += ["", "```mermaid", diagrams[key], "```", ""]

if soft:
    md += ["## Liên kết ngầm (không có ràng buộc khoá ngoại trong CSDL)", "",
           "Các cột dưới đây trỏ tới bảng khác theo quy ước đặt tên nhưng **không** được cơ sở dữ liệu ràng buộc,",
           "nên không hiện thành mũi tên trong sơ đồ. Dữ liệu mồ côi ở đây sẽ không bị chặn tự động.", "",
           "| Bảng | Cột |", "|---|---|"]
    md += [f'| `{s["table"]}` | `{s["column"]}` |' for s in soft]
    md.append("")

with open(f"{OUT}/ERD.md", "w", encoding="utf-8") as fh:
    fh.write("\n".join(md))

with open(f"{OUT}/ERD.json", "w", encoding="utf-8") as fh:
    json.dump({"generated_at": datetime.now(timezone(timedelta(hours=7))).isoformat(),
               "tables": {t: {"group": group_of(t)[1], "rows": counts.get(t, 0),
                              "primary_key": sorted(pks[t]), "columns": columns[t]} for t in sorted(columns)},
               "foreign_keys": fks, "implicit_links": soft}, fh, ensure_ascii=False, indent=2)


# ---------- Trang HTML xem trực quan ----------
def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


BLURB = {
    "San pham & danh muc": "Hàng hoá bán trên web: sản phẩm, phiên bản (màu/size), thương hiệu, danh mục, bảng cỡ và lịch sử xuất nhập kho.",
    "Khach hang": "Tài khoản khách, sổ địa chỉ giao hàng, phiên đăng nhập, liên kết đăng nhập mạng xã hội và các phiếu xác thực email.",
    "Don hang": "Từ giỏ hàng tới đơn hàng: dòng hàng, phí, vận chuyển, ghi chú, thanh toán và các đợt nhắc đơn quá hạn.",
    "Danh gia": "Đánh giá sản phẩm của khách, ảnh kèm theo và các chiến dịch mời khách viết đánh giá sau khi mua.",
    "Noi dung web": "Phần nội dung hiển thị ra ngoài: bài viết, thư viện ảnh, menu, slider, khối trang chủ, cấu hình chung và bảng chuyển hướng đường dẫn cũ.",
    "Quan tri": "Tài khoản nhân sự quản trị, vai trò và quyền, nhật ký thao tác, thông báo trong trang quản trị.",
    "Tro ly chat": "Trợ lý BigBike trên website: khách ẩn danh, hội thoại, tin nhắn, ảnh gửi kèm và hạn mức dùng mỗi ngày.",
    "Ky thuat": "Bảng phục vụ vận hành hệ thống: lịch sử nâng cấp cơ sở dữ liệu, tiến trình chuyển dữ liệu, bản sao lưu tạm.",
    "Khac": "Chưa xếp được vào nhóm nghiệp vụ nào.",
}

total_rows = sum(counts.values())
junk_tables = sorted(t for t in columns if JUNK.search(t))
stamp = datetime.now(timezone(timedelta(hours=7))).strftime("%d/%m/%Y %H:%M")

h = []
h.append("<title>Bản đồ dữ liệu BigBike</title>")
h.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
h.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
h.append('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Inter:wght@400;500;600&family=Oswald:wght@500;600&'
         'family=JetBrains+Mono:wght@400;600&display=swap">')
h.append("""<style>
:root{
  --ground:#FAF7F6; --surface:#FFFFFF; --surface-2:#F4EFEE; --ink:#191313; --ink-2:#6B5D5C;
  --line:#E6DBD9; --line-2:#D6C8C6; --accent:#D40A07; --accent-soft:#FBE9E8; --warn:#8A5310;
  --warn-soft:#FBEFDD; --shadow:0 1px 2px rgba(60,30,28,.06),0 8px 24px rgba(60,30,28,.05);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#141010; --surface:#1C1716; --surface-2:#241D1C; --ink:#F2EBEA; --ink-2:#A4948F;
  --line:#302625; --line-2:#413433; --accent:#FF5A4D; --accent-soft:#3A1B18; --warn:#E0A758;
  --warn-soft:#372616; --shadow:0 1px 2px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.28);
}}
:root[data-theme="dark"]{
  --ground:#141010; --surface:#1C1716; --surface-2:#241D1C; --ink:#F2EBEA; --ink-2:#A4948F;
  --line:#302625; --line-2:#413433; --accent:#FF5A4D; --accent-soft:#3A1B18; --warn:#E0A758;
  --warn-soft:#372616; --shadow:0 1px 2px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.28);
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Oswald,"Arial Narrow",Impact,sans-serif;font-weight:600;letter-spacing:.01em;
  text-wrap:balance;margin:0}
code,.mono{font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
a{color:var(--accent)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px 72px}
header.top{border-bottom:1px solid var(--line);background:var(--surface);margin-bottom:28px}
.top-in{max-width:1180px;margin:0 auto;padding:26px 20px 22px;display:flex;flex-wrap:wrap;
  gap:16px;align-items:flex-end;justify-content:space-between}
h1{font-size:34px;line-height:1.1}
.sub{color:var(--ink-2);font-size:13.5px;margin-top:6px}
.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600}
.stats{display:flex;gap:26px;flex-wrap:wrap}
.stat{display:flex;flex-direction:column}
.stat b{font-family:Oswald,sans-serif;font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1}
.stat span{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.layout{display:grid;grid-template-columns:238px minmax(0,1fr);gap:34px;align-items:start}
@media (max-width:900px){.layout{grid-template-columns:1fr}nav.side{position:static !important}}
nav.side{position:sticky;top:18px}
nav.side ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
nav.side a{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:6px;
  text-decoration:none;color:var(--ink);font-size:13.5px;border-left:2px solid transparent}
nav.side a:hover{background:var(--surface-2);border-left-color:var(--accent)}
nav.side a i{font-style:normal;color:var(--ink-2);font-variant-numeric:tabular-nums;font-size:12.5px}
.nav-h{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);
  font-weight:600;margin:0 0 10px 10px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow)}
.panel-h{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;gap:12px;
  align-items:baseline;justify-content:space-between;flex-wrap:wrap}
.panel-h h2{font-size:21px}
.panel-b{padding:18px 20px}
.note{color:var(--ink-2);font-size:13.5px;max-width:66ch;margin:0}
section.grp{margin-top:30px;scroll-margin-top:18px}
.tbl-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{text-align:left;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);
  font-weight:600;padding:0 12px 8px 0;border-bottom:1px solid var(--line)}
td{padding:7px 12px 7px 0;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;padding-right:0}
.tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:999px;
  background:var(--warn-soft);color:var(--warn);white-space:nowrap}
.diagram{border-top:1px solid var(--line);background:var(--surface-2);
  border-radius:0 0 10px 10px}
.diagram-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;
  padding:9px 20px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--ink-2)}
.zoom{display:flex;gap:6px}
button.z{font:inherit;font-size:13px;line-height:1;padding:5px 10px;border:1px solid var(--line-2);
  background:var(--surface);color:var(--ink);border-radius:6px;cursor:pointer}
button.z:hover{border-color:var(--accent);color:var(--accent)}
button.z:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.scroller{overflow:auto;max-height:78vh;padding:16px 20px 22px;background:#FCFAF9;
  border-radius:0 0 9px 9px}
.scroller pre.mermaid{margin:0;background:transparent}
.scroller pre.mermaid svg{max-width:none !important;height:auto}
#find{width:100%;font:inherit;font-size:14px;padding:9px 12px;border:1px solid var(--line-2);
  border-radius:8px;background:var(--surface);color:var(--ink)}
#find:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
#idx{list-style:none;margin:12px 0 0;padding:0;max-height:300px;overflow:auto;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:2px}
#idx a{display:flex;justify-content:space-between;gap:10px;padding:5px 9px;border-radius:6px;
  text-decoration:none;color:var(--ink);font-size:13px}
#idx a:hover{background:var(--surface-2)}
#idx .g{color:var(--ink-2);font-size:11.5px;white-space:nowrap}
#none{color:var(--ink-2);font-size:13.5px;margin:12px 0 0;display:none}
footer{margin-top:40px;border-top:1px solid var(--line);padding-top:20px;color:var(--ink-2);font-size:13px}
footer code{background:var(--surface-2);padding:2px 6px;border-radius:5px;font-size:12.5px}
footer ol{padding-left:18px;max-width:70ch}
@media (prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
</style>""")

h.append('<header class="top"><div class="top-in"><div>')
h.append('<p class="eyebrow">Sơ đồ quan hệ dữ liệu</p>')
h.append("<h1>Bản đồ dữ liệu BigBike</h1>")
h.append(f'<p class="sub">Chụp từ cơ sở dữ liệu đang chạy · {stamp}</p></div>')
h.append('<div class="stats">')
for val, lab in ((f"{len(columns)}", "bảng"), (f"{len(fks)}", "liên kết"),
                 (vn(sum(len(v) for v in columns.values())), "cột"),
                 (vn(total_rows), "dòng dữ liệu")):
    h.append(f"<div class=\"stat\"><b>{val}</b><span>{lab}</span></div>")
h.append("</div></div></header>")

h.append('<div class="wrap"><div class="layout">')
h.append('<nav class="side"><p class="nav-h">Nhóm nghiệp vụ</p><ol>')
for key, tables in grouped.items():
    if tables:
        h.append(f'<li><a href="#{ascii_fold(key)}">{esc(labels[key])}<i>{len(tables)}</i></a></li>')
h.append('</ol></nav><main>')

h.append('<div class="panel"><div class="panel-h"><h2>Toàn cảnh</h2></div><div class="panel-b">')
h.append('<p class="note">Tám nhóm dữ liệu và số liên kết giữa chúng. Mũi tên đi từ nhóm '
         "phụ thuộc sang nhóm được tham chiếu — ví dụ đơn hàng phụ thuộc vào khách hàng.</p></div>")
h.append('<div class="diagram"><div class="scroller">'
         f'<pre class="mermaid">{esc(overview_mmd)}</pre></div></div></div>')

h.append('<div class="panel" style="margin-top:22px"><div class="panel-h"><h2>Tra cứu nhanh</h2>'
         f'<span class="note">{len(columns)} bảng</span></div><div class="panel-b">')
h.append('<input id="find" type="search" placeholder="Gõ tên bảng, ví dụ: orders, product, chat…" '
         'aria-label="Tìm bảng dữ liệu">')
h.append('<ul id="idx">')
for t in sorted(columns):
    h.append(f'<li><a href="#{ascii_fold(group_of(t)[0])}" data-t="{esc(t)}">'
             f'<span class="mono">{esc(t)}</span>'
             f'<span class="g">{esc(labels[group_of(t)[0]])}</span></a></li>')
h.append('</ul><p id="none">Không có bảng nào khớp.</p></div></div>')

for key, tables in grouped.items():
    if not tables:
        continue
    rows = sum(counts.get(t, 0) for t in tables)
    h.append(f'<section class="grp" id="{ascii_fold(key)}"><div class="panel">')
    h.append(f'<div class="panel-h"><h2>{esc(labels[key])}</h2>'
             f'<span class="note">{len(tables)} bảng · {vn(rows)} dòng</span></div>')
    h.append(f'<div class="panel-b"><p class="note">{esc(BLURB.get(key, ""))}</p>')
    h.append('<div class="tbl-wrap" style="margin-top:14px"><table><thead><tr>'
             '<th>Bảng</th><th class="num">Dòng</th><th class="num">Cột</th><th>Ghi chú</th>'
             "</tr></thead><tbody>")
    for t in tables:
        note = '<span class="tag">bảng tạm / sao lưu</span>' if JUNK.search(t) else ""
        h.append(f'<tr><td class="mono">{esc(t)}</td>'
                 f'<td class="num">{vn(counts.get(t, 0))}</td>'
                 f'<td class="num">{len(columns[t])}</td><td>{note}</td></tr>')
    h.append("</tbody></table></div></div>")
    h.append('<div class="diagram"><div class="diagram-bar">'
             "<span>Khoá chính (PK) và khoá liên kết (FK) của từng bảng · kéo ngang để xem hết</span>"
             '<span class="zoom"><button class="z" data-z="-1" aria-label="Thu nhỏ">−</button>'
             '<button class="z" data-z="0">100%</button>'
             '<button class="z" data-z="1" aria-label="Phóng to">+</button></span></div>')
    h.append(f'<div class="scroller"><pre class="mermaid">{esc(diagrams[key])}</pre></div></div>')
    h.append("</div></section>")

if soft:
    h.append('<section class="grp"><div class="panel"><div class="panel-h">'
             "<h2>Liên kết ngầm</h2>"
             f'<span class="note">{len(soft)} cột</span></div><div class="panel-b">')
    h.append('<p class="note">Những cột này trỏ sang bảng khác theo quy ước đặt tên nhưng '
             "cơ sở dữ liệu <strong>không</strong> ràng buộc, nên không hiện thành mũi tên trong sơ đồ. "
             "Nếu bản ghi gốc bị xoá, dữ liệu ở đây có thể trỏ vào chỗ trống mà hệ thống không cảnh báo.</p>")
    h.append('<div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>Bảng</th>'
             "<th>Cột</th></tr></thead><tbody>")
    for s_ in soft:
        h.append(f'<tr><td class="mono">{esc(s_["table"])}</td>'
                 f'<td class="mono">{esc(s_["column"])}</td></tr>')
    h.append("</tbody></table></div></div></div></section>")

h.append("<footer><p><strong>Cách tạo lại bản đồ này</strong> — chạy trên máy chủ đang chạy hệ thống:</p>")
h.append("<ol><li><code>bash scripts/ops/export-erd.sh</code> — đọc cấu trúc dữ liệu, không đụng vào dữ liệu.</li>"
         "<li>Kết quả nằm ở thư mục gốc dự án: "
         "<code>ERD.dbml</code> (dán vào dbdiagram.io để kéo thả, xuất PNG/PDF), "
         "<code>ERD.md</code> (sơ đồ đọc thẳng trên GitHub), "
         "<code>ERD.html</code> (trang này), "
         "<code>ERD.json</code> (dữ liệu thô).</li></ol>")
h.append(f"<p>Số dòng là số thực tế lúc {stamp}. "
         f"Có {len(junk_tables)} bảng tạm hoặc sao lưu còn sót lại: "
         + ", ".join(f"<code>{esc(t)}</code>" for t in junk_tables) + ".</p></footer>")
h.append("</main></div></div>")

h.append("""<script>
(function(){
  var find=document.getElementById('find'),idx=document.getElementById('idx'),
      none=document.getElementById('none'),items=idx.querySelectorAll('li');
  find.addEventListener('input',function(){
    var q=find.value.trim().toLowerCase(),n=0;
    items.forEach(function(li){
      var hit=!q||li.firstElementChild.dataset.t.toLowerCase().indexOf(q)>-1;
      li.hidden=!hit; if(hit)n++;
    });
    none.style.display=n?'none':'block';
  });
  document.querySelectorAll('.zoom').forEach(function(box){
    var sc=box.closest('.diagram').querySelector('.scroller'),lv=1;
    box.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b)return;
      var d=parseInt(b.dataset.z,10);
      lv = d===0 ? 1 : Math.min(2.4,Math.max(.5,lv+d*0.2));
      sc.style.zoom=lv;
      box.querySelector('[data-z="0"]').textContent=Math.round(lv*100)+'%';
    });
  });
})();
</script>""")

with open(f"{OUT}/ERD.html", "w", encoding="utf-8") as fh:
    fh.write("\n".join(h))


# ---------- File .md rời cho mermaid-viewer.com ----------
import os

SLUG = {"San pham & danh muc": "01-san-pham-danh-muc", "Khach hang": "02-khach-hang",
        "Don hang": "03-don-hang-thanh-toan", "Danh gia": "04-danh-gia",
        "Noi dung web": "05-noi-dung-web", "Quan tri": "06-quan-tri-phan-quyen",
        "Tro ly chat": "07-tro-ly-chat", "Ky thuat": "08-ky-thuat-van-hanh", "Khac": "09-khac"}

MM = f"{OUT}/erd-mermaid"
os.makedirs(MM, exist_ok=True)
for old in os.listdir(MM):
    if old.endswith(".md"):
        os.remove(f"{MM}/{old}")


def write_diagram(fname, title, subtitle, body):
    with open(f"{MM}/{fname}", "w", encoding="utf-8") as fh:
        fh.write(f"# {title}\n\n{subtitle}\n\n```mermaid\n{body}\n```\n")


write_diagram("00-tong-quan.md", "Toàn cảnh dữ liệu BigBike",
              f"{len(columns)} bảng chia thành {sum(1 for v in grouped.values() if v)} nhóm nghiệp vụ. "
              f"Mũi tên: nhóm phụ thuộc → nhóm được tham chiếu.", overview_mmd)

for key, tables in grouped.items():
    if not tables:
        continue
    write_diagram(f"{SLUG[key]}.md", labels[key],
                  f"{len(tables)} bảng · {vn(sum(counts.get(t, 0) for t in tables))} dòng · "
                  "chỉ hiện khoá chính (PK) và khoá liên kết (FK).",
                  diagrams[key])

write_diagram("99-toan-he-thong.md", "Toàn bộ hệ thống trong một sơ đồ",
              f"Đủ {len(columns)} bảng và {len(fks)} liên kết. Sơ đồ rất lớn, "
              "trình duyệt có thể mất vài giây để vẽ - dùng các file theo nhóm nếu chỉ cần một mảng.",
              mermaid_for(sorted(columns), fks))

with open(f"{MM}/README.md", "w", encoding="utf-8") as fh:
    fh.write("# Sơ đồ ERD dạng Mermaid\n\n"
             "Mỗi file chứa **một** sơ đồ, kéo thả thẳng vào https://mermaid-viewer.com "
             "(hoặc mở trên GitHub / VS Code) là ra hình.\n\n"
             "| File | Nội dung |\n|---|---|\n"
             "| `00-tong-quan.md` | Bản đồ 8 nhóm nghiệp vụ - xem cái này trước |\n"
             + "".join(f"| `{SLUG[k]}.md` | {labels[k]} ({len(v)} bảng) |\n"
                       for k, v in grouped.items() if v)
             + "| `99-toan-he-thong.md` | Tất cả bảng trong một sơ đồ (nặng) |\n\n"
             "Sinh lại bằng `bash scripts/ops/export-erd.sh`. Không sửa tay.\n")
