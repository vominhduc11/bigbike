package db.migration;

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
 * Backfill {@code specifications_html}/{@code spec_stats_html}/{@code trust_badges_html} (+ their
 * {@code *_en} siblings) from the legacy structured tables {@code product_specifications}/
 * {@code product_spec_stats}/{@code product_trust_badges}, for any product where the HTML column is
 * still blank. Ports the exact serialize logic (markup + escaping) from the admin's
 * {@code lib/specSheet.js} / {@code specStatsBlock.js} / {@code trustBadgesBlock.js} so the rendered
 * PDP doesn't change. Prerequisite for {@code V330} dropping the 3 structured tables.
 *
 * <p>Đã audit dữ liệu thật trước khi viết migration này (225 sản phẩm, Postgres đang chạy):
 * {@code product_specifications} 95 dòng / 6 sản phẩm, {@code product_spec_stats} 17 dòng / 5 sản
 * phẩm, {@code product_trust_badges} 12 dòng / 4 sản phẩm — TẤT CẢ (6/6, 5/5, 4/4) sản phẩm này đã
 * có sẵn {@code *_html}/{@code *_html_en} không rỗng (admin đã tay-serialize từ trước khi migration
 * này được viết), nên trên dữ liệu hiện tại migration này backfill 0 sản phẩm — vẫn viết đầy đủ để
 * làm lưới an toàn cho môi trường khác có dữ liệu khác, và làm bước "xác nhận trước khi xoá bảng".
 * {@code group_name}/{@code group_name_en} rỗng trên toàn bộ 95 dòng {@code product_specifications}
 * đã audit — logic serialize (giống hệt {@code specSheet.js}) không dùng 2 field này, nên nếu một
 * môi trường khác có dữ liệu không rỗng ở đây, migration NÉM LỖI thay vì âm thầm bỏ dữ liệu.
 */
public class V329__BackfillProductHtmlOnlySections extends BaseJavaMigration {

    private record SpecRow(String name, String value, String groupName,
                            String nameEn, String valueEn, String groupNameEn) {}
    private record StatRow(String value, String label, String valueEn, String labelEn) {}
    private record BadgeRow(String content, String contentEn) {}

