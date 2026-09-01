package com.bigbike.bigbike_backend.service.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

class StorePolicyServiceTest {

    @Test
    void frozenResourcesContainTheLiveBilingualPolicyDocuments() {
        FrozenStorePolicyContent content = new FrozenStorePolicyContent();

        assertDocument(content, "warranty", "vi", "Chính sách bảo hành", 9068,
                "d726ebd8c60a819384be86f244c76568ffa4129b9871808778e09d0ea2bf6640",
                "24 tháng", "{{CONTACT_CHANNELS}}");
        assertDocument(content, "warranty", "en", "Warranty Policy", 8421,
                "2fa54ce0b8b7aa904b6826862fdcf578175d828905c6b5278408654f16e60ce3",
                "24 months", "{{CONTACT_CHANNELS}}");
        assertDocument(content, "return-exchange", "vi", "Chính sách đổi trả hàng", 13681,
                "dddac4578318d689753ad65f81ca74cd54a5fdf0c5776c80fdea8cb9778b528e",
                "7 ngày", "{{CONTACT_HOTLINE}}");
        assertDocument(content, "return-exchange", "en", "Returns and Exchanges Policy", 11455,
                "1a84b6e93f4529f9109f4a070c05d03cdc07705cffc10bea12cba3f53e6678cd",
                "7 days", "{{CONTACT_HOTLINE}}");
    }

    @Test
    void allPolicyPagesUseCurrentContactSettingsAndNeverExposeLegacyContactData() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        Map<String, SiteSettingEntity> current = Map.of(
                "hotline", setting("0900000000", "0900000000"),
                "hotline_2", setting("0760000000", "0760000000"),
                "messenger_display", setting("fb.com/bigbike-now", "fb.com/bigbike-now"),
                "contact_address", setting("Địa chỉ đang dùng", "Current address"),
                "opening_hours_weekday", setting("Thứ 2–7: 9–21h", "Mon–Sat: 9–21"),
                "opening_hours_weekend", setting("CN: 9–18h", "Sun: 9–18"),
                // Prove the removed DB policy rows cannot override the frozen source.
                "policy_warranty_title", setting("Tiêu đề cũ", "Old title"),
                "policy_warranty_body_html", setting("<p>Nội dung cũ</p>", "<p>Old body</p>"));
        when(settings.findBySettingKey(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(current.get(invocation.getArgument(0))));

        StorePolicyService service = new StorePolicyService(settings, new FrozenStorePolicyContent());
        for (String topic : new String[] {"warranty", "return-exchange"}) {
            for (String lang : new String[] {"vi", "en"}) {
                String html = service.get(topic, lang).bodyHtml();
                assertThat(service.get(topic, lang).updatedAt())
                        .isEqualTo(FrozenStorePolicyContent.FROZEN_AT);
                String text = Jsoup.parse(html).text();
                assertThat(text)
                        .contains("0900000000", "0760000000", "fb.com/bigbike-now",
                                lang.equals("vi") ? "Địa chỉ đang dùng" : "Current address",
                                lang.equals("vi") ? "Thứ 2–7: 9–21h" : "Mon–Sat: 9–21",
                                lang.equals("vi") ? "CN: 9–18h" : "Sun: 9–18")
                        .doesNotContain("0906902404", "0764640679", "79/30/52 Âu Cơ",
                                "{{CONTACT_", "ZaloGọi", "ZaloCall", "Tiêu đề cũ", "Old title");
            }
        }
    }

    @Test
    void sanitizerRemainsAppliedToTheFrozenPolicyBoundary() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        FrozenStorePolicyContent content = new FrozenStorePolicyContent(Map.of(
                "warranty|vi", "<p>Bảo hành <strong>12 tháng</strong>.</p>"
                        + "<script>alert(1)</script><a href=\"javascript:alert(2)\">Xấu</a>"));

        StorePolicyService service = new StorePolicyService(settings, content);
        var policy = service.get("warranty", "vi");

        assertThat(policy.title()).isEqualTo("Chính sách bảo hành");
        assertThat(policy.bodyHtml()).contains("12 tháng", "<strong>")
                .doesNotContain("script", "javascript:", "alert(");
        assertThat(service.plainText("warranty", "vi"))
                .isEqualTo("Bảo hành 12 tháng. Xấu");
    }

    @Test
    void missingContactSettingsDoNotLeakFrozenPlaceholders() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        StorePolicyService service = new StorePolicyService(
                settings, new FrozenStorePolicyContent());

        for (String topic : new String[] {"warranty", "return-exchange"}) {
            for (String lang : new String[] {"vi", "en"}) {
                assertThat(service.get(topic, lang).bodyHtml())
                        .doesNotContain("{{CONTACT_");
            }
        }
    }

    @Test
    void reloadsContactSettingsWhenTheOwnerChangesTheHotline() {
        SiteSettingJpaRepository settings = mock(SiteSettingJpaRepository.class);
        Map<String, SiteSettingEntity> current = new HashMap<>();
        current.put("hotline", setting("0900000000", "0900000000"));
        when(settings.findBySettingKey(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(current.get(invocation.getArgument(0))));

        StorePolicyService service = new StorePolicyService(
                settings, new FrozenStorePolicyContent());
        assertThat(Jsoup.parse(service.get("warranty", "vi").bodyHtml()).text())
                .contains("0900000000")
                .doesNotContain("0900111111");

        current.put("hotline", setting("0900111111", "0900111111"));
        assertThat(Jsoup.parse(service.get("warranty", "vi").bodyHtml()).text())
                .contains("0900111111")
                .doesNotContain("0900000000");
    }

    private static void assertDocument(
            FrozenStorePolicyContent content,
            String topic,
            String lang,
            String title,
            int byteLength,
            String sha256,
            String anchor,
            String contactPlaceholder) {
        var document = content.get(topic, lang);
        byte[] bytes = document.bodyHtml().getBytes(StandardCharsets.UTF_8);
        assertThat(document.title()).isEqualTo(title);
        assertThat(bytes).hasSize(byteLength);
        assertThat(sha256(bytes)).isEqualTo(sha256);
        assertThat(document.bodyHtml()).contains(anchor, contactPlaceholder)
                .doesNotContain("0906902404", "0764640679", "79/30/52 Âu Cơ");
    }

    private static String sha256(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format("%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new AssertionError(exception);
        }
    }

    private static SiteSettingEntity setting(String vi, String en) {
        SiteSettingEntity value = new SiteSettingEntity();
        value.setSettingValue(vi);
        value.setSettingValueEn(en);
        value.setCreatedAt(Instant.parse("2026-09-01T00:00:00Z"));
        value.setUpdatedAt(Instant.parse("2026-09-01T00:00:00Z"));
        return value;
    }
}
