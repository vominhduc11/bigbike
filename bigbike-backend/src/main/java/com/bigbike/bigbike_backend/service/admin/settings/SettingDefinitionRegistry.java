package com.bigbike.bigbike_backend.service.admin.settings;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SettingDefinitionRegistry {

    private static final Set<String> SENSITIVE_KEY_FRAGMENTS = Set.of(
            "secret", "password", "token", "privatekey", "private_key",
            "api_key", "apikey", "accesskey", "access_key",
            "client_secret", "clientsecret"
    );

    private final Map<String, SettingDefinition> definitions;

    public SettingDefinitionRegistry() {
        Map<String, SettingDefinition> map = new LinkedHashMap<>();
        for (SettingDefinition def : buildDefinitions()) {
            map.put(def.key(), def);
        }
        this.definitions = Map.copyOf(map);
    }

    public Optional<SettingDefinition> find(String key) {
        if (key == null) return Optional.empty();
        return Optional.ofNullable(definitions.get(key));
    }

    public Map<String, SettingDefinition> all() {
        return definitions;
    }

    public boolean isSensitive(String key) {
        if (key == null) return false;
        return find(key).map(SettingDefinition::sensitive).orElse(false)
                || matchesSensitiveFragment(key);
    }

    public boolean matchesSensitiveFragment(String key) {
        if (key == null) return false;
        String lower = key.toLowerCase(Locale.ROOT);
        return SENSITIVE_KEY_FRAGMENTS.stream().anyMatch(lower::contains);
    }

    public boolean isPublicAllowed(String key) {
        if (matchesSensitiveFragment(key)) return false;
        return find(key).map(SettingDefinition::publicAllowed).orElse(false);
    }

    private static List<SettingDefinition> buildDefinitions() {
        return List.of(
                // ── GENERAL ──
                SettingDefinition.builder("site_name", "general", SettingValueType.STRING)
                        .publicAllowed().required()
                        .description("Tên hiển thị của site — dùng cho SEO (trang chủ/bài viết) và khối liên hệ trang sản phẩm.").build(),
                // footer_tagline / bct_url / business_registration: gỡ V308 — footer hardcode
                // trong WpFooter.tsx (quyết định chủ shop 2026-07-03), 3 key này không còn tác dụng.
                SettingDefinition.builder("footer_description", "general", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Đoạn mô tả ngắn hiển thị trong panel thông tin shop trên header mobile (footer đã hardcode, không còn đọc key này).").build(),

                // ── CONTACT ──
                SettingDefinition.builder("contact_email", "contact", SettingValueType.EMAIL)
                        .publicAllowed()
                        .description("Email liên hệ công khai.").build(),
                SettingDefinition.builder("contact_address", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Địa chỉ cửa hàng công khai.").build(),
                SettingDefinition.builder("hotline", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline chính hiển thị trên header (footer đã hardcode riêng, không còn đọc key này).").build(),
                SettingDefinition.builder("hotline_2", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline phụ hiển thị trên header (footer đã hardcode riêng, không còn đọc key này).").build(),
                SettingDefinition.builder("hotline_3", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline thứ ba hiển thị trên header (footer đã hardcode riêng, không còn đọc key này).").build(),
                SettingDefinition.builder("facebook_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL Facebook page.").build(),
                SettingDefinition.builder("messenger_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("Deep link Facebook Messenger cho floating chat.").build(),
                SettingDefinition.builder("messenger_display", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Chữ hiển thị dòng Messenger trong floating chat (mặc định lấy từ link nếu để trống).").build(),
                SettingDefinition.builder("zalo_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL Zalo cho floating chat.").build(),
                SettingDefinition.builder("zalo_display", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Chữ hiển thị dòng Zalo trong floating chat (mặc định lấy từ link nếu để trống).").build(),
                SettingDefinition.builder("youtube_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL kênh YouTube.").build(),
                SettingDefinition.builder("tiktok_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL profile TikTok.").build(),
                SettingDefinition.builder("instagram_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL profile Instagram.").build(),
                SettingDefinition.builder("shopee_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL gian hàng Shopee.").build(),
                SettingDefinition.builder("opening_hours_weekday", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Giờ mở cửa thứ 2–thứ 6 (header + trang Liên hệ).").build(),
                SettingDefinition.builder("opening_hours_weekend", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Giờ mở cửa thứ 7 / Chủ nhật.").build(),
                SettingDefinition.builder("opening_hours_holiday", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Lịch nghỉ lễ / Tết.").build(),

                // Chế độ bảo trì CỐ Ý không nằm ở đây (V374). Registry chỉ mô tả thêm cho các dòng
                // site_settings; danh sách màn Cài đặt lấy từ settingRepo.findAll(), và mọi guard
                // dựa trên registry đều coi key lạ là KHÔNG hạn chế. Giữ trạng thái bảo trì ở đây
                // đồng nghĩa bất kỳ ai có `settings.write` cũng tự mở khoá được. Trạng thái nay
                // nằm ở bảng riêng `maintenance_state`, chỉ đổi qua PUT /api/v1/admin/maintenance.

                // ── PAYMENT ── (tài khoản nhận chuyển khoản — admin tự nhập & đối soát thủ công,
                // không có cổng thanh toán tự động; hiển thị cho khách ở trang xác nhận đơn BACS)
                SettingDefinition.builder("bank_account_holder", "payment", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tên chủ tài khoản ngân hàng nhận chuyển khoản.").build(),
                SettingDefinition.builder("bank_account_number", "payment", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Số tài khoản ngân hàng nhận chuyển khoản.").build(),
                SettingDefinition.builder("bank_name", "payment", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tên ngân hàng (vd: Vietcombank).").build(),
                SettingDefinition.builder("bank_branch", "payment", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Chi nhánh ngân hàng (không bắt buộc).").build(),

                // ── PUBLIC_HOME: gỡ hẳn V311 — 4 khối (banner promo, trải nghiệm, giới thiệu,
                // kicker/tiêu đề Sản phẩm nổi bật/Tin tức/Video) đã hardcode thẳng trong
                // bigbike-web (quyết định chủ shop 2026-07-03); các 15 key trước đây ở đây
                // (promo_title/promo_off/promo_href/promo_image_url, home_exp_subtitle/title/desc,
                // about_title/subtitle/content_html, home_featured_kicker/title,
                // home_news_kicker/title, home_videos_title) không còn tab admin, không còn row
                // site_settings (V311__remove_public_home_settings.sql).

                // ── PUBLIC_PRODUCT ── (KHÔNG còn setting chung nào.)
                // Mọi nội dung trang chi tiết sản phẩm giờ quản theo TỪNG sản phẩm:
                //  • Khối "cam kết" dưới nút mua → bảng product_commitments (V232).
                //  • Dải "tin cậy" trên tên sản phẩm → bảng product_trust_badges (V233).
                // 6 khóa product_commitment_* (V228) gỡ ở V232; 2 khóa product_trust_* gỡ ở V233.

                // ── PUBLIC_HERO ── (hero banner cho các trang listing, không thuộc CMS)
                SettingDefinition.builder("hero_products_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tất cả sản phẩm (/sp/).").build(),
                SettingDefinition.builder("hero_products_mobile_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tất cả sản phẩm cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.").build(),
                SettingDefinition.builder("hero_products_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Tất cả sản phẩm.").build(),
                SettingDefinition.builder("hero_products_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Tất cả sản phẩm.").build(),
                SettingDefinition.builder("hero_products_illustration_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh minh hoạ (gear) góc phải hero trang Tất cả sản phẩm. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.").build(),

                SettingDefinition.builder("hero_brands_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Thương hiệu (/brands).").build(),
                SettingDefinition.builder("hero_brands_mobile_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Thương hiệu cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.").build(),
                SettingDefinition.builder("hero_brands_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Thương hiệu.").build(),
                SettingDefinition.builder("hero_brands_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Thương hiệu.").build(),
                SettingDefinition.builder("hero_brands_illustration_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh minh hoạ (gear) góc phải hero trang Thương hiệu. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.").build(),

                SettingDefinition.builder("hero_news_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tin tức (/tin-tuc).").build(),
                SettingDefinition.builder("hero_news_mobile_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tin tức cho điện thoại (viewport ≤767px). Ảnh dọc ~750×1125px. Bỏ trống sẽ dùng ảnh desktop.").build(),
                SettingDefinition.builder("hero_news_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Tin tức.").build(),
                SettingDefinition.builder("hero_news_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Tin tức.").build(),
                SettingDefinition.builder("hero_news_illustration_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh minh hoạ (gear) góc phải hero trang Tin tức. PNG nền trong, tỷ lệ ~700×600px. Bỏ trống sẽ dùng ảnh gear mặc định chung.").build(),

                // ── GLOBAL HERO DEFAULTS ──
                SettingDefinition.builder("hero_default_bg_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền mặc định cho hero banner khi trang không cấu hình ảnh riêng. Ảnh nằm ngang, ví dụ 1920×600px.").build(),
                SettingDefinition.builder("hero_default_illustration_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh minh hoạ cut-out mặc định góc phải hero (thay ảnh gear cố định). PNG nền trong, tỷ lệ ~700×600px.").build(),

                // ── SEO ──
                // SETTINGS_RULE_003: owner reopened the homepage title/description/H1 fields
                // on 2026-08-16. og_image_url remains intentionally absent (V337).
                SettingDefinition.builder("seo_home_title", "seo", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề SEO trang chủ; để trống sẽ dùng tên shop.").build(),
                SettingDefinition.builder("seo_home_description", "seo", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Mô tả SEO trang chủ; để trống sẽ dùng mô tả trang chủ theo ngôn ngữ.").build(),
                SettingDefinition.builder("seo_home_h1", "seo", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề chính duy nhất hiển thị trên trang chủ; để trống sẽ dùng tên shop.").build(),
                SettingDefinition.builder("home_content_bottom_html", "seo", SettingValueType.HTML)
                        .publicAllowed()
                        .description("Block HTML SEO ở cuối trang chủ.").build(),

                // ── STORE_POLICY ── (owner decision 2026-08-23).
                // Dedicated public policy endpoint allowlists these four keys; they intentionally
                // stay out of GET /settings/public so the common payload does not carry large HTML.
                SettingDefinition.builder("policy_warranty_title", "store_policy", SettingValueType.STRING)
                        .required()
                        .description("Tiêu đề song ngữ trang Chính sách bảo hành.").build(),
                SettingDefinition.builder("policy_warranty_body_html", "store_policy", SettingValueType.HTML)
                        .required()
                        .description("Nội dung song ngữ Chính sách bảo hành dùng chung cho website và Trợ lý BigBike.").build(),
                SettingDefinition.builder("policy_return_exchange_title", "store_policy", SettingValueType.STRING)
                        .required()
                        .description("Tiêu đề song ngữ trang Chính sách đổi trả.").build(),
                SettingDefinition.builder("policy_return_exchange_body_html", "store_policy", SettingValueType.HTML)
                        .required()
                        .description("Nội dung song ngữ Chính sách đổi trả dùng chung cho website và Trợ lý BigBike.").build(),

                // ── STORE: gỡ hẳn V310 — store_currency/store_timezone không có code nào đọc lại
                // (VND + giờ Việt Nam đã hardcode thẳng nơi khác); tab admin cũng đã ẩn từ trước.

                // ── PRODUCT_ASSIGN ── (banner phân công đội ngũ trên màn tạo/sửa sản phẩm + bài viết;
                // chỉ SUPER_ADMIN sửa. product_assign_roles gộp từ 6 key role_*/items_* cố định cũ
                // (V318) thành 1 mảng JSON động, 1-6 vai trò — xem DATA_CONTRACT.md.)
                SettingDefinition.builder("product_assign_title", "product_assign", SettingValueType.STRING)
                        .superAdminOnly()
                        .description("Tiêu đề banner phân công trên màn tạo/sửa sản phẩm.").build(),
                SettingDefinition.builder("product_assign_roles", "product_assign", SettingValueType.JSON)
                        .superAdminOnly()
                        .description("Danh sách vai trò (tên + việc phụ trách) trên banner phân công, 1-6 vai trò.").build(),

                // ── REVIEW_MODERATION ── (kiểm duyệt đánh giá tự động — REVIEW_RULE_012/013.
                // Không key nào publicAllowed: đây là cấu hình vận hành nội bộ, storefront
                // không cần biết. Khoá dịch vụ AI cố tình KHÔNG nằm ở đây — chỉ ở biến môi
                // trường GEMINI_API_KEY, không bao giờ chạm DB.)
                SettingDefinition.builder("review_moderation_enabled", "review_moderation", SettingValueType.BOOLEAN)
                        .description("Bật kiểm duyệt đánh giá tự động. Cần khai GEMINI_API_KEY ở môi trường trước khi bật.").build(),
                SettingDefinition.builder("review_moderation_block_profanity", "review_moderation", SettingValueType.BOOLEAN)
                        .description("Chặn đánh giá chửi tục, dùng từ thô tục — đưa vào Thùng rác.").build(),
                SettingDefinition.builder("review_moderation_block_harassment", "review_moderation", SettingValueType.BOOLEAN)
                        .description("Chặn đánh giá xúc phạm, công kích cá nhân, kỳ thị — đưa vào Thùng rác.").build(),
                SettingDefinition.builder("review_moderation_block_advertising", "review_moderation", SettingValueType.BOOLEAN)
                        .description("Chặn đánh giá quảng cáo, chèn link, số điện thoại, Zalo, mã giới thiệu — đưa vào Spam.").build(),
                SettingDefinition.builder("review_moderation_block_sensitive", "review_moderation", SettingValueType.BOOLEAN)
                        .description("Chặn nội dung 18+, chính trị, tôn giáo, hoặc rác vô nghĩa không liên quan sản phẩm — đưa vào Thùng rác.").build(),
                SettingDefinition.builder("review_moderation_daily_limit", "review_moderation", SettingValueType.INTEGER)
                        .min(0).max(10_000)
                        .description("Số lượt gọi AI tối đa mỗi ngày (giờ Việt Nam). Vượt ngưỡng thì ngừng gọi AI, đánh giá nằm ở Chờ duyệt; danh sách từ cấm vẫn chạy vì không tốn phí. Đặt 0 để tắt hẳn phần gọi AI.").build(),
                SettingDefinition.builder("review_moderation_banned_words", "review_moderation", SettingValueType.LONG_TEXT)
                        .description("Danh sách từ cấm tự quản, ngăn bằng dấu phẩy hoặc xuống dòng. Khớp bỏ dấu, không phân biệt hoa thường, chỉ khớp trọn từ.").build(),

                // ── AI_ASSISTANT ── (Trợ lý BigBike — CHAT_RULE_001..022).
                // Admin-only operational settings. The shared Gemini credential stays in
                // GEMINI_API_KEY and is never stored in or returned from site_settings.
                SettingDefinition.builder("ai_assistant_enabled", "ai_assistant", SettingValueType.BOOLEAN)
                        .description("Bật Trợ lý BigBike. Khi tắt, khung chat vẫn giữ Hotline–Zalo–Messenger.").build(),
                SettingDefinition.builder("ai_assistant_model", "ai_assistant", SettingValueType.STRING)
                        .readOnly()
                        .description("Model trả lời được chọn qua danh sách account live; không sửa như ô chữ thường.").build(),
                SettingDefinition.builder("ai_assistant_daily_limit", "ai_assistant", SettingValueType.INTEGER)
                        .min(0).max(10_000)
                        .description("Số lượt trả lời có gọi AI tối đa mỗi ngày theo giờ Việt Nam. Đặt 0 để tắt phần AI.").build(),
                SettingDefinition.builder("ai_assistant_conversation_turn_limit", "ai_assistant", SettingValueType.INTEGER)
                        .min(10).max(100)
                        .description("Số lượt tư vấn có nội dung tối đa trong một hội thoại. Vòng làm rõ không tính.").build(),
                SettingDefinition.builder("ai_assistant_monthly_cost_warning_usd", "ai_assistant", SettingValueType.DECIMAL)
                        .min(0).max(1_000_000)
                        .description("Ngưỡng cảnh báo chi phí AI theo tháng dương lịch bằng USD; 0 để tắt cảnh báo.").build(),
                SettingDefinition.builder("ai_assistant_recent_turn_pairs", "ai_assistant", SettingValueType.INTEGER)
                        .min(0).max(12)
                        .description("Số cặp hỏi–đáp gần nhất gửi cho Trợ lý BigBike để hiểu câu nối. Đặt 0 để không gửi lịch sử; tối đa 12.").build(),
                SettingDefinition.builder("ai_assistant_search_ai_interpretation_enabled", "ai_assistant", SettingValueType.BOOLEAN)
                        .description("Cho AI diễn giải cách nói tự nhiên khi tìm hàng, sau đó backend đối chiếu từng bộ lọc. Tắt để quay về cách kiểm chứng cũ ngay.").build(),
                SettingDefinition.builder("ai_assistant_greeting", "ai_assistant", SettingValueType.LONG_TEXT)
                        .description("Câu chào đầu khung chat của Trợ lý BigBike; có thể nhập riêng bản tiếng Anh.").build(),
                SettingDefinition.builder("ai_assistant_quick_prompts", "ai_assistant", SettingValueType.LONG_TEXT)
                        .description("Mỗi dòng là một nút gợi ý nhanh; widget dùng tối đa 4 dòng và có thể nhập riêng bản tiếng Anh.").build(),
                SettingDefinition.builder("ai_assistant_abbreviations", "ai_assistant", SettingValueType.JSON)
                        .description("Tối đa 100 từ/cụm viết tắt; khớp nguyên cụm, ưu tiên cụm dài và không được va chạm catalog.").build(),
                SettingDefinition.builder("ai_assistant_answer_templates", "ai_assistant", SettingValueType.JSON)
                        .description("Tối đa 50 câu mẫu song ngữ; trigger dài nhất duy nhất và câu trả lời phải an toàn.").build(),
                SettingDefinition.builder("ai_assistant_handoff_email_enabled", "ai_assistant", SettingValueType.BOOLEAN)
                        .description("Gửi email ngay khi khách xin gặp nhân viên; cảnh báo trong màn quản trị luôn hoạt động.").build(),
                SettingDefinition.builder("ai_assistant_handoff_email_recipient", "ai_assistant", SettingValueType.STRING)
                        .description("Email nhận yêu cầu gặp nhân viên; để trống dùng email quản trị từ môi trường.").build(),
                SettingDefinition.builder("ai_assistant_business_hours", "ai_assistant", SettingValueType.JSON)
                        .description("Lịch trực nhân viên theo tuần, múi giờ Asia/Ho_Chi_Minh.").build(),
                SettingDefinition.builder("ai_assistant_memory_days", "ai_assistant", SettingValueType.INTEGER)
                        .min(1).max(30)
                        .description("Số ngày nối ngữ cảnh cùng thiết bị; tối đa 30 ngày.").build(),
                SettingDefinition.builder("ai_assistant_proactive_enabled", "ai_assistant", SettingValueType.BOOLEAN)
                        .description("Cho Trợ lý chủ động mở lời đúng một lần mỗi phiên; mặc định tắt.").build(),
                SettingDefinition.builder("ai_assistant_proactive_product_seconds", "ai_assistant", SettingValueType.INTEGER)
                        .min(15).max(600)
                        .description("Số giây khách ở trang sản phẩm trước khi gợi ý.").build(),
                SettingDefinition.builder("ai_assistant_proactive_cart_seconds", "ai_assistant", SettingValueType.INTEGER)
                        .min(15).max(600)
                        .description("Số giây giỏ có hàng chưa thanh toán trước khi gợi ý.").build(),
                SettingDefinition.builder("ai_assistant_image_enabled", "ai_assistant", SettingValueType.BOOLEAN)
                        .description("Bật đọc ảnh khách gửi; mặc định tắt và độc lập với chat chữ.").build(),
                SettingDefinition.builder("ai_assistant_image_daily_limit", "ai_assistant", SettingValueType.INTEGER)
                        .min(1).max(200)
                        .description("Trần số ảnh được xử lý mỗi ngày theo giờ Việt Nam.").build(),
                SettingDefinition.builder("ai_assistant_image_conversation_limit", "ai_assistant", SettingValueType.INTEGER)
                        .min(1).max(10)
                        .description("Trần số ảnh trong một hội thoại; mỗi lượt vẫn chỉ nhận một ảnh.").build()
        );
    }
}
