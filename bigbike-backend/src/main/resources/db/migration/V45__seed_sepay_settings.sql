insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'payment_sepay.enabled',          'false', 'payment_sepay', false, 'Bật/tắt cổng thanh toán SePay',                        now(), now()),
    (gen_random_uuid(), 'payment_sepay.webhook_token',    '',      'payment_sepay', false, 'Token bí mật SePay gửi kèm webhook (giữ bí mật)',       now(), now()),
    (gen_random_uuid(), 'payment_sepay.bank_name',        '',      'payment_sepay', true,  'Tên ngân hàng hiển thị cho khách (vd: MB Bank)',        now(), now()),
    (gen_random_uuid(), 'payment_sepay.bank_bin',         '',      'payment_sepay', true,  'BIN ngân hàng cho VietQR (vd: 970422 cho MB Bank)',     now(), now()),
    (gen_random_uuid(), 'payment_sepay.account_number',   '',      'payment_sepay', true,  'Số tài khoản nhận tiền',                                now(), now()),
    (gen_random_uuid(), 'payment_sepay.account_holder',   '',      'payment_sepay', true,  'Tên chủ tài khoản (in hoa, vd: CONG TY BIGBIKE)',       now(), now()),
    (gen_random_uuid(), 'payment_sepay.timeout_hours',    '48',    'payment_sepay', false, 'Số giờ chờ thanh toán trước khi tự hủy đơn ON_HOLD',    now(), now()),
    (gen_random_uuid(), 'payment_sepay.qr_template',      'compact2', 'payment_sepay', false, 'Template QR VietQR (compact2 / print / qr_only)',    now(), now());
