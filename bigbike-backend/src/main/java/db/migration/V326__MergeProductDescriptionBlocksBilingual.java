package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Gộp {@code products.description_blocks} (VI) và {@code description_blocks_en} (EN) thành MỘT
 * mảng duy nhất — mỗi khối giờ mang cả 2 ngôn ngữ ngay trong chính nó (field {@code *En}, xem
 * {@link com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock}), đúng ràng buộc "VI quyết
 * định cấu trúc, EN chỉ dịch" đã áp dụng cho {@code faqs}/{@code commitments}/{@code trustBadges}/...
 * Xóa hẳn cột {@code description_blocks_en} sau khi gộp xong.
 *
 * <p>Đã audit dữ liệu thật trước khi viết migration này (225 sản phẩm, Postgres đang chạy):
 * <ul>
 *   <li>222 sản phẩm: số khối VI = EN, khớp type theo đúng vị trí.</li>
 *   <li>2 sản phẩm: mảng EN rỗng hoàn toàn — không có gì để gộp, VI giữ nguyên.</li>
 *   <li>1 sản phẩm ({@code TNB-SCS-S13}): VI có 4 khối (paragraph, feature, suitability, sizeGuide),
 *       EN chỉ có 3 (thiếu khối {@code feature} ở vị trí 1) — xử lý bằng thuật toán 2 con trỏ có so
 *       type bên dưới: gặp lệch type thì giữ khối VI với field {@code *En} để trống, chỉ tiến con
 *       trỏ VI, không đụng các khối EN phía sau.</li>
 * </ul>
 *
 * <p>An toàn: nếu sau khi duyệt hết mảng VI mà mảng EN còn khối chưa dùng tới (tức gặp 1 hình dạng
 * dữ liệu nằm ngoài 3 loại đã audit ở trên) thì migration NÉM LỖI, rollback toàn bộ transaction —
 * không đoán mò/gộp liều để tránh làm lệch nội dung.
 *
 * <p><b>NOTE (incident fix, 2026-07-08):</b> đọc bằng {@code JsonNode} thô, KHÔNG dùng
 * {@code TypeReference<List<DescriptionBlock>>} như bản gốc — vì
 * {@code com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock} trong cùng deploy này đã bỏ 2
 * subtype {@code SuitabilityBlock}/{@code SizeGuideBlock} khỏi {@code @JsonSubTypes} (tách ra
 * {@code SuitabilitySection}/{@code SizeGuideSection} độc lập ở V327/V328), nên parse bằng class đó
 * ném lỗi ngay tại mọi hàng còn khối {@code suitability}/{@code sizeGuide} — tức MỌI lần chạy từ đầu
 * trên DB chưa từng áp dụng V326 (fresh bootstrap / DB đang đuổi theo migration), không phải trường
 * hợp hiếm. Cùng kỹ thuật đã áp dụng ở V246/V328 cho đúng vấn đề này (xem javadoc 2 file đó). Field
 * shape của 2 khối lấy từ {@code V246.buildSuitability/buildSizeGuide} + audit trực tiếp dữ liệu thật
 * trên DB đang chạy: {@code suitability = {type, title?, html?, cards?: [{audience?, advice?}]}},
 * {@code sizeGuide = {type, title?, html?}} — nhận {@code titleEn}/{@code htmlEn} (và với suitability,
 * {@code cards[].audienceEn}/{@code adviceEn} gộp theo vị trí) giống mọi khối khác.
 */
public class V326__MergeProductDescriptionBlocksBilingual extends BaseJavaMigration {

