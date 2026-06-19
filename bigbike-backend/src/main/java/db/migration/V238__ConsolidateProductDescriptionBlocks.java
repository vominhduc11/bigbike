package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.fasterxml.jackson.core.type.TypeReference;
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
 * Gộp các khối mô tả SẢN PHẨM về vốn từ 4 khối của trình soạn mới (V238):
 * {@code paragraph} (rich-text), {@code image}, và {@code feature} (ảnh + chữ, side left/right).
 *
 * <p>Các loại khối đứng riêng {@code heading} / {@code list} / {@code callout} / {@code divider} /
 * {@code video} không còn được tạo cho sản phẩm. Dữ liệu cũ (chủ yếu là mô tả nhập từ web cũ) được
 * gộp KHÔNG MẤT NỘI DUNG: mỗi "mục" (một tiêu đề + các đoạn/danh sách/ghi chú đi liền sau) gộp thành
 * MỘT khối {@code paragraph} chứa HTML đầy đủ (TipTap hỗ trợ {@code h2/h3/ul/ol/blockquote}); khối
 * {@code divider} bị bỏ (web tự kẻ vạch giữa các khối); {@code image}/{@code feature} giữ nguyên;
 * {@code video} hiếm (0 trên sản phẩm) → chuyển thành đoạn có link.
 *
 * <p>Phạm vi: {@code products.description_blocks}, {@code description_blocks_en}, và các tab tự do
 * trong {@code products.product_tabs} ({@code blocks} / {@code blocksEn}).
 *
 * <p>Sealed interface {@link DescriptionBlock} VẪN giữ đủ subtype vì dùng chung với Content
 * (Article/Page/Contact) — migration này chỉ dọn DỮ LIỆU sản phẩm.
 *
 * <p>An toàn: idempotent — chỉ UPDATE khi mảng khối thực sự đổi sau khi gộp (so sánh JSON chuẩn hoá
 * qua cùng một {@link ObjectMapper}); chạy lại lần 2 không đổi gì.
 */
public class V238__ConsolidateProductDescriptionBlocks extends BaseJavaMigration {

    private static final TypeReference<List<DescriptionBlock>> BLOCK_LIST = new TypeReference<>() {};

    @Override
    public void migrate(Context context) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        Connection conn = context.getConnection();

        int productsUpdated = 0;
        int tabsUpdated = 0;

