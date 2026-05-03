"""
BigBike Web API - Full flow test
Tests: Catalog, Content, Auth, Cart, Checkout, Account
"""
import sys, json, time, random, io
import urllib.request, urllib.error
from http.cookiejar import CookieJar

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = "http://localhost:8080/api/v1"
results = []
RND = random.randint(10000, 99999)
TEST_EMAIL = f"test.web.{RND}@bigbike-test.vn"
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

def check(label, cond, detail=""):
    tag = "[PASS]" if cond else "[FAIL]"
    msg = f"  {tag} {label}"
    if detail and not cond:
        msg += f" | {str(detail)[:120]}"
    print(msg)
    results.append((tag, label))
    return cond

print(f"=== BigBike Web Flow Tests (run {RND}) ===\n")

# ─── ADMIN SETUP: add temporary inventory so cart tests can run ────────
print("=== SETUP: seeding inventory via admin API ===")
def admin_req(method, path, token=None, body=None):
    url = "http://localhost:8080/api/v1" + path
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

# Admin login
while True:
    s, r = admin_req("POST", "/auth/login", body={"email": "admin@bigbike.vn", "password": "admin123"})
    if s == 429:
        print("  [WAIT] Admin rate limited, waiting 15s..."); time.sleep(15); continue
    ADMIN_TOKEN = r.get("data", {}).get("accessToken", "")
    break

SETUP_VID = ""
SETUP_PROD_ID = ""
SETUP_PROD_SLUG = f"web-test-{RND}"
SETUP_VARIANT_ID = ""
SETUP_PROD_CREATED = False

if ADMIN_TOKEN:
    # Create a dedicated test product for this run (PUBLISHED so public API can see it)
    s, r = admin_req("POST", "/admin/products", ADMIN_TOKEN, {
        "name": f"Web Test Product {RND}", "slug": SETUP_PROD_SLUG,
        "sku": f"WEB-TEST-{RND}", "retailPrice": 100000, "currency": "VND",
        "publishStatus": "PUBLISHED", "stockState": "IN_STOCK",
        "categoryId": "wp-cat-6291", "brandId": "wp-brand-5657",
        "variants": [{"sku": f"WEB-V1-{RND}", "options": [{"optionName": "Size", "optionValue": "M"}],
                      "retailPrice": 100000, "stockState": "IN_STOCK"}]
    })
    SETUP_PROD_ID = r.get("data", {}).get("id", "")
    variants = r.get("data", {}).get("variants", [])
    SETUP_VID = variants[0].get("id", "") if variants else ""
    SETUP_VARIANT_ID = SETUP_VID
    SETUP_PROD_CREATED = bool(SETUP_PROD_ID)

    if SETUP_VID:
        s, r = admin_req("POST", f"/admin/inventory/variants/{SETUP_VID}/adjust", ADMIN_TOKEN,
                         {"quantityDelta": 15, "reason": "ADJUSTMENT", "note": "Auto test seed"})
        if s in (200, 201):
            print(f"  [INFO] Created test product {SETUP_PROD_SLUG}, seeded 15 units (variant: {SETUP_VID})")
        else:
            print(f"  [WARN] Inventory seed failed: {r}")
    else:
        print(f"  [WARN] Could not create test product: {r.get('error', r)}")

print()

# ─── GROUP A: PUBLIC CATALOG & CONTENT ────────────────────────────────
print("=== GROUP A: CATALOG & CONTENT (public) ===")

# Initialize session / get CSRF cookie
req("GET", "/cart")
CSRF = get_csrf()
print(f"  [INFO] CSRF token: {'present' if CSRF else 'absent'}")

print("\n--- Settings & Navigation ---")
s, r = req("GET", "/settings/public")
check("GET /settings/public", s == 200 and "data" in r, r.get("error"))

s, r = req("GET", "/menus/primary")
check("GET /menus/primary", s == 200, r.get("error"))

s, r = req("GET", "/menus/footer")
check("GET /menus/footer", s == 200, r.get("error"))

s, r = req("GET", "/sliders?location=home")
check("GET /sliders?location=home", s == 200, r.get("error"))

