package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

/**
 * Gộp {@code products.description_blocks} (VI) và {@code description_blocks_en} (EN) thành MỘT
 * mảng duy nhất — mỗi khối giờ mang cả 2 ngôn ngữ ngay trong chính nó (field {@code *En}, xem
 * {@link DescriptionBlock}), đúng ràng buộc "VI quyết định cấu trúc, EN chỉ dịch" đã áp dụng cho
 * {@code faqs}/{@code commitments}/{@code trustBadges}/... Xóa hẳn cột {@code description_blocks_en}
 * sau khi gộp xong.
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
 */
public class V326__MergeProductDescriptionBlocksBilingual extends BaseJavaMigration {

    private static final TypeReference<List<DescriptionBlock>> BLOCK_LIST = new TypeReference<>() {};

    @Override
    public void migrate(Context context) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
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
                List<DescriptionBlock> vi = readBlocks(mapper, row[2]);
                List<DescriptionBlock> en = readBlocks(mapper, row[3]);
                if (vi.isEmpty() && en.isEmpty()) continue;

                List<DescriptionBlock> mergedBlocks = mergeBilingual(sku, vi, en);
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

    private List<DescriptionBlock> readBlocks(ObjectMapper mapper, String json) throws Exception {
        if (json == null || json.isBlank() || "null".equals(json.strip())) return List.of();
        List<DescriptionBlock> blocks = mapper.readValue(json, BLOCK_LIST);
        return blocks == null ? List.of() : blocks;
    }

    /**
     * Duyệt song song 2 con trỏ: VI là bản gốc (quyết định cấu trúc/thứ tự). Khớp {@code type} ở vị
     * trí hiện tại của cả 2 → gộp field dịch của khối EN vào bản sao khối VI, tiến cả 2 con trỏ.
     * Lệch {@code type} (ca {@code TNB-SCS-S13}) → giữ khối VI chưa dịch, chỉ tiến con trỏ VI. Ném
     * lỗi nếu còn khối EN chưa dùng sau khi duyệt hết VI — hình dạng dữ liệu chưa được audit.
     */
    private List<DescriptionBlock> mergeBilingual(String sku, List<DescriptionBlock> vi, List<DescriptionBlock> en) {
        List<DescriptionBlock> out = new ArrayList<>();
        int j = 0;
        for (DescriptionBlock viBlock : vi) {
            if (j < en.size() && sameType(viBlock, en.get(j))) {
                out.add(mergeBlock(viBlock, en.get(j)));
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

    private boolean sameType(DescriptionBlock a, DescriptionBlock b) {
        return a.getType() != null && a.getType().equals(b.getType());
    }

    private DescriptionBlock mergeBlock(DescriptionBlock vi, DescriptionBlock en) {
        if (vi instanceof DescriptionBlock.HeadingBlock v && en instanceof DescriptionBlock.HeadingBlock e) {
            v.setTextEn(e.getText());
            return v;
        }
        if (vi instanceof DescriptionBlock.ParagraphBlock v && en instanceof DescriptionBlock.ParagraphBlock e) {
            v.setHtmlEn(e.getHtml());
            return v;
        }
        if (vi instanceof DescriptionBlock.ListBlock v && en instanceof DescriptionBlock.ListBlock e) {
            v.setItemsEn(e.getItems());
            return v;
        }
        if (vi instanceof DescriptionBlock.ImageBlock v && en instanceof DescriptionBlock.ImageBlock e) {
            v.setAltEn(e.getAlt());
            v.setCaptionEn(e.getCaption());
            return v;
        }
        if (vi instanceof DescriptionBlock.VideoBlock v && en instanceof DescriptionBlock.VideoBlock e) {
            v.setCaptionEn(e.getCaption());
            return v;
        }
        if (vi instanceof DescriptionBlock.CalloutBlock v && en instanceof DescriptionBlock.CalloutBlock e) {
            v.setHtmlEn(e.getHtml());
            return v;
        }
        if (vi instanceof DescriptionBlock.FeatureBlock v && en instanceof DescriptionBlock.FeatureBlock e) {
            v.setAltEn(e.getAlt());
            v.setCaptionEn(e.getCaption());
            v.setSubheadingEn(e.getSubheading());
            v.setHeadingEn(e.getHeading());
            v.setHtmlEn(e.getHtml());
            v.setItemsEn(e.getItems());
            return v;
        }
        // suitability/sizeGuide merge branches removed at V327/V328 (which extracted these 2 types
        // out of DescriptionBlock's sealed interface entirely) so this file keeps compiling — this
        // migration already ran against the real DB before that change (Java migrations in this repo
        // don't override getChecksum(), so Flyway does not re-validate their content on later boots).
        // Historical behavior preserved in comments only: at the time V326 ran, both types were merged
        // the same way as every other block — v.setTitleEn(e.getTitle()); v.setHtmlEn(e.getHtml());
        // (suitability additionally merged cards[] positionally: audienceEn/adviceEn from the EN card).
        // DividerBlock (không có nội dung) / ProsConsBlock (dormant, V254) — giữ nguyên khối VI.
        return vi;
    }
}
