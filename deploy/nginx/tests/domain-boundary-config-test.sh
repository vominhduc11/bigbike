#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
default_api="$repo_root/deploy/nginx/api.bigbike.vn.conf"
default_admin="$repo_root/deploy/nginx/admin.bigbike.vn.conf"
default_media="$repo_root/deploy/nginx/media.bigbike.vn.conf"
temporary_root=""

cleanup() {
  if [[ -n "$temporary_root" && "$temporary_root" == */bigbike-boundary.* && -d "$temporary_root" ]]; then
    rm -rf -- "$temporary_root"
  fi
}

trap cleanup EXIT

die() {
  printf 'Kiểm tra ranh giới cửa: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Cách dùng:
  domain-boundary-config-test.sh
  domain-boundary-config-test.sh <api.conf> <admin.conf> <media.conf>
  domain-boundary-config-test.sh --self-test

--self-test kiểm bản nguyên vẹn, tạo bản sao tạm, cố tình bỏ chốt và xác nhận
bản hỏng bị phát hiện. Script không sửa cấu hình đang chạy hoặc file trong repo.
USAGE
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "thiếu lệnh bắt buộc: $1"
}

require_file() {
  test -f "$1" || die "không tìm thấy file: $1"
}

extract_location() {
  local file="$1"
  local marker="$2"
  awk -v marker="$marker" '
    index($0, marker) { capture = 1; found = 1 }
    capture {
      print
      if ($0 ~ /^    }$/) exit
    }
    END { if (!found) exit 2 }
  ' "$file"
}

assert_file_has_fixed() {
  local file="$1"
  local expected="$2"
  local label="$3"
  grep -Fq -- "$expected" "$file" || die "$label"
}

assert_file_has_regex() {
  local file="$1"
  local expected="$2"
  local label="$3"
  grep -Eq -- "$expected" "$file" || die "$label"
}

assert_file_lacks_regex() {
  local file="$1"
  local forbidden="$2"
  local label="$3"
  if grep -Eq -- "$forbidden" "$file"; then
    die "$label"
  fi
}

assert_location_has_regex() {
  local file="$1"
  local marker="$2"
  local expected="$3"
  local label="$4"
  local block
  block="$(extract_location "$file" "$marker")" || die "thiếu location: $marker"
  grep -Eq -- "$expected" <<<"$block" || die "$label"
}

assert_location_lacks_regex() {
  local file="$1"
  local marker="$2"
  local forbidden="$3"
  local label="$4"
  local block
  block="$(extract_location "$file" "$marker")" || die "thiếu location: $marker"
  if grep -Eq -- "$forbidden" <<<"$block"; then
    die "$label"
  fi
}

assert_fixed_count() {
  local file="$1"
  local expected="$2"
  local wanted="$3"
  local label="$4"
  local actual
  actual="$(grep -Fc -- "$expected" "$file" || true)"
  test "$actual" -eq "$wanted" || die "$label (đang có $actual, cần $wanted)"
}