s, r = req("GET", "/home-videos")
check("GET /home-videos", s == 200, r.get("error"))

print("\n--- Products ---")
s, r = req("GET", "/products?size=20&sort=createdAt:desc")
check("GET /products (list)", s == 200 and "data" in r, r.get("error"))
products = r.get("data", [])
# use the seeded test product (by ID); for slug display use the list
PROD_ID   = SETUP_PROD_ID
PROD_SLUG = SETUP_PROD_SLUG
PROD_VARIANT_ID = SETUP_VARIANT_ID or None
display_prod = next((p for p in products if p.get("slug") == PROD_SLUG), products[0] if products else {})
print(f"  [INFO] {len(products)} products, cart test uses: {PROD_SLUG}")

# Use a real product slug (first from list) for slug test
real_slug = (products[0].get("slug") if products else "") or PROD_SLUG
if real_slug:
    s, r = req("GET", f"/products/{real_slug}")
    check("GET /products/{slug}", s == 200 and "data" in r, r.get("error"))

s, r = req("GET", "/products?featured=true&size=5")
check("GET /products?featured=true", s == 200, r.get("error"))

s, r = req("GET", "/products?sort=price:asc&size=5")
check("GET /products?sort=price:asc", s == 200, r.get("error"))

print("\n--- Categories ---")
s, r = req("GET", "/categories?size=5")
check("GET /categories (list)", s == 200 and "data" in r, r.get("error"))
categories = r.get("data", [])
CAT_SLUG = categories[0].get("slug", "") if categories else ""
if CAT_SLUG:
    s, r = req("GET", f"/categories/{CAT_SLUG}")
    check("GET /categories/{slug}", s == 200 and "data" in r, r.get("error"))

s, r = req("GET", f"/products?category={CAT_SLUG}&size=5")
check(f"GET /products?category={CAT_SLUG}", s == 200, r.get("error"))

print("\n--- Brands ---")
s, r = req("GET", "/brands?size=5")
check("GET /brands (list)", s == 200 and "data" in r, r.get("error"))
brands = r.get("data", [])
BRAND_SLUG = brands[0].get("slug", "") if brands else ""
if BRAND_SLUG:
    s, r = req("GET", f"/brands/{BRAND_SLUG}")
    check("GET /brands/{slug}", s == 200 and "data" in r, r.get("error"))

print("\n--- Articles ---")
s, r = req("GET", "/articles?size=5")
check("GET /articles (list)", s == 200 and "data" in r, r.get("error"))
articles = r.get("data", [])
ART_SLUG = articles[0].get("slug", "") if articles else ""
if ART_SLUG:
    s, r = req("GET", f"/articles/{ART_SLUG}")
    check("GET /articles/{slug}", s == 200 and "data" in r, r.get("error"))

print("\n--- Search ---")
s, r = req("GET", "/search?q=xe&type=product,article")
check("GET /search?q=xe", s == 200, r.get("error"))

print("\n--- Pages ---")
# Try common page slugs
for pg_slug in ["gioi-thieu", "about", "lien-he", "chinh-sach-bao-mat"]:
    s, r = req("GET", f"/pages/{pg_slug}")
    if s == 200:
        check(f"GET /pages/{pg_slug}", True)
        break
else:
    # Try fetching list to get a valid slug
    s, r = req("GET", "/pages")
    if s == 200 and r.get("data"):
        pg_slug = r["data"][0].get("slug", "")
        s2, r2 = req("GET", f"/pages/{pg_slug}")
        check(f"GET /pages/{pg_slug}", s2 == 200, r2.get("error"))
    else:
        results.append(("[SKIP]", "GET /pages/{slug} — no pages found"))
        print("  [SKIP] GET /pages/{slug} — no pages found")

# ─── GROUP B: CUSTOMER AUTH ────────────────────────────────────────────
print("\n=== GROUP B: CUSTOMER AUTH ===")

