package com.bigbike.bigbike_backend.api.admin.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class HighlightRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsRichTextContentUpToTwentyThousandCharactersInBothLanguages() {
        String maximumHtml = "<p>" + "x".repeat(19_993) + "</p>";
        HighlightRequest request = HighlightRequest.builder()
                .content(maximumHtml)
                .contentEn(maximumHtml)
                .build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsRichTextContentAboveTwentyThousandCharacters() {
        String tooLongHtml = "<p>" + "x".repeat(19_994) + "</p>";
        HighlightRequest request = HighlightRequest.builder().contentEn(tooLongHtml).build();

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("contentEn"));
    }
}
