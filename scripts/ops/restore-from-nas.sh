#!/usr/bin/env bash
# Khoi phuc du lieu BigBike tu ban sao tren NAS.
#
# MAC DINH KHONG BAO GIO GHI DE DU LIEU DANG CHAY. Che do --drill (dien tap) khoi phuc
# vao mot co so du lieu THU ten rieng roi tu xoa; kho anh khoi phuc vao thu muc thu roi tu xoa.
# Muon khoi phuc that phai chi ro dich va go dung cau xac nhan - khong co duong tat.
#
# Cach dung:
#   bash scripts/ops/restore-from-nas.sh --drill
#       (--drill-db / --drill-media de dien tap rieng tung loai)
#       Dien tap ca hai loai du lieu, doi chieu so lieu, tu don sach. Khong dung du lieu that.
#
#   bash scripts/ops/restore-from-nas.sh db --into <ten-csdl-moi> [--file <duong-dan>]
#       Khoi phuc du lieu ban hang vao mot co so du lieu KHAC. Tu choi neu trung ten CSDL dang chay.
#
#   bash scripts/ops/restore-from-nas.sh media --into <thu-muc> [--dry-run]
#       Lay kho anh tu NAS ve mot thu muc. Tu choi neu tro vao kho anh dang chay.
#
# Khoi phuc DE LEN he thong that la viec thu cong, co huong dan tung buoc trong
# docs/engineering/BACKUP_RESTORE_RUNBOOK.md - script nay khong tu lam.

set -Eeuo pipefail

BB_JOB="restore"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib/nas-common.sh
source "$ROOT/scripts/ops/lib/nas-common.sh"

usage() { sed -n '2,26p' "${BASH_SOURCE[0]}" >&2; exit 64; }

MODE="${1:-}"; shift || true
INTO=""; FILE=""; DRYRUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --into) INTO="${2:-}"; shift 2 ;;
    --file) FILE="${2:-}"; shift 2 ;;
    --dry-run) DRYRUN=1; shift ;;
    -h|--help) usage ;;
    *) echo "Tham so khong hieu: $1" >&2; usage ;;
  esac
done

TMPDIR_LOCAL=""; DRILL_DB=""
cleanup() {
  [[ -n "$TMPDIR_LOCAL" && -d "$TMPDIR_LOCAL" ]] && rm -rf -- "$TMPDIR_LOCAL"
  if [[ -n "$DRILL_DB" ]]; then
    docker exec "$BB_PG_CONTAINER" sh -c \
      "PGPASSWORD=\"\$POSTGRES_PASSWORD\" dropdb -U \"\$POSTGRES_USER\" --if-exists '$DRILL_DB'" >/dev/null 2>&1 || true
    echo "  Da xoa co so du lieu thu: $DRILL_DB"
  fi
  return 0
}
trap cleanup EXIT

require_container() {
  docker ps --format '{{.Names}}' | grep -qx "$1" \
    || { echo "Khong thay container '$1' dang chay. Hay khoi dong he thong roi chay lai." >&2; exit 1; }
}

pgq() { # chay mot cau truy van doc tren mot CSDL bat ky
  local db="$1" sql="$2"
  docker exec "$BB_PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -X -q -A -t -U \"\$POSTGRES_USER\" -d '$db' -c \"$sql\"" 2>/dev/null
}

COUNT_SQL="select 'don_hang='||(select count(*) from orders)
||E'\ndong_hang='||(select count(*) from order_line_items)
||E'\nkhach_hang='||(select count(*) from customers)
||E'\nsan_pham='||(select count(*) from products)
||E'\nanh_trong_kho='||(select count(*) from media)
||E'\ndanh_muc='||(select count(*) from categories)
||E'\nthuong_hieu='||(select count(*) from brands)
||E'\ncau_hinh_shop='||(select count(*) from site_settings)
||E'\nphien_ban_csdl='||(select max(version::int)::text from flyway_schema_history where success)"