# Register new customer
s, r = req("POST", "/customer/auth/register", csrf=CSRF, body={
    "email": TEST_EMAIL, "password": TEST_PASS,
    "firstName": "Test", "lastName": "User"
})
check("POST /customer/auth/register", s in (200, 201) and "customer" in r.get("data", {}), r.get("error") or r)
if s in (200, 201):
    CSRF = r.get("data", {}).get("csrfToken") or get_csrf()

# Login
s, r = req("POST", "/customer/auth/login", csrf=CSRF, body={
    "login": TEST_EMAIL, "password": TEST_PASS
})
check("POST /customer/auth/login", s in (200, 201) and "customer" in r.get("data", {}), r.get("error") or r)
if s in (200, 201):
    CSRF = r.get("data", {}).get("csrfToken") or get_csrf()
print(f"  [INFO] CSRF after login: {'present' if CSRF else 'absent'}")

# Forgot password (won't actually send email but should return 2xx)
s, r = req("POST", "/customer/auth/password/forgot", csrf=CSRF, body={"login": TEST_EMAIL})
check("POST /customer/auth/password/forgot", s in (200, 201, 204), r.get("error"))

# ─── GROUP C: CART ─────────────────────────────────────────────────────
print("\n=== GROUP C: CART ===")

s, r = req("GET", "/cart")
check("GET /cart", s == 200 and "id" in r.get("data", {}), r.get("error"))

if PROD_ID:
    # Add to cart
    s, r = req("POST", "/cart/items", csrf=CSRF, body={
        "productId": PROD_ID, "quantity": 2,
        "productVariantId": PROD_VARIANT_ID
    })
    check("POST /cart/items (add product)", s in (200, 201) and "items" in r.get("data", {}), r.get("error") or r)
    cart_items = r.get("data", {}).get("items", [])
    ITEM_ID = cart_items[0].get("id") if cart_items else ""
    print(f"  [INFO] Cart has {len(cart_items)} item(s), itemId={ITEM_ID}")

    if ITEM_ID:
        # Update quantity
        s, r = req("PATCH", f"/cart/items/{ITEM_ID}", csrf=CSRF, body={"quantity": 3})
        check("PATCH /cart/items/{id} (update qty)", s == 200, r.get("error"))

        # Try invalid coupon (should return error, not crash)
        s, r = req("POST", "/cart/coupons", csrf=CSRF, body={"code": "INVALID_COUPON_ZZZ"})
        check("POST /cart/coupons (invalid code → error response)", s in (400, 404, 422), r.get("error"))

        # Remove item
        s, r = req("DELETE", f"/cart/items/{ITEM_ID}", csrf=CSRF)
        check("DELETE /cart/items/{id}", s in (200, 204), r.get("error"))

    # Add again for checkout test
    s, r = req("POST", "/cart/items", csrf=CSRF, body={
        "productId": PROD_ID, "quantity": 1,
        "productVariantId": PROD_VARIANT_ID
    })
    check("POST /cart/items (re-add for checkout)", s in (200, 201), r.get("error"))
else:
    results.append(("[SKIP]", "Cart CRUD — no products found"))
    print("  [SKIP] Cart CRUD — no products in DB")

# ─── GROUP D: CHECKOUT ─────────────────────────────────────────────────
print("\n=== GROUP D: CHECKOUT ===")

s, r = req("GET", "/checkout/options")
check("GET /checkout/options", s == 200 and "paymentMethods" in r.get("data", {}), r.get("error"))
checkout_opts = r.get("data", {})
payment_methods = checkout_opts.get("paymentMethods", [])
shipping_methods = checkout_opts.get("shippingMethods", [])
SHIPPING_ID = shipping_methods[0].get("id") if shipping_methods else None
PAYMENT_CODE = next((p["code"] for p in payment_methods if p["code"] == "COD"), None) \
               or (payment_methods[0].get("code") if payment_methods else None)
print(f"  [INFO] Payment methods: {[p['code'] for p in payment_methods]}")
print(f"  [INFO] Shipping methods: {[m['title'] for m in shipping_methods]}")

