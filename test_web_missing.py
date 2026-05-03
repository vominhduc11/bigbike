"""
BigBike Web API - Supplementary flow test
Covers: GET /customer/orders/returns/{id}, POST /customer/auth/refresh
"""
import sys, json, time, random, io
import urllib.request, urllib.error
from http.cookiejar import CookieJar

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://localhost:8080/api/v1"
results = []
RND = random.randint(10000, 99999)
TEST_EMAIL = f"test.web2.{RND}@bigbike-test.vn"
TEST_PASS = "Test@123456"

jar = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def get_csrf():
    for c in jar:
        if c.name == "bb_csrf":
            return c.value
    return None

def req(method, path, body=None, csrf=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if csrf:
        headers["X-CSRF-Token"] = csrf
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with opener.open(r) as resp:
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

def admin_req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw and raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw and raw.strip() else {}

def check(label, cond, detail=""):
    tag = "[PASS]" if cond else "[FAIL]"
    msg = f"  {tag} {label}"
    if detail and not cond:
        msg += f" | {str(detail)[:120]}"
    print(msg)
    results.append((tag, label))
    return cond

print(f"=== BigBike Web Supplementary Tests (run {RND}) ===\n")

# ─── SETUP ────────────────────────────────────────────────────────────
# Admin login for order management
while True:
    s, r = admin_req("POST", "/auth/login", body={"email": "admin@bigbike.vn", "password": "admin123"})
    if s == 429:
        print("  [WAIT] Rate limited, waiting 15s..."); time.sleep(15); continue
    ADMIN_TOKEN = r.get("data", {}).get("accessToken", "")
    break

# Create test product with inventory
SETUP_PROD_SLUG = f"web-supp-{RND}"
SETUP_PROD_ID = ""
SETUP_VID = ""

if ADMIN_TOKEN:
    s, r = admin_req("POST", "/admin/products", ADMIN_TOKEN, {
        "name": f"Web Supp Test {RND}", "slug": SETUP_PROD_SLUG,
        "sku": f"WEB-SUPP-{RND}", "retailPrice": 100000, "currency": "VND",
        "publishStatus": "PUBLISHED", "stockState": "IN_STOCK",
        "categoryId": "wp-cat-6291", "brandId": "wp-brand-5657",
        "variants": [{"sku": f"WEB-SUPP-V1-{RND}", "options": [{"optionName": "Size", "optionValue": "M"}],
                      "retailPrice": 100000, "stockState": "IN_STOCK"}]
    })
    SETUP_PROD_ID = r.get("data", {}).get("id", "")
    variants = r.get("data", {}).get("variants", [])
    SETUP_VID = variants[0].get("id", "") if variants else ""

    if SETUP_VID:
        admin_req("POST", f"/admin/inventory/variants/{SETUP_VID}/adjust", ADMIN_TOKEN,
                  {"quantityDelta": 10, "reason": "ADJUSTMENT", "note": "Web supp test seed"})
        print(f"  [INFO] Test product created & seeded: {SETUP_PROD_SLUG}\n")

# ─── CUSTOMER SETUP: register + login ────────────────────────────────
req("GET", "/cart")  # init session / CSRF
CSRF = get_csrf()

s, r = req("POST", "/customer/auth/register", csrf=CSRF, body={
    "email": TEST_EMAIL, "password": TEST_PASS, "firstName": "Test2", "lastName": "User"
})
CSRF = r.get("data", {}).get("csrfToken") or get_csrf()

s, r = req("POST", "/customer/auth/login", csrf=CSRF, body={"login": TEST_EMAIL, "password": TEST_PASS})
CSRF = r.get("data", {}).get("csrfToken") or get_csrf()
print(f"Customer registered and logged in\n")

# ─── POST /customer/auth/refresh ─────────────────────────────────────
print("=== AUTH REFRESH ===")
s, r = req("POST", "/customer/auth/refresh", csrf=CSRF)
check("POST /customer/auth/refresh", s in (200, 201), r.get("error") if isinstance(r, dict) else r)
if s in (200, 201):
    CSRF = r.get("data", {}).get("csrfToken") or get_csrf() or CSRF

# ─── FULL RETURNS FLOW: create order → complete → return → detail ─────
print("\n=== RETURNS (full flow with GET /{id}) ===")

ORDER_ID = ""
if SETUP_PROD_ID and SETUP_VID:
    # Add to cart
    s, r = req("POST", "/cart/items", csrf=CSRF, body={
        "productId": SETUP_PROD_ID, "productVariantId": SETUP_VID, "quantity": 1
    })
    # Get checkout options
    s, r = req("GET", "/checkout/options")
    opts = r.get("data", {})
    shipping_methods = opts.get("shippingMethods", [])
    payment_methods  = opts.get("paymentMethods", [])
    SHIPPING_ID = shipping_methods[0].get("id") if shipping_methods else None
    PAYMENT_CODE = next((p["code"] for p in payment_methods if p["code"] == "COD"), None) \
                   or (payment_methods[0].get("code") if payment_methods else None)

    # Checkout
    s, r = req("POST", "/checkout", csrf=CSRF, body={
        "billingAddress": {
            "fullName": "Test User2", "email": TEST_EMAIL, "phone": "0901234567",
            "country": "VN", "province": "Ho Chi Minh", "district": "Quan 1",
            "ward": "Phuong Ben Nghe", "addressLine1": "123 Test St"
        },
        "shippingMethodId": SHIPPING_ID, "paymentMethod": PAYMENT_CODE
    })
    ORDER_ID = r.get("data", {}).get("id", "")
    ORDER_NUM = r.get("data", {}).get("orderNumber", "")
    print(f"  [INFO] Order created: {ORDER_NUM}")

    # Admin: complete the order
    if ORDER_ID and ADMIN_TOKEN:
        admin_req("PATCH", f"/admin/orders/{ORDER_ID}/status", ADMIN_TOKEN, {"status": "COMPLETED"})
        print(f"  [INFO] Order moved to COMPLETED")

if ORDER_ID:
    # Customer: get order detail → find lineItems
    s, r = req("GET", f"/customer/orders/{ORDER_ID}")
    line_items = r.get("data", {}).get("lineItems", [])

    if line_items:
        # Create return
        s, r = req("POST", f"/customer/orders/{ORDER_ID}/returns", csrf=CSRF, body={
            "reason": "DEFECTIVE", "customerNote": "Supplementary test return",
            "items": [{"orderLineItemId": line_items[0]["id"],
                       "productName": line_items[0]["productName"], "quantity": 1}]
        })
        check("POST /customer/orders/{id}/returns", s in (200, 201), r.get("error") if isinstance(r, dict) else r)
        # response is returned directly without data wrapper
        RETURN_ID = (r.get("data", {}).get("id") or r.get("id", "")) if isinstance(r, dict) else ""
        RETURN_NUM = (r.get("data", {}).get("returnNumber") or r.get("returnNumber", "")) if isinstance(r, dict) else ""
        print(f"  [INFO] Return created: {RETURN_NUM} (id={RETURN_ID})")

        if RETURN_ID:
            # GET return detail — response is return object directly (no data wrapper)
            s, r = req("GET", f"/customer/orders/returns/{RETURN_ID}")
            check("GET /customer/orders/returns/{id}", s == 200 and "id" in r, r.get("error") if isinstance(r, dict) else r)
            print(f"  [INFO] Return detail: status={r.get('status','?') if isinstance(r,dict) else '?'}")

            # Returns list
            s, r = req("GET", "/customer/orders/returns")
            check("GET /customer/orders/returns", s == 200, r.get("error") if isinstance(r, dict) else None)
    else:
        print("  [WARN] No line items found in order — skipping return creation")
        results.append(("[SKIP]", "POST /customer/orders/{id}/returns"))
        results.append(("[SKIP]", "GET /customer/orders/returns/{id}"))
else:
    results.append(("[SKIP]", "Returns flow — no order created"))
    print("  [SKIP] No order created — skipping returns flow")

# ─── TEARDOWN ─────────────────────────────────────────────────────────
req("POST", "/customer/auth/logout", csrf=CSRF)
if SETUP_PROD_ID and ADMIN_TOKEN:
    admin_req("DELETE", f"/admin/products/{SETUP_PROD_ID}", ADMIN_TOKEN)
    print("\n  [INFO] Test product cleaned up")

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
