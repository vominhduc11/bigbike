package com.bigbike.bigbike_backend.migration.wordpress.parser;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class WordPressSqlDumpRowReaderTest {

    @TempDir
    Path tempDir;

    @Test
    void streamsGzipDumpWithoutExpandingItToDisk() throws Exception {
        String sql = """
                CREATE TABLE `custom_posts` (
                  `ID` bigint NOT NULL,
                  `post_title` text NOT NULL
                );
                INSERT INTO `custom_posts` VALUES (7,'Mũ bảo hiểm');
                """;
        Path dump = tempDir.resolve("snapshot.sql.gz");
        try (OutputStream out = new GZIPOutputStream(Files.newOutputStream(dump))) {
            out.write(sql.getBytes(StandardCharsets.UTF_8));
        }

        List<WordPressTableRow> rows = new ArrayList<>();
        List<String> warnings = new WordPressSqlDumpRowReader().stream(
                dump, Set.of("custom_posts"), (table, row) -> rows.add(row));

        assertThat(warnings).isEmpty();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getLong("ID", -1)).isEqualTo(7);
        assertThat(rows.get(0).get("post_title")).isEqualTo("Mũ bảo hiểm");
    }
}