newest_db() { ls -t "$BB_NAS_ROOT"/db/hourly/*.dump 2>/dev/null | head -1; }

# ------------------------------------------------------------------ dien tap CSDL
drill_db() {
  echo "=============================================================="
  echo " DIEN TAP KHOI PHUC — DU LIEU BAN HANG"
  echo "=============================================================="
  require_container "$BB_PG_CONTAINER"
  local src; src="${FILE:-$(newest_db || true)}"
  [[ -n "$src" && -f "$src" ]] || { echo "Khong tim thay ban sao nao tren NAS." >&2; return 1; }
  echo "Ban sao dung de dien tap: $(basename "$src")  ($(du -h "$src" | cut -f1), tao luc $(date -d @"$(stat -c%Y "$src")" '+%d/%m/%Y %H:%M'))"

  echo; echo "-- Doi chieu dau kiem tra truoc khi dung --"
  local want got
  want="$(awk '{print $1}' "$src.sha256" 2>/dev/null)"
  got="$(bb_sha_from_nas "$src")"
  echo "  ghi khi sao luu : $want"
  echo "  doc lai tu NAS  : $got"
  [[ "$want" == "$got" ]] || { echo "  KHONG KHOP — dung dien tap." >&2; return 1; }
  echo "  KHOP"

  echo; echo "-- So lieu HE THONG DANG CHAY (khong bi dung toi) --"
  local live; live="$(pgq bigbike "$COUNT_SQL")"
  echo "$live" | sed 's/^/  /'

  DRILL_DB="bigbike_restore_drill_$(date +%Y%m%d%H%M%S)"
  echo; echo "-- Tao co so du lieu THU: $DRILL_DB --"
  docker exec "$BB_PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" createdb -U \"\$POSTGRES_USER\" '$DRILL_DB'" \
    || { echo "Khong tao duoc CSDL thu." >&2; return 1; }

  echo "-- Nap ban sao vao CSDL thu (du lieu that khong bi cham) --"
  local t0 t1
  t0=$(date +%s)
  docker exec -i "$BB_PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore -U \"\$POSTGRES_USER\" -d '$DRILL_DB' --no-owner --no-acl --exit-on-error" \
    < "$src" > /dev/null 2>"$ROOT/.restore-drill.err" || {
      echo "  Nap that bai:"; head -5 "$ROOT/.restore-drill.err" | sed 's/^/    /'; rm -f "$ROOT/.restore-drill.err"; return 1; }
  t1=$(date +%s)
  rm -f "$ROOT/.restore-drill.err"
  echo "  Nap xong trong $((t1-t0)) giay."

  echo; echo "-- So lieu TRONG BAN KHOI PHUC --"
  local restored; restored="$(pgq "$DRILL_DB" "$COUNT_SQL")"
  echo "$restored" | sed 's/^/  /'

  echo; echo "-- DOI CHIEU --"
  local diff=0 k lv rv
  printf "  %-18s %12s %12s   %s\n" "Muc" "Dang chay" "Khoi phuc" "Ket qua"
  while IFS='=' read -r k lv; do
    [[ -n "$k" ]] || continue
    rv="$(echo "$restored" | grep -m1 "^${k}=" | cut -d= -f2)"
    if [[ "$lv" == "$rv" ]]; then
      printf "  %-18s %12s %12s   %s\n" "$k" "$lv" "$rv" "KHOP"
    else
      printf "  %-18s %12s %12s   %s\n" "$k" "$lv" "$rv" "LECH <<<"
      diff=$((diff+1))
    fi
  done <<< "$live"

  echo
  if (( diff == 0 )); then
    echo "  KET QUA: TAT CA KHOP — ban sao du lieu ban hang dung duoc de khoi phuc."
  else
    echo "  KET QUA: co $diff muc lech. Xem lai truoc khi tin ban sao nay."
  fi
  return $(( diff > 0 ? 1 : 0 ))
}

# ------------------------------------------------------------------ dien tap anh
# Kho anh duoc luu thanh goi nen: mot goi day + cac goi thay doi tiep theo.
# Dien tap = giai nen toan bo chuoi ra mot thu muc THU roi doi chieu voi kho anh dang chay.
#
# Doc tu NAS rat cham (~0,55 MB/s), nen moi goi chi doc DUNG MOT LAN: vua tinh dau kiem tra
# vua giai nen cung luc. Doc hai lan se mat gap doi thoi gian ma khong biet them dieu gi.
drill_media() {
  echo
  echo "=============================================================="
  echo " DIEN TAP KHOI PHUC — KHO ANH/VIDEO"
  echo "=============================================================="
  local MD="$BB_NAS_ROOT/media"
  local base; base="$(ls -t "$MD"/media-base-*.tar.zst 2>/dev/null | head -1 || true)"
  [[ -n "$base" ]] || { echo "Chua co goi sao luu kho anh tren NAS." >&2; return 1; }

  local free; free="$(bb_free_gb /var/tmp)"
  (( free >= 6 )) || { echo "Dia may chu chi con ${free}GB — khong du cho dien tap." >&2; return 1; }

  local -a incs=()
  while IFS= read -r f; do [[ -e "$f" ]] && incs+=("$f"); done < <(ls "$MD"/media-inc-*.tar.zst 2>/dev/null | sort || true)
  echo "Goi nen day : $(basename "$base")  ($(du -h "$base" | cut -f1))"
  echo "Goi thay doi: ${#incs[@]} goi"

  TMPDIR_LOCAL="$(mktemp -d /var/tmp/bigbike-restore-drill.XXXXXX)"
  echo
  echo "Giai nen ra thu muc thu: $TMPDIR_LOCAL"
  echo "(kho anh dang chay KHONG bi cham, khong dung dich vu nao)"
  echo "Moi goi doc dung mot lan — vua doi chieu dau kiem tra vua giai nen."
  echo

  local f want got shafile bad=0 t0 t1
  t0=$(date +%s)
  for f in "$base" "${incs[@]}"; do
    want="$(awk '{print $1}' "$f.sha256" 2>/dev/null)"
    shafile="$TMPDIR_LOCAL/.sha.$$"
    bb_drop_cache "$f"
    if ! < "$f" tee >(sha256sum | awk '{print $1}' > "$shafile") \
         | zstd -dc | tar --listed-incremental=/dev/null -xf - -C "$TMPDIR_LOCAL" 2>/dev/null; then
      printf '  %-44s GIAI NEN THAT BAI <<<\n' "$(basename "$f")"; bad=$((bad+1)); continue
    fi
    got="$(cat "$shafile" 2>/dev/null)"; rm -f "$shafile"
    if [[ -n "$want" && "$want" == "$got" ]]; then
      printf '  %-44s dau kiem tra KHOP, giai nen OK\n' "$(basename "$f")"
    else
      printf '  %-44s DAU KIEM TRA KHONG KHOP <<<\n' "$(basename "$f")"; bad=$((bad+1))
    fi
  done
  t1=$(date +%s)
  echo
  echo "  Doc + kiem tra + giai nen xong trong $((t1-t0)) giay."
  (( bad == 0 )) || { echo "  Co $bad goi hong." >&2; return 1; }

  local live_n rest_n
  live_n="$(find "$BB_MINIO_VOLUME" -type f -not -path '*/.minio.sys/tmp/*' -not -path '*/.minio.sys/multipart/*' 2>/dev/null | wc -l)"
  rest_n="$(find "$TMPDIR_LOCAL" -type f 2>/dev/null | wc -l)"
  echo
  printf "  %-28s %10s %10s   %s\n" "Muc" "Dang chay" "Khoi phuc" "Ket qua"
  printf "  %-28s %10s %10s   %s\n" "Tong so tep" "$live_n" "$rest_n" \
    "$( [[ "$live_n" == "$rest_n" ]] && echo KHOP || echo 'LECH' )"

  local b a c
  for b in bigbike-media bigbike-chat-private; do
    a="$(find "$BB_MINIO_VOLUME/$b" -name xl.meta 2>/dev/null | wc -l)"
    c="$(find "$TMPDIR_LOCAL/$b" -name xl.meta 2>/dev/null | wc -l)"
    printf "  %-28s %10s %10s   %s\n" "Anh trong $b" "$a" "$c" \
      "$( [[ "$a" == "$c" ]] && echo KHOP || echo 'LECH' )"
  done

  echo; echo "-- Doi chieu noi dung 20 tep ngau nhien --"
  local ok=0 nbad=0 rel h1 h2
  while IFS= read -r rel; do
    h1="$(sha256sum "$BB_MINIO_VOLUME/$rel" 2>/dev/null | awk '{print $1}')"
    h2="$(sha256sum "$TMPDIR_LOCAL/$rel"    2>/dev/null | awk '{print $1}')"
    if [[ -n "$h1" && "$h1" == "$h2" ]]; then ok=$((ok+1)); else nbad=$((nbad+1)); echo "    LECH: $rel"; fi
  done < <(cd "$BB_MINIO_VOLUME" && find . -type f -path '*bigbike-media*' 2>/dev/null | sed 's|^\./||' | shuf -n 20)
  echo "  Giong het: $ok tep   |   Lech: $nbad tep"

  # So tep co the lech vai don vi neu khach vua tai anh len trong luc dien tap - do la binh thuong.
  local verdict=0 delta=$(( live_n - rest_n )); (( delta < 0 )) && delta=$(( -delta ))
  (( delta <= 20 )) || verdict=1
  (( nbad == 0 )) || verdict=1
  echo
  if (( verdict == 0 )); then
    (( live_n != rest_n )) && echo "  (lech $delta tep — khach tai anh len trong luc dien tap, khong phai loi)"
    echo "  KET QUA: KHOP — ban sao kho anh dung duoc de khoi phuc."
  else
    echo "  KET QUA: co sai lech, xem chi tiet ben tren."
  fi
  return $verdict
}

# ------------------------------------------------------------------ khoi phuc that
restore_db_into() {
  require_container "$BB_PG_CONTAINER"
  [[ -n "$INTO" ]] || { echo "Thieu --into <ten-csdl-moi>." >&2; exit 64; }
  [[ "$INTO" != "bigbike" ]] || { echo "TU CHOI: khong ghi de co so du lieu dang chay 'bigbike'. Xem runbook." >&2; exit 1; }
  [[ "$INTO" =~ ^[a-z0-9_]+$ ]] || { echo "Ten CSDL chi duoc dung chu thuong, so va gach duoi." >&2; exit 64; }
  local src; src="${FILE:-$(newest_db || true)}"
  [[ -n "$src" && -f "$src" ]] || { echo "Khong tim thay ban sao." >&2; exit 1; }
  echo "Khoi phuc $(basename "$src") -> co so du lieu '$INTO'"
  docker exec "$BB_PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" createdb -U \"\$POSTGRES_USER\" '$INTO'" 2>/dev/null || echo "  (CSDL da ton tai, nap tiep vao do)"
  docker exec -i "$BB_PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore -U \"\$POSTGRES_USER\" -d '$INTO' --no-owner --no-acl" < "$src"
  echo "Xong. So lieu trong '$INTO':"; pgq "$INTO" "$COUNT_SQL" | sed 's/^/  /'
}

restore_media_into() {
  [[ -n "$INTO" ]] || { echo "Thieu --into <thu-muc>." >&2; exit 64; }
  [[ "$INTO" != "$BB_MINIO_VOLUME" ]] || { echo "TU CHOI: khong ghi de kho anh dang chay. Xem runbook." >&2; exit 1; }
  local MD="$BB_NAS_ROOT/media"
  local base; base="$(ls -t "$MD"/media-base-*.tar.zst 2>/dev/null | head -1 || true)"
  [[ -n "$base" ]] || { echo "Khong tim thay goi sao luu kho anh." >&2; exit 1; }
  local -a incs=()
  while IFS= read -r f; do [[ -e "$f" ]] && incs+=("$f"); done < <(ls "$MD"/media-inc-*.tar.zst 2>/dev/null | sort || true)
  echo "Se giai nen: $(basename "$base") + ${#incs[@]} goi thay doi -> $INTO"
  (( DRYRUN )) && { echo "(chi xem thu, khong lam gi)"; exit 0; }
  mkdir -p "$INTO"
  local f
  for f in "$base" "${incs[@]}"; do
    echo "  $(basename "$f")"
    zstd -dc "$f" | tar --listed-incremental=/dev/null -xf - -C "$INTO" || { echo "That bai." >&2; exit 1; }
  done
  echo "Xong. $(find "$INTO" -type f | wc -l) tep tai $INTO"
}

case "$MODE" in
  --drill|--drill-db|--drill-media)
    bb_nas_require
    rc=0; scope=""
    [[ "$MODE" != "--drill-media" ]] && { drill_db    || rc=1; }
    [[ "$MODE" != "--drill-db"    ]] && { drill_media || rc=1; }
    echo
    echo "=============================================================="
    case "$MODE" in
      --drill-db)    scope="du lieu ban hang" ;;
      --drill-media) scope="kho anh/video" ;;
      *)             scope="ca hai loai du lieu" ;;
    esac
    (( rc == 0 )) && echo " DIEN TAP DAT — $scope khoi phuc lai duoc." \
                  || echo " DIEN TAP CO SAI LECH — xem chi tiet ben tren."
    echo "=============================================================="
    exit $rc ;;
  db)    bb_nas_require; restore_db_into ;;
  media) bb_nas_require; restore_media_into ;;
  *) usage ;;
esac
