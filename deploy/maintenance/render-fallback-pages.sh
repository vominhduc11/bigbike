#!/usr/bin/env bash
set -Eeuo pipefail

# Renders the static OUTAGE pages that nginx serves via `error_page 502 503 504`
# when an upstream container is genuinely unreachable.
#
# This is NOT a maintenance switch. Since V374 the maintenance lock covers the admin
# panel only, lives in the database, and is toggled from the admin UI by the DEVELOPER
# role (PUT /api/v1/admin/maintenance) — there is no host-side state control any more,
# and the storefront is never taken down on purpose.
#
# Run it at deploy time: the pages must be regenerated whenever contact settings change,
# because a static file cannot read the database at the moment the stack is down — which
# is precisely when it gets served.
#
# The script never starts, stops, restarts or removes Docker containers, and never
# reloads nginx (it only writes files).

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_ROOT="$SCRIPT_DIR/templates"
STATIC_ROOT="${BIGBIKE_MAINTENANCE_STATIC_ROOT:-/var/www/bigbike-static/maintenance}"
API_URL="${BIGBIKE_MAINTENANCE_API_URL:-http://127.0.0.1:8080}"

die() {
  printf 'render-fallback-pages: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  render-fallback-pages.sh

Reads public contact settings from the running backend and regenerates the static
outage pages (storefront + admin) into $BIGBIKE_MAINTENANCE_STATIC_ROOT.

Env:
  BIGBIKE_MAINTENANCE_STATIC_ROOT  Output dir (default /var/www/bigbike-static/maintenance)
  BIGBIKE_MAINTENANCE_API_URL      Backend base URL   (default http://127.0.0.1:8080)
USAGE
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "thiếu lệnh bắt buộc: $1"
}

render_pages() {
  local settings_json
  settings_json="$(curl --fail-with-body --silent --show-error --max-time 20 \
    "$API_URL/api/v1/settings/public?lang=vi")" \
    || die "không đọc được contact settings; giữ nguyên trang đã sinh trước đó"
  mkdir -p "$STATIC_ROOT"
  MAINTENANCE_SETTINGS_JSON="$settings_json" \
    MAINTENANCE_REPO_ROOT="$REPO_ROOT" \
    MAINTENANCE_TEMPLATE_ROOT="$TEMPLATE_ROOT" \
    MAINTENANCE_STATIC_ROOT="$STATIC_ROOT" \
    python3 - <<'PY'
import base64
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path

payload = json.loads(os.environ["MAINTENANCE_SETTINGS_JSON"])
settings = payload.get("data", payload)
if not isinstance(settings, list):
    raise SystemExit("public settings response không hợp lệ")
values = {str(item.get("settingKey")): item.get("settingValue") or "" for item in settings if isinstance(item, dict)}

# Fail loudly rather than shipping an outage page with a blank contact line: this page is
# the only thing a customer sees while the stack is down, so stale/empty is worse than late.
# opening_hours_weekday joins the set for the same reason it stopped being hardcoded —
# a wrong "open 8:00-20:00" on the one page nobody can fix live is a real customer problem.
required = {"contact_address", "hotline", "facebook_url", "zalo_url", "opening_hours_weekday"}
missing = sorted(key for key in required if not values.get(key, "").strip())
if missing:
    raise SystemExit("contact settings trống: " + ", ".join(missing))

repo = Path(os.environ["MAINTENANCE_REPO_ROOT"])
template_root = Path(os.environ["MAINTENANCE_TEMPLATE_ROOT"])
output_root = Path(os.environ["MAINTENANCE_STATIC_ROOT"])
# Inline the pre-scaled 320px copy, NOT bigbike-web/public/brand/logo-primary.png. That source
# is 2000x2000 / 6.5 MB, which base64 inlined to an 8.6 MB outage page — served precisely when
# the system is already struggling and the customer is most likely on mobile data. The committed
# derivative is ~70 KB and the CSS caps display at 160px, so 320px still covers 2x retina.
logo = template_root / "logo-outage.png"
logo_uri = "data:image/png;base64," + base64.b64encode(logo.read_bytes()).decode("ascii")

# Self-policing staleness check: warn if the brand logo changed since the derivative was made.
# Not fatal — a slightly old logo is far better than refusing to publish an outage page.
stamp = template_root / "logo-outage.source.sha256"
brand_logo = repo / "bigbike-web" / "public" / "brand" / "logo-primary.png"
if stamp.exists() and brand_logo.exists():
    recorded = stamp.read_text(encoding="utf-8").split()[0]
    actual = hashlib.sha256(brand_logo.read_bytes()).hexdigest()
    if recorded != actual:
        print("render-fallback-pages: CANH BAO — logo thuong hieu da doi, logo-outage.png co the "
              "da cu. Xem DEPLOYMENT_GUIDE muc 'Static outage pages' de sinh lai.", file=sys.stderr)
token_source = (repo / "bigbike-web" / "styles" / "brand-tokens.css").read_text(encoding="utf-8")
token_pattern = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;]+);")
tokens = dict(token_pattern.findall(token_source))

