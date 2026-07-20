package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

/**
 * Owner decision 2026-07-20: trình soạn mô tả sản phẩm (menu {@code PRODUCT_MENU}) và luồng Import
 * file thu hẹp còn ĐÚNG 1 loại khối cho {@code descriptionBlocks} — {@code feature} (ảnh phải + chữ
 * trái / ảnh trái + chữ phải). Trước đó (owner decision 2026-07-15) menu còn 4 lựa chọn gồm cả
 * {@code paragraph}/{@code image}. Migration này chuyển TOÀN BỘ khối {@code paragraph}/{@code image}
 * còn sót trong {@code products.description_blocks} của mọi sản phẩm thành khối {@code feature} tương
 * đương — {@code paragraph} → feature chữ-thuần (chỉ field {@code html}/{@code htmlEn}), {@code image}
 * → feature ảnh-thuần (chỉ field {@code url}/{@code alt}/{@code altEn}/{@code caption}/
 * {@code captionEn}) — để sau migration không sản phẩm nào còn khối thuộc 2 loại đã gỡ khỏi menu.
 * {@code side} gán so le {@code right}/{@code left} theo vị trí khối trong mảng (bắt đầu {@code right}
 * ở vị trí 0) — {@code FeatureBlock} không bắt buộc field nào riêng lẻ nên khối chữ-thuần/ảnh-thuần
 * vẫn hợp lệ, và {@code side} chỉ ảnh hưởng render khi khối có CẢ ảnh lẫn chữ.
 *
 * <p>Đọc bằng {@code JsonNode} thô qua JDBC trực tiếp (không dùng class {@code DescriptionBlock}),
 * cùng kỹ thuật đã dùng ở V326/V328 — tránh phụ thuộc ngược vào sealed interface đã đổi trong cùng
 * lần deploy (PRODUCT_MENU/Import validation ở đây chỉ còn nhận {@code feature}, parse bằng class đó
 * sẽ không phản ánh đúng dữ liệu {@code paragraph}/{@code image} cũ cần migration).
 *
 * <p>Khối {@code feature} có sẵn được giữ nguyên hoàn toàn — theo {@code FeatureBlockEditor.jsx}, khối
 * feature của SẢN PHẨM chỉ từng được tạo với {@code side} là {@code left}/{@code right} (chưa từng
 * dùng {@code auto} cho sản phẩm), không cần chuẩn hoá thêm.
 *
 * <p>Owner decision 2026-07-20 (bổ sung, sau khi phát hiện sản phẩm {@code TNB-SCS-Q5} còn khối
 * {@code heading}/{@code list} sót lại từ trước đợt thu hẹp menu): 2 loại này cũng được gộp về
 * {@code feature} chữ-thuần — {@code heading} → {@code html}/{@code htmlEn} là 1 đoạn {@code <p><strong>}
 * bọc nguyên văn {@code text}/{@code textEn}; {@code list} → {@code html}/{@code htmlEn} là 1 danh sách
 * {@code <ul>} ({@code <ol>} nếu {@code style} là {@code numbered}) bọc từng phần tử {@code items}/
 * {@code itemsEn} trong {@code <li>}, ký tự {@code & < >} được escape. Không giữ lại cấu trúc gốc
 * ({@code level} của heading, {@code style} của list) vì {@code FeatureBlock} không có field tương ứng —
 * chấp nhận mất thông tin trình bày, giữ nguyên nội dung chữ.
 *
 * <p>Loại khối khác ({@code video}/{@code callout}/{@code divider}/{@code prosCons} dormant/
 * {@code suitability}/{@code sizeGuide} — 2 loại cuối lẽ ra đã bị V327/V328 tách hết) gặp trong
 * {@code description_blocks} của sản phẩm vẫn là hình dạng dữ liệu ngoài phạm vi đã audit → NÉM LỖI,
 * rollback toàn bộ, không đoán mò.
 */
public class V343__MigrateLegacyDescriptionBlocksToFeature extends BaseJavaMigration {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
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

