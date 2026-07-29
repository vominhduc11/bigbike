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
                // seo_home_title / seo_home_description / og_image_url: gỡ hẳn V337
                // (quyết định chủ shop 2026-07-12) — 3 ô "SEO Title/Description/Ảnh chia sẻ"
                // trang chủ bỏ khỏi admin; web rơi title/description về site_name, bỏ og:image
                // mặc định. Khác hẳn SEO per-entity (category/product/article) — giữ nguyên.
                SettingDefinition.builder("home_content_bottom_html", "seo", SettingValueType.HTML)
                        .publicAllowed()
                        .description("Block HTML SEO ở cuối trang chủ.").build(),

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
                        .description("Danh sách vai trò (tên + việc phụ trách) trên banner phân công, 1-6 vai trò.").build()
        );
    }
}