        List<String[]> rows = new ArrayList<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT id, description_blocks, description_blocks_en, product_tabs FROM products");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                rows.add(new String[]{
                        rs.getString("id"),
                        rs.getString("description_blocks"),
                        rs.getString("description_blocks_en"),
                        rs.getString("product_tabs"),
                });
            }
        }

        try (PreparedStatement upBlocks = conn.prepareStatement(
                "UPDATE products SET description_blocks = ?::jsonb WHERE id = ?");
             PreparedStatement upBlocksEn = conn.prepareStatement(
                "UPDATE products SET description_blocks_en = ?::jsonb WHERE id = ?");
             PreparedStatement upTabs = conn.prepareStatement(
                "UPDATE products SET product_tabs = ?::jsonb WHERE id = ?")) {

            for (String[] row : rows) {
                String id = row[0];

                String newBlocks = consolidateJson(mapper, row[1]);
                if (newBlocks != null) {
                    upBlocks.setString(1, newBlocks);
                    upBlocks.setString(2, id);
                    upBlocks.executeUpdate();
                    productsUpdated++;
                }

                String newBlocksEn = consolidateJson(mapper, row[2]);
                if (newBlocksEn != null) {
                    upBlocksEn.setString(1, newBlocksEn);
                    upBlocksEn.setString(2, id);
                    upBlocksEn.executeUpdate();
                }

                String newTabs = consolidateTabsJson(mapper, row[3]);
                if (newTabs != null) {
                    upTabs.setString(1, newTabs);
                    upTabs.setString(2, id);
                    upTabs.executeUpdate();
                    tabsUpdated++;
                }
            }
        }

        System.out.printf("[V238] products: %d description rewritten, %d tab-sets rewritten%n",
                productsUpdated, tabsUpdated);
    }

    /**
     * Gộp một mảng khối JSON. Trả về JSON mới nếu thay đổi, hoặc {@code null} nếu giữ nguyên / rỗng.
     */
    private String consolidateJson(ObjectMapper mapper, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return null;
        List<DescriptionBlock> in = mapper.readValue(json, BLOCK_LIST);
        if (in == null || in.isEmpty()) return null;

        String before = mapper.writeValueAsString(in);
        List<DescriptionBlock> out = consolidate(in);
        String after = mapper.writeValueAsString(out);
        return before.equals(after) ? null : after;
    }

    /** Gộp khối trong các tab tự do của {@code product_tabs}. Trả về JSON mới hoặc {@code null}. */
    private String consolidateTabsJson(ObjectMapper mapper, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return null;
        JsonNode root = mapper.readTree(json);
        if (root == null || !root.isArray()) return null;

        boolean changed = false;
        for (JsonNode tab : root) {
            if (!(tab instanceof ObjectNode tabNode)) continue;
            changed |= consolidateTabField(mapper, tabNode, "blocks");
            changed |= consolidateTabField(mapper, tabNode, "blocksEn");
        }
        return changed ? mapper.writeValueAsString(root) : null;
    }

    private boolean consolidateTabField(ObjectMapper mapper, ObjectNode tabNode, String field) {
        JsonNode arr = tabNode.get(field);
        if (arr == null || !arr.isArray() || arr.isEmpty()) return false;
        List<DescriptionBlock> in = mapper.convertValue(arr, BLOCK_LIST);
        String before = arrToJson(mapper, in);
        List<DescriptionBlock> out = consolidate(in);
        String after = arrToJson(mapper, out);
        if (before.equals(after)) return false;
        tabNode.set(field, mapper.valueToTree(out));
        return true;
    }

    private static String arrToJson(ObjectMapper mapper, Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Quy tắc gộp: tích luỹ các khối CHỮ (heading/paragraph/list/callout) vào một bộ đệm HTML, flush
     * thành MỘT {@code paragraph} khi gặp tiêu đề mới (mở mục mới), {@code divider}, hoặc khối media.
     */
    private List<DescriptionBlock> consolidate(List<DescriptionBlock> in) {
        List<DescriptionBlock> out = new ArrayList<>();
        StringBuilder buf = new StringBuilder();

        for (DescriptionBlock block : in) {
            if (block instanceof DescriptionBlock.HeadingBlock h) {
                flush(out, buf);                       // mỗi tiêu đề mở một mục mới
                int level = h.getLevel() != null ? h.getLevel() : 2;
                String tag = level == 3 ? "h3" : "h2";
                buf.append('<').append(tag).append('>')
                   .append(escape(h.getText())).append("</").append(tag).append('>');
            } else if (block instanceof DescriptionBlock.ParagraphBlock p) {
                appendHtml(buf, p.getHtml());
            } else if (block instanceof DescriptionBlock.ListBlock l) {
                buf.append(renderList(l.getStyle(), l.getItems()));
            } else if (block instanceof DescriptionBlock.CalloutBlock c) {
                if (c.getHtml() != null && !c.getHtml().isBlank()) {
                    buf.append("<blockquote>").append(c.getHtml().strip()).append("</blockquote>");
                }
            } else if (block instanceof DescriptionBlock.DividerBlock) {
                flush(out, buf);                       // bỏ đường kẻ, web tự kẻ vạch giữa khối
            } else if (block instanceof DescriptionBlock.VideoBlock v) {
                flush(out, buf);
                String url = v.getUrl() != null ? v.getUrl().strip() : "";
                if (!url.isEmpty()) {
                    out.add(DescriptionBlock.ParagraphBlock.builder()
                            .type("paragraph")
                            .html("<p><a href=\"" + escapeAttr(url) + "\">" + escape(url) + "</a></p>")
                            .build());
                }
            } else if (block instanceof DescriptionBlock.ImageBlock) {
                flush(out, buf);
                out.add(block);
            } else if (block instanceof DescriptionBlock.FeatureBlock) {
                flush(out, buf);
                out.add(block);
            }
            // các loại khác (không có) bị bỏ qua an toàn
        }
        flush(out, buf);
        return out;
    }

    private void flush(List<DescriptionBlock> out, StringBuilder buf) {
        String html = buf.toString().strip();
        buf.setLength(0);
        if (html.isEmpty()) return;
        out.add(DescriptionBlock.ParagraphBlock.builder().type("paragraph").html(html).build());
    }

    /** Nối html của khối paragraph cũ, đảm bảo bọc thẻ khối để HTML gộp hợp lệ. */
    private void appendHtml(StringBuilder buf, String html) {
        if (html == null) return;
        String trimmed = html.strip();
        if (trimmed.isEmpty()) return;
        if (trimmed.startsWith("<")) {
            buf.append(trimmed);
        } else {
            buf.append("<p>").append(trimmed).append("</p>");
        }
    }

    private String renderList(String style, List<String> items) {
        if (items == null || items.isEmpty()) return "";
        String tag = "numbered".equals(style) ? "ol" : "ul";
        StringBuilder sb = new StringBuilder("<").append(tag).append('>');
        for (String item : items) {
            if (item != null && !item.isBlank()) {
                sb.append("<li>").append(escape(item)).append("</li>");
            }
        }
        return sb.append("</").append(tag).append('>').toString();
    }

    private static String escape(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("\"", "&quot;")
                .replace("<", "&lt;").replace(">", "&gt;");
    }
}
