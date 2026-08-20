#!/usr/bin/env bash
# Lệnh dọn một lần cho chủ shop. Không đụng giỏ CONVERTED hoặc dòng đơn hàng.
set -euo pipefail

usage() {
  echo "Cách dùng: bash scripts/ops/purge-stale-carts.sh --dry-run|--execute" >&2
  exit 64
}

[[ $# -eq 1 ]] || usage
mode="$1"
[[ "$mode" == "--dry-run" || "$mode" == "--execute" ]] || usage

compose=(docker compose --env-file .env.vps)
psql() {
  "${compose[@]}" exec -T postgres sh -c \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

cutoff="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

if [[ "$mode" == "--dry-run" ]]; then
  echo "Giỏ đủ điều kiện là ACTIVE/MERGED có expires_at trước $cutoff; không có thao tác ghi."
  psql -P pager=off -c "
    select status, count(*) as carts
    from carts
    where status in ('ACTIVE', 'MERGED')
      and expires_at is not null
      and expires_at < '$cutoff'::timestamptz
    group by status
    order by status;
    select count(*) as total_carts,
           coalesce(sum((select count(*) from cart_items ci where ci.cart_id = c.id)), 0) as total_items
    from carts c
    where c.status in ('ACTIVE', 'MERGED')
      and c.expires_at is not null
      and c.expires_at < '$cutoff'::timestamptz;"
  exit 0
fi

run_id="$(psql -Atq -c "
  insert into maintenance_cart_purge_runs (cutoff_at, status)
  values ('$cutoff'::timestamptz, 'RUNNING')
  returning id;")"
[[ -n "$run_id" ]] || { echo "Không tạo được mã lần dọn." >&2; exit 1; }

finished=false
trap 'if [[ "$finished" != true ]]; then
  psql -v run_id="$run_id" -c "update maintenance_cart_purge_runs set status = 'FAILED', completed_at = now(), failure_reason = 'Lệnh dừng trước khi hoàn tất; xem đầu ra shell.' where id = :'run_id'::uuid and status = 'RUNNING';" || true
fi' ERR

total_carts=0
total_items=0
started_epoch="$(date +%s)"

while true; do
  result="$(psql -At -F '|' -v run_id="$run_id" -v cutoff="$cutoff" -c "
    with candidates as (
      select id
      from carts
      where status in ('ACTIVE', 'MERGED')
        and expires_at is not null
        and expires_at < :'cutoff'::timestamptz
      order by expires_at, id
      limit 500
      for update skip locked
    ), backed_items as (
      insert into maintenance_cart_purge_backup_items (
        run_id, purged_at, id, cart_id, product_id, product_pk, product_variant_id,
        product_variant_pk, assistant_conversation_id, assistant_interaction_id, sku,
        product_name, variant_name, product_image_id, product_image_url, product_image_alt,
        product_image_width, product_image_height, product_image_mime_type, quantity,
        unit_price, regular_price, sale_price, line_subtotal, line_discount, line_total,
        metadata, created_at, updated_at
      )
      select :'run_id'::uuid, clock_timestamp(), ci.id, ci.cart_id, ci.product_id, ci.product_pk,
        ci.product_variant_id, ci.product_variant_pk, ci.assistant_conversation_id,
        ci.assistant_interaction_id, ci.sku, ci.product_name, ci.variant_name,
        ci.product_image_id, ci.product_image_url, ci.product_image_alt, ci.product_image_width,
        ci.product_image_height, ci.product_image_mime_type, ci.quantity, ci.unit_price,
        ci.regular_price, ci.sale_price, ci.line_subtotal, ci.line_discount, ci.line_total,
        ci.metadata, ci.created_at, ci.updated_at
      from cart_items ci join candidates c on c.id = ci.cart_id
      returning id
    ), backed_carts as (
      insert into maintenance_cart_purge_backup_carts (
        run_id, purged_at, id, customer_id, session_id, status, currency, subtotal_amount,
        discount_amount, shipping_amount, fee_amount, total_amount, expires_at, created_at,
        updated_at, version
      )
      select :'run_id'::uuid, clock_timestamp(), c.id, c.customer_id, c.session_id, c.status,
        c.currency, c.subtotal_amount, c.discount_amount, c.shipping_amount, c.fee_amount,
        c.total_amount, c.expires_at, c.created_at, c.updated_at, c.version
      from carts c join candidates candidate on candidate.id = c.id
      returning id
    ), deleted as (
      delete from carts c
      using candidates candidate
      where c.id = candidate.id
      returning c.id
    )
    select (select count(*) from deleted), (select count(*) from backed_items);")"
  IFS='|' read -r cart_count item_count <<< "$result"
  total_carts=$((total_carts + cart_count))
  total_items=$((total_items + item_count))
  echo "Lần $run_id: đã sao lưu và dọn $cart_count giỏ, $item_count dòng hàng."
  [[ "$cart_count" -lt 500 ]] && break
  sleep 1
done

elapsed=$(( $(date +%s) - started_epoch ))
psql -v run_id="$run_id" -v carts="$total_carts" -v items="$total_items" -v elapsed="$elapsed" -c "
  update maintenance_cart_purge_runs
  set status = 'COMPLETED', completed_at = now(), carts_purged = :'carts'::integer,
      items_purged = :'items'::integer,
      failure_reason = null
  where id = :'run_id'::uuid and status = 'RUNNING';"
finished=true
echo "Hoàn tất. run-id=$run_id; giỏ=$total_carts; dòng hàng=$total_items; thời gian=${elapsed}s."
echo "Giữ run-id này để hoàn tác nếu cần: bash scripts/ops/restore-cart-purge.sh $run_id"
