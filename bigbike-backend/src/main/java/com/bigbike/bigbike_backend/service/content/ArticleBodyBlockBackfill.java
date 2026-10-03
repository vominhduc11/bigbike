package com.bigbike.bigbike_backend.service.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

/** Fills only the derived blocks; original HTML, translations and metadata never change. */
public final class ArticleBodyBlockBackfill {
    private ArticleBodyBlockBackfill() {}

    public static int fillMissing(Connection connection, int limit) throws Exception {
        record Source(String id, String body) {}
        List<Source> sources = new ArrayList<>();
        try (var select = connection.prepareStatement("""
                SELECT id, body FROM articles
                WHERE body_blocks IS NULL OR body_blocks = 'null'::jsonb
                   OR (body_blocks = '[]'::jsonb AND body IS NOT NULL AND btrim(body) <> '')
                ORDER BY id LIMIT ?
                """)) {
            select.setInt(1, limit);
            try (var result = select.executeQuery()) {
                while (result.next()) sources.add(new Source(result.getString(1), result.getString(2)));
            }
        }
        var parser = new BodyBlockParser();
        var mapper = new ObjectMapper();
        int filled = 0;
        try (var update = connection.prepareStatement("""
                UPDATE articles SET body_blocks = ?::jsonb
                WHERE id = ? AND body IS NOT DISTINCT FROM ?
                  AND (body_blocks IS NULL OR body_blocks IN ('[]'::jsonb, 'null'::jsonb))
                """)) {
            for (var source : sources) {
                var blocks = parser.parseArticleHtmlToBlocks(source.body());
                if ((blocks.isEmpty() && source.body() != null && !source.body().isBlank()) || blocks.size() > 400) {
                    throw new IllegalStateException("Article block conversion requires review: " + source.id());
                }
                update.setString(1, mapper.writeValueAsString(blocks));
                update.setString(2, source.id());
                update.setString(3, source.body());
                filled += update.executeUpdate();
            }
        }
        return filled;
    }
}