def token_value(name, seen=None):
    seen = set() if seen is None else seen
    if name in seen:
        raise SystemExit("vòng tham chiếu brand token: " + name)
    seen.add(name)
    value = tokens.get(name, "").strip()
    if not value:
        raise SystemExit("thiếu brand token: " + name)
    match = re.fullmatch(r"var\(--([a-z0-9-]+)\)", value)
    return token_value(match.group(1), seen) if match else value

brand_replacements = {
    "BRAND_RED": token_value("bb-color-red-500"),
    "BRAND_RED_DARK": token_value("bb-color-red-700"),
    "INK": token_value("bb-color-black"),
    "MUTED": token_value("bb-color-gray-500"),
    "SURFACE": token_value("bb-color-white"),
    "CANVAS": token_value("bb-color-gray-50"),
    "LINE": token_value("bb-color-gray-200"),
}
hotline = values["hotline"].strip()
hotline_tel = re.sub(r"[^0-9+]", "", hotline)
if not hotline_tel:
    raise SystemExit("hotline không có số gọi hợp lệ")

# The three opening-hours settings are already self-describing ("T2 - T7: 09h00 - 21h00",
# "CN: 09h00 - 17h00", "Lễ / Tết: …") — join whichever are filled in.
opening_hours = " · ".join(
    values[key].strip()
    for key in ("opening_hours_weekday", "opening_hours_weekend", "opening_hours_holiday")
    if values.get(key, "").strip()
)

replacements = {
    **brand_replacements,
    "LOGO_DATA_URI": logo_uri,
    "HOTLINE": html.escape(hotline),
    "HOTLINE_TEL": html.escape(hotline_tel, quote=True),
    "ZALO_URL": html.escape(values["zalo_url"].strip(), quote=True),
    "FACEBOOK_URL": html.escape(values["facebook_url"].strip(), quote=True),
    "ADDRESS": html.escape(values["contact_address"].strip()),
    "OPENING_HOURS": html.escape(opening_hours),
}
for name in ("maintenance-web.html", "maintenance-admin.html"):
    source = (template_root / name).read_text(encoding="utf-8")
    for key, value in replacements.items():
        source = source.replace("{{" + key + "}}", value)
    leftover = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", source)))
    if leftover:
        raise SystemExit(f"{name}: token chưa được thay: " + ", ".join(leftover))
    (output_root / name).write_text(source, encoding="utf-8")
PY
  printf 'render-fallback-pages: đã sinh trang web/admin tại %s\n' "$STATIC_ROOT"
}

main() {
  case "${1:-}" in
    "") ;;
    -h|--help) usage; return 0 ;;
    *) usage >&2; die "tham số không nhận diện: $1" ;;
  esac
  require_command curl
  require_command python3
  render_pages
}

main "$@"