validate_configs() {
  local api="$1"
  local admin="$2"
  local media="$3"

  require_file "$api"
  require_file "$admin"
  require_file "$media"

  # Cửa khách: giữ chốt gốc, chốt tải ảnh riêng, chốt hoa/thường và dấu phân cách mã hóa.
  assert_location_has_regex "$api" "location = /api/v1/admin {" 'return[[:space:]]+404;' \
    "cửa khách thiếu chốt gốc quản trị"
  assert_location_has_regex "$api" "location ^~ /api/v1/admin/media {" 'return[[:space:]]+404;' \
    "cửa khách thiếu chốt tải ảnh quản trị"
  assert_location_lacks_regex "$api" "location ^~ /api/v1/admin/media {" 'proxy_pass' \
    "đường tải ảnh quản trị còn chuyển tiếp vào backend"
  assert_location_has_regex "$api" "location ^~ /api/v1/admin/ {" 'return[[:space:]]+404;' \
    "cửa khách thiếu chốt nhánh quản trị"
  assert_location_has_regex "$api" "location = /api/v1/auth {" 'return[[:space:]]+404;' \
    "cửa khách thiếu chốt gốc đăng nhập nhân viên"
  assert_location_has_regex "$api" "location ^~ /api/v1/auth/ {" 'return[[:space:]]+404;' \
    "cửa khách thiếu chốt nhánh đăng nhập nhân viên"
  assert_file_has_fixed "$api" \
    'location ~* "^/api/v1/(?:admin|auth)(?:/|;|%(?:25)*(?:2f|3b|5c)|$)" {' \
    "cửa khách thiếu chốt hoa/thường, tham số hoặc dấu phân cách mã hóa lặp"
  assert_file_lacks_regex "$api" 'location.*\/api\/internal' \
    "đường nội bộ cố ý để ứng dụng kiểm khóa không được chặn thêm tại cửa khách"

  # Cửa nhân viên: đúng năm nhóm API, fallback /api trả 404 và /ws không bị giới hạn.
  assert_file_has_fixed "$admin" \
    'location ~ ^/api/v1/(?:admin(?:/|$)|auth(?:/|$)|articles(?:/|$)|catalog/facets$|settings/public$) {' \
    "danh sách năm nhóm cửa nhân viên bị thay đổi"
  assert_location_has_regex "$admin" "location = /api {" 'return[[:space:]]+404;' \
    "cửa nhân viên thiếu chốt gốc /api"
  assert_location_has_regex "$admin" "location /api/ {" 'return[[:space:]]+404;' \
    "cửa nhân viên thiếu chốt fallback /api/"
  assert_file_lacks_regex "$admin" 'location[[:space:]]+\^~[[:space:]]+/api/' \
    "^~ /api/ sẽ nuốt danh sách năm nhóm cửa nhân viên"
  assert_file_has_regex "$admin" '^[[:space:]]*limit_req_status[[:space:]]+429;' \
    "cửa nhân viên thiếu mã 429 riêng"
  assert_file_has_regex "$admin" '^[[:space:]]*error_page[[:space:]]+429[[:space:]]+=[[:space:]]+@rate_limited_admin;' \
    "cửa nhân viên thiếu phản hồi 429 riêng"
  assert_fixed_count "$admin" 'limit_req zone=general_limit burst=30 nodelay;' 2 \
    "giới hạn thô cửa nhân viên phải xuất hiện đúng hai nơi"
  assert_location_has_regex "$admin" "location /ws {" 'proxy_pass[[:space:]]+http://127\.0\.0\.1:4000;' \
    "chuông báo không còn chuyển tới giao diện quản trị"
  assert_location_lacks_regex "$admin" "location /ws {" 'limit_(req|conn)' \
    "không được đặt giới hạn theo IP lên chuông báo"

  # Giữ các chốt vận hành đang chạy và không tự đưa IP/Cloudflare vào phạm vi này.
  assert_file_has_fixed "$api" 'error_page 502 503 504 =503 /__bigbike_outage.json;' \
    "cửa khách thiếu phản hồi khi backend mất kết nối"
  assert_file_has_fixed "$api" 'location = /api/v1/chat/videos' \
    "đường video chat riêng bị mất"
  assert_file_has_fixed "$admin" 'error_page 502 503 504 =503 /__bigbike_outage.html;' \
    "cửa nhân viên thiếu trang xin lỗi"
  assert_file_lacks_regex "$api" '^[[:space:]]*(allow|deny|set_real_ip_from|real_ip_header)[[:space:]]' \
    "không được thêm khóa IP/real_ip vào cửa khách"
  assert_file_lacks_regex "$admin" '^[[:space:]]*(allow|deny|set_real_ip_from|real_ip_header)[[:space:]]' \
    "không được thêm khóa IP/real_ip vào cửa nhân viên"

  # Cửa ảnh: chỉ prefix object công khai, không liệt kê bucket, không rate limit.
  assert_file_has_fixed "$media" '# CẢNH BÁO TRIỂN KHAI:' \
    "cấu hình cửa ảnh thiếu cảnh báo đối chiếu production"
  assert_location_has_regex "$media" "location = /bigbike-media {" 'return[[:space:]]+404;' \
    "cửa ảnh còn mở gốc bucket không dấu gạch"
  assert_location_has_regex "$media" "location = /bigbike-media/ {" 'return[[:space:]]+404;' \
    "cửa ảnh còn mở gốc bucket"
  assert_location_has_regex "$media" "location ^~ /bigbike-media/ {" \
    'limit_except[[:space:]]+GET[[:space:]]+HEAD[[:space:]]+OPTIONS[[:space:]]*\{[[:space:]]*deny[[:space:]]+all;' \
    "đường ảnh công khai không còn ở chế độ chỉ đọc"
  assert_location_has_regex "$media" "location ^~ /bigbike-media/ {" \
    'proxy_pass[[:space:]]+http://127\.0\.0\.1:9000;' \
    "đường ảnh công khai không chuyển tới MinIO"
  assert_location_has_regex "$media" "location ^~ /bigbike-media/ {" \
    'proxy_intercept_errors[[:space:]]+off;' \
    "cửa ảnh có thể nuốt phản hồi lỗi hợp lệ của MinIO"
  assert_location_has_regex "$media" "location / {" 'return[[:space:]]+404;' \
    "cửa ảnh thiếu chốt mọi đường lạ"
  assert_file_lacks_regex "$media" '^[[:space:]]*limit_(req|conn)[[:space:]]' \
    "không được thêm giới hạn tốc độ theo IP tại cửa ảnh"
  assert_file_has_fixed "$media" 'error_page 502 503 504 =503 /__bigbike_media_outage.html;' \
    "cửa ảnh thiếu trang xin lỗi khi MinIO mất kết nối"
  assert_location_has_regex "$media" "location = /__bigbike_media_outage.html {" 'internal;' \
    "trang xin lỗi cửa ảnh phải là đường nội bộ"
  assert_location_has_regex "$media" "location = /__bigbike_media_outage.html {" \
    'maintenance-media\.html;' "cửa ảnh trỏ sai trang xin lỗi"
  require_file "$repo_root/deploy/maintenance/templates/maintenance-media.html"
  assert_file_has_fixed "$repo_root/deploy/maintenance/render-fallback-pages.sh" \
    '"maintenance-media.html"' "công cụ chưa sinh trang xin lỗi cửa ảnh"
}

