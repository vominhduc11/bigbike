-- Owner-confirmed name: Trợ lý BigBike. Compare-and-set preserves later owner customisation.

update site_settings
set setting_value = 'Em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng khi đã đăng nhập.',
    setting_value_en = 'I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you choose products, check store policies, or view orders on your signed-in account.',
    description = 'Câu chào đầu khung chat của Trợ lý BigBike.',
    updated_at = now()
where setting_key = 'ai_assistant_greeting'
  and setting_value = 'Em là Bi, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng đã đăng nhập.'
  and setting_value_en = 'I’m Bi, BigBike’s AI assistant. I can help you choose products, check store policies, or view orders on your signed-in account.';

update site_settings
set description = 'Bật Trợ lý BigBike. Khi tắt, widget vẫn giữ các kênh Hotline–Zalo–Messenger.',
    updated_at = now()
where setting_key = 'ai_assistant_enabled'
  and description = 'Bật trợ lý bán hàng Bi. Khi tắt, widget trở về bảng Hotline–Zalo–Messenger.';

update site_settings
set description = 'Số cặp hỏi–đáp gần nhất gửi cho Trợ lý BigBike sau khi che thông tin riêng tư; 0 để tắt, tối đa 3.',
    updated_at = now()
where setting_key = 'ai_assistant_recent_turn_pairs'
  and description = 'Số cặp hỏi–đáp gần nhất gửi cho Bi sau khi che thông tin riêng tư; 0 để tắt, tối đa 3.';
