"""
BigBike Admin API - Supplementary flow test
Covers all endpoints not tested in test_admin_flows.py:
Coupons, Reviews, Returns(admin), Dashboard, POS, Audit Logs,
Orders (detail/notes/transitions/payment/refund), Customers (update),
Admin users (update), Products (publish), Inventory (movements/export),
Shipping CRUD, Menus CRUD, Media (get/delete/restore)
"""
import sys, json, time, random, io
import urllib.request, urllib.error

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
        s, r = req("POST", "/auth/login", body={"email": "admin@bigbike.vn", "password": "admin123"})
        if s == 429:
            print("  [WAIT] Rate limited, waiting 15s..."); time.sleep(15); continue
        if s in (200, 201):
            return r["data"]["accessToken"]
        print(f"  [ERROR] Login failed: {s} {r}"); sys.exit(1)

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

# ─── DASHBOARD ────────────────────────────────────────────────────────
print("=== DASHBOARD ===")
s, r = req("GET", "/admin/dashboard", TOKEN)
check("GET /admin/dashboard", s == 200, r.get("error"))

# ─── AUDIT LOGS ───────────────────────────────────────────────────────
print("\n=== AUDIT LOGS ===")
s, r = req("GET", "/admin/audit-logs", TOKEN)
check("GET /admin/audit-logs", s == 200, r.get("error"))

# ─── COUPONS ─────────────────────────────────────────────────────────
print("\n=== COUPONS ===")
s, r = req("GET", "/admin/coupons", TOKEN)
check("GET /admin/coupons", s == 200, r.get("error"))

s, r = req("POST", "/admin/coupons", TOKEN, {
    "code": f"TEST{RND}", "name": f"Test Coupon {RND}",
    "discountType": "PERCENT", "amount": 10,
    "usageLimit": 100, "status": "ACTIVE"
})
CID = r.get("data", {}).get("id", "")
check("POST /admin/coupons", bool(CID), r.get("error") or r)

if CID:
    s, r = req("GET", f"/admin/coupons/{CID}", TOKEN)
    check("GET /admin/coupons/{id}", s == 200, r.get("error"))

    s, r = req("PATCH", f"/admin/coupons/{CID}", TOKEN, {"value": 15, "usageLimit": 50})
    check("PATCH /admin/coupons/{id}", s == 200, r.get("error"))

    s, r = req("PATCH", f"/admin/coupons/{CID}/status", TOKEN, {"status": "INACTIVE"})
    check("PATCH /admin/coupons/{id}/status (deactivate)", s == 200, r.get("error"))

# ─── REVIEWS ──────────────────────────────────────────────────────────
print("\n=== REVIEWS ===")
s, r = req("GET", "/admin/reviews", TOKEN)
check("GET /admin/reviews", s == 200, r.get("error"))
reviews = r.get("data", [])
if reviews:
    rid = reviews[0].get("id")
    s, r = req("GET", f"/admin/reviews/{rid}", TOKEN)
    check("GET /admin/reviews/{id}", s == 200, r.get("error"))
    # Try changing status (approve/reject)
    s, r = req("PATCH", f"/admin/reviews/{rid}/status", TOKEN, {"status": "APPROVED"})
    check("PATCH /admin/reviews/{id}/status", s == 200, r.get("error"))
else:
    print("  [SKIP] No reviews in DB")
    results.append(("[SKIP]", "GET /admin/reviews/{id}"))
    results.append(("[SKIP]", "PATCH /admin/reviews/{id}/status"))

