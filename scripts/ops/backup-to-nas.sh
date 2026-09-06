#!/usr/bin/env bash
# Sao luu du lieu BigBike ra NAS o nha (qua duong truyen rieng Tailscale).
#
# Script nay CHI DOC du lieu dang chay. No khong sua/xoa mot dong du lieu nao cua shop,
# khong dung/khoi dong lai/thay bat cu container nao, khong dung toi he thong 4thitek
# tren cung may chu, va khong bao gio ghi ra ngoai thu muc vps-backups/ tren NAS.
#
# Cach dung:
#   bash scripts/ops/backup-to-nas.sh db        # du lieu ban hang (moi gio)
#   bash scripts/ops/backup-to-nas.sh media     # kho anh/video (moi ngay)
#   bash scripts/ops/backup-to-nas.sh config    # cau hinh van hanh (moi ngay)
#   bash scripts/ops/backup-to-nas.sh watchdog  # nguoi gac: qua 24h khong co ban moi thi bao dong
#   bash scripts/ops/backup-to-nas.sh digest    # tin tong ket moi sang
#   bash scripts/ops/backup-to-nas.sh list      # xem cac ban dang co tren NAS
#   bash scripts/ops/backup-to-nas.sh verify    # kiem tra lai ban moi nhat
#
# Nhip chay va so ban giu lai chinh o DUNG MOT CHO: /etc/cron.d/bigbike-backup

set -Eeuo pipefail

BB_JOB="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib/nas-common.sh
source "$ROOT/scripts/ops/lib/nas-common.sh"

usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}" >&2
  exit 64
}
[[ -n "$BB_JOB" ]] || usage

TMPDIR_LOCAL=""
cleanup() {
  # Xoa tep tam DU CO LOI GIUA CHUNG - khong de lai ban sao day tren dia may chu.
  [[ -n "$TMPDIR_LOCAL" && -d "$TMPDIR_LOCAL" ]] && rm -rf -- "$TMPDIR_LOCAL"
  return 0
}
trap cleanup EXIT
trap 'bb_fail "Bi ngat giua chung (tin hieu dung)."' INT TERM

require_container() {
  local c="$1"
  docker ps --format '{{.Names}}' | grep -qx "$c" \
    || bb_fail "Khong thay container '$c' dang chay. Hay khoi dong he thong roi chay lai."
}

# Chuyen tep len NAS: ghi ban .part truoc, doc nguoc lai kiem tra, dat ten that sau cung.
ship_and_verify() {
  local src="$1" dest="$2" want
  # Don xac ban do dang cua lan chay truoc bi ngat giua chung.
  find "$(dirname "$dest")" -maxdepth 1 -name '*.part' -mmin +360 -delete 2>/dev/null || true
  want="$(sha256sum "$src" | awk '{print $1}')"
  bb_log "Chuyen $(basename "$dest") ($(du -h "$src" | cut -f1)) sang NAS..."
  if ! ionice -c3 nice -n 19 cp -- "$src" "$dest.part"; then
    rm -f -- "$dest.part" 2>/dev/null || true
    bb_fail "Chuyen sang NAS that bai (duong truyen dut hoac NAS het cho)."
  fi
  sync
  local got; got="$(bb_sha_from_nas "$dest.part")"
  if [[ "$got" != "$want" ]]; then
    rm -f -- "$dest.part" 2>/dev/null || true
    bb_fail "Ban tren NAS khong khop dau kiem tra (cho $want, doc duoc $got). Da xoa ban hong."
  fi
  mv -- "$dest.part" "$dest"
  printf '%s  %s\n' "$want" "$(basename "$dest")" > "$dest.sha256"
  bb_log "Da xac nhan toan ven: ${want:0:16}..."
}

# Chuyen ban theo gio thanh ban theo ngay/thang bang lien ket cung -> khong truyen lai gi.
promote() {
  local src="$1" kind="$2"
  local day month
  day="$(date +%Y%m%d)"; month="$(date +%Y%m)"
  local d="$BB_NAS_ROOT/$kind/daily/${kind}-${day}.$(basename "$src" | sed 's/^[^.]*\.//')"
  local m="$BB_NAS_ROOT/$kind/monthly/${kind}-${month}.$(basename "$src" | sed 's/^[^.]*\.//')"
  [[ -e "$d" ]] || { ln -- "$src" "$d" 2>/dev/null && ln -f -- "$src.sha256" "$d.sha256" 2>/dev/null && bb_log "Da tao ban theo ngay $(basename "$d")"; }
  [[ -e "$m" ]] || { ln -- "$src" "$m" 2>/dev/null && ln -f -- "$src.sha256" "$m.sha256" 2>/dev/null && bb_log "Da tao ban theo thang $(basename "$m")"; }
  return 0
}

