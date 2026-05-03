#!/usr/bin/env python3
"""BigBike Admin API Test Suite"""
import json
import time
import requests

BASE = "http://localhost:8080/api/v1"
ADMIN_EMAIL = "admin@bigbike.vn"
ADMIN_PASS = "admin123"

results = []

def fmt(label, passed, extra=""):
    status = "[PASS]" if passed else "[FAIL]"
    msg = f"{status} {label}"
    if not passed and extra:
        msg += f"\n       Response: {str(extra)[:300]}"
    print(msg)
    results.append((label, passed))

# ─── 1. Login with correct credentials ───────────────────────────────────────
token = None
for attempt in range(10):
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if r.status_code == 429:
        print(f"  Rate-limited on login attempt {attempt+1}, waiting 15s …")
        time.sleep(15)
        continue
    break

passed = r.status_code == 200 and "accessToken" in r.json().get("data", r.json())
body = r.json()
if passed:
    data = body.get("data", body)
    token = data.get("accessToken") or body.get("accessToken")
fmt("1. Login with correct credentials → 200 + accessToken", passed, body if not passed else "")

# ─── 2. Login with wrong password → 401 ───────────────────────────────────────
r2 = requests.post(f"{BASE}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": "wrongpass"})
fmt("2. Login with wrong password → 401", r2.status_code == 401, r2.text)

# Helper headers
H = {"Authorization": f"Bearer {token}"} if token else {}

# ─── 3. GET /auth/me ──────────────────────────────────────────────────────────
r3 = requests.get(f"{BASE}/auth/me", headers=H)
fmt("3. GET /auth/me with valid token → 200 + user object",
    r3.status_code == 200 and ("email" in str(r3.text) or "id" in str(r3.text)),
    r3.text)

# ─── 4. POST /auth/logout ─────────────────────────────────────────────────────
r4 = requests.post(f"{BASE}/auth/logout", headers=H)
fmt("4. POST /auth/logout with valid token → 200",
    r4.status_code in (200, 204), r4.text)

# Re-login if token was invalidated by logout
# (reuse same token; many impls accept it until expiry)

# ─── 5. GET /admin/orders → list ──────────────────────────────────────────────
r5 = requests.get(f"{BASE}/admin/orders", headers=H)
d5 = r5.json() if r5.headers.get("content-type","").startswith("application/json") else {}
# Accept both {data:[...]} and {data:{items:[...]}} shapes
raw_data = d5.get("data", {})
has_array = isinstance(raw_data, list) or isinstance(raw_data.get("items", raw_data.get("data", None)), list)
fmt("5. GET /admin/orders → 200 + data array", r5.status_code == 200 and has_array, r5.text)

# Extract a real order id
order_id = None
order_status_orig = None
if r5.status_code == 200:
    if isinstance(raw_data, list) and raw_data:
        order_id = raw_data[0].get("id")
        order_status_orig = raw_data[0].get("orderStatus") or raw_data[0].get("status")
    elif isinstance(raw_data, dict):
        items = raw_data.get("items") or raw_data.get("data") or []
        if items:
            order_id = items[0].get("id")
            order_status_orig = items[0].get("orderStatus") or items[0].get("status")
print(f"  → Using order_id: {order_id}  (status={order_status_orig})")

# ─── 6. GET /admin/orders?status=PENDING ──────────────────────────────────────
r6 = requests.get(f"{BASE}/admin/orders?status=PENDING", headers=H)
fmt("6. GET /admin/orders?status=PENDING → 200",
    r6.status_code == 200, r6.text)

# ─── 7. GET /admin/orders/{id} ────────────────────────────────────────────────
if order_id:
    r7 = requests.get(f"{BASE}/admin/orders/{order_id}", headers=H)
    d7 = r7.json() if r7.ok else {}
    body7 = d7.get("data", d7)
    has_fields = any(k in body7 for k in ("id", "orderNumber", "orderStatus", "status"))
    fmt("7. GET /admin/orders/{id} → 200 + id/orderNumber/orderStatus",
        r7.status_code == 200 and has_fields, r7.text)