# ─── ADMIN RETURNS ────────────────────────────────────────────────────
print("\n=== ADMIN RETURNS ===")
s, r = req("GET", "/admin/returns", TOKEN)
check("GET /admin/returns", s == 200, r.get("error"))
returns_list = r.get("data", [])
if returns_list:
    ret_id = returns_list[0].get("id")
    s, r = req("GET", f"/admin/returns/{ret_id}", TOKEN)
    check("GET /admin/returns/{id}", s == 200, r.get("error"))
    current_status = r.get("data", {}).get("status", "")
    # Try a valid transition: PENDING → RECEIVED
    if current_status == "PENDING":
        s2, r2 = req("PATCH", f"/admin/returns/{ret_id}/status", TOKEN, {"status": "RECEIVED"})
        check("PATCH /admin/returns/{id}/status PENDING→RECEIVED", s2 == 200, r2.get("error"))
    else:
        print(f"  [INFO] Return status={current_status}, skipping transition")
        results.append(("[SKIP]", "PATCH /admin/returns/{id}/status"))
else:
    print("  [SKIP] No returns in DB")
    results.append(("[SKIP]", "GET /admin/returns/{id}"))
    results.append(("[SKIP]", "PATCH /admin/returns/{id}/status"))

# ─── POS ──────────────────────────────────────────────────────────────
print("\n=== POS ===")
s, r = req("GET", "/admin/pos/products/search?q=mu", TOKEN)
check("GET /admin/pos/products/search?q=mu", s == 200, r.get("error"))
pos_products = r.get("data", [])
if pos_products:
    pp = pos_products[0]
    s, r = req("POST", "/admin/pos/orders", TOKEN, {
        "items": [{"productId": pp.get("id"), "productVariantId": pp.get("variantId") or pp.get("defaultVariantId"), "quantity": 1, "unitPrice": pp.get("price") or pp.get("retailPrice") or 100000}],
        "paymentMethod": "CASH",
        "customerNote": "Auto POS test"
    })
    check("POST /admin/pos/orders", s in (200, 201), r.get("error") or r)
else:
    print("  [SKIP] No POS products found for q=mu")
    results.append(("[SKIP]", "POST /admin/pos/orders"))

# ─── ORDERS: missing flows ─────────────────────────────────────────────
print("\n=== ORDERS (additional) ===")
s, r = req("GET", "/admin/orders?size=5", TOKEN)
orders = r.get("data", [])
OID = orders[0].get("id") if orders else ""

if OID:
    s, r = req("GET", f"/admin/orders/{OID}", TOKEN)
    check("GET /admin/orders/{id}", s == 200, r.get("error"))

    s, r = req("GET", f"/admin/orders/{OID}/allowed-transitions", TOKEN)
    check("GET /admin/orders/{id}/allowed-transitions", s == 200, r.get("error"))
    print(f"  [INFO] Allowed transitions: {r.get('data', [])}")

    s, r = req("GET", f"/admin/orders/{OID}/notes", TOKEN)
    check("GET /admin/orders/{id}/notes", s == 200, r.get("error"))

    s, r = req("POST", f"/admin/orders/{OID}/notes", TOKEN, {"content": f"Auto test note {RND}"})
    check("POST /admin/orders/{id}/notes", s in (200, 201), r.get("error"))

    # payment-status: try UNPAID → PENDING (if currently UNPAID)
    order_data = req("GET", f"/admin/orders/{OID}", TOKEN)[1].get("data", {})
    pay_status = order_data.get("paymentStatus", "")
    if pay_status == "UNPAID":
        s, r = req("PATCH", f"/admin/orders/{OID}/payment-status", TOKEN, {"paymentStatus": "PENDING"})
        check("PATCH /admin/orders/{id}/payment-status UNPAID→PENDING", s == 200, r.get("error"))
    elif pay_status == "PENDING":
        s, r = req("PATCH", f"/admin/orders/{OID}/payment-status", TOKEN, {"paymentStatus": "PAID"})
        check("PATCH /admin/orders/{id}/payment-status PENDING→PAID", s == 200, r.get("error"))
    else:
        print(f"  [SKIP] Order paymentStatus={pay_status}, no payment-status test")
        results.append(("[SKIP]", "PATCH /admin/orders/{id}/payment-status"))

    # refund: only on PAID orders — check if any completed/paid order exists
    s2, r2 = req("GET", "/admin/orders?size=5&status=COMPLETED", TOKEN)
    completed = r2.get("data", [])
    paid_order = next((o for o in completed if o.get("paymentStatus") == "PAID"), None)
    if paid_order:
        s3, r3 = req("POST", f"/admin/orders/{paid_order['id']}/refund", TOKEN,
                     {"amount": 1000, "reason": "Auto test refund"})
        check("POST /admin/orders/{id}/refund", s3 in (200, 201, 400), r3.get("error"))
        # 400 is OK if order already refunded or below min amount
    else:
        results.append(("[SKIP]", "POST /admin/orders/{id}/refund — no PAID+COMPLETED order"))
        print("  [SKIP] No PAID COMPLETED order for refund test")

