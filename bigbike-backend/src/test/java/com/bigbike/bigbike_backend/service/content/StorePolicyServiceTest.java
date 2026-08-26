package com.bigbike.bigbike_backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.jsoup.Jsoup;

class StorePolicyServiceTest {

    @Test
    void warrantyPageAndAssistantPlainTextReadTheSameSanitizedSettings() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        when(settings.findBySettingKey("policy_warranty_title"))
                .thenReturn(Optional.of(setting("Chính sách bảo hành", "Warranty Policy")));
        when(settings.findBySettingKey("policy_warranty_body_html"))
                .thenReturn(Optional.of(setting(
                        "<p>Bảo hành <strong>12 tháng</strong>.</p><script>alert(1)</script>"
                                + "<a href=\"javascript:alert(2)\">Xấu</a>",
                        "<p>Covered for <strong>12 months</strong>.</p>")));
        StorePolicyService service = new StorePolicyService(settings);

        var policy = service.get("warranty", "vi");

        assertThat(policy.title()).isEqualTo("Chính sách bảo hành");
        assertThat(policy.bodyHtml()).contains("12 tháng", "<strong>")
                .doesNotContain("script", "javascript:", "alert(");
        assertThat(service.plainText("warranty", "vi"))
                .isEqualTo("Bảo hành 12 tháng. Xấu");
    }

    @Test
    void missingEnglishPolicyFallsBackToTheCurrentVietnameseSource() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        when(settings.findBySettingKey("policy_return_exchange_title"))
                .thenReturn(Optional.of(setting("Chính sách đổi trả", "")));
        when(settings.findBySettingKey("policy_return_exchange_body_html"))
                .thenReturn(Optional.of(setting("<p>Đổi trong 7 ngày.</p>", null)));

        var policy = new StorePolicyService(settings).get("return-exchange", "en");

        assertThat(policy.title()).isEqualTo("Chính sách đổi trả");
        assertThat(policy.bodyHtml()).contains("Đổi trong 7 ngày");
    }

    @Test
    void warrantyContactUsesCurrentSharedSettingsInsteadOfFrozenPolicyValues() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        when(settings.findBySettingKey("policy_warranty_title"))
                .thenReturn(Optional.of(setting("Chính sách bảo hành", "Warranty Policy")));
        when(settings.findBySettingKey("policy_warranty_body_html"))
                .thenReturn(Optional.of(setting(
                        "<ol><li><div class='leading-body'><span>ZaloGọi Hotline</span></div></li>"
                                + "<li><div class='leading-body'><span>Xác nhận</span></div></li>"
                                + "<li><div class='leading-body'><span>Gửi về shop</span></div></li></ol>"
                                + "<table><tbody></tbody></table>",
                        "<ol><li><div class='leading-body'><span>ZaloCall Hotline</span></div></li>"
                                + "<li><div class='leading-body'><span>Confirm</span></div></li>"
                                + "<li><div class='leading-body'><span>Send to shop</span></div></li></ol>"
                                + "<table><tbody></tbody></table>")));
        when(settings.findBySettingKey("hotline"))
                .thenReturn(Optional.of(setting("0900000000", "0900000000")));
        when(settings.findBySettingKey("hotline_2"))
                .thenReturn(Optional.of(setting("0760000000", "0760000000")));
        when(settings.findBySettingKey("contact_address"))
                .thenReturn(Optional.of(setting("Địa chỉ đang dùng", "Current address")));
        when(settings.findBySettingKey("opening_hours_weekday"))
                .thenReturn(Optional.of(setting("Thứ 2–7: 9–21h", "Mon–Sat: 9–21")));

        StorePolicyService service = new StorePolicyService(settings);
        var vi = service.get("warranty", "vi");
        var en = service.get("warranty", "en");

        assertThat(Jsoup.parse(vi.bodyHtml()).text())
                .contains("Nhắn Zalo 0760000000 hoặc gọi Hotline 0900000000")
                .contains("Địa chỉ đang dùng", "Thứ 2–7: 9–21h")
                .doesNotContain("ZaloGọi");
        assertThat(Jsoup.parse(en.bodyHtml()).text())
                .contains("Message Zalo 0760000000 or call Hotline 0900000000")
                .contains("Current address", "Mon–Sat: 9–21")
                .doesNotContain("ZaloCall");
    }

    @Test
    void returnExchangeContactUsesCurrentSharedSettingsInsteadOfFrozenPolicyValues() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        when(settings.findBySettingKey("policy_return_exchange_title"))
                .thenReturn(Optional.of(setting("Chính sách đổi trả", "Returns Policy")));
        when(settings.findBySettingKey("policy_return_exchange_body_html"))
                .thenReturn(Optional.of(setting(
                        "<table><tbody><tr><td>1</td><td><strong>Liên hệ BigBike trong thời hạn</strong>"
                                + "<br>Nhắn 0764640679 hoặc gọi 0906902404.</td></tr>"
                                + "<tr><td>3</td><td><strong>Gửi hàng về BigBike</strong>"
                                + "<br>Gửi về địa chỉ cũ.</td></tr></tbody></table>"
                                + "<h2>Liên hệ hỗ trợ đổi / trả</h2>"
                                + "<table><tbody><tr><td>Hotline</td><td>0906902404</td></tr></tbody></table>",
                        "<table><tbody><tr><td>1</td><td><strong>Contact BigBike within the applicable period</strong>"
                                + "<br>Message 0764640679 or call 0906902404.</td></tr>"
                                + "<tr><td>3</td><td><strong>Send the product to BigBike</strong>"
                                + "<br>Send to the old address.</td></tr></tbody></table>"
                                + "<h2>Returns and exchanges support</h2>"
                                + "<table><tbody><tr><td>Hotline</td><td>0906902404</td></tr></tbody></table>")));
        when(settings.findBySettingKey("hotline"))
                .thenReturn(Optional.of(setting("0900000000", "0900000000")));
        when(settings.findBySettingKey("hotline_2"))
                .thenReturn(Optional.of(setting("0760000000", "0760000000")));
        when(settings.findBySettingKey("contact_address"))
                .thenReturn(Optional.of(setting("Địa chỉ đang dùng", "Current address")));
        when(settings.findBySettingKey("opening_hours_weekday"))
                .thenReturn(Optional.of(setting("Thứ 2–7: 9–21h", "Mon–Sat: 9–21")));

        StorePolicyService service = new StorePolicyService(settings);
        String vi = Jsoup.parse(service.get("return-exchange", "vi").bodyHtml()).text();
        String en = Jsoup.parse(service.get("return-exchange", "en").bodyHtml()).text();

        assertThat(vi)
                .contains("Nhắn Zalo 0760000000 hoặc gọi Hotline 0900000000")
                .contains("Địa chỉ đang dùng", "Thứ 2–7: 9–21h")
                .doesNotContain("0906902404", "0764640679", "địa chỉ cũ");
        assertThat(en)
                .contains("Message Zalo 0760000000 or call Hotline 0900000000")
                .contains("Current address", "Mon–Sat: 9–21")
                .doesNotContain("0906902404", "0764640679", "old address");
    }

    private static SiteSettingEntity setting(String vi, String en) {
        SiteSettingEntity value = new SiteSettingEntity();
        value.setSettingValue(vi);
        value.setSettingValueEn(en);
        value.setCreatedAt(Instant.parse("2026-08-23T00:00:00Z"));
        value.setUpdatedAt(Instant.parse("2026-08-23T00:00:00Z"));
        return value;
    }
}