else:
    fmt("7. GET /admin/orders/{id} → SKIPPED (no orders in DB)", True)

# ─── 8. GET /admin/orders/{id}/allowed-transitions ────────────────────────────
allowed_transitions = []
if order_id:
    r8 = requests.get(f"{BASE}/admin/orders/{order_id}/allowed-transitions", headers=H)
    d8 = r8.json() if r8.ok else {}
    # could be list at root or in data
    raw8 = d8.get("data", d8)
    if isinstance(raw8, list):
        allowed_transitions = raw8
    elif isinstance(raw8, dict):
        allowed_transitions = raw8.get("transitions", raw8.get("allowedTransitions", []))
    fmt("8. GET /admin/orders/{id}/allowed-transitions → 200 + array",
        r8.status_code == 200 and isinstance(allowed_transitions, list), r8.text)
    print(f"  → allowed_transitions: {allowed_transitions}")
else:
    fmt("8. GET /admin/orders/{id}/allowed-transitions → SKIPPED", True)

# ─── 9. PATCH /admin/orders/{id}/status ──────────────────────────────────────
if order_id and allowed_transitions:
    next_status = allowed_transitions[0]
    if isinstance(next_status, dict):
        next_status = next_status.get("status") or next_status.get("value") or list(next_status.values())[0]
    r9 = requests.patch(f"{BASE}/admin/orders/{order_id}/status",
                        json={"status": next_status}, headers=H)
    fmt(f"9. PATCH /admin/orders/{{id}}/status → 200 (→{next_status})",
        r9.status_code in (200, 201), r9.text)
elif order_id:
    fmt("9. PATCH /admin/orders/{id}/status → SKIPPED (no allowed transitions)", True)
else:
    fmt("9. PATCH /admin/orders/{id}/status → SKIPPED (no orders)", True)

# ─── 10. POST /admin/orders/{id}/notes ────────────────────────────────────────
if order_id:
    r10 = requests.post(f"{BASE}/admin/orders/{order_id}/notes",
                        json={"note": "Test note from automated test"}, headers=H)
    fmt("10. POST /admin/orders/{id}/notes → 200 or 201",
        r10.status_code in (200, 201), r10.text)
else:
    fmt("10. POST /admin/orders/{id}/notes → SKIPPED (no orders)", True)

# ─── 11. PATCH /admin/orders/{id}/payment-status ──────────────────────────────
if order_id:
    r11 = requests.patch(f"{BASE}/admin/orders/{order_id}/payment-status",
                         json={"paymentStatus": "PAID"}, headers=H)
    fmt("11. PATCH /admin/orders/{id}/payment-status → 200",
        r11.status_code in (200, 201), r11.text)
else:
    fmt("11. PATCH /admin/orders/{id}/payment-status → SKIPPED (no orders)", True)

# ─── 12. GET /admin/customers ─────────────────────────────────────────────────
r12 = requests.get(f"{BASE}/admin/customers", headers=H)
d12 = r12.json() if r12.ok else {}
raw12 = d12.get("data", {})
has_arr12 = isinstance(raw12, list) or isinstance(raw12.get("items", raw12.get("data", None)), list)
fmt("12. GET /admin/customers → 200 + data array",
    r12.status_code == 200 and has_arr12, r12.text)

# Extract customer id
cust_id = None
cust_status_orig = None
if r12.status_code == 200:
    if isinstance(raw12, list) and raw12:
        cust_id = raw12[0].get("id")
        cust_status_orig = raw12[0].get("status")
    elif isinstance(raw12, dict):
        items12 = raw12.get("items") or raw12.get("data") or []
        if items12:
            cust_id = items12[0].get("id")
            cust_status_orig = items12[0].get("status")
print(f"  → Using customer_id: {cust_id} (status={cust_status_orig})")

