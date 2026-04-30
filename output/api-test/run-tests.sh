#!/usr/bin/env bash
# Comprehensive API test for bigbike-admin, bigbike-web, bigbike_mobile.

set -u

BASE="http://localhost:8080"
COOKIE="/tmp/bb_cookies.txt"
ADMIN_TOKEN=""
PASS=0
FAIL=0
declare -a FAIL_LIST=()

rm -f "$COOKIE"

log() { printf '%s\n' "$*"; }

# Check a status code is in 2xx range, log result.
check_status() {
  local proj="$1" method="$2" path="$3" code="$4" snippet="$5"
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    PASS=$((PASS+1))
    printf '  [%s OK %s] %s %s\n' "$proj" "$code" "$method" "$path"
  else
    FAIL=$((FAIL+1))
    FAIL_LIST+=("[$proj $code] $method $path -- $snippet")
    printf '  [%s FAIL %s] %s %s -- %s\n' "$proj" "$code" "$method" "$path" "$snippet"
  fi
}

# Public/cookie-based GET (no body)
get_pub() {
  local proj="$1" path="$2"
  local code
  code=$(curl -sk -b "$COOKIE" -c "$COOKIE" -o /tmp/_resp.json -w '%{http_code}' -H 'Accept: application/json' "$BASE$path")
  local snip; snip=$(head -c 200 /tmp/_resp.json | tr -d '\r' | tr '\n' ' ')
  check_status "$proj" GET "$path" "$code" "$snip"
}

# Public/cookie-based mutation with optional CSRF
mut_pub() {
  local proj="$1" method="$2" path="$3" body="$4" csrf="${5:-}"
  local code
  if [[ -n "$body" ]]; then
    if [[ -n "$csrf" ]]; then
      code=$(curl -sk -b "$COOKIE" -c "$COOKIE" -o /tmp/_resp.json -w '%{http_code}' \
        -X "$method" -H 'Accept: application/json' -H 'Content-Type: application/json' \
        -H "X-CSRF-Token: $csrf" --data "$body" "$BASE$path")
    else
      code=$(curl -sk -b "$COOKIE" -c "$COOKIE" -o /tmp/_resp.json -w '%{http_code}' \
        -X "$method" -H 'Accept: application/json' -H 'Content-Type: application/json' \
        --data "$body" "$BASE$path")
    fi
  else
    if [[ -n "$csrf" ]]; then
      code=$(curl -sk -b "$COOKIE" -c "$COOKIE" -o /tmp/_resp.json -w '%{http_code}' \
        -X "$method" -H 'Accept: application/json' -H "X-CSRF-Token: $csrf" "$BASE$path")
    else
      code=$(curl -sk -b "$COOKIE" -c "$COOKIE" -o /tmp/_resp.json -w '%{http_code}' \
        -X "$method" -H 'Accept: application/json' "$BASE$path")
    fi
  fi
  local snip; snip=$(head -c 200 /tmp/_resp.json | tr -d '\r' | tr '\n' ' ')
  check_status "$proj" "$method" "$path" "$code" "$snip"
}

# Admin (Bearer token) request
adm_req() {
  local method="$1" path="$2" body="${3:-}"
  local code
  if [[ -n "$body" ]]; then
    code=$(curl -sk -o /tmp/_aresp.json -w '%{http_code}' \
      -X "$method" -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H 'Accept: application/json' -H 'Content-Type: application/json' \
      --data "$body" "$BASE$path")
  else
    code=$(curl -sk -o /tmp/_aresp.json -w '%{http_code}' \
      -X "$method" -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H 'Accept: application/json' "$BASE$path")
  fi
  local snip; snip=$(head -c 200 /tmp/_aresp.json | tr -d '\r' | tr '\n' ' ')
  check_status admin "$method" "$path" "$code" "$snip"
}

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== Sampling reference IDs/slugs ==='
PRODUCT_SLUG=$(curl -sk "$BASE/api/v1/products?size=1" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['slug'])")
PRODUCT_ID=$(curl -sk "$BASE/api/v1/products?size=1" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['id'])")
CATEGORY_SLUG=$(curl -sk "$BASE/api/v1/categories?size=1" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['slug'])")
BRAND_SLUG=$(curl -sk "$BASE/api/v1/brands?size=1" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['slug'])")
ARTICLE_SLUG=$(curl -sk "$BASE/api/v1/articles?size=1" | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['slug'])")
log "PRODUCT_SLUG=$PRODUCT_SLUG  PRODUCT_ID=$PRODUCT_ID"
log "CATEGORY_SLUG=$CATEGORY_SLUG  BRAND_SLUG=$BRAND_SLUG  ARTICLE_SLUG=$ARTICLE_SLUG"

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== PUBLIC CATALOG (used by web + mobile) ==='
get_pub web "/api/v1/products?size=5"
get_pub web "/api/v1/products?size=5&sort=createdAt:desc"
get_pub web "/api/v1/products?size=5&category=$CATEGORY_SLUG"
get_pub web "/api/v1/products?size=5&pwb-brand=$BRAND_SLUG"
get_pub web "/api/v1/products?size=5&q=mu"
get_pub web "/api/v1/products?size=5&showOnHomepage=true"
get_pub web "/api/v1/products/$PRODUCT_SLUG"
get_pub mobile "/api/v1/products/$PRODUCT_ID/snapshot"
get_pub mobile "/api/v1/products/$PRODUCT_ID/reviews"

