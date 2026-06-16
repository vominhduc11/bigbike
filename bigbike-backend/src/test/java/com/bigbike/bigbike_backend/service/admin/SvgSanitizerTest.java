package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SvgSanitizerTest {

    private static String clean(String svg) {
        return new String(SvgSanitizer.sanitize(svg.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);
    }

    @Test
    void stripsScriptElement() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<script>alert(1)</script><path d=\"M0 0h10v10H0z\"/></svg>");
        assertThat(out).doesNotContain("script").doesNotContain("alert");
        assertThat(out).contains("<path");
    }

    @Test
    void stripsEventHandlerAttributes() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<rect width=\"10\" height=\"10\" onload=\"alert(1)\" onclick=\"x()\"/></svg>");
        assertThat(out).doesNotContain("onload").doesNotContain("onclick").doesNotContain("alert");
        assertThat(out).contains("<rect");
    }

    @Test
    void stripsForeignObjectAndEmbeddedHtml() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<foreignObject><body xmlns=\"http://www.w3.org/1999/xhtml\">"
                + "<img src=x onerror=alert(1)></body></foreignObject></svg>");
        assertThat(out).doesNotContain("foreignObject").doesNotContain("onerror");
    }

    @Test
    void stripsJavascriptHrefButKeepsLocalFragment() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<a href=\"javascript:alert(1)\"><use xlink:href=\"#ico\"/></a>"
                + "<use xlink:href=\"#ico\"/></svg>");
        assertThat(out).doesNotContain("javascript:");
        // External-linking <a> is dropped; the local <use> fragment ref survives.
        assertThat(out).contains("#ico");
    }

    @Test
    void stripsExternalImageReference() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<image href=\"https://evil.example/x.png\"/></svg>");
        assertThat(out).doesNotContain("evil.example").doesNotContain("<image");
    }

    @Test
    void stripsStyleElementWithImport() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                + "<style>@import url('https://evil.example/x.css');</style><path/></svg>");
        assertThat(out).doesNotContain("@import").doesNotContain("evil.example").doesNotContain("<style");
    }

    @Test
    void keepsCleanIconUnchangedInShape() {
        String out = clean("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">"
                + "<path d=\"M4 4h16v16H4z\" fill=\"currentColor\"/></svg>");
        assertThat(out).contains("viewBox=\"0 0 24 24\"");
        assertThat(out).contains("currentColor");
        assertThat(out).contains("<path");
    }

    @Test
    void rejectsNonSvgContent() {
        assertThatThrownBy(() -> SvgSanitizer.sanitize("not an svg".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void rejectsEmptyInput() {
        assertThatThrownBy(() -> SvgSanitizer.sanitize(new byte[0]))
                .isInstanceOf(ValidationException.class);
    }
}
