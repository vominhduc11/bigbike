package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class WordPressRedirectMapperTest {

    @Test
    void parsesEveryExactPhpSerializedRankMathPattern() {
        String serialized = "a:2:{i:0;a:3:{s:6:\"ignore\";s:0:\"\";"
                + "s:7:\"pattern\";s:19:\"vi/old-product.html\";"
                + "s:10:\"comparison\";s:5:\"exact\";}"
                + "i:1;a:3:{s:6:\"ignore\";s:0:\"\";"
                + "s:7:\"pattern\";s:16:\"sp/old-item.html\";"
                + "s:10:\"comparison\";s:5:\"exact\";}}";

        var parsed = WordPressRedirectMapper.parseSourcePatterns(serialized);

        assertThat(parsed.patterns())
                .containsExactly("vi/old-product.html", "sp/old-item.html");
        assertThat(parsed.warnings()).isEmpty();
        assertThat(WordPressRedirectMapper.parseFirstSourcePattern(serialized))
                .isEqualTo("vi/old-product.html");
    }

    @Test
    void parsesJsonAndSkipsNonExactPatterns() {
        String json = """
                [
                  {"pattern":"\\/vi\\/old.html","comparison":"exact"},
                  {"pattern":"regex/(.*)","comparison":"regex"}
                ]
                """;

        var parsed = WordPressRedirectMapper.parseSourcePatterns(json);

        assertThat(parsed.patterns()).containsExactly("/vi/old.html");
        assertThat(parsed.warnings()).anyMatch(value -> value.contains("non-exact"));
    }

    @Test
    void malformedSerializedValueFailsClosedInsteadOfBecomingAPath() {
        var parsed = WordPressRedirectMapper.parseSourcePatterns("a:2:{broken");

        assertThat(parsed.patterns()).isEmpty();
        assertThat(parsed.warnings()).anyMatch(value -> value.contains("parse failed"));
    }
}