get_pub web "/api/v1/categories?size=10"
get_pub web "/api/v1/categories?size=10&filterHome=true"
get_pub web "/api/v1/categories/$CATEGORY_SLUG"
get_pub web "/api/v1/brands?size=10"
get_pub web "/api/v1/brands/$BRAND_SLUG"
get_pub web "/api/v1/articles?size=5"
get_pub web "/api/v1/articles/$ARTICLE_SLUG"

get_pub web "/api/v1/pages/gioi-thieu"
get_pub web "/api/v1/menus/primary"
get_pub web "/api/v1/settings/public"
get_pub web "/api/v1/sliders?location=home"
get_pub web "/api/v1/home-videos"
get_pub web "/api/v1/search?q=mu&limit=5"
get_pub web "/api/v1/search?q=mu&type=product,article&limit=5"
get_pub mobile "/api/v1/search-suggest?q=mu&limit=5"

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== VN ADDRESS API (mobile) ==='
get_pub mobile "/api/v1/address/provinces"
PROVINCE_CODE=$(curl -sk "$BASE/api/v1/address/provinces" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['code'] if d.get('data') else '')" 2>/dev/null)
if [[ -n "${PROVINCE_CODE:-}" ]]; then
  get_pub mobile "/api/v1/address/provinces/$PROVINCE_CODE/districts"
  DISTRICT_CODE=$(curl -sk "$BASE/api/v1/address/provinces/$PROVINCE_CODE/districts" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['code'] if d.get('data') else '')" 2>/dev/null)
  if [[ -n "${DISTRICT_CODE:-}" ]]; then
    get_pub mobile "/api/v1/address/districts/$DISTRICT_CODE/wards"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== GUEST CART (web + mobile) ==='
get_pub web "/api/v1/cart"
CSRF=$(awk '/bb_csrf/ {csrf=$7} END{print csrf}' "$COOKIE")
log "CSRF=$CSRF"

mut_pub web POST   "/api/v1/cart/items" "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}" "$CSRF"
ITEM_ID=$(curl -sk -b "$COOKIE" "$BASE/api/v1/cart" | python -c "import sys,json;d=json.load(sys.stdin);items=d['data']['items'];print(items[0]['id'] if items else '')" 2>/dev/null)
log "ITEM_ID=$ITEM_ID"
if [[ -n "$ITEM_ID" ]]; then
  mut_pub web PATCH  "/api/v1/cart/items/$ITEM_ID" '{"quantity":2}' "$CSRF"
  mut_pub web DELETE "/api/v1/cart/items/$ITEM_ID" '' "$CSRF"
fi
mut_pub web DELETE "/api/v1/cart/clear" '' "$CSRF"
get_pub web "/api/v1/checkout/options"

# Re-add an item so we have a valid coupon-test target
mut_pub web POST "/api/v1/cart/items" "{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}" "$CSRF"
# (Coupon endpoints exist; testing with a real coupon code requires admin setup.
#  We have already verified they reach the controller — 404 on nonexistent code = OK.)

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== CUSTOMER AUTH + PROFILE (web + mobile) ==='
TS=$(date +%s)
EMAIL="apitest+$TS@bigbike.local"
PWD='ApiTest@123!'
mut_pub web POST "/api/v1/customer/auth/register" "{\"email\":\"$EMAIL\",\"password\":\"$PWD\",\"firstName\":\"Api\",\"lastName\":\"Test\"}" "$CSRF"
mut_pub web POST "/api/v1/customer/auth/login"    "{\"login\":\"$EMAIL\",\"password\":\"$PWD\"}" "$CSRF"
CSRF=$(awk '/bb_csrf/ {csrf=$7} END{print csrf}' "$COOKIE")
log "CSRF (after login)=$CSRF"
mut_pub web POST "/api/v1/customer/auth/password/forgot" "{\"login\":\"$EMAIL\"}" "$CSRF"

