package com.bigbike.bigbike_backend.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SeoTextNormalizerTest {

    @Test
    void stripsMarkupAndKnownChatWidgetBeforeTruncating() {
        String input = "<p>Thông tin hữu ích</p>"
                + "<div id='messageView'><div class='chat-message'>Nội dung chat không đưa vào SEO</div></div>"
                + "<p>Quad Lock chính hãng tại BigBike.</p>";

        assertThat(SeoTextNormalizer.toDescription(input, 165))
                .isEqualTo("Thông tin hữu ích Quad Lock chính hãng tại BigBike.");
    }

    @Test
    void truncatesAtWordBoundary() {
        assertThat(SeoTextNormalizer.toDescription("Một hai ba bốn năm sáu", 12))
                .isEqualTo("Một hai ba");
    }

    @Test
    void returnsNullForEmptyMarkup() {
        assertThat(SeoTextNormalizer.toDescription("<p>&nbsp;</p>", 165)).isNull();
    }
}