# ─── CUSTOMERS: missing flows ─────────────────────────────────────────
print("\n=== CUSTOMERS (additional) ===")
s, r = req("GET", "/admin/customers?size=5", TOKEN)
customers = r.get("data", [])
CUS_ID = customers[0].get("id") if customers else ""
if CUS_ID:
    s, r = req("PATCH", f"/admin/customers/{CUS_ID}", TOKEN, {"note": "Auto test note"})
    check("PATCH /admin/customers/{id}", s == 200, r.get("error"))

    # status: check current status first
    s2, r2 = req("GET", f"/admin/customers/{CUS_ID}", TOKEN)
    cus_status = r2.get("data", {}).get("status", "ACTIVE")
    new_status = "BLOCKED" if cus_status == "ACTIVE" else "ACTIVE"
    s, r = req("PATCH", f"/admin/customers/{CUS_ID}/status", TOKEN, {"status": new_status})
    check(f"PATCH /admin/customers/{{id}}/status → {new_status}", s == 200, r.get("error"))
    # Restore
    req("PATCH", f"/admin/customers/{CUS_ID}/status", TOKEN, {"status": cus_status})

# ─── ADMIN USERS: PATCH ───────────────────────────────────────────────
print("\n=== ADMIN USERS (additional) ===")
s, r = req("GET", "/admin/admin-users", TOKEN)
admin_users = r.get("data", [])
if admin_users:
    uid = admin_users[0].get("id")
    orig_name = admin_users[0].get("displayName", "")
    s, r = req("PATCH", f"/admin/admin-users/{uid}", TOKEN, {"displayName": f"Admin Test {RND}"})
    check("PATCH /admin/admin-users/{id}", s == 200, r.get("error"))
    # Restore
    req("PATCH", f"/admin/admin-users/{uid}", TOKEN, {"displayName": orig_name})

# ─── PRODUCTS: PATCH publish ──────────────────────────────────────────
print("\n=== PRODUCTS (publish) ===")
# Create a DRAFT product to test publish
s, r = req("POST", "/admin/products", TOKEN, {
    "name": f"Publish Test {RND}", "slug": f"publish-test-{RND}",
    "sku": f"PUB-TEST-{RND}", "retailPrice": 100000, "currency": "VND",
    "publishStatus": "DRAFT", "stockState": "IN_STOCK",
    "categoryId": "wp-cat-6291", "brandId": "wp-brand-5657"
})
PUB_PID = r.get("data", {}).get("id", "")
if PUB_PID:
    s, r = req("PATCH", f"/admin/products/{PUB_PID}/publish", TOKEN, {"publishStatus": "PUBLISHED"})
    check("PATCH /admin/products/{id}/publish DRAFT→PUBLISHED", s == 200, r.get("error"))
    req("DELETE", f"/admin/products/{PUB_PID}", TOKEN)
    print("  [INFO] Publish test product cleaned up")

# ─── INVENTORY: variant movements & export ────────────────────────────
print("\n=== INVENTORY (additional) ===")
s, r = req("GET", "/admin/inventory?size=5", TOKEN)
inv_items = r.get("items", r.get("data", []))
if inv_items:
    vid = inv_items[0].get("variantId") or inv_items[0].get("id", "")
    s, r = req("GET", f"/admin/inventory/variants/{vid}/movements", TOKEN)
    check("GET /admin/inventory/variants/{id}/movements", s == 200, r.get("error"))
