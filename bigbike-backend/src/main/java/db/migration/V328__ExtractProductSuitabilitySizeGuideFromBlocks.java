package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

/**
 * Trích {@code suitability}/{@code sizeGuide} ra khỏi mảng {@code description_blocks}, ghi vào 2 cột
 * mới {@code suitability_section}/{@code size_guide_section} (thêm ở V327), xoá 2 loại khối này khỏi
 * mảng. Đảo ngược quyết định V246/V251 ("giữ nguyên là khối") theo yêu cầu chủ shop: trình dựng mô tả
 * chỉ còn 4 loại khối (paragraph/image/feature×2), 2 khối PDP chuyên biệt này giờ là field riêng.
 *
 * <p>Đọc bằng {@code JsonNode} thô, KHÔNG dùng {@code TypeReference<List<DescriptionBlock>>} như
 * V326 — vì {@link com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock} trong cùng deploy này
 * đã bỏ 2 subtype {@code SuitabilityBlock}/{@code SizeGuideBlock} khỏi {@code @JsonSubTypes}, nên
 * parse bằng class đó sẽ ném lỗi ngay tại các hàng còn dữ liệu cũ. Thao tác JSON cây tránh phụ thuộc
 * này hoàn toàn — 4 loại khối còn lại được giữ nguyên dạng {@code JsonNode}, không cần biết shape.
 *
 * <p>Đã audit dữ liệu thật trước khi viết migration này (225 sản phẩm, Postgres đang chạy): 219 sản
 * phẩm có {@code description_blocks}, 4 sản phẩm có đúng 1 khối {@code suitability}, 3 sản phẩm có
 * đúng 1 khối {@code sizeGuide} — KHÔNG sản phẩm nào có ≥2 khối cùng loại trong 1 mảng. Vì vậy migration
 * này NÉM LỖI (rollback toàn bộ) nếu gặp ≥2 khối cùng loại ở bất kỳ sản phẩm nào — không đoán mò giữ
 * khối nào, giống nguyên tắc V326.
 */
public class V328__ExtractProductSuitabilitySizeGuideFromBlocks extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        Connection conn = context.getConnection();

        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, sku, description_blocks FROM products");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("id"),
                        rs.getString("sku"),
                        rs.getString("description_blocks"),
                });
            }
        }

        int suitabilityExtracted = 0;
        int sizeGuideExtracted = 0;
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb, "
                        + "suitability_section = ?::jsonb, size_guide_section = ?::jsonb WHERE id = ?")) {
            for (String[] row : rows) {
                String id = row[0];
                String sku = row[1];
                String json = row[2];
                if (json == null || json.isBlank() || "null".equals(json.strip())) continue;

                JsonNode root = mapper.readTree(json);
                if (!root.isArray()) continue;

                ArrayNode remaining = mapper.createArrayNode();
                JsonNode suitability = null;
                JsonNode sizeGuide = null;
                for (JsonNode block : root) {
                    String type = block.path("type").asText(null);
                    if ("suitability".equals(type)) {
                        if (suitability != null) {
                            throw new IllegalStateException("V328: product " + sku
                                    + " has more than one 'suitability' block in description_blocks — "
                                    + "shape outside the audited categories, aborting migration.");
                        }
                        suitability = toSection(block);
                    } else if ("sizeGuide".equals(type)) {
                        if (sizeGuide != null) {
                            throw new IllegalStateException("V328: product " + sku
                                    + " has more than one 'sizeGuide' block in description_blocks — "
                                    + "shape outside the audited categories, aborting migration.");
                        }
                        sizeGuide = toSection(block);
                    } else {
                        remaining.add(block);
                    }
                }

                if (suitability == null && sizeGuide == null) continue;

                if (suitability != null) suitabilityExtracted++;
                if (sizeGuide != null) sizeGuideExtracted++;

                update.setString(1, remaining.isEmpty() ? null : mapper.writeValueAsString(remaining));
                update.setString(2, suitability == null ? null : mapper.writeValueAsString(suitability));
                update.setString(3, sizeGuide == null ? null : mapper.writeValueAsString(sizeGuide));
                update.setString(4, id);
                update.executeUpdate();
            }
        }

        System.out.printf(
                "[V328] extracted %d suitability + %d sizeGuide block(s) out of description_blocks into "
                        + "dedicated columns%n",
                suitabilityExtracted, sizeGuideExtracted);
    }

    /** Bỏ discriminator {@code type} — 2 field mới không còn đa hình, không cần field này. */
    private JsonNode toSection(JsonNode block) {
        ObjectNode copy = block.deepCopy();
        copy.remove("type");
        return copy;
    }
}
