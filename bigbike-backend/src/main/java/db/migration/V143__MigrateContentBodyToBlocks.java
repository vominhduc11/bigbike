package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.service.content.BodyBlockParser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Flyway Java migration that parses legacy HTML in the {@code body} column of
 * {@code articles} and {@code pages} into structured {@code body_blocks} JSON.
 *
 * <p>Migration properties:
 * <ul>
 *   <li>Idempotent: only processes rows where {@code body_blocks IS NULL}.</li>
 *   <li>Non-destructive: the original {@code body} column is not touched.</li>
 *   <li>Fallback: unrecognised HTML elements become {@code paragraph} blocks
 *       (outerHTML preserved) — admin can clean up in Phase 4.</li>
 * </ul>
 *
 * <p>Runs outside the Spring context — instantiates {@link BodyBlockParser} and
 * {@link ObjectMapper} directly (no DI needed).
 */
public class V143__MigrateContentBodyToBlocks extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        BodyBlockParser parser = new BodyBlockParser();
        ObjectMapper mapper = new ObjectMapper();
        Connection conn = context.getConnection();

        migrateTable(conn, "articles", parser, mapper);
        migrateTable(conn, "pages", parser, mapper);
    }

    private void migrateTable(
            Connection conn, String table, BodyBlockParser parser, ObjectMapper mapper) throws Exception {

        // Collect rows first to avoid cursor/update conflicts on the same connection
        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, body FROM " + table
                + " WHERE body IS NOT NULL AND body <> '' AND body_blocks IS NULL")) {
            ResultSet rs = select.executeQuery();
            while (rs.next()) {
                rows.add(new String[]{rs.getString("id"), rs.getString("body")});
            }
        }

        if (rows.isEmpty()) {
            System.out.printf("[V143] %s: 0 rows to migrate%n", table);
            return;
        }

        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        int processed = 0;

        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE " + table + " SET body_blocks = ?::jsonb WHERE id = ?")) {

            for (String[] row : rows) {
                String id = row[0];
                String body = row[1];

                List<DescriptionBlock> blocks = parser.parseHtmlToBlocks(body);
                String json = mapper.writeValueAsString(blocks);

                update.setString(1, json);
                update.setString(2, id);
                update.executeUpdate();

                for (DescriptionBlock block : blocks) {
                    String typeName = blockTypeName(block);
                    typeCounts.merge(typeName, 1, Integer::sum);
                }
                processed++;
            }
        }

        System.out.printf("[V143] %s: %d rows processed, block counts: %s%n",
                table, processed, typeCounts);
    }

    private static String blockTypeName(DescriptionBlock block) {
        if (block instanceof DescriptionBlock.HeadingBlock)   return "heading";
        if (block instanceof DescriptionBlock.ParagraphBlock) return "paragraph";
        if (block instanceof DescriptionBlock.ListBlock)      return "list";
        if (block instanceof DescriptionBlock.ImageBlock)     return "image";
        if (block instanceof DescriptionBlock.VideoBlock)     return "video";
        if (block instanceof DescriptionBlock.CalloutBlock)   return "callout";
        if (block instanceof DescriptionBlock.DividerBlock)   return "divider";
        return "unknown";
    }
}