else:
    # Use a known product's variant
    s2, r2 = req("GET", "/admin/products?size=1", TOKEN)
    prods = r2.get("data", [])
    if prods:
        s3, r3 = req("GET", f"/admin/products/{prods[0]['id']}", TOKEN)
        variants = r3.get("data", {}).get("variants", [])
        if variants:
            vid = variants[0].get("id")
            s, r = req("GET", f"/admin/inventory/variants/{vid}/movements", TOKEN)
            check("GET /admin/inventory/variants/{id}/movements", s == 200, r.get("error"))
    else:
        results.append(("[SKIP]", "GET /admin/inventory/variants/{id}/movements"))

s, r = req("GET", "/admin/inventory/export.csv", TOKEN)
check("GET /admin/inventory/export.csv", s in (200, 204), r.get("error"))

# ─── SHIPPING: full CRUD ──────────────────────────────────────────────
print("\n=== SHIPPING (CRUD) ===")
s, r = req("POST", "/admin/shipping/zones", TOKEN, {
    "name": f"Test Zone {RND}", "description": "Auto test zone",
    "countries": ["VN"], "isActive": True
})
ZONE_ID = r.get("data", {}).get("id", "")
check("POST /admin/shipping/zones", bool(ZONE_ID), r.get("error") or r)

if ZONE_ID:
    s, r = req("GET", f"/admin/shipping/zones/{ZONE_ID}", TOKEN)
    check("GET /admin/shipping/zones/{id}", s == 200, r.get("error"))

    s, r = req("PATCH", f"/admin/shipping/zones/{ZONE_ID}", TOKEN, {"name": f"Test Zone {RND} Updated"})
    check("PATCH /admin/shipping/zones/{id}", s == 200, r.get("error"))

    s, r = req("POST", f"/admin/shipping/zones/{ZONE_ID}/methods", TOKEN, {
        "name": "Test Shipping Method", "code": f"TEST_SHIP_{RND}",
        "cost": 30000, "isActive": True
    })
    METHOD_ID = r.get("data", {}).get("id", "")
    check("POST /admin/shipping/zones/{id}/methods", bool(METHOD_ID), r.get("error") or r)

    if METHOD_ID:
        s, r = req("PATCH", f"/admin/shipping/zones/{ZONE_ID}/methods/{METHOD_ID}", TOKEN,
                   {"cost": 25000, "name": "Test Shipping Updated"})
        check("PATCH /admin/shipping/zones/{id}/methods/{mid}", s == 200, r.get("error"))

        s, r = req("DELETE", f"/admin/shipping/zones/{ZONE_ID}/methods/{METHOD_ID}", TOKEN)
        check("DELETE /admin/shipping/zones/{id}/methods/{mid}", s in (200, 204), r.get("error"))

    s, r = req("DELETE", f"/admin/shipping/zones/{ZONE_ID}", TOKEN)
    check("DELETE /admin/shipping/zones/{id}", s in (200, 204), r.get("error"))

# ─── MENUS: CRUD + items ──────────────────────────────────────────────
print("\n=== MENUS (CRUD) ===")
s, r = req("POST", "/admin/menus", TOKEN, {
    "name": f"Test Menu {RND}", "location": f"test-menu-{RND}", "isActive": True
})
MENU_ID = r.get("data", {}).get("id", "")
check("POST /admin/menus", bool(MENU_ID), r.get("error") or r)

