#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
admin="${1:-$repo_root/deploy/nginx/admin.bigbike.vn.conf}"

die() {
  printf 'Kiểm tra truyền tải cửa quản trị: %s\n' "$*" >&2
  exit 1
}

test -f "$admin" || die "không tìm thấy file: $admin"

assert_server_directive_once() {
  local directive="$1"
  local actual
  actual="$(grep -Fxc -- "    $directive" "$admin" || true)"
  test "$actual" -eq 1 || die "cần đúng một '$directive' ở cấp server (đang có $actual)"
}

assert_server_directive_once 'proxy_request_buffering off;'
assert_server_directive_once 'proxy_buffering off;'
assert_server_directive_once 'proxy_max_temp_file_size 0;'

if grep -Eq '^[[:space:]]*proxy_(request_)?buffering[[:space:]]+on;' "$admin"; then
  die "location con đang bật lại proxy buffering"
fi

printf 'Nginx admin proxy streaming checks passed: %s\n' "$admin"
