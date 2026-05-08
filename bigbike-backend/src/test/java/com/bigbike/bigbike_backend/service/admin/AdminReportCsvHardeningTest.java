package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AdminReportCsvHardeningTest {

    // ── BOM ───────────────────────────────────────────────────────────────────

    @Test
    void withBom_prependsUtf8BomBytes() {
        byte[] input = "hello".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] result = AdminReportService.withBom(input);

        assertThat(result).hasSizeGreaterThan(3);
        assertThat(result[0]).isEqualTo((byte) 0xEF);
        assertThat(result[1]).isEqualTo((byte) 0xBB);
        assertThat(result[2]).isEqualTo((byte) 0xBF);
    }

    @Test
    void withBom_contentAfterBomIsUnchanged() {
        byte[] content = "test,row\n".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] result = AdminReportService.withBom(content);

        byte[] tail = java.util.Arrays.copyOfRange(result, 3, result.length);
        assertThat(tail).isEqualTo(content);
    }

    @Test
    void withBom_emptyInput_returnsBomOnly() {
        byte[] result = AdminReportService.withBom(new byte[0]);
        assertThat(result).containsExactly((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
    }

    // ── Formula injection escape ──────────────────────────────────────────────

    @ParameterizedTest
    @ValueSource(strings = {"=SUM(A1)", "=HYPERLINK(\"evil.com\")", "==double"})
    void escape_equalsPrefix_isEscaped(String value) {
        assertThat(AdminReportService.escape(value)).startsWith("'=");
    }

    @ParameterizedTest
    @ValueSource(strings = {"+1234567890", "+Country", "++double"})
    void escape_plusPrefix_isEscaped(String value) {
        assertThat(AdminReportService.escape(value)).startsWith("'+");
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "--double", "-ROUND()"})
    void escape_minusPrefix_isEscaped(String value) {
        assertThat(AdminReportService.escape(value)).startsWith("'-");
    }

    @Test
    void escape_atPrefix_isEscaped() {
        assertThat(AdminReportService.escape("@SUM")).isEqualTo("'@SUM");
    }

    @Test
    void escape_tabPrefix_isEscaped() {
        assertThat(AdminReportService.escape("\tcell")).isEqualTo("'\tcell");
    }

    @Test
    void escape_crPrefix_isEscaped() {
        assertThat(AdminReportService.escape("\rcell")).isEqualTo("'\rcell");
    }

    // ── RBAUD-002: LF injection vector ────────────────────────────────────────

    @Test
    void escape_leadingLinefeed_isStripped() {
        // \ncell → leading LF stripped; no formula trigger left → "cell"
        assertThat(AdminReportService.escape("\ncell")).isEqualTo("cell");
    }

    @Test
    void escape_leadingLinefeedFormula_isStripped() {
        // \n=formula → LF stripped, then = triggers apostrophe prefix
        String result = AdminReportService.escape("\n=SUM(A1)");
        assertThat(result).doesNotStartWith("\n");
        assertThat(result).startsWith("'=");
    }

    @Test
    void escape_leadingCrLfFormula_isStripped() {
        // \r\n=formula → both control chars stripped, = triggers apostrophe
        String result = AdminReportService.escape("\r\n=HYPERLINK(\"evil.com\")");
        assertThat(result).doesNotStartWith("\r");
        assertThat(result).doesNotStartWith("\n");
        assertThat(result).startsWith("'=");
    }

    @Test
    void escape_multipleLeadingLinefeeds_allStripped() {
        // \n\n\n=formula → all LFs stripped before formula escape
        String result = AdminReportService.escape("\n\n\n=formula");
        assertThat(result).startsWith("'=");
        assertThat(result).doesNotContain("\n");
    }

    // Safe values must pass through unchanged

    @ParameterizedTest
    @ValueSource(strings = {"hello", "user@example.com", "0123", "COMPLETED", "", "Nguyễn Văn A"})
    void escape_safeValues_passThrough(String value) {
        assertThat(AdminReportService.escape(value)).isEqualTo(value);
    }

    @Test
    void escape_null_returnsNull() {
        assertThat(AdminReportService.escape(null)).isNull();
    }

    // Prefix quote must be a single apostrophe (neutralises formula without altering value semantics)
    @Test
    void escape_formulaCell_prefixedWithSingleApostrophe() {
        String result = AdminReportService.escape("=DANGEROUS()");
        assertThat(result).isEqualTo("'=DANGEROUS()");
        assertThat(result).startsWith("'");
        assertThat(result.substring(1)).isEqualTo("=DANGEROUS()");
    }
}