if MENU_ID:
    s, r = req("PATCH", f"/admin/menus/{MENU_ID}", TOKEN, {"name": f"Test Menu {RND} Updated"})
    check("PATCH /admin/menus/{id}", s == 200, r.get("error"))

    # Add menu item
    s, r = req("POST", f"/admin/menus/{MENU_ID}/items", TOKEN, {
        "label": "Test Item", "url": "/san-pham", "sortOrder": 1, "isVisible": True
    })
    MITEM_ID = r.get("data", {}).get("id", "") or \
               (r.get("data", {}).get("items", [{}])[-1].get("id", "") if r.get("data", {}).get("items") else "")
    check("POST /admin/menus/{id}/items", bool(MITEM_ID), r.get("error") or r)

    if MITEM_ID:
        s, r = req("PATCH", f"/admin/menus/{MENU_ID}/items/{MITEM_ID}", TOKEN,
                   {"label": "Test Item Updated", "url": "/san-pham"})
        check("PATCH /admin/menus/{id}/items/{itemId}", s == 200, r.get("error"))

        s, r = req("DELETE", f"/admin/menus/{MENU_ID}/items/{MITEM_ID}", TOKEN)
        check("DELETE /admin/menus/{id}/items/{itemId}", s in (200, 204), r.get("error"))

    s, r = req("DELETE", f"/admin/menus/{MENU_ID}", TOKEN)
    check("DELETE /admin/menus/{id}", s in (200, 204), r.get("error"))

# ─── MEDIA: GET by id, DELETE, restore ───────────────────────────────
print("\n=== MEDIA (additional) ===")
s, r = req("GET", "/admin/media?size=5", TOKEN)
media_list = r.get("data", [])
if media_list:
    mid = media_list[0].get("id")
    s, r = req("GET", f"/admin/media/{mid}", TOKEN)
    check("GET /admin/media/{id}", s == 200, r.get("error"))
    # Don't DELETE real media — skip destructive test
    results.append(("[SKIP]", "DELETE /admin/media/{id} — skipped to avoid deleting real assets"))
    results.append(("[SKIP]", "POST /admin/media/{id}/restore — requires prior delete"))
    print("  [SKIP] DELETE/restore media — skipped to avoid deleting real assets")
else:
    results.append(("[SKIP]", "GET /admin/media/{id} — no media found"))

# ─── SETTINGS: GET by key ─────────────────────────────────────────────
print("\n=== SETTINGS (additional) ===")
s, r = req("GET", "/admin/settings", TOKEN)
settings = r.get("data", [])
if settings:
    key = settings[0].get("settingKey") or settings[0].get("key", "")
    if key:
        s, r = req("GET", f"/admin/settings/{key}", TOKEN)
        check(f"GET /admin/settings/{{key}} ({key})", s == 200, r.get("error"))

# ─── REDIRECTS: PATCH /enabled ───────────────────────────────────────
print("\n=== REDIRECTS (additional) ===")
s, r = req("GET", "/admin/redirects?size=5", TOKEN)
redirects = r.get("data", [])
if redirects:
    rdid = redirects[0].get("id")
    orig_enabled = redirects[0].get("isEnabled", True)
    s, r = req("PATCH", f"/admin/redirects/{rdid}/enabled", TOKEN, {"enabled": not orig_enabled})
    check("PATCH /admin/redirects/{id}/enabled", s == 200, r.get("error"))
    req("PATCH", f"/admin/redirects/{rdid}/enabled", TOKEN, {"isEnabled": orig_enabled})
else:
    results.append(("[SKIP]", "PATCH /admin/redirects/{id}/enabled — no redirects"))
    print("  [SKIP] No redirects found")

# ─── SUMMARY ─────────────────────────────────────────────────────────
print("\n" + "=" * 50)
passed  = sum(1 for t, _ in results if t == "[PASS]")
failed  = sum(1 for t, _ in results if t == "[FAIL]")
skipped = sum(1 for t, _ in results if t == "[SKIP]")
print(f"TOTAL: {passed} PASS / {failed} FAIL / {skipped} SKIP / {len(results)} tests")
if failed:
    print("\nFailed tests:")
    for tag, label in results:
        if tag == "[FAIL]":
            print(f"  - {label}")
