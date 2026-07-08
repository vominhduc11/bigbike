package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Di chuyển dữ liệu từ 3 bảng con {@code product_faqs}/{@code product_commitments}/
 * {@code product_highlights} sang 3 cột JSONB mới trên {@code products} (thêm ở V331) — dùng đúng
 * record domain {@link ProductFaq}/{@link ProductCommitment}/{@link ProductHighlight}/
 * {@link ProductHighlights} (không hand-roll JSON) để output khớp đúng những gì
 * {@code ProductFaqsConverter}/{@code ProductCommitmentsConverter}/{@code ProductHighlightsConverter}
 * tự đọc lại được — giống cách V326 tái dùng {@code DescriptionBlock} thay vì tự dựng JSON tay.
 *
 * <p>Đã audit dữ liệu thật trước khi viết migration này (225 sản phẩm, Postgres đang chạy):
 * {@code product_faqs} 27 dòng / 7 sản phẩm, {@code product_commitments} 663 dòng / 223 sản phẩm,
 * {@code product_highlights} 43 dòng / 8 sản phẩm (24 {@code PRO} / 19 {@code CON}, 0 dòng có
 * {@code kind} khác PRO/CON). Prerequisite cho {@code V333} xoá 3 bảng con này.
 */
public class V332__MigrateProductChildContentToJsonb extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        int faqs = migrateFaqs(conn);
        int commitments = migrateCommitments(conn);
        int highlights = migrateHighlights(conn);
        System.out.printf(
                "[V332] migrated faqs for %d, commitments for %d, highlights for %d product(s) into JSONB%n",
                faqs, commitments, highlights);
    }

    private int migrateFaqs(Connection conn) throws Exception {
        Map<String, List<ProductFaq>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, question, answer, question_en, answer_en "
                        + "FROM product_faqs ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new ProductFaq(
                        rs.getString("question"), rs.getString("answer"),
                        rs.getString("question_en"), rs.getString("answer_en")));
            }
        }
        return writeJsonColumn(conn, "faqs", byProduct);
    }

    private int migrateCommitments(Connection conn) throws Exception {
        Map<String, List<ProductCommitment>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, icon, title, subtitle, title_en, subtitle_en "
                        + "FROM product_commitments ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new ProductCommitment(
                        rs.getString("icon"), rs.getString("title"), rs.getString("subtitle"),
                        rs.getString("title_en"), rs.getString("subtitle_en")));
            }
        }
        return writeJsonColumn(conn, "commitments", byProduct);
    }

    private int migrateHighlights(Connection conn) throws Exception {
        Map<String, List<ProductHighlight>> positiveByProduct = new LinkedHashMap<>();
        Map<String, List<ProductHighlight>> negativeByProduct = new LinkedHashMap<>();
        Set<String> productIds = new LinkedHashSet<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, kind, content, content_en "
                        + "FROM product_highlights ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                String kind = rs.getString("kind");
                ProductHighlight highlight = new ProductHighlight(rs.getString("content"), rs.getString("content_en"));
                productIds.add(productId);
                if ("PRO".equals(kind)) {
                    positiveByProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(highlight);
                } else if ("CON".equals(kind)) {
                    negativeByProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(highlight);
                } else {
                    throw new IllegalStateException("V332: product_highlights row for product " + productId
                            + " has kind '" + kind + "' — outside the audited PRO/CON shape, aborting migration.");
                }
            }
        }

        Map<String, ProductHighlights> byProduct = new LinkedHashMap<>();
        for (String productId : productIds) {
            List<ProductHighlight> positives = positiveByProduct.getOrDefault(productId, List.of());
            List<ProductHighlight> negatives = negativeByProduct.getOrDefault(productId, List.of());
            byProduct.put(productId, new ProductHighlights(positives, negatives));
        }
        return writeJsonColumn(conn, "highlights", byProduct);
    }

    private <T> int writeJsonColumn(Connection conn, String column, Map<String, T> byProduct) throws Exception {
        int updated = 0;
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET " + column + " = ?::jsonb WHERE id = ?")) {
            for (Map.Entry<String, T> entry : byProduct.entrySet()) {
                update.setString(1, MAPPER.writeValueAsString(entry.getValue()));
                update.setString(2, entry.getKey());
                update.executeUpdate();
                updated++;
            }
        }
        return updated;
    }
}