TEST_ADDRESS = {
    "fullName": "Nguyen Van Test",
    "email": TEST_EMAIL,
    "phone": "0901234567",
    "country": "VN",
    "province": "Ho Chi Minh",
    "district": "Quan 1",
    "ward": "Phuong Ben Nghe",
    "addressLine1": "123 Duong Test, Q1"
}

if PROD_ID and PAYMENT_CODE:
    s, r = req("POST", "/checkout", csrf=CSRF, body={
        "billingAddress": TEST_ADDRESS,
        "shippingMethodId": SHIPPING_ID,
        "paymentMethod": PAYMENT_CODE,
        "customerNote": "Auto test order"
    })
    check("POST /checkout (create order)", s in (200, 201) and "orderNumber" in r.get("data", {}), r.get("error") or r)
    ORDER_NUMBER = r.get("data", {}).get("orderNumber", "")
    ORDER_KEY    = r.get("data", {}).get("orderKey", "")
    ORDER_ID     = r.get("data", {}).get("id", "")
    print(f"  [INFO] Order: {ORDER_NUMBER} id={ORDER_ID}")

    if ORDER_NUMBER and ORDER_KEY:
        s, r = req("GET", f"/orders/lookup?orderNumber={ORDER_NUMBER}&orderKey={ORDER_KEY}")
        check("GET /orders/lookup (guest)", s == 200 and "data" in r, r.get("error"))
else:
    ORDER_NUMBER = ""
    ORDER_KEY = ""
    ORDER_ID = ""
    results.append(("[SKIP]", "POST /checkout — no products or payment methods"))
    results.append(("[SKIP]", "GET /orders/lookup"))
    print("  [SKIP] Checkout — missing products or payment methods")

# Quick buy
if PROD_ID and PAYMENT_CODE:
    s, r = req("POST", "/orders/quick-buy", csrf=CSRF, body={
        "productId": PROD_ID,
        "productVariantId": PROD_VARIANT_ID,
        "quantity": 1,
        "billingAddress": TEST_ADDRESS,
        "shippingMethodId": SHIPPING_ID,
        "paymentMethod": PAYMENT_CODE
    })
    check("POST /orders/quick-buy", s in (200, 201) and "orderNumber" in r.get("data", {}), r.get("error") or r)
else:
    results.append(("[SKIP]", "POST /orders/quick-buy"))

# ─── GROUP E: CUSTOMER ACCOUNT ─────────────────────────────────────────
print("\n=== GROUP E: CUSTOMER ACCOUNT ===")

s, r = req("GET", "/customer/me")
check("GET /customer/me", s == 200 and "id" in r.get("data", {}), r.get("error"))

s, r = req("PATCH", "/customer/me", csrf=CSRF, body={"displayName": f"Test User {RND}"})
check("PATCH /customer/me (update displayName)", s == 200, r.get("error"))
# Restore
req("PATCH", "/customer/me", csrf=CSRF, body={"displayName": "Test User"})

# Addresses
s, r = req("GET", "/customer/addresses")
check("GET /customer/addresses", s == 200, r.get("error"))

s, r = req("POST", "/customer/addresses", csrf=CSRF, body={
    "type": "SHIPPING", "fullName": "Test User",
    "phone": "0901234567", "province": "Ho Chi Minh",
    "district": "Quan 1", "ward": "Phuong Ben Nghe",
    "addressLine1": "123 Duong Test Q1", "isDefault": False
})
check("POST /customer/addresses", s in (200, 201) and "id" in r.get("data", {}), r.get("error"))
ADDR_ID = r.get("data", {}).get("id", "")

if ADDR_ID:
    s, r = req("PATCH", f"/customer/addresses/{ADDR_ID}", csrf=CSRF, body={
        "type": "SHIPPING", "fullName": "Test User Updated",
        "phone": "0907654321", "province": "Ha Noi",
        "district": "Hoan Kiem", "ward": "Phuong Hang Bai",
        "addressLine1": "456 Duong Test HN"
    })
    check("PATCH /customer/addresses/{id}", s == 200, r.get("error"))

    s, r = req("DELETE", f"/customer/addresses/{ADDR_ID}", csrf=CSRF)
    check("DELETE /customer/addresses/{id}", s in (200, 204), r.get("error"))

