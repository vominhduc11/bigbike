"""
BigBike Admin API - Full flow test
Tests: Products+Variants, Inventory, Categories, Brands, Content, Sliders, Videos, Menus, Redirects, Reports, SePay
"""
import sys, json, time, random
import urllib.request, urllib.error
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://localhost:8080/api/v1"
results = []
RND = random.randint(10000, 99999)

def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            if not raw or not raw.strip():
                return resp.status, {}
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, {"_raw": raw[:200].decode("utf-8", errors="replace")}
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
            if not raw or not raw.strip():
                return e.code, {}
            try:
                return e.code, json.loads(raw)
            except Exception:
                return e.code, {"_raw": raw[:200].decode("utf-8", errors="replace")}
        except Exception:
            return e.code, {}

def login():
    while True:
        status, body = req("POST", "/auth/login", body={"email": "admin@bigbike.vn", "password": "admin123"})
        if status == 429:
            print("  [WAIT] Rate limited, waiting 15s...")
            time.sleep(15)
            continue
        if status in (200, 201) and "data" in body:
            return body["data"]["accessToken"]
        print(f"  [ERROR] Login failed: {status} {body}")
        sys.exit(1)

def check(label, cond, detail=""):
    tag = "[PASS]" if cond else "[FAIL]"
    msg = f"  {tag} {label}"
    if detail and not cond:
        msg += f" | {str(detail)[:120]}"
    print(msg)
    results.append((tag, label))
    return cond

TOKEN = login()
print(f"Logged in OK  [run suffix: {RND}]\n")

# ─── PRODUCTS WITH VARIANTS ───────────────────────────────────────────
print("=== GROUP B: PRODUCTS ADVANCED ===")
print("--- Variants ---")
s, r = req("POST", "/admin/products", TOKEN, {
    "name": f"Variant Test Product {RND}", "slug": f"variant-test-{RND}",
    "sku": f"VAR-TEST-{RND}", "retailPrice": 500000, "currency": "VND",
    "publishStatus": "DRAFT", "stockState": "IN_STOCK",
    "categoryId": "wp-cat-6291", "brandId": "wp-brand-5657",
    "variants": [
        {"sku": f"VAR-S-BLK-{RND}", "options": [{"optionName": "Size", "optionValue": "S"}, {"optionName": "Mau", "optionValue": "Den"}], "retailPrice": 500000, "stockState": "IN_STOCK"},
        {"sku": f"VAR-L-WHT-{RND}", "options": [{"optionName": "Size", "optionValue": "L"}, {"optionName": "Mau", "optionValue": "Trang"}], "retailPrice": 550000, "stockState": "IN_STOCK"}
    ]
})
VPID = r.get("data", {}).get("id", "")
vcount = len(r.get("data", {}).get("variants", []))
check("POST product with 2 variants", bool(VPID) and vcount == 2, r.get("error"))

s, r = req("GET", f"/admin/products/{VPID}", TOKEN)
variants = r.get("data", {}).get("variants", [])
VID = variants[0]["id"] if variants else ""
check("GET product detail -> variants present", len(variants) == 2, r.get("error"))

if VID and variants:
    s, r = req("PATCH", f"/admin/products/{VPID}", TOKEN, {
        "variants": [{"sku": f"VAR-S-BLK-{RND}", "options": [{"optionName": "Size", "optionValue": "S"}, {"optionName": "Mau", "optionValue": "Den"}], "retailPrice": 620000, "stockState": "IN_STOCK"}]
    })
    updated_variants = r.get("data", {}).get("variants", [])
    new_price = None
    for v in updated_variants:
        if "BLK" in v.get("sku", ""):
            new_price = v.get("price", {}).get("retailPrice")
            VID = v.get("id", VID)  # refresh VID — PATCH replaces variants with new IDs
            break
    check("PATCH variant price -> 620000", new_price in (620000, 620000.0), f"got={new_price}")

