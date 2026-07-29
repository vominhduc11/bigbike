package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Completes REVIEW_RULE_009/011 for data created before the durable first-approval marker
 * and privacy-safe Review audit snapshots existed.
 */
public class V358__BackfillReviewApprovalAndRedactAudit extends BaseJavaMigration {

    private static final List<String> SAFE_AUDIT_FIELDS = List.of(
            "id",
            "productId",
            "productName",
            "productNameEn",
            "productSlug",
            "rating",
            "status",
            "photoCount",
            "version",
            "createdAt",
            "updatedAt",
            "deleted",
            "redacted");

    private final ObjectMapper mapper = JsonMapper.builder().findAndAddModules().build();

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        List<AuditRow> reviewAudits = loadReviewAudits(connection);
        Map<Long, Instant> firstApprovalByReview = new HashMap<>();

        for (AuditRow audit : reviewAudits) {
            ApprovalEvent approval = approvalEvent(audit);
            if (approval != null) {
                firstApprovalByReview.merge(
                        approval.reviewId(), approval.approvedAt(), this::earlier);
            }
        }

        backfillHistoricalApprovals(connection, firstApprovalByReview);
        backfillCurrentlyApprovedReviews(connection);
        redactReviewAudits(connection, reviewAudits);
    }

    private List<AuditRow> loadReviewAudits(Connection connection) throws Exception {
        List<AuditRow> rows = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement("""
                SELECT id, action, before_data, after_data, created_at
                FROM audit_logs
                WHERE resource_type = 'REVIEW'
                ORDER BY created_at ASC, id ASC
                """);
                ResultSet result = select.executeQuery()) {
            while (result.next()) {
                Timestamp createdAt = result.getTimestamp("created_at");
                rows.add(new AuditRow(
                        result.getObject("id"),
                        result.getString("action"),
                        result.getString("before_data"),
                        result.getString("after_data"),
                        createdAt != null ? createdAt.toInstant() : Instant.EPOCH));
            }
        }
        return rows;
    }

    private ApprovalEvent approvalEvent(AuditRow audit) {
        if (!"REVIEW_STATUS_CHANGED".equals(audit.action()) || audit.afterData() == null) {
            return null;
        }
        try {
            JsonNode after = mapper.readTree(audit.afterData());
            if (after == null || !after.isObject()
                    || !"APPROVED".equalsIgnoreCase(after.path("status").asText())) {
                return null;
            }
            Long reviewId = longValue(after.path("id"));
            return reviewId != null ? new ApprovalEvent(reviewId, audit.createdAt()) : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void backfillHistoricalApprovals(
            Connection connection,
            Map<Long, Instant> firstApprovalByReview
    ) throws Exception {
        try (PreparedStatement update = connection.prepareStatement("""
                UPDATE reviews
                SET first_approved_at = ?
                WHERE id = ?
                  AND (first_approved_at IS NULL OR first_approved_at > ?)
                """)) {
            for (Map.Entry<Long, Instant> approval : firstApprovalByReview.entrySet()) {
                Timestamp approvedAt = Timestamp.from(approval.getValue());
                update.setTimestamp(1, approvedAt);
                update.setLong(2, approval.getKey());
                update.setTimestamp(3, approvedAt);
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private void backfillCurrentlyApprovedReviews(Connection connection) throws Exception {
        try (PreparedStatement update = connection.prepareStatement("""
                UPDATE reviews
                SET first_approved_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
                WHERE status = 'APPROVED'
                  AND first_approved_at IS NULL
                """)) {
            update.executeUpdate();
        }
    }

    private void redactReviewAudits(Connection connection, List<AuditRow> reviewAudits)
            throws Exception {
        try (PreparedStatement update = connection.prepareStatement("""
                UPDATE audit_logs
                SET before_data = ?, after_data = ?
                WHERE id = ?
                """)) {
            for (AuditRow audit : reviewAudits) {
                update.setString(1, redact(audit.beforeData()));
                update.setString(2, redact(audit.afterData()));
                update.setObject(3, audit.id());
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private String redact(String json) {
        if (json == null || json.isBlank()) {
            return json;
        }
        try {
            JsonNode original = mapper.readTree(json);
            if (original == null || !original.isObject()) {
                return redactedFallback();
            }
            ObjectNode safe = mapper.createObjectNode();
            for (String field : SAFE_AUDIT_FIELDS) {
                if (original.has(field)) {
                    safe.set(field, original.get(field));
                }
            }
            if (!safe.has("photoCount") && original.path("photos").isArray()) {
                safe.put("photoCount", original.path("photos").size());
            }
            return mapper.writeValueAsString(safe);
        } catch (Exception ignored) {
            return redactedFallback();
        }
    }

    private String redactedFallback() {
        ObjectNode fallback = mapper.createObjectNode();
        fallback.put("redacted", true);
        return fallback.toString();
    }

    private Long longValue(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.canConvertToLong()) {
            return value.longValue();
        }
        if (value.isTextual()) {
            try {
                return Long.valueOf(value.textValue());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Instant earlier(Instant left, Instant right) {
        return left.isBefore(right) ? left : right;
    }

    private record AuditRow(
            Object id,
            String action,
            String beforeData,
            String afterData,
            Instant createdAt
    ) {}

    private record ApprovalEvent(Long reviewId, Instant approvedAt) {}
}
