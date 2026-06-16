-- Điền label + URL cho 6 menu item footer (đang trống) dựa theo WP live bigbike.vn.
-- URL dùng route của bigbike-web-new (không phải .html WP cũ).
-- menu_id footer = 00000000-0000-0000-0000-000000000841

UPDATE menu_items SET
    label    = 'Hướng dẫn mua hàng',
    url      = '/huong-dan-mua-hang',
    updated_at = NOW()
WHERE id = '73b5571f-f689-0627-53f1-ec0f1ba89a59';

UPDATE menu_items SET
    label    = 'Hướng dẫn mua hàng Online',
    url      = '/huong-dan-mua-hang-online-html',
    updated_at = NOW()
WHERE id = '034701e7-330e-622d-6f33-ad311865bf3c';

UPDATE menu_items SET
    label    = 'Chính sách bảo hành',
    url      = '/chinh-sach/bao-hanh',
    updated_at = NOW()
WHERE id = '7025d8d5-5317-b38c-79fe-851551dffc49';

UPDATE menu_items SET
    label    = 'Chính Sách Đổi Trả Hàng',
    url      = '/chinh-sach/doi-tra',
    updated_at = NOW()
WHERE id = 'd3603e82-157e-9102-c749-3327122292ca';

UPDATE menu_items SET
    label    = 'Chính sách Bảo vệ thông tin cá nhân',
    url      = '/chinh-sach/bao-mat',
    updated_at = NOW()
WHERE id = 'fa34726f-be78-5847-bcc7-666c82e718aa';

UPDATE menu_items SET
    label    = 'Các Điều Kiện và Điều khoản',
    url      = '/chinh-sach/dieu-khoan',
    updated_at = NOW()
WHERE id = '597c6c1f-fe94-ed52-cb41-d30fc0274efe';