print("\n--- Inventory ---")
s, r = req("GET", "/admin/inventory", TOKEN)
check("GET /admin/inventory", s == 200, r.get("error"))
s, r = req("GET", "/admin/inventory/summary", TOKEN)
check("GET /admin/inventory/summary", s == 200, r.get("error"))
s, r = req("GET", "/admin/inventory/movements", TOKEN)
check("GET /admin/inventory/movements", s == 200, r.get("error"))
s, r = req("GET", "/admin/inventory?stockState=IN_STOCK", TOKEN)
check("GET inventory?stockState=IN_STOCK", s == 200, r.get("error"))

if VID:
    s, r = req("POST", f"/admin/inventory/variants/{VID}/adjust", TOKEN, {"quantityDelta": 5, "reason": "ADJUSTMENT", "note": "Auto test +5"})
    check("POST inventory adjust +5", s in (200, 201), r.get("error"))
    req("POST", f"/admin/inventory/variants/{VID}/adjust", TOKEN, {"quantityDelta": -5, "reason": "ADJUSTMENT", "note": "Auto test restore"})
    print("  [INFO] Inventory restored")

print("\n--- Categories ---")
s, r = req("GET", "/admin/categories", TOKEN)
check("GET /admin/categories", s == 200, r.get("error"))
s, r = req("POST", "/admin/categories", TOKEN, {"name": f"Test Cat {RND}", "slug": f"test-cat-{RND}-auto", "isVisible": True})
CATID = r.get("data", {}).get("id", "")
check("POST /admin/categories", bool(CATID), r.get("error"))
if CATID:
    s, r = req("GET", f"/admin/categories/{CATID}", TOKEN)
    check("GET /admin/categories/{id}", s == 200, r.get("error"))
    s, r = req("PATCH", f"/admin/categories/{CATID}", TOKEN, {"name": f"Test Cat {RND} Updated", "description": "Test desc"})
    check("PATCH category name", r.get("data", {}).get("name") == f"Test Cat {RND} Updated", r.get("error"))
    s, r = req("DELETE", f"/admin/categories/{CATID}", TOKEN)
    check("DELETE category (soft)", s in (200, 204), r.get("error"))

print("\n--- Brands ---")
s, r = req("GET", "/admin/brands", TOKEN)
check("GET /admin/brands", s == 200, r.get("error"))
s, r = req("POST", "/admin/brands", TOKEN, {"name": f"Test Brand {RND}", "slug": f"test-brand-{RND}-auto", "isVisible": True})
BRID = r.get("data", {}).get("id", "")
check("POST /admin/brands", bool(BRID), r.get("error"))
if BRID:
    s, r = req("GET", f"/admin/brands/{BRID}", TOKEN)
    check("GET /admin/brands/{id}", s == 200, r.get("error"))
    s, r = req("PATCH", f"/admin/brands/{BRID}", TOKEN, {"name": f"Test Brand {RND} Updated", "description": "Test brand desc"})
    check("PATCH brand name", r.get("data", {}).get("name") == f"Test Brand {RND} Updated", r.get("error"))
    s, r = req("DELETE", f"/admin/brands/{BRID}", TOKEN)
    check("DELETE brand", s in (200, 204), r.get("error"))

# Cleanup variant product
req("DELETE", f"/admin/products/{VPID}", TOKEN)
print("  [INFO] Variant product cleaned up")

# ─── CONTENT ──────────────────────────────────────────────────────────
print("\n=== GROUP C: CONTENT ===")
print("--- Articles ---")
s, r = req("GET", "/admin/content?type=ARTICLE", TOKEN)
check("GET /admin/content?type=ARTICLE", s == 200, r.get("error"))
s, r = req("POST", "/admin/content/articles", TOKEN, {
    "title": f"Test Article {RND}", "slug": f"test-article-{RND}",
    "publishStatus": "DRAFT", "shortDescription": "Auto test", "body": "<p>Test</p>"
})
AID = r.get("data", {}).get("id", "")
check("POST /admin/content/articles", bool(AID), r.get("error") or r)
if AID:
    s, r = req("GET", f"/admin/content/article/{AID}", TOKEN)
    check("GET /admin/content/article/{id}", s == 200, r.get("error"))
    s, r = req("PATCH", f"/admin/content/articles/{AID}", TOKEN, {"title": f"Test Article {RND} Updated", "publishStatus": "PUBLISHED"})
    check("PATCH article title + publish", r.get("data", {}).get("title") == f"Test Article {RND} Updated", r.get("error"))
    s, r = req("DELETE", f"/admin/content/article/{AID}", TOKEN)
    check("DELETE article", s in (200, 204), r.get("error"))

