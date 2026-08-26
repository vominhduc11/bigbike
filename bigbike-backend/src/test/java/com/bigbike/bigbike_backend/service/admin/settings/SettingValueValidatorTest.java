package com.bigbike.bigbike_backend.service.admin.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MediaUrlProperties;
import com.bigbike.bigbike_backend.service.security.SafeMediaAssetUrlPolicy;
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
        validator = new SettingValueValidator(policy, new ObjectMapper());
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
    private static final SettingDefinition ASSISTANT_TEMPLATES_DEF =
            SettingDefinition.builder(
                    "ai_assistant_answer_templates", "ai_assistant", SettingValueType.JSON).build();

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

    @Test
    void assistantTemplateRejectsAnEnabledDiscountPromiseWithAnOwnerFacingCode() {
        String json = """
                [{"id":"sale","topic":"promotion","enabled":true,
                  "triggersVi":["có giảm giá không"],"triggersEn":["is there a discount"],
                  "answerVi":"Shop hứa giảm giá 10% cho anh/chị.",
                  "answerEn":"The shop promises a 10% discount."}]
                """;

        ValidationException ex = assertThrows(ValidationException.class,
                () -> validator.validate(
                        "ai_assistant_answer_templates", json, ASSISTANT_TEMPLATES_DEF));

        assertThat(ex.details().get(0).code()).isEqualTo("DISCOUNT_PROMISE");
        assertThat(ex.details().get(0).message()).contains("vi phạm", "DISCOUNT_PROMISE");
    }

    @Test
    void assistantTemplateKeepsUnsafeDraftContentUnchangedWhileItIsDisabled() {
        String json = """
                [{"id":"draft","topic":"delivery","enabled":false,
                  "triggersVi":[],"triggersEn":[],
                  "answerVi":"Shop hứa giao ngày mai.",
                  "answerEn":"The shop promises delivery tomorrow."}]
                """;

        assertThatCode(() -> validator.validate(
                "ai_assistant_answer_templates", json, ASSISTANT_TEMPLATES_DEF))
                .doesNotThrowAnyException();
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