    private static final Set<String> KNOWN_TYPES = Set.of(
            "heading", "paragraph", "list", "image", "video", "callout", "divider", "feature",
            "prosCons", "suitability", "sizeGuide");

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();

        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, sku, description_blocks, description_blocks_en FROM products");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("id"),
                        rs.getString("sku"),
                        rs.getString("description_blocks"),
                        rs.getString("description_blocks_en"),
                });
            }
        }

        int merged = 0;
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb WHERE id = ?")) {
            for (String[] row : rows) {
                String id = row[0];
                String sku = row[1];
                ArrayNode vi = readBlocks(sku, "description_blocks", row[2]);
                ArrayNode en = stripKnownOrphanEnBlocks(sku, readBlocks(sku, "description_blocks_en", row[3]));
                if (vi.isEmpty() && en.isEmpty()) continue;

                ArrayNode mergedBlocks = mergeBilingual(sku, vi, en);
                update.setString(1, mapper.writeValueAsString(mergedBlocks));
                update.setString(2, id);
                update.executeUpdate();
                merged++;
            }
        }

        try (PreparedStatement drop = conn.prepareStatement(
                "ALTER TABLE products DROP COLUMN description_blocks_en")) {
            drop.execute();
        }

        System.out.printf(
                "[V326] merged bilingual description blocks for %d product(s); dropped description_blocks_en%n",
                merged);
    }

    private ArrayNode readBlocks(String sku, String column, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return mapper.createArrayNode();
        JsonNode root = mapper.readTree(json);
        if (root == null || root.isNull()) return mapper.createArrayNode();
        if (!root.isArray()) {
            throw new IllegalStateException("V326: product " + sku + " has non-array " + column
                    + " — shape outside the audited categories, aborting migration.");
        }
        return (ArrayNode) root;
    }

    /**
     * {@code TNB-SCS-T2PLUS} (phát hiện khi chạy migration này lần đầu trên DB VPS, 229 sản phẩm —
     * ngoài audit gốc 225 sản phẩm): bản EN có thêm 1 khối {@code paragraph} mở đầu ("QUICK ANSWER")
     * không tồn tại bên VI — nếu ghép mù theo type, khối thừa này sẽ chiếm chỗ của bản dịch đúng
     * (khối {@code paragraph} kế tiếp, vốn là bản dịch thật của VI khối 1 "SẢN PHẨM NÀY LÀ GÌ"), đẩy
     * lệch cặp toàn bộ phần còn lại. Bỏ khối thừa này ra TRƯỚC khi chạy thuật toán 2 con trỏ (để 5
     * khối còn lại của EN khớp type theo đúng vị trí với VI, không còn mơ hồ) — KHÔNG xoá nội dung,
     * chỉ in ra log để con người quyết định có thêm vào bản VI qua admin sau hay không (an toàn hơn
     * là tự chèn 1 khối VI rỗng vào trang sản phẩm đang live).
     */
    private ArrayNode stripKnownOrphanEnBlocks(String sku, ArrayNode en) {
        if (!"TNB-SCS-T2PLUS".equals(sku)) return en;
        if (en.isEmpty() || !"paragraph".equals(en.get(0).path("type").asText(null))) return en;

        JsonNode orphan = en.get(0);
        System.out.printf(
                "[V326] product %s: dropped 1 orphan EN paragraph block with no VI counterpart "
                        + "(not merged, not translated into any block — review manually in admin if this "
                        + "content should be kept): %s%n",
                sku, orphan.path("html").asText(""));

        ArrayNode rest = mapper.createArrayNode();
        for (int i = 1; i < en.size(); i++) rest.add(en.get(i));
        return rest;
    }

    /**
     * Duyệt song song 2 con trỏ: VI là bản gốc (quyết định cấu trúc/thứ tự). Khớp {@code type} ở vị
     * trí hiện tại của cả 2 → gộp field dịch của khối EN vào bản sao khối VI, tiến cả 2 con trỏ.
     * Lệch {@code type} (ca {@code TNB-SCS-S13}) → giữ khối VI chưa dịch, chỉ tiến con trỏ VI. Ném
     * lỗi nếu còn khối EN chưa dùng sau khi duyệt hết VI — hình dạng dữ liệu chưa được audit.
     */
    private ArrayNode mergeBilingual(String sku, ArrayNode vi, ArrayNode en) {
        ArrayNode out = mapper.createArrayNode();
        int j = 0;
        for (JsonNode viBlock : vi) {
            if (j < en.size() && sameType(viBlock, en.get(j))) {
                out.add(mergeBlock(sku, viBlock, en.get(j)));
                j++;
            } else {
                out.add(viBlock);
            }
        }
        if (j < en.size()) {
            throw new IllegalStateException("V326: product " + sku + " has " + (en.size() - j)
                    + " unconsumed EN description block(s) after positional/type merge — "
                    + "shape outside the audited categories, aborting migration.");
        }
        return out;
    }

    private boolean sameType(JsonNode a, JsonNode b) {
        String ta = a.path("type").asText(null);
        String tb = b.path("type").asText(null);
        return ta != null && ta.equals(tb);
    }

    private JsonNode mergeBlock(String sku, JsonNode vi, JsonNode en) {
        String type = vi.path("type").asText(null);
        if (type == null || !KNOWN_TYPES.contains(type)) {
            throw new IllegalStateException("V326: product " + sku + " has unrecognized block type '"
                    + type + "' — shape outside the audited categories, aborting migration.");
        }
        ObjectNode v = (ObjectNode) vi.deepCopy();
        switch (type) {
            case "heading" -> v.set("textEn", textOrNull(en, "text"));
            case "paragraph" -> v.set("htmlEn", textOrNull(en, "html"));
            case "list" -> v.set("itemsEn", nodeOrNull(en, "items"));
            case "image" -> {
                v.set("altEn", textOrNull(en, "alt"));
                v.set("captionEn", textOrNull(en, "caption"));
            }
            case "video" -> v.set("captionEn", textOrNull(en, "caption"));
            case "callout" -> v.set("htmlEn", textOrNull(en, "html"));
            case "feature" -> {
                v.set("altEn", textOrNull(en, "alt"));
                v.set("captionEn", textOrNull(en, "caption"));
                v.set("subheadingEn", textOrNull(en, "subheading"));
                v.set("headingEn", textOrNull(en, "heading"));
                v.set("htmlEn", textOrNull(en, "html"));
                v.set("itemsEn", nodeOrNull(en, "items"));
            }
            case "suitability" -> {
                v.set("titleEn", textOrNull(en, "title"));
                v.set("htmlEn", textOrNull(en, "html"));
                JsonNode viCards = vi.get("cards");
                if (viCards != null && viCards.isArray()) {
                    v.set("cards", mergeSuitabilityCards(sku, (ArrayNode) viCards, en.get("cards")));
                }
            }
            case "sizeGuide" -> {
                v.set("titleEn", textOrNull(en, "title"));
                v.set("htmlEn", textOrNull(en, "html"));
            }
            default -> { /* divider (không nội dung) / prosCons (dormant, V254) — giữ nguyên khối VI */ }
        }
        return v;
    }

    private ArrayNode mergeSuitabilityCards(String sku, ArrayNode viCards, JsonNode enCards) {
        ArrayNode out = mapper.createArrayNode();
        for (int i = 0; i < viCards.size(); i++) {
            JsonNode viCardNode = viCards.get(i);
            if (!viCardNode.isObject()) {
                throw new IllegalStateException("V326: product " + sku
                        + " has a non-object suitability card — shape outside the audited categories, "
                        + "aborting migration.");
            }
            ObjectNode card = (ObjectNode) viCardNode.deepCopy();
            JsonNode enCard = (enCards != null && enCards.isArray() && i < enCards.size())
                    ? enCards.get(i) : null;
            card.set("audienceEn", enCard == null ? NullNode.getInstance() : textOrNull(enCard, "audience"));
            card.set("adviceEn", enCard == null ? NullNode.getInstance() : textOrNull(enCard, "advice"));
            out.add(card);
        }
        return out;
    }

    private JsonNode textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? NullNode.getInstance() : v;
    }

    private JsonNode nodeOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? NullNode.getInstance() : v.deepCopy();
    }
}