print("\n--- Pages ---")
s, r = req("GET", "/admin/content?type=PAGE", TOKEN)
check("GET /admin/content?type=PAGE", s == 200, r.get("error"))
s, r = req("POST", "/admin/content/pages", TOKEN, {
    "title": f"Test Page {RND}", "slug": f"test-page-{RND}",
    "publishStatus": "DRAFT", "body": "<p>Test page</p>", "pageType": "CUSTOM"
})
PID = r.get("data", {}).get("id", "")
check("POST /admin/content/pages", bool(PID), r.get("error") or r)
if PID:
    s, r = req("PATCH", f"/admin/content/pages/{PID}", TOKEN, {"title": f"Test Page {RND} Updated"})
    check("PATCH page title", r.get("data", {}).get("title") == f"Test Page {RND} Updated", r.get("error"))
    s, r = req("DELETE", f"/admin/content/page/{PID}", TOKEN)
    check("DELETE page", s in (200, 204), r.get("error"))

print("\n--- Media ---")
s, r = req("GET", "/admin/media", TOKEN)
check("GET /admin/media", s == 200, r.get("error"))
s, r = req("GET", "/admin/media?q=png", TOKEN)
check("GET /admin/media?q=png search", s == 200, r.get("error"))
media_items = r.get("data", [])
if media_items:
    mid = media_items[0].get("id")
    orig_alt = media_items[0].get("alt", "")
    s, r = req("PATCH", f"/admin/media/{mid}", TOKEN, {"alt": "Updated alt text auto test"})
    check("PATCH media alt text", s == 200, r.get("error"))
    req("PATCH", f"/admin/media/{mid}", TOKEN, {"alt": orig_alt})

print("\n--- Sliders ---")
s, r = req("GET", "/admin/sliders", TOKEN)
check("GET /admin/sliders", s == 200, r.get("error"))
sort_order = RND % 900 + 100
s, r = req("POST", "/admin/sliders", TOKEN, {
    "title": f"Test Slider {RND}", "imageUrl": "https://example.com/test.jpg",
    "externalLink": "/san-pham", "location": "home", "isActive": True, "sortOrder": sort_order
})
SLID = r.get("data", {}).get("id", "")
check("POST /admin/sliders", bool(SLID), r.get("error") or r)
if SLID:
    # GET /admin/sliders/{id} route does not exist in backend — skip
    results.append(("[SKIP]", "GET /admin/sliders/{id} (no route in backend)"))
    print("  [SKIP] GET /admin/sliders/{id} — no GET-by-id route in backend")
    s, r = req("PATCH", f"/admin/sliders/{SLID}", TOKEN, {"isActive": False})
    check("PATCH slider deactivate", s == 200, r.get("error"))
    s, r = req("DELETE", f"/admin/sliders/{SLID}", TOKEN)
    check("DELETE slider", s in (200, 204), r.get("error"))

print("\n--- Home Videos ---")
s, r = req("GET", "/admin/home-videos", TOKEN)
check("GET /admin/home-videos", s == 200, r.get("error"))
s, r = req("POST", "/admin/home-videos", TOKEN, {
    "title": f"Test Video {RND}", "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "sortOrder": sort_order + 1, "isActive": True
})
HVID = r.get("data", {}).get("id", "")
check("POST /admin/home-videos", bool(HVID), r.get("error") or r)
if HVID:
    s, r = req("PATCH", f"/admin/home-videos/{HVID}", TOKEN, {"title": f"Test Video {RND} Updated"})
    check("PATCH home-video title", r.get("data", {}).get("title") == f"Test Video {RND} Updated", r.get("error"))
    s, r = req("DELETE", f"/admin/home-videos/{HVID}", TOKEN)
    check("DELETE home-video", s in (200, 204), r.get("error"))

