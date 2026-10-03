#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
shared="$repo_root/deploy/nginx/shared-config.conf"
api="$repo_root/deploy/nginx/api.bigbike.vn.conf"
web="$repo_root/deploy/nginx/bigbike.vn.conf"
admin="$repo_root/deploy/nginx/admin.bigbike.vn.conf"
admin_inner="$repo_root/bigbike-admin/nginx.conf"

rg -q 'zone=api_limit:10m rate=10r/s;' "$shared"
rg -q 'zone=general_limit:10m rate=30r/s;' "$shared"
rg -q 'limit_req zone=api_limit' "$api"
rg -q 'limit_req zone=general_limit' "$web"

# The 2026-09-12 admin rollout intentionally deploys request-rate protection
# without a connection cap because every employee appears behind Cloudflare.
rg -q 'limit_req_status 429;' "$admin"
rg -q 'error_page 429 = @rate_limited_admin;' "$admin"
rg -q 'Retry-After "1"' "$admin"
test "$(rg -c 'limit_req zone=general_limit burst=30 nodelay;' "$admin")" -eq 2
! rg -q 'limit_conn' "$admin"
! rg -q 'error_page[^;]*(429[^;]*503|503[^;]*429)' "$admin"

# Backend 429 envelopes must pass through the two admin proxy locations.
test "$(rg -c 'proxy_intercept_errors off;' "$admin")" -eq 2
! rg -q '\$proxy_add_x_forwarded_for' "$admin_inner"
rg -q 'proxy_set_header X-Forwarded-For \$http_x_forwarded_for;' "$admin_inner"

echo "Nginx rate-limit static configuration checks passed."
