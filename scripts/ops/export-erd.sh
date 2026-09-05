#!/usr/bin/env bash
# Xuất sơ đồ ERD (quan hệ giữa các bảng dữ liệu) từ CSDL Postgres đang chạy.
# Chỉ ĐỌC metadata, không đụng vào dữ liệu.
#
# Cách dùng:
#   bash scripts/ops/export-erd.sh                    # xuất vào docs/engineering/generated/
#   bash scripts/ops/export-erd.sh --out /duong/dan   # xuất vào thư mục khác
#
# Kết quả:
#   ERD.dbml  -> dán vào https://dbdiagram.io để xem/kéo thả/xuất PNG-PDF
#   ERD.md    -> sơ đồ Mermaid theo từng nhóm nghiệp vụ (xem trên GitHub/VS Code)
#   ERD.json  -> dữ liệu thô (bảng, cột, khoá ngoại, số dòng)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT"
CONTAINER="${ERD_PG_CONTAINER:-bigbike-postgres}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT="$2"; shift 2 ;;
    --container) CONTAINER="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Tham số không hiểu: $1" >&2; exit 64 ;;
  esac
done

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Không thấy container '$CONTAINER' đang chạy. Hãy khởi động stack rồi chạy lại." >&2
  exit 1
fi

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

q() { docker exec "$CONTAINER" sh -c 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' psql "$1"; }

q "select c.table_name||'|'||c.column_name||'|'||c.data_type||'|'||coalesce(c.character_maximum_length::text,'')||'|'||c.is_nullable
    from information_schema.columns c
    join information_schema.tables t on t.table_name=c.table_name and t.table_schema=c.table_schema and t.table_type='BASE TABLE'
    where c.table_schema='public' order by c.table_name, c.ordinal_position" > "$TMP/columns.psv"

q "select c.conrelid::regclass::text||'|'||a.attname||'|'||c.confrelid::regclass::text||'|'||af.attname
    from pg_constraint c
    join lateral unnest(c.conkey, c.confkey) with ordinality as k(src, dst, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.src
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = k.dst
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace" > "$TMP/fks.psv"

q "select tc.table_name||'|'||kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
    where tc.constraint_type='PRIMARY KEY' and tc.table_schema='public'" > "$TMP/pks.psv"

q "select tc.table_name||'|'||kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
    where tc.constraint_type='UNIQUE' and tc.table_schema='public'" > "$TMP/uks.psv"

q "select table_name||'|'||(xpath('/row/cnt/text()', x))[1]::text
    from (select table_name, table_schema, query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as x
          from information_schema.tables where table_schema='public' and table_type='BASE TABLE') t" > "$TMP/counts.psv"

python3 "$ROOT/scripts/ops/export_erd.py" "$TMP" "$OUT"
echo "Đã xuất: $OUT/ERD.dbml, $OUT/ERD.md, $OUT/ERD.html, $OUT/ERD.json + $OUT/erd-mermaid/*.md"