print("\n--- Menus ---")
s, r = req("GET", "/admin/menus", TOKEN)
check("GET /admin/menus", s == 200, r.get("error"))
menus = r.get("data", [])
if menus:
    mid = menus[0].get("id")
    s, r = req("GET", f"/admin/menus/{mid}", TOKEN)
    check("GET /admin/menus/{id}", s == 200, r.get("error"))
    items = r.get("data", {}).get("items", [])
    print(f"  [INFO] Menu '{menus[0].get('name')}' has {len(items)} items")

print("\n--- Redirects ---")
s, r = req("GET", "/admin/redirects", TOKEN)
check("GET /admin/redirects", s == 200, r.get("error"))
s, r = req("POST", "/admin/redirects", TOKEN, {
    "sourcePattern": f"/test-old-url-{RND}", "targetUrl": "/san-pham",
    "redirectType": "PERMANENT", "isEnabled": True
})
RDID = r.get("data", {}).get("id", "")
check("POST /admin/redirects", bool(RDID), r.get("error"))
if RDID:
    s, r = req("GET", f"/admin/redirects/{RDID}", TOKEN)
    check("GET /admin/redirects/{id}", s == 200, r.get("error"))
    s, r = req("PATCH", f"/admin/redirects/{RDID}", TOKEN, {"isEnabled": False})
    check("PATCH redirect disable", s == 200, r.get("error"))
    s, r = req("DELETE", f"/admin/redirects/{RDID}", TOKEN)
    check("DELETE redirect", s in (200, 204), r.get("error"))

# ─── ORDERS ───────────────────────────────────────────────────────────
print("\n=== GROUP E: ORDERS ===")
s, r = req("GET", "/admin/orders", TOKEN)
check("GET /admin/orders", s == 200, r.get("error"))
s, r = req("GET", "/admin/orders?status=PENDING", TOKEN)
check("GET /admin/orders?status=PENDING", s == 200, r.get("error"))
pending_orders = r.get("data", [])

s, r = req("GET", "/admin/orders?status=COMPLETED", TOKEN)
check("GET /admin/orders?status=COMPLETED", s == 200, r.get("error"))

OID = pending_orders[0].get("id") if pending_orders else ""
if OID:
    s, r = req("GET", f"/admin/orders/{OID}", TOKEN)
    check("GET /admin/orders/{id}", s == 200, r.get("error"))
    s, r = req("PATCH", f"/admin/orders/{OID}/status", TOKEN, {"status": "PROCESSING"})
    check("PATCH order PENDING->PROCESSING", s in (200, 201), r.get("error"))
    s, r = req("POST", f"/admin/orders/{OID}/notes", TOKEN, {"content": "Auto test note"})
    check("POST order note", s in (200, 201), r.get("error"))
else:
    print("  [INFO] No PENDING orders found — skipping order status transition")
    results.append(("[SKIP]", "PATCH order PENDING->PROCESSING"))
    results.append(("[SKIP]", "POST order note"))

# ─── CUSTOMERS ────────────────────────────────────────────────────────
print("\n=== GROUP F: CUSTOMERS ===")
s, r = req("GET", "/admin/customers", TOKEN)
check("GET /admin/customers", s == 200, r.get("error"))
customers = r.get("data", [])
CUS_ID = customers[0].get("id") if customers else ""
if CUS_ID:
    s, r = req("GET", f"/admin/customers/{CUS_ID}", TOKEN)
    check("GET /admin/customers/{id}", s == 200, r.get("error"))