expect_mutation_failure() {
  local label="$1"
  local api="$2"
  local admin="$3"
  local media="$4"
  if (validate_configs "$api" "$admin" "$media") >/dev/null 2>&1; then
    die "bài tự kiểm không phát hiện bản hỏng: $label"
  fi
  printf 'Đạt kiểm âm: %s bị phát hiện.\n' "$label"
}

self_test() {
  validate_configs "$default_api" "$default_admin" "$default_media"
  printf 'Đạt kiểm dương: bộ cấu hình nguyên vẹn.\n'

  temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/bigbike-boundary.XXXXXX")"
  cp -- "$default_api" "$temporary_root/api.conf"
  cp -- "$default_admin" "$temporary_root/admin.conf"
  cp -- "$default_media" "$temporary_root/media.conf"

  sed -i '0,/location ~\*/s/location ~\*/location ~/' "$temporary_root/api.conf"
  expect_mutation_failure "bỏ chốt hoa/thường cửa khách" \
    "$temporary_root/api.conf" "$temporary_root/admin.conf" "$temporary_root/media.conf"

  cp -- "$default_api" "$temporary_root/api.conf"
  sed -i '0,/location = \/bigbike-media {/s//location = \/bigbike-media-loi {/' \
    "$temporary_root/media.conf"
  expect_mutation_failure "bỏ chốt gốc kho ảnh" \
    "$temporary_root/api.conf" "$temporary_root/admin.conf" "$temporary_root/media.conf"
}

main() {
  require_command grep
  require_command awk
  require_command sed
  require_command mktemp
  require_command cp

  case "${1:-}" in
    -h|--help)
      usage
      ;;
    --self-test)
      test "$#" -eq 1 || die "--self-test không nhận thêm tham số"
      self_test
      printf 'Tất cả kiểm tra ranh giới cửa đều đạt.\n'
      ;;
    *)
      test "$#" -le 3 || { usage >&2; die "quá nhiều tham số"; }
      validate_configs \
        "${1:-$default_api}" \
        "${2:-$default_admin}" \
        "${3:-$default_media}"
      printf 'Tất cả kiểm tra ranh giới cửa đều đạt.\n'
      ;;
  esac
}

main "$@"
