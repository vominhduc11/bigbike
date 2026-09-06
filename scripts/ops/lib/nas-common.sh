#!/usr/bin/env bash
# Thu vien dung chung cho viec sao luu ra NAS.
# CHI DOC du lieu dang chay. Khong sua/xoa du lieu shop, khong dung/khoi dong lai container nao,
# khong dung toi bat cu thu gi ngoai thu muc vps-backups/ tren NAS.
# File nay khong chay truc tiep; cac script khac nap bang `source`.

BB_REPO_ROOT="${BB_REPO_ROOT:-/root/myproject/bigbike}"
BB_ENV_FILE="${BB_ENV_FILE:-$BB_REPO_ROOT/.env.vps}"
BB_NAS_MOUNT="${BB_NAS_MOUNT:-/mnt/bigbike-nas}"
BB_NAS_ROOT="${BB_NAS_ROOT:-$BB_NAS_MOUNT/vps-backups}"
BB_NAS_MARKER="$BB_NAS_ROOT/.nas-marker"
BB_LEDGER="$BB_NAS_ROOT/logs/runs.jsonl"
BB_LOCAL_LOG="${BB_LOCAL_LOG:-/var/log/bigbike-backup/run.log}"

# So ban giu lai - owner chinh o /etc/cron.d/bigbike-backup, khong sua trong file nay.
BB_KEEP_HOURLY="${BB_KEEP_HOURLY:-48}"
BB_KEEP_DAILY="${BB_KEEP_DAILY:-30}"
BB_KEEP_MONTHLY="${BB_KEEP_MONTHLY:-12}"
BB_ALERT_STALE_HOURS="${BB_ALERT_STALE_HOURS:-24}"
BB_MEDIA_REBASE_DAYS="${BB_MEDIA_REBASE_DAYS:-30}"

BB_PG_CONTAINER="${BB_PG_CONTAINER:-bigbike-postgres}"
BB_MINIO_VOLUME="${BB_MINIO_VOLUME:-/var/lib/docker/volumes/bigbike_minio_data/_data}"

export TZ=Asia/Ho_Chi_Minh

# ---------------------------------------------------------------- tien ich chung

bb_ts()       { date +%Y%m%dT%H%M%S; }
bb_human()    { date '+%d/%m/%Y %H:%M:%S %Z'; }

bb_log() {
  local line; line="$(bb_human) [$BB_JOB] $*"
  mkdir -p "$(dirname "$BB_LOCAL_LOG")" 2>/dev/null || true
  printf '%s\n' "$line" | tee -a "$BB_LOCAL_LOG" >&2
}

