package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
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
 * Gộp 3 mục "Ưu/Nhược điểm" + "Phù hợp với ai" + "Bảng size" — vốn nhập tách rời — vào trình dựng mô tả
 * sản phẩm dưới dạng KHỐI ({@code prosCons} / {@code suitability} / {@code sizeGuide}) trong
 * {@code products.description_blocks} (vi) và {@code description_blocks_en} (en).
 *
 * <p>Nguồn cũ:
 * <ul>
 *   <li>Ưu/Nhược điểm → bảng con {@code product_highlights} (kind PRO/CON, song ngữ inline).</li>
 *   <li>Phù hợp với ai (V240) → cột {@code suitability_advisory} / {@code suitability_advisory_en} (JSON thẻ).</li>
 *   <li>Bảng size → cột {@code size_guide} (HTML tự do, chỉ tiếng Việt).</li>
 * </ul>
 *
 * <p>An toàn:
 * <ul>
 *   <li><b>Chỉ append, không ghi đè</b>: khối mới thêm vào cuối danh sách khối hiện có.</li>
 *   <li><b>Idempotent</b>: nếu danh sách đã có khối cùng loại thì bỏ qua; chỉ UPDATE khi JSON đổi.</li>
 *   <li><b>Không phá huỷ</b>: KHÔNG drop bảng/cột cũ — dữ liệu nguồn giữ lại làm lưới an toàn
 *       (đã thôi đọc/ghi ở code; có thể drop ở migration sau khi đã kiểm chứng).</li>
 *   <li>Bản EN chỉ thêm khi có nội dung EN — tránh tạo bản dịch giả.</li>
 * </ul>
 */
public class V246__MigrateProductSectionsToBlocks extends BaseJavaMigration {

    private static final TypeReference<List<DescriptionBlock>> BLOCK_LIST = new TypeReference<>() {};

    @Override
    public void migrate(Context context) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        Connection conn = context.getConnection();