newest_db() { ls -t "$BB_NAS_ROOT"/db/hourly/*.dump 2>/dev/null | head -1; }

# =============================================================================== db
job_db() {
  bb_nas_require
  require_container "$BB_PG_CONTAINER"

  TMPDIR_LOCAL="$(mktemp -d /var/tmp/bigbike-backup.XXXXXX)"
  local free; free="$(bb_free_gb /var/tmp)"
  (( free >= 2 )) || bb_fail "Dia may chu chi con ${free}GB - khong du cho tao ban tam."

  local ts name tmp
  ts="$(bb_ts)"; name="db-${ts}.dump"; tmp="$TMPDIR_LOCAL/$name"

  bb_log "Tao ban chup nhat quan cua co so du lieu (web van phuc vu khach binh thuong)..."
  # Mat khau chi duoc mo BEN TRONG container, khong bao gio nam tren dong lenh cua may chu.
  if ! ionice -c3 nice -n 19 docker exec "$BB_PG_CONTAINER" sh -c \
        'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6 --no-owner --no-acl --lock-wait-timeout=30000' \
        > "$tmp" 2>"$TMPDIR_LOCAL/err"; then
    bb_fail "Tao ban chup that bai: $(head -3 "$TMPDIR_LOCAL/err" | tr '\n' ' ')"
  fi
  [[ -s "$tmp" ]] || bb_fail "Ban chup rong - khong dung duoc."

  # Kiem tra ban chup doc duoc truoc khi ton bang thong chuyen di
  docker exec -i "$BB_PG_CONTAINER" pg_restore -l < "$tmp" >/dev/null 2>&1 \
    || bb_fail "Ban chup vua tao khong doc duoc (hong ngay tu dau)."

  ship_and_verify "$tmp" "$BB_NAS_ROOT/db/hourly/$name"
  promote "$BB_NAS_ROOT/db/hourly/$name" db

  local bytes; bytes="$(stat -c%s "$BB_NAS_ROOT/db/hourly/$name")"
  bb_prune_keep "$BB_NAS_ROOT/db/hourly"  'db-*.dump' "$BB_KEEP_HOURLY"
  bb_prune_keep "$BB_NAS_ROOT/db/daily"   'db-*.dump' "$BB_KEEP_DAILY"
  bb_prune_keep "$BB_NAS_ROOT/db/monthly" 'db-*.dump' "$BB_KEEP_MONTHLY"
  bb_ledger ok "$name" "$bytes"
  bb_log "Xong. Du lieu ban hang da co ban sao moi tren NAS ($(numfmt --to=iec "$bytes"))."
}

# ============================================================================ media
# Duong truyen toi NAS co do tre rat cao (280 ms moi thao tac). Kho anh co 6.223 tep
# nam trong hang nghin thu muc long nhau; chep tung tep se mat ~9,6 tieng moi lan.
# Nen kho anh duoc goi thanh MOT goi nen roi gui di: goi nen chay 1,1 MB/s -> ~25 phut.
# Hang ngay chi gui PHAN THAY DOI (goi nho, vai giay). Moi thang lam lai goi nen day mot lan
# de chuoi khong dai qua. Goi duoc gui THANG sang NAS, khong tao ban tam tren dia may chu.
job_media() {
  bb_nas_require
  [[ -d "$BB_MINIO_VOLUME" ]] || bb_fail "Khong thay kho anh tai $BB_MINIO_VOLUME."

  local MD="$BB_NAS_ROOT/media"
  local snar="$MD/media.snar"
  # Don xac goi do dang cua lan chay truoc bi ngat (vd may chu khoi dong lai giua chung).
  find "$MD" -maxdepth 1 -name '*.tar.zst.part' -mmin +360 -delete 2>/dev/null || true
  local base kind name ts
  ts="$(bb_ts)"
  base="$(ls -t "$MD"/media-base-*.tar.zst 2>/dev/null | head -1 || true)"

  local rebase=0
  if [[ -z "$base" || ! -f "$snar" ]]; then
    rebase=1
  else
    local age_d=$(( ( $(date +%s) - $(stat -c%Y "$base") ) / 86400 ))
    (( age_d >= BB_MEDIA_REBASE_DAYS )) && rebase=1
  fi

  if (( rebase )); then
    kind=base; name="media-base-${ts}.tar.zst"
    rm -f "$snar" 2>/dev/null || true
    bb_log "Tao goi nen day cua kho anh (~25 phut, moi thang mot lan)..."
  else
    kind=inc; name="media-inc-${ts}.tar.zst"
    bb_log "Gui phan thay doi cua kho anh ke tu lan truoc..."
  fi

  TMPDIR_LOCAL="$(mktemp -d /var/tmp/bigbike-backup.XXXXXX)"
  local dest="$MD/$name" sha="$TMPDIR_LOCAL/sha"
  local snar_work="$TMPDIR_LOCAL/media.snar"
  [[ -f "$snar" ]] && cp -- "$snar" "$snar_work"

  # Goi va gui THANG sang NAS, vua gui vua tinh dau kiem tra. Khong tao ban day tren may chu.
  set +e
  ionice -c3 nice -n 19 tar \
      --listed-incremental="$snar_work" \
      --exclude='.minio.sys/tmp' --exclude='.minio.sys/multipart' \
      --warning=no-file-changed --warning=no-file-removed \
      -C "$BB_MINIO_VOLUME" -cf - . 2>"$TMPDIR_LOCAL/tarerr" \
    | zstd -3 -T2 -q -c \
    | tee >(sha256sum | awk '{print $1}' > "$sha") > "$dest.part"
  local rc=${PIPESTATUS[0]}
  set -e
  # tar tra 1 khi co tep doi ngay luc dang goi - binh thuong voi kho dang phuc vu khach
  if (( rc != 0 && rc != 1 )); then
    rm -f -- "$dest.part"
    bb_fail "Goi kho anh that bai (ma loi $rc): $(tail -2 "$TMPDIR_LOCAL/tarerr" | tr '\n' ' ')"
  fi
  (( rc == 1 )) && bb_log "Ghi chu: vai tep thay doi ngay luc dang goi - lan sau se bat kip."

  sync
  local want got
  want="$(cat "$sha")"
  [[ -n "$want" ]] || { rm -f -- "$dest.part"; bb_fail "Khong tinh duoc dau kiem tra goi kho anh."; }
  got="$(bb_sha_from_nas "$dest.part")"
  if [[ "$got" != "$want" ]]; then
    rm -f -- "$dest.part"
    bb_fail "Goi kho anh tren NAS khong khop dau kiem tra. Da xoa ban hong."
  fi
  mv -- "$dest.part" "$dest"
  printf '%s  %s\n' "$want" "$name" > "$dest.sha256"
  cp -- "$snar_work" "$snar"

  # Lam lai goi nen day -> cac goi thay doi cu khong con dung duoc nua, xoa di.
  if (( rebase )); then
    local b
    for b in "$MD"/media-inc-*.tar.zst; do [[ -e "$b" ]] && rm -f -- "$b" "$b.sha256"; done
    while IFS= read -r b; do [[ -n "$b" ]] && rm -f -- "$b" "$b.sha256"; done < <(ls -t "$MD"/media-base-*.tar.zst 2>/dev/null | tail -n +2 || true)
    bb_log "Da xoa cac goi cu khong con dung duoc."
  fi

  local bytes files
  bytes="$(stat -c%s "$dest")"
  files="$(find "$BB_MINIO_VOLUME" -type f | wc -l)"
  printf 'synced_at=%s\nkind=%s\narchive=%s\nsource_files=%s\narchive_bytes=%s\nsource=%s\n' \
    "$(date -Is)" "$kind" "$name" "$files" "$bytes" "$BB_MINIO_VOLUME" > "$MD/current.manifest"

  bb_ledger ok "media $kind $name" "$bytes"
  bb_log "Xong. Kho anh ($files tep tren may chu) da sao luu — goi $kind $(numfmt --to=iec "$bytes")."
}

# =========================================================================== config
job_config() {
  bb_nas_require
  TMPDIR_LOCAL="$(mktemp -d /var/tmp/bigbike-backup.XXXXXX)"
  local stage="$TMPDIR_LOCAL/stage"; mkdir -p "$stage"/{env,nginx,systemd,ufw,repo}

  # Bien moi truong + compose
  for f in .env .env.vps .env.example .env.vps.example docker-compose.yaml; do
    [[ -f "$ROOT/$f" ]] && cp -- "$ROOT/$f" "$stage/env/" 2>/dev/null || true
  done
  # Cau hinh web may chu: CHI cua BigBike. Khong dung toi cau hinh cua 4thitek.
  for f in /etc/nginx/sites-available/*bigbike*; do
    [[ -f "$f" ]] && cp -- "$f" "$stage/nginx/" 2>/dev/null || true
  done
  cp -- /etc/nginx/nginx.conf "$stage/nginx/" 2>/dev/null || true
  ls -la /etc/nginx/sites-enabled/ > "$stage/nginx/sites-enabled.listing" 2>/dev/null || true
  # Tuong lua + lich sao luu + khai bao gan NAS
  cp -- /etc/ufw/user.rules /etc/ufw/user6.rules "$stage/ufw/" 2>/dev/null || true
  cp -- /etc/cron.d/bigbike-backup "$stage/systemd/" 2>/dev/null || true
  cp -- /etc/systemd/system/mnt-bigbike\\x2dnas.mount /etc/systemd/system/mnt-bigbike\\x2dnas.automount \
        "$stage/systemd/" 2>/dev/null || true
  crontab -l > "$stage/systemd/root.crontab" 2>/dev/null || true

  # Danh sach tai khoan/quyen cua may chu CSDL - can khi dung lai tu may trang
  docker exec "$BB_PG_CONTAINER" sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall -U "$POSTGRES_USER" --globals-only --no-role-passwords' \
    > "$stage/env/postgres-globals.sql" 2>/dev/null || true

  # Ma nguon dang sua do CHUA luu Git - phan nay Git khong giu ho
  ( cd "$ROOT" && git rev-parse HEAD 2>/dev/null ) > "$stage/repo/HEAD" 2>/dev/null || true
  ( cd "$ROOT" && git status --porcelain 2>/dev/null ) > "$stage/repo/uncommitted-files.txt" 2>/dev/null || true
  ( cd "$ROOT" && git diff HEAD 2>/dev/null ) > "$stage/repo/uncommitted.patch" 2>/dev/null || true

  local ts name tmp
  ts="$(bb_ts)"; name="config-${ts}.tar.gz"; tmp="$TMPDIR_LOCAL/$name"
  tar -czf "$tmp" -C "$stage" . 2>/dev/null || bb_fail "Dong goi cau hinh that bai."
  chmod 600 "$tmp"

  ship_and_verify "$tmp" "$BB_NAS_ROOT/config/daily/$name"
  chmod 600 "$BB_NAS_ROOT/config/daily/$name" 2>/dev/null || true
  local month; month="$(date +%Y%m)"
  local m="$BB_NAS_ROOT/config/monthly/config-${month}.tar.gz"
  [[ -e "$m" ]] || ln -- "$BB_NAS_ROOT/config/daily/$name" "$m" 2>/dev/null || true

  local bytes; bytes="$(stat -c%s "$BB_NAS_ROOT/config/daily/$name")"
  bb_prune_keep "$BB_NAS_ROOT/config/daily"   'config-*.tar.gz' "$BB_KEEP_DAILY"
  bb_prune_keep "$BB_NAS_ROOT/config/monthly" 'config-*.tar.gz' "$BB_KEEP_MONTHLY"
  bb_ledger ok "$name" "$bytes"
  bb_log "Xong. Cau hinh van hanh da sao luu ($(numfmt --to=iec "$bytes"))."
}

# ========================================================================= watchdog
job_watchdog() {
  bb_nas_require
  local newest age_h
  newest="$(newest_db || true)"
  [[ -n "$newest" ]] || bb_fail "Tren NAS khong co ban sao du lieu ban hang nao."
  age_h=$(( ( $(date +%s) - $(stat -c%Y "$newest") ) / 3600 ))
  if (( age_h >= BB_ALERT_STALE_HOURS )); then
    bb_fail "Da ${age_h} gio khong co ban sao du lieu ban hang moi (nguong ${BB_ALERT_STALE_HOURS} gio). Ban gan nhat: $(basename "$newest")."
  fi
  bb_log "Nguoi gac: ban moi nhat cach day ${age_h} gio - binh thuong."
}

# =========================================================================== digest
job_digest() {
  bb_nas_require
  local newest cnt_h cnt_d cnt_m free_nas free_vps stats media_line age_h
  newest="$(newest_db || true)"
  cnt_h="$(find "$BB_NAS_ROOT/db/hourly"  -maxdepth 1 -name 'db-*.dump' 2>/dev/null | wc -l)"
  cnt_d="$(find "$BB_NAS_ROOT/db/daily"   -maxdepth 1 -name 'db-*.dump' 2>/dev/null | wc -l)"
  cnt_m="$(find "$BB_NAS_ROOT/db/monthly" -maxdepth 1 -name 'db-*.dump' 2>/dev/null | wc -l)"
  free_nas="$(df -h "$BB_NAS_MOUNT" | tail -1 | awk '{print $4}')"
  free_vps="$(df -h / | tail -1 | awk '{print $4}')"

  # Dem so luot thanh cong / that bai trong 24 gio qua tu so chay
  stats="$(BB_L="$BB_LEDGER" python3 - <<'PYSTAT' 2>/dev/null || echo "?|?")
import json,os,datetime
cut=datetime.datetime.now().astimezone()-datetime.timedelta(hours=24)
ok=err=0
try:
    with open(os.environ["BB_L"],encoding="utf-8") as f:
        for line in f:
            try: r=json.loads(line)
            except Exception: continue
            try: t=datetime.datetime.fromisoformat(r.get("at",""))
            except Exception: continue
            if t<cut: continue
            if r.get("status")=="ok": ok+=1
            else: err+=1
except FileNotFoundError: pass
print(f"{ok}|{err}")
PYSTAT
)"
  local ok24="${stats%%|*}" err24="${stats##*|}"

  if [[ -f "$BB_NAS_ROOT/media/current.manifest" ]]; then
    local mf ma mk
    mf="$(grep -m1 '^source_files=' "$BB_NAS_ROOT/media/current.manifest" | cut -d= -f2 || true)"
    ma="$(grep -m1 '^synced_at='    "$BB_NAS_ROOT/media/current.manifest" | cut -d= -f2 | cut -dT -f1 || true)"
    mk="$(grep -m1 '^kind='         "$BB_NAS_ROOT/media/current.manifest" | cut -d= -f2 || true)"
    media_line="Kho anh: ${mf:-?} tep, sao luu ngay ${ma:-?} (goi ${mk:-?})"
  else
    media_line="Kho anh: CHUA SAO LUU LAN NAO"
  fi

  if [[ -n "$newest" ]]; then
    age_h=$(( ( $(date +%s) - $(stat -c%Y "$newest") ) / 3600 ))
    newest="$(basename "$newest") — cach day ${age_h} gio"
  else
    newest="CHUA CO"
  fi

  local body="Luc: $(bb_human)

24 gio qua: ${ok24} luot thanh cong, ${err24} luot hong
Du lieu ban hang: ${cnt_h} ban theo gio, ${cnt_d} theo ngay, ${cnt_m} theo thang
Ban moi nhat: ${newest}
${media_line}
Cho trong NAS: ${free_nas}   |   Cho trong may chu: ${free_vps}

Neu tin nay ngung den, tuc la he thong sao luu da chet - hay kiem tra ngay."

  bb_telegram "<b>BigBike sao luu — tong ket ngay</b>
${body}" || true
  bb_email "BigBike sao luu — tong ket ngay $(date '+%d/%m/%Y')" "$body" || true
  bb_log "Da gui tin tong ket (${ok24} thanh cong / ${err24} hong trong 24 gio)."
}

# ============================================================================= list
_bb_list_dir() {
  local dir="$1" pat="$2" keep="$3" label="$4" n=0
  printf '\n%s (giu %s)\n' "$label" "$keep"
  while IFS='|' read -r name size mtime; do
    [[ -n "$name" ]] || continue
    printf '  %-34s %8s   %s\n' "$name" "$(numfmt --to=iec "$size")" "$(date -d @"$mtime" '+%d/%m/%Y %H:%M')"
    n=$((n+1))
  done < <(find "$dir" -maxdepth 1 -type f -name "$pat" -printf '%f|%s|%T@\n' 2>/dev/null | sort -t'|' -k3 -rn | cut -d'|' -f1,2,3 | awk -F'|' '{printf "%s|%s|%d\n",$1,$2,$3}')
  (( n == 0 )) && echo "  (chua co ban nao)"
  return 0
}

job_list() {
  bb_nas_require
  echo "======================================================================"
  echo " CAC BAN SAO LUU DANG CO TREN NAS — $(bb_human)"
  echo "======================================================================"
  _bb_list_dir "$BB_NAS_ROOT/db/hourly"      'db-*.dump'        "$BB_KEEP_HOURLY ban"  "DU LIEU BAN HANG — theo gio"
  _bb_list_dir "$BB_NAS_ROOT/db/daily"       'db-*.dump'        "$BB_KEEP_DAILY ban"   "DU LIEU BAN HANG — theo ngay"
  _bb_list_dir "$BB_NAS_ROOT/db/monthly"     'db-*.dump'        "$BB_KEEP_MONTHLY ban" "DU LIEU BAN HANG — theo thang"
  _bb_list_dir "$BB_NAS_ROOT/config/daily"   'config-*.tar.gz'  "$BB_KEEP_DAILY ban"   "CAU HINH VAN HANH — theo ngay"
  _bb_list_dir "$BB_NAS_ROOT/config/monthly" 'config-*.tar.gz'  "$BB_KEEP_MONTHLY ban" "CAU HINH VAN HANH — theo thang"
  _bb_list_dir "$BB_NAS_ROOT/media"          'media-*.tar.zst'  "1 goi day + cac goi thay doi" "KHO ANH/VIDEO"
  echo
  echo "CHO TRONG"
  printf '  NAS     : %s trong tong %s\n' \
    "$(df -h "$BB_NAS_MOUNT" | tail -1 | awk '{print $4}')" "$(df -h "$BB_NAS_MOUNT" | tail -1 | awk '{print $2}')"
  printf '  May chu : %s trong tong %s\n' \
    "$(df -h / | tail -1 | awk '{print $4}')" "$(df -h / | tail -1 | awk '{print $2}')"
  local newest
  newest="$(newest_db || true)"
  if [[ -n "$newest" ]]; then
    printf '\nBAN MOI NHAT cach day %s gio.\n' "$(( ( $(date +%s) - $(stat -c%Y "$newest") ) / 3600 ))"
  fi
}

# =========================================================================== verify
job_verify() {
  bb_nas_require
  local f="${2:-}"; [[ -n "$f" ]] || f="$(newest_db || true)"
  [[ -n "$f" && -f "$f" ]] || bb_fail "Khong tim thay ban sao de kiem tra."
  local want got
  want="$(awk '{print $1}' "$f.sha256" 2>/dev/null)"
  [[ -n "$want" ]] || bb_fail "Ban $(basename "$f") khong co dau kiem tra di kem."
  bb_log "Doc nguoc lai tu NAS de kiem tra $(basename "$f")..."
  got="$(bb_sha_from_nas "$f")"
  echo "  Tep      : $(basename "$f")"
  echo "  Dung luong: $(du -h "$f" | cut -f1)"
  echo "  Tao luc  : $(date -d @"$(stat -c%Y "$f")" '+%d/%m/%Y %H:%M:%S')"
  echo "  Dau ghi  : $want"
  echo "  Doc lai  : $got"
  [[ "$want" == "$got" ]] || bb_fail "Dau kiem tra KHONG khop - ban nay hong."
  echo "  Ket qua  : KHOP — ban sao con nguyen ven"
  docker ps --format '{{.Names}}' | grep -qx "$BB_PG_CONTAINER" \
    && { docker exec -i "$BB_PG_CONTAINER" pg_restore -l < "$f" >/dev/null 2>&1 \
         && echo "  Doc thu  : mo duoc muc luc ban sao — dung duoc de khoi phuc" \
         || bb_fail "Dau khop nhung khong mo duoc noi dung ban sao."; } || true
}

case "$BB_JOB" in
  db)       job_db ;;
  media)    job_media ;;
  config)   job_config ;;
  watchdog) job_watchdog ;;
  digest)   job_digest ;;
  list)     job_list ;;
  verify)   job_verify "$@" ;;
  *) echo "Tham so khong hieu: $BB_JOB" >&2; usage ;;
esac
