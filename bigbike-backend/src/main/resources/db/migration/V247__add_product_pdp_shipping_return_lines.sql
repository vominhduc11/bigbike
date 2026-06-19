-- V247: Per-product PDP "Mua tại BigBike.vn" trust block — admin-editable shipping &
-- return policy lines (1 ngôn ngữ, fallback VI như warranty_scope/SKU; detail-only).
-- Trống → bigbike-web tự dùng câu mặc định chung (i18n trustShippingValue/trustExchangeValue).
alter table products
    add column pdp_shipping_line text,
    add column pdp_return_line text;
