#!/usr/bin/env bash
# Đánh dấu lô đơn nhập từ website cũ mà không sửa bất kỳ dòng orders nào.
set -euo pipefail

usage() {
  echo "Cách dùng: bash scripts/ops/classify-legacy-orders.sh --dry-run|--execute|--rollback|--reactivate" >&2
  exit 64
}

[[ $# -eq 1 ]] || usage
mode="$1"
case "$mode" in
  --dry-run|--execute|--rollback|--reactivate) ;;
  *) usage ;;
esac

compose=(docker compose --env-file .env.vps)
psql() {
  "${compose[@]}" exec -T postgres sh -c \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

batch_key="LEGACY_WEB_IMPORT_2026_06_11"
started_epoch="$(date +%s)"

if [[ "$mode" == "--dry-run" ]]; then
  echo "Chỉ kiểm tra; không có thao tác ghi. Tiêu chí: đơn có mã legacy_id."
  psql -P pager=off -v batch_key="$batch_key" -c "
    select count(*) as legacy_total,
           count(*) filter (where status = 'PENDING') as legacy_pending,
           count(*) filter (where status = 'PROCESSING') as legacy_processing
    from orders
    where legacy_id is not null;

    select batch_key, active, created_at, activated_at, deactivated_at,
           (select count(*) from order_history_batch_orders m where m.batch_id = b.id) as marked_orders
    from order_history_batches b
    where batch_key = :'batch_key';"
  echo "Hoàn tất kiểm tra sau $(( $(date +%s) - started_epoch )) giây."
  exit 0
fi

if [[ "$mode" == "--execute" ]]; then
  psql -v batch_key="$batch_key" -c "
    begin;
    do \$\$
    declare
      actual_total integer;
      actual_pending integer;
      actual_processing integer;
    begin
      select count(*),
             count(*) filter (where status = 'PENDING'),
             count(*) filter (where status = 'PROCESSING')
      into actual_total, actual_pending, actual_processing
      from orders
      where legacy_id is not null;

      if actual_total <> 1661 or actual_pending <> 388 or actual_processing <> 508 then
        raise exception 'Dừng an toàn: đo được total=%, pending=%, processing=%; cần đúng 1661/388/508.',
          actual_total, actual_pending, actual_processing;
      end if;

      if exists (
        select 1 from order_history_batches
        where batch_key = 'LEGACY_WEB_IMPORT_2026_06_11' and active = false
      ) then
        raise exception 'Lô % đang được hoàn tác. Dùng --reactivate sau khi kiểm tra.', 'LEGACY_WEB_IMPORT_2026_06_11';
      end if;
    end \$\$;

    insert into order_history_batches (
      batch_key, label_vi, label_en, reason_vi, reason_en, criteria_json,
      expected_total, expected_pending, expected_processing, active
    ) values (
      :'batch_key',
      'Đơn lịch sử nhập từ website cũ ngày 11/06/2026',
      'Historical orders imported from the legacy website on 11 Jun 2026',
      'Lô nhập một lần khi chuyển hệ thống; giữ nguyên để tra cứu và đối soát, không tính vào việc vận hành hằng ngày.',
      'One-time system migration batch; retained for lookup and reconciliation, excluded from daily operational work.',
      '{\"selector\":\"legacy_id IS NOT NULL\",\"measuredOn\":\"2026-08-31\",\"expectedTotal\":1661,\"expectedPending\":388,\"expectedProcessing\":508}'::jsonb,
      1661, 388, 508, true
    )
    on conflict (batch_key) do update
    set label_vi = excluded.label_vi,
        label_en = excluded.label_en,
        reason_vi = excluded.reason_vi,
        reason_en = excluded.reason_en,
        criteria_json = excluded.criteria_json,
        expected_total = excluded.expected_total,
        expected_pending = excluded.expected_pending,
        expected_processing = excluded.expected_processing;

    insert into order_history_batch_orders (batch_id, order_id)
    select b.id, o.id
    from order_history_batches b
    cross join orders o
    where b.batch_key = :'batch_key'
      and b.active = true
      and o.legacy_id is not null
    on conflict (batch_id, order_id) do nothing;

    do \$\$
    declare marked_count integer;
    begin
      select count(*) into marked_count
      from order_history_batch_orders m
      join order_history_batches b on b.id = m.batch_id
      where b.batch_key = 'LEGACY_WEB_IMPORT_2026_06_11';
      if marked_count <> 1661 then
        raise exception 'Dừng an toàn: lô % có % đơn đã đánh dấu, cần đúng 1661.',
          'LEGACY_WEB_IMPORT_2026_06_11', marked_count;
      end if;
    end \$\$;
    commit;"
  echo "Đã đánh dấu 1.661 đơn lịch sử; không sửa bảng orders. Thời gian: $(( $(date +%s) - started_epoch )) giây."
  exit 0
fi

if [[ "$mode" == "--rollback" ]]; then
  psql -v batch_key="$batch_key" -c "
    update order_history_batches
    set active = false, deactivated_at = coalesce(deactivated_at, now())
    where batch_key = :'batch_key' and active = true;"
  echo "Đã tắt dấu đơn lịch sử; toàn bộ đơn trở lại phạm vi vận hành. Dữ liệu đơn và danh sách đánh dấu vẫn nguyên vẹn để kiểm tra hoặc bật lại. Thời gian: $(( $(date +%s) - started_epoch )) giây."
  exit 0
fi

psql -v batch_key="$batch_key" -c "
  begin;
  do \$\$
  declare candidate_count integer;
  declare marked_count integer;
  declare mismatch_count integer;
  begin
    select count(*) into candidate_count from orders where legacy_id is not null;
    select count(*) into marked_count
    from order_history_batch_orders m
    join order_history_batches b on b.id = m.batch_id
    where b.batch_key = 'LEGACY_WEB_IMPORT_2026_06_11';
    select count(*) into mismatch_count
    from (
      (select o.id from orders o where o.legacy_id is not null
       except
       select m.order_id from order_history_batch_orders m
       join order_history_batches b on b.id = m.batch_id where b.batch_key = 'LEGACY_WEB_IMPORT_2026_06_11')
      union all
      (select m.order_id from order_history_batch_orders m
       join order_history_batches b on b.id = m.batch_id where b.batch_key = 'LEGACY_WEB_IMPORT_2026_06_11'
       except
       select o.id from orders o where o.legacy_id is not null)
    ) differences;
    if candidate_count <> 1661 or marked_count <> 1661 or mismatch_count <> 0 then
      raise exception 'Dừng an toàn: candidate=%, marked=%, mismatch=%; cần 1661/1661/0.',
        candidate_count, marked_count, mismatch_count;
    end if;
  end \$\$;

  update order_history_batches
  set active = true, activated_at = now(), deactivated_at = null
  where batch_key = :'batch_key';
  commit;"
echo "Đã bật lại đúng lô 1.661 đơn lịch sử. Thời gian: $(( $(date +%s) - started_epoch )) giây."