# Orders
s, r = req("GET", "/customer/orders?page=1&size=10")
check("GET /customer/orders", s == 200, r.get("error"))
customer_orders = r.get("data", [])

if customer_orders:
    oid = customer_orders[0].get("id", "")
    s, r = req("GET", f"/customer/orders/{oid}")
    check("GET /customer/orders/{id}", s == 200 and "id" in r.get("data", {}), r.get("error"))

# ─── GROUP F: RETURNS (full flow) ──────────────────────────────────────
print("\n=== GROUP F: RETURNS ===")

# Need a COMPLETED order to create a return — use ORDER_ID from checkout + admin status bump
RETURN_ORDER_ID = ORDER_ID
if RETURN_ORDER_ID and ADMIN_TOKEN:
    # Admin: PROCESSING → COMPLETED
    s2, r2 = admin_req("PATCH", f"/admin/orders/{RETURN_ORDER_ID}/status", ADMIN_TOKEN,
                       {"status": "COMPLETED"})
    if s2 in (200, 201):
        print(f"  [INFO] Order {ORDER_NUMBER} moved to COMPLETED for return test")
    else:
        print(f"  [WARN] Could not complete order: {r2.get('error', r2)}")
        RETURN_ORDER_ID = ""

if RETURN_ORDER_ID:
    # Get order detail to find lineItem IDs
    s, r = req("GET", f"/customer/orders/{RETURN_ORDER_ID}")
    line_items = r.get("data", {}).get("lineItems", [])
    print(f"  [INFO] Order has {len(line_items)} line item(s)")

    if line_items:
        # Create return request
        s, r = req("POST", f"/customer/orders/{RETURN_ORDER_ID}/returns", csrf=CSRF, body={
            "reason": "DEFECTIVE", "customerNote": "Auto test return request",
            "items": [{"orderLineItemId": line_items[0]["id"],
                       "productName": line_items[0]["productName"], "quantity": 1}]
        })
        check("POST /customer/orders/{id}/returns", s in (200, 201), r.get("error") if isinstance(r, dict) else r)
        RETURN_ID = r.get("data", {}).get("id", "") if isinstance(r, dict) else ""

        if RETURN_ID:
            # View return detail
            s, r = req("GET", f"/customer/orders/returns/{RETURN_ID}")
            check("GET /customer/orders/returns/{id}", s == 200 and "id" in r.get("data", {}), r.get("error"))
            RETURN_NUMBER = r.get("data", {}).get("returnNumber", "")
            print(f"  [INFO] Return created: {RETURN_NUMBER} status={r.get('data',{}).get('status','?')}")
    else:
        results.append(("[SKIP]", "POST returns — no line items in order"))
        print("  [SKIP] No line items found in order")
else:
    results.append(("[SKIP]", "POST returns — no completed order"))
    results.append(("[SKIP]", "GET returns/{id}"))
    print("  [SKIP] No completed order available for return test")

# Returns list
s, r = req("GET", "/customer/orders/returns")
detail = r.get("error") if isinstance(r, dict) else None
check("GET /customer/orders/returns", s == 200, detail)

# Contact form
print("\n--- Contact ---")
s, r = req("POST", "/contact", csrf=CSRF, body={
    "fullName": "Test User", "phone": "0901234567",
    "email": TEST_EMAIL, "content": "Auto test contact message"
})
check("POST /contact", s in (200, 201, 204), r.get("error"))

# ─── AUTH: LOGOUT ──────────────────────────────────────────────────────
print("\n--- Logout ---")
s, r = req("POST", "/customer/auth/logout", csrf=CSRF)
check("POST /customer/auth/logout", s in (200, 201, 204), r.get("error"))

# Verify session cleared
s, r = req("GET", "/customer/me")
check("GET /customer/me after logout → 401", s == 401, r.get("error"))

# ─── TEARDOWN: delete test product ────────────────────────────────────
if SETUP_PROD_ID and ADMIN_TOKEN and SETUP_PROD_CREATED:
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
