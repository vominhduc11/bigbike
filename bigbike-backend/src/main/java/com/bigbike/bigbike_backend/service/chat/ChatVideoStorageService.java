package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.config.MinioProperties;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import java.io.ByteArrayInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Same private MinIO store as photos, with separate bounded clients for video operations. */
@Service
@lombok.extern.slf4j.Slf4j
public class ChatVideoStorageService {
    private final MinioProperties properties;
    private final String bucket;
    private final OkHttpClient baseClient = new OkHttpClient.Builder().retryOnConnectionFailure(true).build();

    public ChatVideoStorageService(MinioProperties properties,
            @Value("${bigbike.minio.chat-private-bucket:bigbike-chat-private}") String bucket) {
        this.properties = properties;
        this.bucket = bucket.trim();
    }

    private MinioClient client() {
        ChatTurnBudget.checkTime();
        long timeout = Math.max(1, ChatTurnBudget.remainingMillis(5_000));
        var http = baseClient.newBuilder().callTimeout(timeout, TimeUnit.MILLISECONDS)
                .connectTimeout(timeout, TimeUnit.MILLISECONDS).readTimeout(timeout, TimeUnit.MILLISECONDS)
                .writeTimeout(timeout, TimeUnit.MILLISECONDS).build();
        // BigBike uses MinIO's default region. Avoid a second region-discovery request per operation.
        return MinioClient.builder().endpoint(properties.getEndpoint()).region("us-east-1")
                .credentials(properties.getAccessKey(), properties.getSecretKey()).httpClient(http).build();
    }

    public StoredVideo store(UUID conversationId, UUID requestId, byte[] bytes, String lang) {
        String key = "chat/videos/" + conversationId + "/" + requestId + ".mp4";
        try {
            try {
                String policy = client().getBucketPolicy(GetBucketPolicyArgs.builder().bucket(bucket).build());
                if (policy != null && !policy.isBlank()) throw new IllegalStateException("Private bucket required");
            } catch (ErrorResponseException failure) {
                if (failure.errorResponse() == null
                        || !"NoSuchBucketPolicy".equals(failure.errorResponse().code())) throw failure;
            }
            client().putObject(PutObjectArgs.builder().bucket(bucket).object(key)
                    .stream(new ByteArrayInputStream(bytes), bytes.length, -1).contentType("video/mp4").build());
            ChatTurnBudget.checkTime();
            return new StoredVideo(bucket, key, bytes.length,
                    HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        } catch (ChatTurnBudget.Expired failure) { throw failure;
        } catch (Exception failure) {
            log.warn("chat_video_storage_failed type={}", failure.getClass().getSimpleName());
            ChatTurnBudget.checkTime();
            throw ChatVideoErrors.invalid("CHAT_VIDEO_UNAVAILABLE", lang);
        }
    }

    public ChatImageStorageService.StoredContent read(String bucket, String key) {
        try (var input = client().getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())) {
            byte[] bytes = input.readNBytes(ChatVideoNormalizer.MAX_INLINE_BYTES + 1);
            if (bytes.length > ChatVideoNormalizer.MAX_INLINE_BYTES) throw new IllegalStateException("Invalid video size");
            ChatTurnBudget.checkTime();
            return new ChatImageStorageService.StoredContent(bytes, "video/mp4");
        } catch (ChatTurnBudget.Expired failure) { throw failure;
        } catch (Exception failure) {
            ChatTurnBudget.checkTime();
            throw new IllegalStateException("Private video unavailable", failure);
        }
    }

    public void delete(String bucket, String key) {
        try {
            client().removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception failure) { throw new IllegalStateException("Private video deletion failed", failure); }
    }
    public int deleteOrphansOlderThan(java.time.Instant cutoff) {
        int deleted = 0;
        try {
            for (var result : client().listObjects(ListObjectsArgs.builder().bucket(bucket)
                    .prefix("chat/videos/").recursive(true).build())) {
                var item = result.get();
                if (!item.isDir() && item.lastModified().toInstant().isBefore(cutoff)) {
                    delete(bucket, item.objectName());
                    deleted++;
                }
            }
            return deleted;
        } catch (Exception failure) {
            log.warn("chat_video_storage_cleanup_failed type={}", failure.getClass().getSimpleName());
            throw new IllegalStateException("Private video orphan cleanup failed", failure);
        }
    }
    public record StoredVideo(String bucket, String objectKey, long sizeBytes, String sha256) {}
}
