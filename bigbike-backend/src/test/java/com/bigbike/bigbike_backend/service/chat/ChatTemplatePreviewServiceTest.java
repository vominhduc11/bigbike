package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.chat.AdminChatTemplatePreviewRequest;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatTemplatePreviewServiceTest {

    private final ChatTemplatePreviewService service =
            new ChatTemplatePreviewService(new ChatResponseGuard());

    @Test
    @DisplayName("AC11/12 VI/EN: preview returns exactly the enabled owner-authored customer answer")
    void bilingualPreviewMatchesTheOwnerAnswerExactly() {
        var vi = service.preview(request(
                "vi", "Cách vệ sinh mũ?",
                "Anh/chị lau nhẹ bằng khăn mềm.",
                "Please wipe it gently with a soft cloth."));
        var en = service.preview(request(
                "en", "How do I clean my helmet?",
                "Anh/chị lau nhẹ bằng khăn mềm.",
                "Please wipe it gently with a soft cloth."));

        assertThat(vi.matched()).isTrue();
        assertThat(vi.canEnable()).isTrue();
        assertThat(vi.answer()).isEqualTo("Anh/chị lau nhẹ bằng khăn mềm.");
        assertThat(en.matched()).isTrue();
        assertThat(en.canEnable()).isTrue();
        assertThat(en.answer()).isEqualTo("Please wipe it gently with a soft cloth.");
    }

    @Test
    @DisplayName("AC14: preview names a discount promise and never rewrites the owner's draft")
    void previewReportsUnsafePromiseWithoutReturningEditedCopy() {
        String unsafeVi = "Shop hứa giảm giá 10% cho anh/chị.";
        String unsafeEn = "The shop promises a 10% discount.";

        var response = service.preview(request(
                "vi", "Có giảm giá không?", unsafeVi, unsafeEn));

        assertThat(response.matched()).isTrue();
        assertThat(response.canEnable()).isFalse();
        assertThat(response.violations()).contains("DISCOUNT_PROMISE");
        assertThat(response.answer()).isNull();
        assertThat(unsafeVi).isEqualTo("Shop hứa giảm giá 10% cho anh/chị.");
    }

    private static AdminChatTemplatePreviewRequest request(
            String locale, String question, String answerVi, String answerEn) {
        return new AdminChatTemplatePreviewRequest(
                "care",
                List.of("cách vệ sinh mũ", "có giảm giá không"),
                List.of("how do i clean my helmet", "is there a discount"),
                answerVi,
                answerEn,
                locale,
                question);
    }
}