# ─── SETTINGS ─────────────────────────────────────────────────────────
print("\n=== GROUP G: SETTINGS ===")
s, r = req("GET", "/admin/settings", TOKEN)
check("GET /admin/settings", s == 200, r.get("error"))
settings_list = r.get("data", [])
if settings_list:
    key = settings_list[0].get("settingKey") or settings_list[0].get("key", "")
    orig_val = settings_list[0].get("settingValue") or settings_list[0].get("value", "")
    if key:
        s, r = req("PATCH", f"/admin/settings/{key}", TOKEN, {"settingValue": orig_val})
        check(f"PATCH /admin/settings/{key}", s == 200, r.get("error"))

# ─── SHIPPING ─────────────────────────────────────────────────────────
print("\n=== GROUP H: SHIPPING ===")
s, r = req("GET", "/admin/shipping/zones", TOKEN)
check("GET /admin/shipping/zones", s == 200, r.get("error"))
zones = r.get("data", [])
if zones:
    zid = zones[0].get("id")
    s, r = req("GET", f"/admin/shipping/zones/{zid}/methods", TOKEN)
    check("GET /admin/shipping/zones/{id}/methods", s == 200, r.get("error"))

# ─── ADMIN USERS ──────────────────────────────────────────────────────
print("\n=== GROUP I: ADMIN USERS ===")
s, r = req("GET", "/admin/admin-users", TOKEN)
check("GET /admin/admin-users", s == 200, r.get("error"))
admin_users = r.get("data", [])
if admin_users:
    uid = admin_users[0].get("id")
    s, r = req("GET", f"/admin/admin-users/{uid}", TOKEN)
    check("GET /admin/admin-users/{id}", s == 200, r.get("error"))

# ─── SEPAY SETTINGS ───────────────────────────────────────────────────
print("\n=== GROUP J: SEPAY ===")
s, r = req("GET", "/admin/settings/sepay", TOKEN)
check("GET /admin/settings/sepay", s == 200, r.get("error"))
if s == 200:
    orig = r
    s, r = req("PUT", "/admin/settings/sepay", TOKEN, {
        "enabled": orig.get("data", {}).get("enabled", False),
        "bankName": orig.get("data", {}).get("bankName", ""),
    })
    check("PUT /admin/settings/sepay (no-op update)", s == 200, r.get("error"))

# ─── REPORTS ──────────────────────────────────────────────────────────
print("\n=== GROUP D: REPORTS ===")
s, r = req("GET", "/admin/reports/analytics?from=2026-04-01&to=2026-05-01", TOKEN)
check("GET analytics 30d", s == 200 and "summary" in r, r.get("error"))
print(f"  [INFO] Revenue: {r.get('summary', {}).get('totalRevenue', 0):,.0f} VND, {r.get('summary', {}).get('orderCount', 0)} orders")

s, r = req("GET", "/admin/reports/analytics?from=2026-04-24&to=2026-05-01", TOKEN)
check("GET analytics 7d", s == 200 and "summary" in r, r.get("error"))

s, r = req("GET", "/admin/reports/orders/export?from=2026-04-01&to=2026-05-01", TOKEN)
check("GET reports/orders/export", s in (200, 204), r.get("error"))

s, r = req("GET", "/admin/reports/customers/export", TOKEN)
check("GET reports/customers/export", s in (200, 204), r.get("error"))

s, r = req("GET", "/admin/reports/products/export", TOKEN)
check("GET reports/products/export", s in (200, 204), r.get("error"))

# ─── SUMMARY ─────────────────────────────────────────────────────────
print("\n" + "=" * 50)
passed = sum(1 for t, _ in results if t == "[PASS]")
failed = sum(1 for t, _ in results if t == "[FAIL]")
skipped = sum(1 for t, _ in results if t == "[SKIP]")
print(f"TOTAL: {passed} PASS / {failed} FAIL / {skipped} SKIP / {len(results)} tests")
if failed:
    print("\nFailed tests:")
    for tag, label in results:
        if tag == "[FAIL]":
            print(f"  - {label}")
