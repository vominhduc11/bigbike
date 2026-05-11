package com.bigbike.bigbike_backend.service.admin.settings;

import java.math.BigDecimal;
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
                SettingDefinition.builder("facebook_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL Facebook page.").build(),
                SettingDefinition.builder("messenger_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("Deep link Facebook Messenger cho floating chat.").build(),
                SettingDefinition.builder("zalo_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL Zalo cho floating chat.").build(),
                SettingDefinition.builder("youtube_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL kênh YouTube.").build(),
                SettingDefinition.builder("tiktok_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL profile TikTok.").build(),
                SettingDefinition.builder("instagram_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL profile Instagram.").build(),
                SettingDefinition.builder("google_maps_url", "contact", SettingValueType.URL)
                        .publicAllowed()
                        .description("URL nhúng Google Maps cho trang Liên hệ.").build(),

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

                // ── PUBLIC_HERO ── (hero banner cho listing pages không có PageEntity)
                SettingDefinition.builder("hero_products_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tất cả sản phẩm (/san-pham).").build(),
                SettingDefinition.builder("hero_products_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Tất cả sản phẩm.").build(),
                SettingDefinition.builder("hero_products_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Tất cả sản phẩm.").build(),
                SettingDefinition.builder("hero_products_description", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Mô tả ngắn dưới tiêu đề hero trang Tất cả sản phẩm.").build(),
                SettingDefinition.builder("hero_products_kicker", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Kicker (chip nhỏ trên tiêu đề) hero trang Tất cả sản phẩm.").build(),

                SettingDefinition.builder("hero_brands_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Thương hiệu (/brands).").build(),
                SettingDefinition.builder("hero_brands_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Thương hiệu.").build(),
                SettingDefinition.builder("hero_brands_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Thương hiệu.").build(),
                SettingDefinition.builder("hero_brands_description", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Mô tả ngắn dưới tiêu đề hero trang Thương hiệu.").build(),
                SettingDefinition.builder("hero_brands_kicker", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Kicker hero trang Thương hiệu.").build(),

                SettingDefinition.builder("hero_news_image_url", "public_hero", SettingValueType.IMAGE_URL)
                        .publicAllowed()
                        .description("Ảnh nền hero trang Tin tức (/tin-tuc).").build(),
                SettingDefinition.builder("hero_news_image_alt", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Alt text ảnh hero trang Tin tức.").build(),
                SettingDefinition.builder("hero_news_title", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề hero trang Tin tức.").build(),
                SettingDefinition.builder("hero_news_description", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Mô tả ngắn dưới tiêu đề hero trang Tin tức.").build(),
                SettingDefinition.builder("hero_news_kicker", "public_hero", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Kicker hero trang Tin tức.").build(),

                // ── SEO ──
                SettingDefinition.builder("seo_home_title", "seo", SettingValueType.STRING)
                        .publicAllowed()
                        .description("SEO meta title của trang chủ.").build(),
                SettingDefinition.builder("seo_home_description", "seo", SettingValueType.LONG_TEXT)
                        .publicAllowed()
                        .description("SEO meta description của trang chủ.").build(),
                SettingDefinition.builder("seo_home_h1", "seo", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Tiêu đề H1 chính trên trang chủ.").build(),
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
                SettingDefinition.builder("order_min_amount", "STORE", SettingValueType.MONEY)
                        .min(0L).max(1_000_000_000L)
                        .description("Số tiền tối thiểu để checkout (VND).").build(),
                SettingDefinition.builder("low_stock_threshold", "STORE", SettingValueType.INTEGER)
                        .min(0L).max(10_000L)
                        .description("Ngưỡng low-stock cho variant.").build(),

                // ── TAX ──
                SettingDefinition.builder("tax_enabled", "TAX", SettingValueType.BOOLEAN)
                        .description("Bật tính thuế tự động trên đơn hàng.").build(),
                SettingDefinition.builder("tax_rate", "TAX", SettingValueType.DECIMAL)
                        .min(BigDecimal.ZERO).max(BigDecimal.ONE)
                        .description("Tỷ lệ VAT mặc định (0.10 = 10%).").build(),
                SettingDefinition.builder("tax_inclusive", "TAX", SettingValueType.BOOLEAN)
                        .description("Giá sản phẩm đã bao gồm thuế hay chưa.").build(),
                SettingDefinition.builder("tax_label", "TAX", SettingValueType.STRING)
                        .publicAllowed()
                        .description("Nhãn hiển thị thuế trên hoá đơn (VAT, GST,…).").build(),
                SettingDefinition.builder("tax_registration_number", "TAX", SettingValueType.STRING)
                        .description("MST của doanh nghiệp.").build(),

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