        // 1) Nạp ưu/nhược điểm theo product (PRO/CON, sort_order).
        Map<String, List<String[]>> highlightsByProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, kind, content, content_en FROM product_highlights ORDER BY kind, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                highlightsByProduct
                        .computeIfAbsent(rs.getString("product_id"), k -> new ArrayList<>())
                        .add(new String[]{rs.getString("kind"), rs.getString("content"), rs.getString("content_en")});
            }
        }

        // 2) Nạp sản phẩm.
        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, description_blocks, description_blocks_en,"
                + " size_guide, suitability_advisory, suitability_advisory_en FROM products");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("id"),
                        rs.getString("description_blocks"),
                        rs.getString("description_blocks_en"),
                        rs.getString("size_guide"),
                        rs.getString("suitability_advisory"),
                        rs.getString("suitability_advisory_en"),
                });
            }
        }

        int viUpdated = 0;
        int enUpdated = 0;

        try (PreparedStatement upVi = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb WHERE id = ?");
             PreparedStatement upEn = conn.prepareStatement(
                "UPDATE products SET description_blocks_en = ?::jsonb WHERE id = ?")) {

            for (String[] row : rows) {
                String id = row[0];
                List<String[]> highlights = highlightsByProduct.getOrDefault(id, List.of());

                // ---- VI ----
                List<DescriptionBlock> vi = parseBlocks(mapper, row[1]);
                boolean viChanged = false;
                if (!hasType(vi, DescriptionBlock.ProsConsBlock.class)) {
                    DescriptionBlock pc = buildProsCons(highlights, false);
                    if (pc != null) { vi.add(pc); viChanged = true; }
                }
                if (!hasType(vi, DescriptionBlock.SuitabilityBlock.class)) {
                    DescriptionBlock su = buildSuitability(mapper, row[4]);
                    if (su != null) { vi.add(su); viChanged = true; }
                }
                if (!hasType(vi, DescriptionBlock.SizeGuideBlock.class)) {
                    DescriptionBlock sg = buildSizeGuide(row[3]);
                    if (sg != null) { vi.add(sg); viChanged = true; }
                }
                if (viChanged) {
                    upVi.setString(1, mapper.writeValueAsString(vi));
                    upVi.setString(2, id);
                    upVi.executeUpdate();
                    viUpdated++;
                }

                // ---- EN (chỉ khi có nội dung EN) ----
                List<DescriptionBlock> en = parseBlocks(mapper, row[2]);
                boolean enChanged = false;
                if (!hasType(en, DescriptionBlock.ProsConsBlock.class)) {
                    DescriptionBlock pc = buildProsCons(highlights, true);
                    if (pc != null) { en.add(pc); enChanged = true; }
                }
                if (!hasType(en, DescriptionBlock.SuitabilityBlock.class)) {
                    DescriptionBlock su = buildSuitability(mapper, row[5]);
                    if (su != null) { en.add(su); enChanged = true; }
                }
                // sizeGuide chỉ có tiếng Việt → không thêm khối EN.
                if (enChanged) {
                    upEn.setString(1, mapper.writeValueAsString(en));
                    upEn.setString(2, id);
                    upEn.executeUpdate();
                    enUpdated++;
                }
            }
        }

        System.out.printf("[V246] products: %d vi block-lists, %d en block-lists updated%n", viUpdated, enUpdated);
    }

    private List<DescriptionBlock> parseBlocks(ObjectMapper mapper, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return new ArrayList<>();
        List<DescriptionBlock> list = mapper.readValue(json, BLOCK_LIST);
        return list == null ? new ArrayList<>() : new ArrayList<>(list);
    }

    private static boolean hasType(List<DescriptionBlock> blocks, Class<? extends DescriptionBlock> type) {
        return blocks.stream().anyMatch(type::isInstance);
    }

    /** Dựng khối prosCons từ product_highlights. {@code en}=true → lấy content_en. Null nếu rỗng. */
    private DescriptionBlock buildProsCons(List<String[]> highlights, boolean en) {
        List<String> positive = new ArrayList<>();
        List<String> negative = new ArrayList<>();
        for (String[] h : highlights) {
            String kind = h[0];
            String value = en ? h[2] : h[1];
            if (value == null || value.isBlank()) continue;
            if ("PRO".equals(kind)) positive.add(value.strip());
            else if ("CON".equals(kind)) negative.add(value.strip());
        }
        if (positive.isEmpty() && negative.isEmpty()) return null;
        return DescriptionBlock.ProsConsBlock.builder()
                .type("prosCons")
                .positive(positive)
                .negative(negative)
                .build();
    }

    /** Dựng khối suitability từ JSON thẻ cũ ({@code [{audience,advice,linkLabel,linkUrl}]}). Null nếu rỗng. */
    private DescriptionBlock buildSuitability(ObjectMapper mapper, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return null;
        JsonNode root = mapper.readTree(json);
        if (root == null || !root.isArray() || root.isEmpty()) return null;
        List<DescriptionBlock.SuitabilityBlock.SuitabilityCard> cards = new ArrayList<>();
        for (JsonNode node : root) {
            String audience = text(node, "audience");
            String advice = text(node, "advice");
            String linkLabel = text(node, "linkLabel");
            String linkUrl = text(node, "linkUrl");
            if (audience == null && advice == null && (linkLabel == null || linkUrl == null)) continue;
            cards.add(DescriptionBlock.SuitabilityBlock.SuitabilityCard.builder()
                    .audience(audience).advice(advice).linkLabel(linkLabel).linkUrl(linkUrl).build());
        }
        if (cards.isEmpty()) return null;
        return DescriptionBlock.SuitabilityBlock.builder().type("suitability").cards(cards).build();
    }

    /** Dựng khối sizeGuide từ HTML cũ. Null nếu rỗng. */
    private DescriptionBlock buildSizeGuide(String html) {
        if (html == null || html.isBlank()) return null;
        return DescriptionBlock.SizeGuideBlock.builder().type("sizeGuide").html(html.strip()).build();
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText();
        return (s == null || s.isBlank()) ? null : s.strip();
    }
}
