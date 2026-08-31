package com.bigbike.bigbike_backend.service.admin.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
import com.bigbike.bigbike_backend.service.security.YouTubeChannelUrlPolicy;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SettingValueValidatorTest {

    private static final SettingDefinition PRODUCT_ASSIGN_ROLES_DEF =
            SettingDefinition.builder("product_assign_roles", "product_assign", SettingValueType.JSON)
                    .superAdminOnly()
                    .build();

    private SettingValueValidator validator;

    @BeforeEach
    void setUp() {
        SafeMediaAssetUrlPolicy policy = new SafeMediaAssetUrlPolicy(new MediaUrlProperties(), "https://bigbike.vn");
        validator = new SettingValueValidator(policy, new YouTubeChannelUrlPolicy(), new ObjectMapper());
    }

    @Test
    void acceptsValidRoleListWithinRange() {
        String json = "[{\"id\":\"content\",\"name\":\"Content\",\"items\":\"A · B\"},"
                + "{\"id\":\"seo\",\"name\":\"SEO\",\"items\":\"\"}]";
        assertThatCode(() -> validator.validate("product_assign_roles", json, PRODUCT_ASSIGN_ROLES_DEF))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsMaximumOfSixRoles() {
        assertThatCode(() -> validator.validate("product_assign_roles", buildRoles(6), PRODUCT_ASSIGN_ROLES_DEF))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMalformedJson() {
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", "not json at all", PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("NOT_JSON");
    }

    @Test
    void rejectsNonArrayJson() {
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", "{\"id\":\"content\"}", PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("NOT_ARRAY");
    }

    @Test
    void rejectsEmptyArray() {
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", "[]", PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("TOO_FEW_ROLES");
    }

    @Test
    void rejectsMoreThanSixRoles() {
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", buildRoles(7), PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("TOO_MANY_ROLES");
    }

    @Test
    void rejectsBlankRoleName() {
        String json = "[{\"id\":\"content\",\"name\":\"\",\"items\":\"x\"}]";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", json, PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("ROLE_NAME_REQUIRED");
    }

    @Test
    void rejectsBlankRoleId() {
        String json = "[{\"id\":\"\",\"name\":\"Content\",\"items\":\"x\"}]";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", json, PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("ROLE_ID_REQUIRED");
    }

    @Test
    void rejectsDuplicateRoleId() {
        String json = "[{\"id\":\"content\",\"name\":\"Content\",\"items\":\"\"},"
                + "{\"id\":\"content\",\"name\":\"Content 2\",\"items\":\"\"}]";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("product_assign_roles", json, PRODUCT_ASSIGN_ROLES_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("ROLE_ID_DUPLICATE");
    }

    @Test
    void allowsBlankItemsOnANewlyAddedRole() {
        String json = "[{\"id\":\"content\",\"name\":\"Content\",\"items\":\"\"}]";
        assertThatCode(() -> validator.validate("product_assign_roles", json, PRODUCT_ASSIGN_ROLES_DEF))
                .doesNotThrowAnyException();
    }

    // ── HTML image-source policy (AUD-036) ────────────────────────────────────

    private static final SettingDefinition HTML_DEF =
            SettingDefinition.builder("footer_html", "content", SettingValueType.HTML).build();
    private static final SettingDefinition YOUTUBE_CHANNEL_DEF =
            SettingDefinition.builder("youtube_url", "contact", SettingValueType.URL).build();
    private static final SettingDefinition OUT_OF_STOCK_TIME_DEF =
            SettingDefinition.builder(
                    "inventory_out_of_stock_digest_time", "inventory", SettingValueType.STRING).build();

    @Test
    void outOfStockDigestTimeAcceptsStrictTwentyFourHourClock() {
        assertThatCode(() -> validator.validate(
                "inventory_out_of_stock_digest_time", "08:00", OUT_OF_STOCK_TIME_DEF))
                .doesNotThrowAnyException();

        for (String value : List.of("8:00", "24:00", "08:60", "08:00:00")) {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> validator.validate(
                            "inventory_out_of_stock_digest_time", value, OUT_OF_STOCK_TIME_DEF));
            assertThat(ex.details().get(0).code()).isEqualTo("INVALID_TIME");
        }
    }

    @Test
    void youtubeChannel_acceptsHandleAndDirectChannelPages() {
        assertThatCode(() -> validator.validate(
                "youtube_url", "https://youtube.com/@bigbike-shop?sub_confirmation=1", YOUTUBE_CHANNEL_DEF))
                .doesNotThrowAnyException();
        assertThatCode(() -> validator.validate(
                "youtube_url", "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv", YOUTUBE_CHANNEL_DEF))
                .doesNotThrowAnyException();
    }

    @Test
    void youtubeChannel_rejectsVideoPlaylistAndOtherHosts() {
        for (String value : List.of(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/playlist?list=PL123",
                "https://example.com/@bigbike-shop")) {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> validator.validate("youtube_url", value, YOUTUBE_CHANNEL_DEF));
            assertThat(ex.details().get(0).code()).isEqualTo("INVALID_YOUTUBE_CHANNEL_URL");
        }
    }

    @Test
    void html_allowsInternalMediaImages() {
        String html = "<p>Hi</p><img src=\"/media/reviews/x/photo.jpg\"><div style=\"background:url('/media/a.png')\"></div>";
        assertThatCode(() -> validator.validate("footer_html", html, HTML_DEF))
                .doesNotThrowAnyException();
    }

    @Test
    void html_rejectsExternalImage() {
        String html = "<img src=\"https://evil.example.com/pixel.gif\">";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("footer_html", html, HTML_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("EXTERNAL_IMAGE");
    }

    @Test
    void html_rejectsTrackingPixelInCssBackground() {
        String html = "<div style=\"background-image:url(https://track.example.com/beacon.png)\"></div>";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("footer_html", html, HTML_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("EXTERNAL_IMAGE");
    }

    @Test
    void html_rejectsDataUriImage() {
        String html = "<img src=\"data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=\">";
        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate("footer_html", html, HTML_DEF));
        assertThat(ex.details().get(0).code()).isEqualTo("EXTERNAL_IMAGE");
    }

    private static String buildRoles(int count) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < count; i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"id\":\"r").append(i).append("\",\"name\":\"R").append(i).append("\",\"items\":\"\"}");
        }
        return sb.append("]").toString();
    }
}
