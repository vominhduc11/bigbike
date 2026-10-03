package com.bigbike.bigbike_backend.service.retention;

import io.minio.MinioClient;
import io.minio.ListObjectsArgs;
import io.minio.RemoveObjectArgs;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** CHAT_RULE_070: only expire retained history; no assistant, upload or provider access. */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "bigbike.archived-chat-retention.enabled", matchIfMissing = true)
public class ArchivedChatRetentionService {

    private final JdbcTemplate jdbc;
    private final MinioClient storage;

    @Value("${bigbike.minio.chat-private-bucket:bigbike-chat-private}")
    private String privateBucket = "bigbike-chat-private";

    record Attachment(UUID id, String bucket, String objectKey) {}

    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void deleteExpiredHistory() {
        Timestamp now = Timestamp.from(Instant.now());
        List<UUID> conversations = jdbc.query(
                "select id from chat_conversations where expires_at < ? order by expires_at",
                (row, index) -> row.getObject("id", UUID.class), now);
        for (UUID id : conversations) {
            if (!deleteConversationAttachments("chat_images", id)
                    || !deleteConversationAttachments("chat_videos", id)) continue;
            jdbc.update("delete from chat_conversations where id = ?", id);
        }
        for (Attachment image : attachments("select id, storage_bucket, storage_object_key "
                + "from chat_images where expires_at < ? "
                + "or (status = 'PENDING' and created_at < ?) "
                + "or (status in ('REJECTED_UNSAFE', 'DELETING') and deleted_at is null)",
                now, Timestamp.from(now.toInstant().minusSeconds(3600)))) {
            if (deleteObject(image)) jdbc.update("delete from chat_images where id = ?", image.id());
        }
        // A visitor's cascade must never delete conversations whose attachments are still retained.
        jdbc.update("delete from chat_visitors v where remembered_until < ? "
                + "and not exists (select 1 from chat_conversations c where c.visitor_id = v.id)", now);
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void deleteExpiredVideos() {
        Timestamp now = Timestamp.from(Instant.now());
        for (Attachment video : attachments("select id, storage_bucket, storage_object_key "
                + "from chat_videos where deleted_at is null and "
                + "(expires_at < ? or status in ('REJECTED_UNSAFE', 'DELETING'))", now)) {
            if (deleteObject(video)) {
                jdbc.update("update chat_videos set status = 'DELETED', deleted_at = ?, updated_at = ? "
                        + "where id = ?", now, now, video.id());
            }
        }
        // Preserve the former seven-day cleanup for uploads whose metadata rolled back.
        try {
            for (var result : storage.listObjects(ListObjectsArgs.builder()
                    .bucket(privateBucket).prefix("chat/videos/").recursive(true).build())) {
                var item = result.get();
                if (!item.isDir() && item.lastModified().toInstant()
                        .isBefore(now.toInstant().minusSeconds(7 * 24 * 60 * 60))) {
                    storage.removeObject(RemoveObjectArgs.builder()
                            .bucket(privateBucket).object(item.objectName()).build());
                }
            }
        } catch (Exception failure) {
            log.warn("Retained video orphan cleanup will retry: {}", failure.getClass().getSimpleName());
        }
    }

    private boolean deleteConversationAttachments(String table, UUID conversationId) {
        // Table names are fixed internal literals; customer input never reaches this query.
        for (Attachment item : attachments("select id, storage_bucket, storage_object_key from "
                + table + " where conversation_id = ?", conversationId)) {
            if (!deleteObject(item)) return false;
            jdbc.update("delete from " + table + " where id = ?", item.id());
        }
        return true;
    }

    private List<Attachment> attachments(String sql, Object... arguments) {
        return jdbc.query(sql, (row, index) -> new Attachment(
                row.getObject("id", UUID.class), row.getString("storage_bucket"),
                row.getString("storage_object_key")), arguments);
    }

    private boolean deleteObject(Attachment item) {
        try {
            storage.removeObject(RemoveObjectArgs.builder()
                    .bucket(item.bucket()).object(item.objectKey()).build());
            return true;
        } catch (Exception failure) {
            log.warn("Retained attachment cleanup will retry: {}", failure.getClass().getSimpleName());
            return false;
        }
    }
}