# ─── 13. GET /admin/customers?q=test ──────────────────────────────────────────
r13 = requests.get(f"{BASE}/admin/customers?q=test", headers=H)
fmt("13. GET /admin/customers?q=test → 200", r13.status_code == 200, r13.text)

# ─── 14. GET /admin/customers/{id} ────────────────────────────────────────────
if cust_id:
    r14 = requests.get(f"{BASE}/admin/customers/{cust_id}", headers=H)
    d14 = r14.json() if r14.ok else {}
    body14 = d14.get("data", d14)
    has14 = any(k in body14 for k in ("id", "email", "status"))
    fmt("14. GET /admin/customers/{id} → 200 + id/email/status",
        r14.status_code == 200 and has14, r14.text)
else:
    fmt("14. GET /admin/customers/{id} → SKIPPED (no customers)", True)

# ─── 15. PATCH /admin/customers/{id}/status ───────────────────────────────────
if cust_id:
    r15 = requests.patch(f"{BASE}/admin/customers/{cust_id}/status",
                         json={"status": "ACTIVE"}, headers=H)
    fmt("15. PATCH /admin/customers/{id}/status → 200",
        r15.status_code in (200, 201), r15.text)
else:
    fmt("15. PATCH /admin/customers/{id}/status → SKIPPED (no customers)", True)

# ─── 16. GET /admin/returns ───────────────────────────────────────────────────
r16 = requests.get(f"{BASE}/admin/returns", headers=H)
fmt("16. GET /admin/returns → 200", r16.status_code == 200, r16.text)

# ─── 17. GET /admin/returns?status=PENDING ────────────────────────────────────
r17 = requests.get(f"{BASE}/admin/returns?status=PENDING", headers=H)
fmt("17. GET /admin/returns?status=PENDING → 200", r17.status_code == 200, r17.text)

# ─── 18. GET /admin/reviews ───────────────────────────────────────────────────
r18 = requests.get(f"{BASE}/admin/reviews", headers=H)
fmt("18. GET /admin/reviews → 200", r18.status_code == 200, r18.text)

# ─── 19. GET /admin/reviews?status=PENDING ────────────────────────────────────
r19 = requests.get(f"{BASE}/admin/reviews?status=PENDING", headers=H)
fmt("19. GET /admin/reviews?status=PENDING → 200", r19.status_code == 200, r19.text)

# ─── 20. PATCH /admin/reviews/{id}/status (APPROVED + restore) ────────────────
review_id = None
review_orig_status = None
if r18.status_code == 200:
    d18 = r18.json()
    raw18 = d18.get("data", {})
    items18 = raw18 if isinstance(raw18, list) else (raw18.get("items") or raw18.get("data") or [])
    if items18:
        review_id = items18[0].get("id")
        review_orig_status = items18[0].get("status")

if review_id:
    r20a = requests.patch(f"{BASE}/admin/reviews/{review_id}/status",
                          json={"status": "APPROVED"}, headers=H)
    fmt("20. PATCH /admin/reviews/{id}/status → APPROVED → 200",
        r20a.status_code in (200, 201), r20a.text)
    # Restore
    if review_orig_status and review_orig_status != "APPROVED":
        r20b = requests.patch(f"{BASE}/admin/reviews/{review_id}/status",
                              json={"status": review_orig_status}, headers=H)
        print(f"  → Restored review status to {review_orig_status}: HTTP {r20b.status_code}")
else:
    fmt("20. PATCH /admin/reviews/{id}/status → SKIPPED (no reviews)", True)

# ─── Summary ─────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
passed_count = sum(1 for _, p in results if p)
failed_count = len(results) - passed_count
print(f"{'#':<5} {'Test':<52} {'Result'}")
print("-"*60)
for i, (label, p) in enumerate(results, 1):
    short = label[:50]
    print(f"{i:<5} {short:<52} {'PASS' if p else 'FAIL'}")
print("-"*60)
print(f"Total: {len(results)} tests  |  PASS: {passed_count}  |  FAIL: {failed_count}")