get_pub web "/api/v1/customer/me"
mut_pub web PATCH "/api/v1/customer/me" '{"firstName":"Api2"}' "$CSRF"
get_pub web "/api/v1/customer/addresses"
mut_pub web POST "/api/v1/customer/addresses" '{"recipientName":"Api Test","phoneNumber":"0900000001","line1":"123 Test Street","provinceCode":"01","districtCode":"001","wardCode":"00001","isDefault":true}' "$CSRF"
ADDR_ID=$(curl -sk -b "$COOKIE" "$BASE/api/v1/customer/addresses" | python -c "import sys,json;d=json.load(sys.stdin);items=d.get('data',[]);print(items[0]['id'] if items else '')" 2>/dev/null)
log "ADDR_ID=$ADDR_ID"
if [[ -n "$ADDR_ID" ]]; then
  mut_pub web PATCH  "/api/v1/customer/addresses/$ADDR_ID" '{"recipientName":"Api Test 2"}' "$CSRF"
  mut_pub web DELETE "/api/v1/customer/addresses/$ADDR_ID" '' "$CSRF"
fi
get_pub web "/api/v1/customer/orders?page=1&size=10"
get_pub web "/api/v1/customer/orders/returns"

mut_pub web POST "/api/v1/contact" '{"fullName":"Api","email":"a@b.co","phone":"0900000001","content":"Hello world from API test - this needs to be at least 20 characters."}' "$CSRF"

mut_pub web POST "/api/v1/customer/auth/logout" '' "$CSRF"

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=== ADMIN AUTH ==='
LOGIN_RESP=$(curl -sk -X POST -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -c "$COOKIE" -b "$COOKIE" \
  --data '{"email":"admin@bigbike.vn","password":"admin123"}' \
  "$BASE/api/v1/auth/login")