# Doc mot bien tu .env.vps ma KHONG source (tranh chay nham lenh trong file cau hinh).
bb_env_get() {
  local key="$1" val
  [[ -r "$BB_ENV_FILE" ]] || return 1
  val="$(grep -m1 -E "^[[:space:]]*${key}=" "$BB_ENV_FILE" 2>/dev/null)" || return 1
  val="${val#*=}"
  val="${val%$'\r'}"
  # bo dau nhay bao quanh neu co
  [[ "$val" == \"*\" && "$val" == *\" ]] && val="${val:1:${#val}-2}"
  [[ "$val" == \'*\' && "$val" == *\' ]] && val="${val:1:${#val}-2}"
  printf '%s' "$val"
}

# ---------------------------------------------------------------- kiem tra NAS

# Ba lop chan de KHONG BAO GIO ghi nham vao dia may chu khi NAS mat mang.
bb_nas_require() {
  # cham nhe vao diem gan de systemd automount tu keo len
  timeout 90 ls "$BB_NAS_MOUNT" >/dev/null 2>&1 || true

  if ! mountpoint -q "$BB_NAS_MOUNT"; then
    bb_fail "NAS chua duoc gan tai $BB_NAS_MOUNT. Kiem tra NAS o nha con dien/mang khong."
  fi
  if [[ ! -f "$BB_NAS_MARKER" ]]; then
    bb_fail "Khong thay tep moc $BB_NAS_MARKER. Diem gan co the tro sai cho - dung de an toan."
  fi
  if ! timeout 60 touch "$BB_NAS_ROOT/tmp/.writetest.$$" 2>/dev/null; then
    bb_fail "NAS gan roi nhung khong ghi duoc (co the NAS day hoac mat ket noi giua chung)."
  fi
  rm -f "$BB_NAS_ROOT/tmp/.writetest.$$" 2>/dev/null || true
}

# ---------------------------------------------------------------- bao dong

bb_telegram() {
  local text="$1" token chat
  token="$(bb_env_get BIGBIKE_TELEGRAM_BOT_TOKEN || true)"
  chat="$(bb_env_get BIGBIKE_TELEGRAM_CHAT_ID || true)"
  [[ -n "$token" && -n "$chat" ]] || { bb_log "Telegram: chua cau hinh, bo qua"; return 1; }
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
      -X POST "https://api.telegram.org/bot${token}/sendMessage" \
      -H 'Content-Type: application/json' \
      --data-binary @<(BB_T="$text" BB_C="$chat" python3 -c '
import json,os
print(json.dumps({"chat_id":os.environ["BB_C"],"text":os.environ["BB_T"],
                  "parse_mode":"HTML","disable_web_page_preview":True}))')
    2>/dev/null)" || code=000
  [[ "$code" == "200" ]] && { bb_log "Telegram: da gui (200)"; return 0; }
  bb_log "Telegram: gui that bai (http $code)"; return 1
}

bb_email() {
  local subject="$1" body="$2"
  local host port user pass from fromname to starttls
  host="$(bb_env_get BIGBIKE_MAIL_HOST || true)"
  port="$(bb_env_get BIGBIKE_MAIL_PORT || true)"; port="${port:-587}"
  user="$(bb_env_get BIGBIKE_MAIL_USERNAME || true)"
  pass="$(bb_env_get BIGBIKE_MAIL_PASSWORD || true)"
  from="$(bb_env_get BIGBIKE_MAIL_FROM || true)"
  fromname="$(bb_env_get BIGBIKE_MAIL_FROM_NAME || true)"; fromname="${fromname:-BigBike}"
  to="$(bb_env_get BIGBIKE_MAIL_ADMIN || true)"
  starttls="$(bb_env_get BIGBIKE_MAIL_STARTTLS || true)"; starttls="${starttls:-true}"
  [[ -n "$host" && -n "$to" ]] || { bb_log "Email: chua cau hinh, bo qua"; return 1; }

  BB_H="$host" BB_P="$port" BB_U="$user" BB_PW="$pass" BB_F="${from:-$user}" \
  BB_FN="$fromname" BB_TO="$to" BB_SUBJ="$subject" BB_BODY="$body" BB_TLS="$starttls" \
  python3 - <<'PY' 2>&1 | while read -r l; do bb_log "Email: $l"; done
import os, smtplib, ssl
from email.message import EmailMessage
from email.headerregistry import Address
from email.utils import formataddr

m = EmailMessage()
m["Subject"] = os.environ["BB_SUBJ"]
m["From"] = formataddr((os.environ["BB_FN"], os.environ["BB_F"]))
m["To"] = os.environ["BB_TO"]
m.set_content(os.environ["BB_BODY"])
try:
    port = int(os.environ["BB_P"])
    if port == 465:
        s = smtplib.SMTP_SSL(os.environ["BB_H"], port, timeout=30)
    else:
        s = smtplib.SMTP(os.environ["BB_H"], port, timeout=30)
        if os.environ["BB_TLS"].lower() == "true":
            s.starttls(context=ssl.create_default_context())
    if os.environ["BB_U"]:
        s.login(os.environ["BB_U"], os.environ["BB_PW"])
    s.send_message(m)
    s.quit()
    print("da gui toi " + os.environ["BB_TO"])
except Exception as e:
    print("that bai: %s: %s" % (type(e).__name__, e))
PY
}

# Bao dong ca hai kenh theo lua chon cua owner (06/09/2026).
bb_alert() {
  local subject="$1" body="$2"
  bb_telegram "<b>${subject}</b>
${body}" || true
  bb_email "$subject" "$body" || true
}

bb_fail() {
  local msg="$*"
  bb_log "THAT BAI: $msg"
  bb_ledger "error" "$msg" 0
  bb_alert "⚠️ BigBike sao luu THAT BAI — ${BB_JOB}" \
"Luc: $(bb_human)
Viec: ${BB_JOB}
Ly do: ${msg}

Xem so chay: ${BB_LEDGER}
Nhat ky may chu: ${BB_LOCAL_LOG}"
  exit 1
}

# ---------------------------------------------------------------- so chay

bb_ledger() {
  local status="$1" detail="$2" bytes="${3:-0}"
  mountpoint -q "$BB_NAS_MOUNT" || return 0
  mkdir -p "$(dirname "$BB_LEDGER")" 2>/dev/null || true
  BB_J="$BB_JOB" BB_S="$status" BB_D="$detail" BB_B="$bytes" python3 -c '
import json,os,datetime
print(json.dumps({"at":datetime.datetime.now().astimezone().isoformat(),
  "job":os.environ["BB_J"],"status":os.environ["BB_S"],
  "detail":os.environ["BB_D"],"bytes":int(os.environ["BB_B"])},ensure_ascii=False))' \
  >> "$BB_LEDGER" 2>/dev/null || true
}

# ---------------------------------------------------------------- xoa ban qua han

# Xoa an toan: chi xoa TRONG dung thu muc duoc chi dinh, chi tep thuong, giu N ban moi nhat.
bb_prune_keep() {
  local dir="$1" pattern="$2" keep="$3"
  [[ -d "$dir" ]] || return 0
  [[ "$dir" == "$BB_NAS_ROOT"/* ]] || { bb_log "Tu choi xoa ngoai $BB_NAS_ROOT: $dir"; return 1; }
  [[ "$keep" =~ ^[0-9]+$ ]] || { bb_log "So ban giu khong hop le: $keep"; return 1; }

  local -a files=()
  while IFS= read -r f; do files+=("$f"); done < <(
    find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%f\n' 2>/dev/null | sort -r
  )
  local total=${#files[@]}
  (( total > keep )) || { bb_log "Giu $total/$keep ban trong $(basename "$dir") - chua can xoa"; return 0; }

  local removed=0 i
  for (( i=keep; i<total; i++ )); do
    rm -f -- "$dir/${files[$i]}" "$dir/${files[$i]}.sha256" 2>/dev/null && removed=$((removed+1))
  done
  bb_log "Da xoa $removed ban qua han trong $(basename "$dir") (giu $keep)"
}

# ---------------------------------------------------------------- kiem tra toan ven

# Doc NGUOC lai tu NAS, co gang bo qua bo nho dem de khong tu lua minh.
# Doc NGUOC lai tu NAS de xac nhan ban vua chuyen khong hong.
#
# Cach lam: xoa tep khoi bo nho dem cua may chu TRUOC khi doc, roi doc binh thuong.
# Doc binh thuong tan dung duoc co che doc truoc cua he thong nen nhanh gap doi so voi
# doc kieu bo qua han bo nho dem (do 06/09/2026: 2,0 MB/s so voi 0,94 MB/s).
#
# Gioi han that su, ghi ra cho ro: cach nay xac nhan duong truyen, may NAS va he thong tep
# cua NAS. Neu chinh NAS tra tu bo nho dem cua no thi khong co cach nao ep doc tu dia cung.
bb_sha_from_nas() {
  local f="$1" h=""
  bb_drop_cache "$f"
  h="$(sha256sum -- "$f" 2>/dev/null | awk '{print $1}')" || h=""
  if [[ ! "$h" =~ ^[0-9a-f]{64}$ ]]; then
    # Du phong: doc bo qua bo nho dem (cham hon nhung khong phu thuoc buoc xoa dem)
    h="$(dd if="$f" iflag=direct bs=16M status=none 2>/dev/null | sha256sum | awk '{print $1}')" || h=""
  fi
  # Dau kiem tra cua chuoi rong = da doc 0 byte ma tuong la xong. Khong bao gio duoc coi la dat.
  [[ "$h" == e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]] && h="doc-duoc-0-byte"
  printf '%s' "$h"
}

# Day du lieu da ghi xuong NAS roi xoa tep khoi bo nho dem cua may chu.
bb_drop_cache() {
  python3 - "$1" 2>/dev/null <<'PYEVICT' || true
import os,sys
fd=os.open(sys.argv[1], os.O_RDONLY)
try:
    os.fsync(fd)
    os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
finally:
    os.close(fd)
PYEVICT
}

bb_free_gb() { df -BG --output=avail "$1" 2>/dev/null | tail -1 | tr -dc '0-9'; }
