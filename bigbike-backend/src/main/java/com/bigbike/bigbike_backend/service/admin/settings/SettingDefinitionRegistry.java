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
                        .description("Tên hiển thị của site (header, footer).").build(),
                SettingDefinition.builder("footer_tagline", "general", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tagline hiển thị trong cột brand của footer.").build(),
                SettingDefinition.builder("footer_description", "general", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Đoạn mô tả ngắn dưới tagline trong footer.").build(),
                SettingDefinition.builder("bct_url", "general", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL trang đăng ký Bộ Công Thương cho badge BCT.").build(),
                SettingDefinition.builder("business_registration", "general", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Dòng giấy chứng nhận đăng ký kinh doanh hiển thị ở footer (số GP, ngày cấp, nơi cấp).").build(),

                // ── CONTACT ──
                SettingDefinition.builder("contact_email", "contact", SettingValueType.EMAIL)
                        .publicAllowed()
                        .description("Email liên hệ công khai.").build(),
                SettingDefinition.builder("contact_address", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Địa chỉ cửa hàng công khai.").build(),
                SettingDefinition.builder("hotline", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline chính hiển thị trên header và footer.").build(),
                SettingDefinition.builder("hotline_2", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline phụ hiển thị trên footer.").build(),
                SettingDefinition.builder("hotline_3", "contact", SettingValueType.PHONE)
                        .publicAllowed()
                        .description("Hotline thứ ba hiển thị trên footer.").build(),
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
                SettingDefinition.builder("opening_hours_weekday", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Giờ mở cửa thứ 2–thứ 6 (header + trang Liên hệ).").build(),
                SettingDefinition.builder("opening_hours_weekend", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Giờ mở cửa thứ 7 / Chủ nhật.").build(),
                SettingDefinition.builder("opening_hours_holiday", "contact", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Lịch nghỉ lễ / Tết.").build(),

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

                // ── PUBLIC_HOME ──
                SettingDefinition.builder("promo_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề banner promo trên trang chủ.").build(),
                SettingDefinition.builder("promo_off", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Nhãn % giảm giá trên banner promo.").build(),
                SettingDefinition.builder("promo_href", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("URL đích của banner promo (path tương đối được phép).").build(),
                SettingDefinition.builder("promo_image_url", "public_home", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("URL ảnh banner promo trang chủ.").build(),
                SettingDefinition.builder("home_exp_subtitle", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Subtitle/kicker section trải nghiệm trên trang chủ.").build(),
                SettingDefinition.builder("home_exp_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề section trải nghiệm trên trang chủ.").build(),
                SettingDefinition.builder("home_exp_desc", "public_home", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Mô tả section trải nghiệm trên trang chủ.").build(),
                SettingDefinition.builder("about_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề section giới thiệu trên trang chủ.").build(),
                SettingDefinition.builder("about_subtitle", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Sub-heading section giới thiệu trên trang chủ.").build(),
                SettingDefinition.builder("about_content_html", "public_home", SettingValueType.HTML)
                        .publicAllowed()
                        .description("Nội dung HTML section giới thiệu trên trang chủ.").build(),
                SettingDefinition.builder("home_featured_kicker", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Kicker (chữ nhỏ phía trên) khu Sản phẩm nổi bật trên trang chủ.").build(),
                SettingDefinition.builder("home_featured_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề khu Sản phẩm nổi bật trên trang chủ.").build(),
                SettingDefinition.builder("home_news_kicker", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Kicker khu Tin tức trên trang chủ.").build(),
                SettingDefinition.builder("home_news_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề khu Tin tức trên trang chủ.").build(),
                SettingDefinition.builder("home_videos_title", "public_home", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề khu Video trải nghiệm trên trang chủ.").build(),

                // ── PUBLIC_ABOUT ── (toàn bộ copy trang Giới thiệu /gioi-thieu — admin sửa được,
                // giữ nguyên bố cục lưới 5 ô; web render settings-first, fallback copy theme khi trống)
                SettingDefinition.builder("about_page_kicker", "public_about", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Trang Giới thiệu — tiêu đề nhỏ (kicker) khối đầu trang.").build(),
                SettingDefinition.builder("about_page_tagline", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Trang Giới thiệu — câu tagline khối đầu trang.").build(),
                SettingDefinition.builder("about_page_intro_html", "public_about", SettingValueType.HTML)
                        .publicAllowed()
                        .description("Trang Giới thiệu — đoạn giới thiệu mở đầu (rich-text, gồm 4 đoạn).").build(),
                SettingDefinition.builder("about_page_quality_heading", "public_about", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Trang Giới thiệu — tiêu đề khối Chất lượng dịch vụ.").build(),
                SettingDefinition.builder("about_page_quality_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("Trang Giới thiệu — mô tả khối Chất lượng dịch vụ.").build(),

                SettingDefinition.builder("about_page_service1_title", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 1: tiêu đề.").build(),
                SettingDefinition.builder("about_page_service1_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 1: mô tả.").build(),
                SettingDefinition.builder("about_page_service1_image", "public_about", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 1: hình minh hoạ.").build(),
                SettingDefinition.builder("about_page_service1_highlight", "public_about", SettingValueType.BOOLEAN)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 1: nền cam nổi bật.").build(),

                SettingDefinition.builder("about_page_service2_title", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 2: tiêu đề.").build(),
                SettingDefinition.builder("about_page_service2_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 2: mô tả.").build(),
                SettingDefinition.builder("about_page_service2_image", "public_about", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 2: hình minh hoạ.").build(),
                SettingDefinition.builder("about_page_service2_highlight", "public_about", SettingValueType.BOOLEAN)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 2: nền cam nổi bật.").build(),

                SettingDefinition.builder("about_page_service3_title", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 3: tiêu đề.").build(),
                SettingDefinition.builder("about_page_service3_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 3: mô tả.").build(),
                SettingDefinition.builder("about_page_service3_image", "public_about", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 3: hình minh hoạ.").build(),
                SettingDefinition.builder("about_page_service3_highlight", "public_about", SettingValueType.BOOLEAN)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 3: nền cam nổi bật.").build(),

                SettingDefinition.builder("about_page_service4_title", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 4: tiêu đề.").build(),
                SettingDefinition.builder("about_page_service4_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 4: mô tả.").build(),
                SettingDefinition.builder("about_page_service4_image", "public_about", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 4: hình minh hoạ.").build(),
                SettingDefinition.builder("about_page_service4_highlight", "public_about", SettingValueType.BOOLEAN)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 4: nền cam nổi bật.").build(),

                SettingDefinition.builder("about_page_service5_title", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 5: tiêu đề.").build(),
                SettingDefinition.builder("about_page_service5_body", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 5: mô tả.").build(),
                SettingDefinition.builder("about_page_service5_image", "public_about", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 5: hình minh hoạ.").build(),
                SettingDefinition.builder("about_page_service5_highlight", "public_about", SettingValueType.BOOLEAN)
                        .publicAllowed().description("Trang Giới thiệu — ô dịch vụ 5: nền cam nổi bật.").build(),

                SettingDefinition.builder("about_page_connect_heading", "public_about", SettingValueType.STRING)
                        .publicAllowed().description("Trang Giới thiệu — tiêu đề khối Kết nối với chúng tôi.").build(),
                SettingDefinition.builder("about_page_connect_intro1", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — dòng 1 khối Kết nối.").build(),
                SettingDefinition.builder("about_page_connect_intro2", "public_about", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Giới thiệu — dòng 2 khối Kết nối.").build(),

                // ── PUBLIC_WARRANTY ── (toàn bộ copy trang Tra cứu bảo hành /bao-hanh — admin sửa được;
                // công cụ tra cứu serial giữ nguyên chức năng, chỉ chữ là động. Web render settings-first,
                // fallback copy theme (i18n Warranty) khi trống nên trang không bao giờ trắng.)
                SettingDefinition.builder("warranty_page_meta_title", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — tiêu đề SEO (thẻ <title>).").build(),
                SettingDefinition.builder("warranty_page_meta_description", "public_warranty", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Bảo hành — mô tả SEO (meta description).").build(),
                SettingDefinition.builder("warranty_page_heading", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — tiêu đề banner đầu trang.").build(),
                SettingDefinition.builder("warranty_page_kicker", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — tiêu đề nhỏ (kicker) trên khối tra cứu.").build(),
                SettingDefinition.builder("warranty_page_subheading", "public_warranty", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Bảo hành — dòng mô tả dưới kicker.").build(),
                SettingDefinition.builder("warranty_page_intro_html", "public_warranty", SettingValueType.HTML)
                        .publicAllowed().description("Trang Bảo hành — khối nội dung giới thiệu phía trên ô tra cứu (rich-text, để trống sẽ ẩn).").build(),
                SettingDefinition.builder("warranty_page_intro_image", "public_warranty", SettingValueType.IMAGE_URL)
                        .publicAllowed().description("Trang Bảo hành — hình minh hoạ tuỳ chọn cho khối giới thiệu (để trống sẽ ẩn).").build(),
                SettingDefinition.builder("warranty_page_serial_label", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn ô nhập số serial.").build(),
                SettingDefinition.builder("warranty_page_serial_placeholder", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — chữ gợi ý trong ô nhập serial (placeholder).").build(),
                SettingDefinition.builder("warranty_page_serial_hint", "public_warranty", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Bảo hành — dòng hướng dẫn dưới ô nhập serial.").build(),
                SettingDefinition.builder("warranty_page_submit_button", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — chữ trên nút tra cứu.").build(),
                SettingDefinition.builder("warranty_page_submitting", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — chữ nút khi đang tra cứu.").build(),
                SettingDefinition.builder("warranty_page_not_found", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — thông báo khi không tìm thấy bảo hành.").build(),
                SettingDefinition.builder("warranty_page_result_heading", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — tiêu đề khối kết quả.").build(),
                SettingDefinition.builder("warranty_page_field_product", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn dòng Sản phẩm trong kết quả.").build(),
                SettingDefinition.builder("warranty_page_field_serial", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn dòng Số serial trong kết quả.").build(),
                SettingDefinition.builder("warranty_page_field_start", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn dòng Ngày bắt đầu trong kết quả.").build(),
                SettingDefinition.builder("warranty_page_field_end", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn dòng Ngày kết thúc trong kết quả.").build(),
                SettingDefinition.builder("warranty_page_status_active", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn trạng thái Còn hiệu lực. Giữ {daysLeft} để hiện số ngày còn lại.").build(),
                SettingDefinition.builder("warranty_page_status_almost_expired", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn trạng thái Sắp hết hạn. Giữ {daysLeft} để hiện số ngày còn lại.").build(),
                SettingDefinition.builder("warranty_page_status_expired", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn trạng thái Hết hạn.").build(),
                SettingDefinition.builder("warranty_page_status_voided", "public_warranty", SettingValueType.STRING)
                        .publicAllowed().description("Trang Bảo hành — nhãn trạng thái Đã huỷ.").build(),
                SettingDefinition.builder("warranty_page_footer_active", "public_warranty", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Bảo hành — ghi chú dưới kết quả khi bảo hành còn hiệu lực.").build(),
                SettingDefinition.builder("warranty_page_footer_voided", "public_warranty", SettingValueType.LONG_TEXT)
                        .publicAllowed().description("Trang Bảo hành — ghi chú dưới kết quả khi bảo hành đã huỷ.").build(),
                SettingDefinition.builder("warranty_page_policy_html", "public_warranty", SettingValueType.HTML)
                        .publicAllowed().description("Trang Bảo hành — khối chính sách / câu hỏi thường gặp phía dưới (rich-text, để trống sẽ ẩn).").build(),

                // ── PUBLIC_PRODUCT ── (KHÔNG còn setting chung nào.)
                // Mọi nội dung trang chi tiết sản phẩm giờ quản theo TỪNG sản phẩm:
                //  • Khối "cam kết" dưới nút mua → bảng product_commitments (V232).
                //  • Dải "tin cậy" trên tên sản phẩm → bảng product_trust_badges (V233).
                // 6 khóa product_commitment_* (V228) gỡ ở V232; 2 khóa product_trust_* gỡ ở V233.

                // ── PUBLIC_HERO ── (hero banner cho listing pages không có PageEntity)
                SettingDefinition.builder("hero_products_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tất cả sản phẩm (/san-pham).").build(),
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
                SettingDefinition.builder("seo_home_title", "seo", SettingValueType.STRING)
                        .publicAllowed()
                        .description("SEO meta title của trang chủ.").build(),
                SettingDefinition.builder("seo_home_description", "seo", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("SEO meta description của trang chủ.").build(),
                SettingDefinition.builder("og_image_url", "seo", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("URL ảnh Open Graph mặc định.").build(),
                SettingDefinition.builder("home_content_bottom_html", "seo", SettingValueType.HTML)
                        .publicAllowed()
                        .description("Block HTML SEO ở cuối trang chủ.").build(),

                // ── STORE ──
                SettingDefinition.builder("store_currency", "STORE", SettingValueType.ENUM)
                        .publicAllowed().required()
                        .allowedValues("VND", "USD")
                        .description("Mã tiền tệ mặc định.").build(),
                SettingDefinition.builder("store_timezone", "STORE", SettingValueType.STRING)
                        .description("Múi giờ dùng cho timestamp đơn hàng và scheduled job.").build(),
                SettingDefinition.builder("low_stock_threshold", "STORE", SettingValueType.INTEGER)
                        .min(0L).max(10_000L)
                        .description("Ngưỡng low-stock cho variant.").build(),

                // ── INVENTORY ── (vận hành kho; admin shop chỉnh, không public)
                SettingDefinition.builder("reservation_ttl_minutes", "inventory", SettingValueType.INTEGER)
                        .min(1L).max(1440L)
                        .description("Số phút giữ hàng trong giỏ trước khi nhả lại kho.").build(),
                SettingDefinition.builder("default_warranty_months", "inventory", SettingValueType.INTEGER)
                        .min(0L).max(600L)
                        .description("Thời hạn bảo hành mặc định khi tạo phiếu (tháng).").build(),
                SettingDefinition.builder("serial_inventory_only", "inventory", SettingValueType.BOOLEAN)
                        .description("Chỉ bán sản phẩm có serial đã nhập kho.").build(),

                // ── PRODUCT_ASSIGN ── (text phân công đội ngũ trên màn tạo/sửa sản phẩm; chỉ SUPER_ADMIN sửa)
                SettingDefinition.builder("product_assign_title", "product_assign", SettingValueType.STRING)
                        .superAdminOnly()
                        .description("Tiêu đề banner phân công trên màn tạo/sửa sản phẩm.").build(),
                SettingDefinition.builder("product_assign_role_content", "product_assign", SettingValueType.STRING)
                        .superAdminOnly()
                        .description("Tên vai trò 1 (mặc định: Content) trên banner phân công.").build(),
                SettingDefinition.builder("product_assign_items_content", "product_assign", SettingValueType.LONG_TEXT)
                        .superAdminOnly()
                        .description("Danh sách công việc do vai trò Content phụ trách.").build(),
                SettingDefinition.builder("product_assign_role_seo", "product_assign", SettingValueType.STRING)
                        .superAdminOnly()
                        .description("Tên vai trò 2 (mặc định: SEO) trên banner phân công.").build(),
                SettingDefinition.builder("product_assign_items_seo", "product_assign", SettingValueType.LONG_TEXT)
                        .superAdminOnly()
                        .description("Danh sách công việc do vai trò SEO phụ trách.").build(),
                SettingDefinition.builder("product_assign_role_manager", "product_assign", SettingValueType.STRING)
                        .superAdminOnly()
                        .description("Tên vai trò 3 (mặc định: Quản lý) trên banner phân công.").build(),
                SettingDefinition.builder("product_assign_items_manager", "product_assign", SettingValueType.LONG_TEXT)
                        .superAdminOnly()
                        .description("Danh sách công việc do vai trò Quản lý phụ trách.").build(),

                // ── SECURITY ──
                SettingDefinition.builder("login_max_attempts", "SECURITY", SettingValueType.INTEGER)
                        .min(1L).max(50L)
                        .description("Số lần đăng nhập sai tối đa trước khi khoá tạm.").build(),
                SettingDefinition.builder("session_timeout_minutes", "SECURITY", SettingValueType.INTEGER)
                        .min(1L).max(1440L)
                        .description("Idle timeout cho admin session (phút).").build()
        );
    }
}
