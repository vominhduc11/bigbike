package com.bigbike.bigbike_backend.migration.wordpress.media;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import java.io.InputStream;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * MinIO (S3-compatible) implementation of {@link MediaStoragePort}.
 * Created per-run by {@link MediaCopyRunner} — not a Spring bean.
 */
public class MinioMediaStorageAdapter implements MediaStoragePort {

    private static final Logger log = LoggerFactory.getLogger(MinioMediaStorageAdapter.class);

    private final MinioClient client;

    public MinioMediaStorageAdapter(String endpoint, String accessKey, String secretKey) {
        this.client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    @Override
    public boolean exists(String bucket, String key) throws Exception {
        try {
            client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
            return true;
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) return false;
            throw e;
        }
    }

    @Override
    public Optional<String> etag(String bucket, String key) throws Exception {
        try {
            StatObjectResponse stat = client.statObject(
                    StatObjectArgs.builder().bucket(bucket).object(key).build());
            return Optional.ofNullable(stat.etag()).map(s -> s.replace("\"", ""));
        } catch (Exception e) {
            log.debug("Could not retrieve ETag for {}/{}: {}", bucket, key, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void put(String bucket, String key, InputStream stream, long size, String contentType) throws Exception {
        client.putObject(
                PutObjectArgs.builder()
                        .bucket(bucket)
                        .object(key)
                        .stream(stream, size, -1)
                        .contentType(contentType)
                        .build());
    }

    @Override
    public Optional<Long> objectSize(String bucket, String key) throws Exception {
        try {
            StatObjectResponse stat = client.statObject(
                    StatObjectArgs.builder().bucket(bucket).object(key).build());
            return Optional.of(stat.size());
        } catch (Exception e) {
            log.debug("Could not retrieve size for {}/{}: {}", bucket, key, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void ensureBucket(String bucket) throws Exception {
        boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            log.info("Created MinIO bucket: {}", bucket);
        }
    }
}