        int productsChanged = 0;
        int paragraphConverted = 0;
        int imageConverted = 0;
        int headingConverted = 0;
        int listConverted = 0;
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb WHERE id = ?")) {
            for (String[] row : rows) {
                String id = row[0];
                String sku = row[1];
                String json = row[2];
                if (json == null || json.isBlank() || "null".equals(json.strip())) continue;

                JsonNode root = mapper.readTree(json);
                if (root == null || root.isNull()) continue;
                if (!root.isArray()) {
                    throw new IllegalStateException("V343: product " + sku
                            + " has non-array description_blocks — shape outside the audited categories, "
                            + "aborting migration.");
                }

                boolean changed = false;
                ArrayNode out = mapper.createArrayNode();
                int index = 0;
                for (JsonNode block : root) {
                    String type = block.path("type").asText(null);
                    String side = index % 2 == 0 ? "right" : "left";
                    switch (type == null ? "" : type) {
                        case "paragraph" -> {
                            out.add(paragraphToFeature(block, side));
                            paragraphConverted++;
                            changed = true;
                        }
                        case "image" -> {
                            out.add(imageToFeature(block, side));
                            imageConverted++;
                            changed = true;
                        }
                        case "heading" -> {
                            out.add(headingToFeature(block, side));
                            headingConverted++;
                            changed = true;
                        }
                        case "list" -> {
                            out.add(listToFeature(block, side));
                            listConverted++;
                            changed = true;
                        }
                        case "feature" -> out.add(block);
                        default -> throw new IllegalStateException("V343: product " + sku
                                + " has description_blocks[" + index + "] with unexpected type '" + type
                                + "' — shape outside the audited categories, aborting migration.");
                    }
                    index++;
                }

                if (!changed) continue;

                update.setString(1, mapper.writeValueAsString(out));
                update.setString(2, id);
                update.executeUpdate();
                productsChanged++;
            }
        }

        System.out.printf(
                "[V343] migrated %d product(s): %d paragraph + %d image + %d heading + %d list block(s) converted to feature%n",
                productsChanged, paragraphConverted, imageConverted, headingConverted, listConverted);
    }

    /** paragraph → feature chữ-thuần: chỉ mang html/htmlEn, mọi field ảnh để null. */
    private ObjectNode paragraphToFeature(JsonNode paragraph, String side) {
        ObjectNode feature = mapper.createObjectNode();
        feature.put("type", "feature");
        feature.put("side", side);
        feature.set("url", NullNode.getInstance());
        feature.set("alt", NullNode.getInstance());
        feature.set("altEn", NullNode.getInstance());
        feature.set("caption", NullNode.getInstance());
        feature.set("captionEn", NullNode.getInstance());
        feature.set("subheading", NullNode.getInstance());
        feature.set("subheadingEn", NullNode.getInstance());
        feature.set("heading", NullNode.getInstance());
        feature.set("headingEn", NullNode.getInstance());
        feature.set("html", textOrNull(paragraph, "html"));
        feature.set("htmlEn", textOrNull(paragraph, "htmlEn"));
        return feature;
    }

    /** image → feature ảnh-thuần: chỉ mang url/alt/caption (+ En), mọi field chữ để null. */
    private ObjectNode imageToFeature(JsonNode image, String side) {
        ObjectNode feature = mapper.createObjectNode();
        feature.put("type", "feature");
        feature.put("side", side);
        feature.set("url", textOrNull(image, "url"));
        feature.set("alt", textOrNull(image, "alt"));
        feature.set("altEn", textOrNull(image, "altEn"));
        feature.set("caption", textOrNull(image, "caption"));
        feature.set("captionEn", textOrNull(image, "captionEn"));
        feature.set("subheading", NullNode.getInstance());
        feature.set("subheadingEn", NullNode.getInstance());
        feature.set("heading", NullNode.getInstance());
        feature.set("headingEn", NullNode.getInstance());
        feature.set("html", NullNode.getInstance());
        feature.set("htmlEn", NullNode.getInstance());
        return feature;
    }

    /** heading → feature chữ-thuần: text/textEn bọc trong <p><strong>. */
    private ObjectNode headingToFeature(JsonNode heading, String side) {
        ObjectNode feature = mapper.createObjectNode();
        feature.put("type", "feature");
        feature.put("side", side);
        feature.set("url", NullNode.getInstance());
        feature.set("alt", NullNode.getInstance());
        feature.set("altEn", NullNode.getInstance());
        feature.set("caption", NullNode.getInstance());
        feature.set("captionEn", NullNode.getInstance());
        feature.set("subheading", NullNode.getInstance());
        feature.set("subheadingEn", NullNode.getInstance());
        feature.set("heading", NullNode.getInstance());
        feature.set("headingEn", NullNode.getInstance());
        feature.set("html", boldParagraphOrNull(heading, "text"));
        feature.set("htmlEn", boldParagraphOrNull(heading, "textEn"));
        return feature;
    }

    /** list → feature chữ-thuần: items/itemsEn bọc trong <ul>/<ol> theo style. */
    private ObjectNode listToFeature(JsonNode list, String side) {
        ObjectNode feature = mapper.createObjectNode();
        feature.put("type", "feature");
        feature.put("side", side);
        feature.set("url", NullNode.getInstance());
        feature.set("alt", NullNode.getInstance());
        feature.set("altEn", NullNode.getInstance());
        feature.set("caption", NullNode.getInstance());
        feature.set("captionEn", NullNode.getInstance());
        feature.set("subheading", NullNode.getInstance());
        feature.set("subheadingEn", NullNode.getInstance());
        feature.set("heading", NullNode.getInstance());
        feature.set("headingEn", NullNode.getInstance());
        String tag = "numbered".equals(list.path("style").asText(null)) ? "ol" : "ul";
        feature.set("html", listHtmlOrNull(list, "items", tag));
        feature.set("htmlEn", listHtmlOrNull(list, "itemsEn", tag));
        return feature;
    }

    private JsonNode boldParagraphOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull() || v.asText().isBlank()) return NullNode.getInstance();
        return new TextNode("<p><strong>" + escapeHtml(v.asText()) + "</strong></p>");
    }

    private JsonNode listHtmlOrNull(JsonNode node, String itemsField, String tag) {
        JsonNode items = node.get(itemsField);
        if (items == null || items.isNull() || !items.isArray() || items.isEmpty()) return NullNode.getInstance();
        StringBuilder sb = new StringBuilder("<").append(tag).append(">");
        for (JsonNode item : items) {
            sb.append("<li>").append(escapeHtml(item.asText(""))).append("</li>");
        }
        sb.append("</").append(tag).append(">");
        return new TextNode(sb.toString());
    }

    private String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private JsonNode textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? NullNode.getInstance() : v;
    }
}