log "Admin login response: $(echo "$LOGIN_RESP" | head -c 300)"
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | python -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
log "ADMIN_TOKEN length=${#ADMIN_TOKEN}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  log 'ABORT: cannot acquire admin token; skipping admin tests.'
else
  log ''
  log '=== ADMIN /auth ==='
  adm_req GET "/api/v1/auth/me"

  log ''
  log '=== ADMIN reads (lists) ==='
  adm_req GET "/api/v1/admin/products?size=5"
  adm_req GET "/api/v1/admin/categories?size=5"
  adm_req GET "/api/v1/admin/brands?size=5"
  adm_req GET "/api/v1/admin/content?size=5"
  adm_req GET "/api/v1/admin/orders?size=5"
  adm_req GET "/api/v1/admin/customers?size=5"
  adm_req GET "/api/v1/admin/media?size=5"
  adm_req GET "/api/v1/admin/settings?size=10"
  adm_req GET "/api/v1/admin/coupons?size=5"
  adm_req GET "/api/v1/admin/redirects?size=5"
  adm_req GET "/api/v1/admin/menus"
  adm_req GET "/api/v1/admin/sliders?location=home"
  adm_req GET "/api/v1/admin/home-videos"
  adm_req GET "/api/v1/admin/shipping/zones"
  adm_req GET "/api/v1/admin/admin-users?size=5"
  adm_req GET "/api/v1/admin/reviews?size=5"
  adm_req GET "/api/v1/admin/audit-logs?size=5"
  adm_req GET "/api/v1/admin/reports/analytics"
  adm_req GET "/api/v1/admin/inventory?size=5"
  adm_req GET "/api/v1/admin/inventory/summary"
  adm_req GET "/api/v1/admin/inventory/movements?size=5"
  adm_req GET "/api/v1/admin/returns?size=5"
  adm_req GET "/api/v1/admin/dashboard?period=30d"

  # CSV exports
  log ''
  log '=== ADMIN CSV exports ==='
  for path in "/api/v1/admin/reports/orders/export" "/api/v1/admin/reports/customers/export" "/api/v1/admin/reports/products/export" "/api/v1/admin/inventory/export.csv"; do
    code=$(curl -sk -o /tmp/_aresp.json -w '%{http_code}' \
      -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Accept: text/csv' "$BASE$path")
    snip=$(head -c 200 /tmp/_aresp.json | tr -d '\r' | tr '\n' ' ')
    check_status admin GET "$path" "$code" "$snip"
  done

  # Detail endpoints — get IDs from the lists
  ADMIN_PRODUCT_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/products?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_CATEGORY_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/categories?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_BRAND_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/brands?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_ORDER_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/orders?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_CUSTOMER_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/customers?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_CONTENT_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/content?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null)
  ADMIN_CONTENT_TYPE=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/content?size=1" | python -c "import sys,json;d=json.load(sys.stdin);print(d['data'][0].get('type','article').lower() if d.get('data') else 'article')" 2>/dev/null)
  ADMIN_MENU_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/menus" | python -c "import sys,json;d=json.load(sys.stdin);items=d.get('data') or [];print(items[0]['id'] if items else '')" 2>/dev/null)
  ADMIN_VARIANT_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/inventory?size=1" | python -c "import sys,json;d=json.load(sys.stdin);items=d.get('data',[]);print(items[0].get('variantId') or items[0].get('id') if items else '')" 2>/dev/null)
  ADMIN_ZONE_ID=$(curl -sk -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE/api/v1/admin/shipping/zones" | python -c "import sys,json;d=json.load(sys.stdin);items=d.get('data',[]);print(items[0]['id'] if items else '')" 2>/dev/null)

  log ''
  log "Sample admin IDs: product=$ADMIN_PRODUCT_ID category=$ADMIN_CATEGORY_ID brand=$ADMIN_BRAND_ID order=$ADMIN_ORDER_ID customer=$ADMIN_CUSTOMER_ID content=$ADMIN_CONTENT_ID/$ADMIN_CONTENT_TYPE menu=$ADMIN_MENU_ID variant=$ADMIN_VARIANT_ID zone=$ADMIN_ZONE_ID"

  log ''
  log '=== ADMIN reads (details) ==='
  [[ -n "$ADMIN_PRODUCT_ID" ]] && adm_req GET "/api/v1/admin/products/$ADMIN_PRODUCT_ID"
  [[ -n "$ADMIN_CATEGORY_ID" ]] && adm_req GET "/api/v1/admin/categories/$ADMIN_CATEGORY_ID"
  [[ -n "$ADMIN_BRAND_ID" ]] && adm_req GET "/api/v1/admin/brands/$ADMIN_BRAND_ID"
  if [[ -n "$ADMIN_CONTENT_ID" ]]; then
    case "$ADMIN_CONTENT_TYPE" in
      page|pages) CTYPE=page ;;
      *) CTYPE=article ;;
    esac
    adm_req GET "/api/v1/admin/content/$CTYPE/$ADMIN_CONTENT_ID"
  fi
  [[ -n "$ADMIN_ORDER_ID" ]] && adm_req GET "/api/v1/admin/orders/$ADMIN_ORDER_ID"
  [[ -n "$ADMIN_ORDER_ID" ]] && adm_req GET "/api/v1/admin/orders/$ADMIN_ORDER_ID/allowed-transitions"
  [[ -n "$ADMIN_CUSTOMER_ID" ]] && adm_req GET "/api/v1/admin/customers/$ADMIN_CUSTOMER_ID"
  [[ -n "$ADMIN_MENU_ID" ]] && adm_req GET "/api/v1/admin/menus/$ADMIN_MENU_ID"
  [[ -n "$ADMIN_VARIANT_ID" ]] && adm_req GET "/api/v1/admin/inventory/variants/$ADMIN_VARIANT_ID/movements?size=5"
  [[ -n "$ADMIN_ZONE_ID" ]] && adm_req GET "/api/v1/admin/shipping/zones/$ADMIN_ZONE_ID/methods"

  # Refresh token endpoint — re-login to get a real refresh token
  REFRESH_TOKEN=$(curl -sk -X POST -H 'Content-Type: application/json' \
    --data '{"email":"admin@bigbike.vn","password":"admin123"}' \
    "$BASE/api/v1/auth/login" | python -c "import sys,json;print(json.load(sys.stdin)['data'].get('refreshToken',''))")
  adm_req POST "/api/v1/auth/refresh" "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
  # Admin logout
  adm_req POST "/api/v1/auth/logout" "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
fi

# ─────────────────────────────────────────────────────────────────────────────
log ''
log '=================================================='
log "RESULT: PASS=$PASS  FAIL=$FAIL"
log '=================================================='
if (( FAIL > 0 )); then
  log ''
  log 'FAILURES:'
  for f in "${FAIL_LIST[@]}"; do
    log " - $f"
  done
fi
exit 0
