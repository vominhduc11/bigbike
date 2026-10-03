package com.bigbike.bigbike_backend.service.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class ArchivedChatRetentionServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MinioClient storage = mock(MinioClient.class);
    private final ArchivedChatRetentionService service = new ArchivedChatRetentionService(jdbc, storage);

    @BeforeEach
    void noUntrackedVideoObjects() {
        when(storage.listObjects(any())).thenReturn(List.of());
    }

    @Test
    void storageFailureKeepsVideoMetadataForRetry() throws Exception {
        var video = new ArchivedChatRetentionService.Attachment(
                UUID.randomUUID(), "private-archive", "chat/videos/retained.mp4");
        when(jdbc.query(startsWith("select id, storage_bucket"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(video));
        doThrow(new IllegalStateException("storage unavailable")).when(storage).removeObject(any());

        service.deleteExpiredVideos();

        verify(storage).removeObject(any(RemoveObjectArgs.class));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void successfulVideoExpiryRetainsTranscriptUntilConversationExpires() throws Exception {
        var video = new ArchivedChatRetentionService.Attachment(
                UUID.randomUUID(), "private-archive", "chat/videos/retained.mp4");
        when(jdbc.query(startsWith("select id, storage_bucket"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(video));

        service.deleteExpiredVideos();

        verify(storage).removeObject(any(RemoveObjectArgs.class));
        verify(jdbc).update(startsWith("update chat_videos set status = 'DELETED'"),
                any(), any(), eq(video.id()));
        verify(jdbc, never()).update(startsWith("delete from chat_conversations"), any(Object[].class));
    }

    @Test
    void historyExpiryCannotCascadeAwayAnAttachmentWhenStorageFails() throws Exception {
        JdbcTemplate history = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:archived_chat_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", ""));
        try {
            history.execute("create table chat_visitors (id uuid primary key, remembered_until timestamp)");
            history.execute("create table chat_conversations (id uuid primary key, visitor_id uuid "
                    + "references chat_visitors(id) on delete cascade, expires_at timestamp)");
            history.execute("create table chat_images (id uuid primary key, conversation_id uuid "
                    + "references chat_conversations(id) on delete cascade, storage_bucket varchar, "
                    + "storage_object_key varchar, expires_at timestamp, created_at timestamp, "
                    + "status varchar, deleted_at timestamp)");
            history.execute("create table chat_videos (id uuid primary key, conversation_id uuid "
                    + "references chat_conversations(id) on delete cascade, storage_bucket varchar, "
                    + "storage_object_key varchar)");
            UUID visitor = UUID.randomUUID();
            UUID conversation = UUID.randomUUID();
            Timestamp expired = Timestamp.from(Instant.now().minusSeconds(3600));
            history.update("insert into chat_visitors values (?, ?)", visitor, expired);
            history.update("insert into chat_conversations values (?, ?, ?)", conversation, visitor, expired);
            history.update("insert into chat_images values (?, ?, ?, ?, ?, ?, ?, null)",
                    UUID.randomUUID(), conversation, "private-archive", "chat/images/retained.webp",
                    expired, expired, "READY");
            var cleanup = new ArchivedChatRetentionService(history, storage);
            doThrow(new IllegalStateException("storage unavailable")).when(storage).removeObject(any());

            cleanup.deleteExpiredHistory();

            for (String table : List.of("chat_visitors", "chat_conversations", "chat_images")) {
                assertThat(history.queryForObject("select count(*) from " + table, Integer.class)).isEqualTo(1);
            }

            doNothing().when(storage).removeObject(any());
            cleanup.deleteExpiredHistory();

            for (String table : List.of("chat_visitors", "chat_conversations", "chat_images")) {
                assertThat(history.queryForObject("select count(*) from " + table, Integer.class)).isZero();
            }
        } finally {
            history.execute("shutdown");
        }
    }
}
