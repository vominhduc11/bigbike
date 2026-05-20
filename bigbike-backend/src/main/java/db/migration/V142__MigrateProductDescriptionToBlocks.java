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
 * Flyway Java migration that parses legacy HTML in the {@code description} column of
 * {@code products} into structured {@code description_blocks} JSON.
 *
 * <p>Migration properties:
 * <ul>
 *   <li>Idempotent: only processes rows where {@code description_blocks IS NULL}.</li>
 *   <li>Non-destructive: the original {@code description} column is not touched.</li>
 *   <li>Fallback: unrecognised HTML elements become {@code paragraph} blocks
 *       (outerHTML preserved) — admin can clean up via BlockEditor.</li>
 * </ul>
 */
public class V142__MigrateProductDescriptionToBlocks extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        BodyBlockParser parser = new BodyBlockParser();
        ObjectMapper mapper = new ObjectMapper();
        Connection conn = context.getConnection();

        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, description FROM products"
                + " WHERE description IS NOT NULL AND description <> '' AND description_blocks IS NULL")) {
            ResultSet rs = select.executeQuery();
            while (rs.next()) {
                rows.add(new String[]{rs.getString("id"), rs.getString("description")});
            }
        }

        if (rows.isEmpty()) {
            System.out.println("[V142] products: 0 rows to migrate");
            return;
        }

        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        int processed = 0;

        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb WHERE id = ?")) {

            for (String[] row : rows) {
                String id = row[0];
                String description = row[1];

                List<DescriptionBlock> blocks = parser.parseHtmlToBlocks(description);
                String json = mapper.writeValueAsString(blocks);

                update.setString(1, json);
                update.setString(2, id);
                update.executeUpdate();

                for (DescriptionBlock block : blocks) {
                    typeCounts.merge(blockTypeName(block), 1, Integer::sum);
                }
                processed++;
            }
        }

        System.out.printf("[V142] products: %d rows processed, block counts: %s%n",
                processed, typeCounts);
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
