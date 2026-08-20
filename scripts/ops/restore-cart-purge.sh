#!/usr/bin/env bash
# Khôi phục chính xác một lần sao lưu đã hoàn tất; dừng an toàn nếu mã định danh đã được dùng lại.
set -euo pipefail

[[ $# -eq 1 ]] || { echo "Cách dùng: bash scripts/ops/restore-cart-purge.sh <run-id>" >&2; exit 64; }
run_id="$1"
[[ "$run_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
  || { echo "run-id phải là UUID hợp lệ." >&2; exit 64; }
compose=(docker compose --env-file .env.vps)
psql() {
  "${compose[@]}" exec -T postgres sh -c \
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

psql -c "
  begin;
  do \$\$
  begin
    if not exists (
      select 1 from maintenance_cart_purge_runs
      where id = '$run_id'::uuid and status in ('COMPLETED', 'FAILED')
    ) then
      raise exception 'Lần dọn % chưa hoàn tất, đã khôi phục hoặc không thể hoàn tác.', '$run_id';
    end if;
    if exists (
      select 1 from carts c
      join maintenance_cart_purge_backup_carts b on b.id = c.id
      where b.run_id = '$run_id'::uuid
    ) then
      raise exception 'Khôi phục đã dừng: mã giỏ của lần dọn % đã tồn tại.', '$run_id';
    end if;
    if exists (
      select 1 from cart_items ci
      join maintenance_cart_purge_backup_items b on b.id = ci.id
      where b.run_id = '$run_id'::uuid
    ) then
      raise exception 'Khôi phục đã dừng: mã dòng hàng của lần dọn % đã tồn tại.', '$run_id';
    end if;
  end \$\$;

  insert into carts (
    id, customer_id, session_id, status, currency, subtotal_amount, discount_amount,
    shipping_amount, fee_amount, total_amount, expires_at, created_at, updated_at, version
  )
  select id, customer_id, session_id, status, currency, subtotal_amount, discount_amount,
    shipping_amount, fee_amount, total_amount, expires_at, created_at, updated_at, version
  from maintenance_cart_purge_backup_carts
  where run_id = '$run_id'::uuid;

  insert into cart_items (
    id, cart_id, product_id, product_pk, product_variant_id, product_variant_pk,
    assistant_conversation_id, assistant_interaction_id, sku, product_name, variant_name,
    product_image_id, product_image_url, product_image_alt, product_image_width,
    product_image_height, product_image_mime_type, quantity, unit_price, regular_price,
    sale_price, line_subtotal, line_discount, line_total, metadata, created_at, updated_at
  )
  select id, cart_id, product_id, product_pk, product_variant_id, product_variant_pk,
    assistant_conversation_id, assistant_interaction_id, sku, product_name, variant_name,
    product_image_id, product_image_url, product_image_alt, product_image_width,
    product_image_height, product_image_mime_type, quantity, unit_price, regular_price,
    sale_price, line_subtotal, line_discount, line_total, metadata, created_at, updated_at
  from maintenance_cart_purge_backup_items
  where run_id = '$run_id'::uuid;

  update maintenance_cart_purge_runs
  set status = 'RESTORED', completed_at = now(), failure_reason = null
  where id = '$run_id'::uuid;
  commit;"

echo "Đã khôi phục đúng giỏ và dòng hàng của run-id=$run_id. Đơn hàng, khách hàng và thanh toán không thay đổi."