    private static final String GRID_STYLE =
            "display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;"
                    + "border:1px solid var(--color-border,#e5e7eb);background:var(--color-border,#e5e7eb)";
    private static final String BOX_STYLE =
            "display:flex;flex-direction:column;align-items:center;gap:4px;"
                    + "background:var(--color-background,#ffffff);padding:24px 16px;text-align:center";
    private static final String VALUE_STYLE =
            "font-weight:700;font-size:24px;line-height:1;text-transform:uppercase;color:var(--color-brand,#e8281e)";
    private static final String LABEL_STYLE =
            "font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;"
                    + "color:var(--color-muted-foreground,#6b7280);opacity:0.72";
    private static final String ROW_STYLE =
            "display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;"
                    + "font-size:14px;color:var(--color-muted-foreground,#6b7280)";
    private static final String BADGE_STYLE = "display:flex;align-items:center;gap:8px";
    private static final String DOT_STYLE = "height:6px;width:6px;flex:none;background:var(--color-brand,#e8281e)";

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        int specs = backfillSpecifications(conn);
        int specStats = backfillSpecStats(conn);
        int trustBadges = backfillTrustBadges(conn);
        System.out.printf(
                "[V329] backfilled specificationsHtml for %d, specStatsHtml for %d, trustBadgesHtml for %d product(s)%n",
                specs, specStats, trustBadges);
    }

    private int backfillSpecifications(Connection conn) throws Exception {
        Map<String, List<SpecRow>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, name, spec_value, group_name, name_en, spec_value_en, group_name_en "
                        + "FROM product_specifications ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                String groupName = rs.getString("group_name");
                String groupNameEn = rs.getString("group_name_en");
                if (!isBlank(groupName) || !isBlank(groupNameEn)) {
                    throw new IllegalStateException("V329: product " + productId
                            + " has a non-blank group_name on product_specifications — outside the audited "
                            + "shape (the serialize logic drops this field), aborting migration.");
                }
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new SpecRow(
                        rs.getString("name"), rs.getString("spec_value"), groupName,
                        rs.getString("name_en"), rs.getString("spec_value_en"), groupNameEn));
            }
        }

        int updated = 0;
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT specifications_html, specifications_html_en FROM products WHERE id = ?");
             PreparedStatement update = conn.prepareStatement(
                     "UPDATE products SET specifications_html = ?, specifications_html_en = ? WHERE id = ?")) {
            for (Map.Entry<String, List<SpecRow>> entry : byProduct.entrySet()) {
                String productId = entry.getKey();
                List<SpecRow> rows = entry.getValue();

                select.setString(1, productId);
                String currentHtml;
                String currentHtmlEn;
                try (ResultSet rs = select.executeQuery()) {
                    if (!rs.next()) continue;
                    currentHtml = rs.getString(1);
                    currentHtmlEn = rs.getString(2);
                }

                boolean needsVi = isBlank(currentHtml);
                boolean needsEn = isBlank(currentHtmlEn);
                if (!needsVi && !needsEn) continue;

                String finalHtml = needsVi ? serializeSpecsHtml(rows, false) : currentHtml;
                String finalHtmlEn = needsEn ? serializeSpecsHtml(rows, true) : currentHtmlEn;

                update.setString(1, finalHtml);
                update.setString(2, finalHtmlEn);
                update.setString(3, productId);
                update.executeUpdate();
                updated++;
            }
        }
        return updated;
    }

    private int backfillSpecStats(Connection conn) throws Exception {
        Map<String, List<StatRow>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, stat_value, label, stat_value_en, label_en "
                        + "FROM product_spec_stats ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new StatRow(
                        rs.getString("stat_value"), rs.getString("label"),
                        rs.getString("stat_value_en"), rs.getString("label_en")));
            }
        }

        int updated = 0;
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT spec_stats_html, spec_stats_html_en FROM products WHERE id = ?");
             PreparedStatement update = conn.prepareStatement(
                     "UPDATE products SET spec_stats_html = ?, spec_stats_html_en = ? WHERE id = ?")) {
            for (Map.Entry<String, List<StatRow>> entry : byProduct.entrySet()) {
                String productId = entry.getKey();
                List<StatRow> rows = entry.getValue();

                select.setString(1, productId);
                String currentHtml;
                String currentHtmlEn;
                try (ResultSet rs = select.executeQuery()) {
                    if (!rs.next()) continue;
                    currentHtml = rs.getString(1);
                    currentHtmlEn = rs.getString(2);
                }

                boolean needsVi = isBlank(currentHtml);
                boolean needsEn = isBlank(currentHtmlEn);
                if (!needsVi && !needsEn) continue;

                String finalHtml = needsVi ? serializeSpecStatsHtml(rows, false) : currentHtml;
                String finalHtmlEn = needsEn ? serializeSpecStatsHtml(rows, true) : currentHtmlEn;

                update.setString(1, finalHtml);
                update.setString(2, finalHtmlEn);
                update.setString(3, productId);
                update.executeUpdate();
                updated++;
            }
        }
        return updated;
    }

    private int backfillTrustBadges(Connection conn) throws Exception {
        Map<String, List<BadgeRow>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, content, content_en "
                        + "FROM product_trust_badges ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new BadgeRow(
                        rs.getString("content"), rs.getString("content_en")));
            }
        }

        int updated = 0;
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT trust_badges_html, trust_badges_html_en FROM products WHERE id = ?");
             PreparedStatement update = conn.prepareStatement(
                     "UPDATE products SET trust_badges_html = ?, trust_badges_html_en = ? WHERE id = ?")) {
            for (Map.Entry<String, List<BadgeRow>> entry : byProduct.entrySet()) {
                String productId = entry.getKey();
                List<BadgeRow> rows = entry.getValue();

                select.setString(1, productId);
                String currentHtml;
                String currentHtmlEn;
                try (ResultSet rs = select.executeQuery()) {
                    if (!rs.next()) continue;
                    currentHtml = rs.getString(1);
                    currentHtmlEn = rs.getString(2);
                }

                boolean needsVi = isBlank(currentHtml);
                boolean needsEn = isBlank(currentHtmlEn);
                if (!needsVi && !needsEn) continue;

                String finalHtml = needsVi ? serializeTrustBadgesHtml(rows, false) : currentHtml;
                String finalHtmlEn = needsEn ? serializeTrustBadgesHtml(rows, true) : currentHtmlEn;

                update.setString(1, finalHtml);
                update.setString(2, finalHtmlEn);
                update.setString(3, productId);
                update.executeUpdate();
                updated++;
            }
        }
        return updated;
    }

    /** Mirrors {@code specSheet.js}'s {@code serializeSpecs}. */
    private static String serializeSpecsHtml(List<SpecRow> rows, boolean en) {
        StringBuilder trs = new StringBuilder();
        for (SpecRow row : rows) {
            String name = (en ? nullToEmpty(row.nameEn()) : nullToEmpty(row.name())).trim();
            String value = (en ? nullToEmpty(row.valueEn()) : nullToEmpty(row.value())).trim();
            if (name.isEmpty() && value.isEmpty()) continue;
            trs.append("<tr><th scope=\"row\">").append(escapeHtml(name)).append("</th><td>")
                    .append(escapeHtml(value)).append("</td></tr>");
        }
        if (trs.length() == 0) return "";
        return "<table class=\"shop_attributes\"><tbody>" + trs + "</tbody></table>";
    }

    /** Mirrors {@code specStatsBlock.js}'s {@code serializeSpecStats}. */
    private static String serializeSpecStatsHtml(List<StatRow> rows, boolean en) {
        StringBuilder boxes = new StringBuilder();
        for (StatRow row : rows) {
            String value = (en ? nullToEmpty(row.valueEn()) : nullToEmpty(row.value())).trim();
            String label = (en ? nullToEmpty(row.labelEn()) : nullToEmpty(row.label())).trim();
            if (value.isEmpty() && label.isEmpty()) continue;
            boxes.append("<div style=\"").append(BOX_STYLE).append("\">")
                    .append("<span style=\"").append(VALUE_STYLE).append("\">").append(escapeHtml(value)).append("</span>")
                    .append("<span style=\"").append(LABEL_STYLE).append("\">").append(escapeHtml(label)).append("</span>")
                    .append("</div>");
        }
        if (boxes.length() == 0) return "";
        return "<div class=\"bb-specstats\" style=\"" + GRID_STYLE + "\">" + boxes + "</div>";
    }

    /** Mirrors {@code trustBadgesBlock.js}'s {@code serializeTrustBadges}. */
    private static String serializeTrustBadgesHtml(List<BadgeRow> rows, boolean en) {
        StringBuilder spans = new StringBuilder();
        for (BadgeRow row : rows) {
            String content = (en ? nullToEmpty(row.contentEn()) : nullToEmpty(row.content())).trim();
            if (content.isEmpty()) continue;
            spans.append("<span style=\"").append(BADGE_STYLE).append("\">")
                    .append("<span style=\"").append(DOT_STYLE).append("\"></span>")
                    .append("<span>").append(escapeHtml(content)).append("</span>")
                    .append("</span>");
        }
        if (spans.length() == 0) return "";
        return "<div class=\"bb-trust-badges\" style=\"" + ROW_STYLE + "\">" + spans + "</div>";
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    /** Mirrors the admin JS helpers' {@code escapeHtml} exactly (order matters: & before &lt;/&gt;). */
    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
