#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
shared="$repo_root/deploy/nginx/shared-config.conf"
api="$repo_root/deploy/nginx/api.bigbike.vn.conf"
web="$repo_root/deploy/nginx/bigbike.vn.conf"
admin="$repo_root/deploy/nginx/admin.bigbike.vn.conf"
admin_inner="$repo_root/bigbike-admin/nginx.conf"

rg -q '^limit_req_status 429;' "$shared"
rg -q '^limit_conn_status 429;' "$shared"
rg -q 'bigbike_rate_limit_json' "$shared"

for config in "$api" "$web" "$admin"; do
  rg -q 'error_page 429' "$config"
  rg -q 'Retry-After "1"' "$config"
  ! rg -q 'error_page[^;]*(429[^;]*503|503[^;]*429)' "$config"
  ! rg -q '\$proxy_add_x_forwarded_for' "$config"
  rg -q 'proxy_set_header X-Forwarded-For \$remote_addr;' "$config"
done

# Backend 429 must pass through unchanged; a proxy interceptor plus error_page 429 would turn it
# into an Nginx maintenance/generic response.
rg -q 'proxy_intercept_errors off;' "$api"
! rg -q '\$proxy_add_x_forwarded_for' "$admin_inner"
rg -q 'proxy_set_header X-Forwarded-For \$http_x_forwarded_for;' "$admin_inner"

echo "Nginx rate-limit static configuration checks passed."
