package com.bigbike.bigbike_backend.config;

import io.minio.BucketExistsArgs;
import io.minio.DeleteBucketPolicyArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@Slf4j
public class MinioConfig {

    @Bean
    public MinioClient minioClient(MinioProperties props) {
        return MinioClient.builder()
                .endpoint(props.getEndpoint())
                .credentials(props.getAccessKey(), props.getSecretKey())
                .build();
    }

    @Bean
    public MinioStartupInitializer minioStartupInitializer(MinioClient client, MinioProperties props) {
        return new MinioStartupInitializer(client, props);
    }

    @Bean
    public ChatPrivateBucketInitializer chatPrivateBucketInitializer(
            MinioClient client,
            MinioProperties props,
            @Value("${bigbike.minio.chat-private-bucket:bigbike-chat-private}") String privateBucket
    ) {
        return new ChatPrivateBucketInitializer(client, props.getBucket(), privateBucket);
    }

    public static class MinioStartupInitializer {
        private final MinioClient client;
        private final MinioProperties props;

        public MinioStartupInitializer(MinioClient client, MinioProperties props) {
            this.client = client;
            this.props = props;
        }

        // S3-compatible public-read policy — allows anonymous GET on all objects.
        // Required so Next.js rewrites (/wp-content/uploads/, /media/) can serve
        // images directly from MinIO without presigned URLs.
        private static final String PUBLIC_READ_POLICY_TEMPLATE =
                "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\","
                + "\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],"
                + "\"Resource\":[\"arn:aws:s3:::%s/*\"]}]}";

        @PostConstruct
        public void ensureBucket() {
            String bucket = props.getBucket();
            try {
                boolean exists = client.bucketExists(
                        BucketExistsArgs.builder().bucket(bucket).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                }
                String policy = String.format(PUBLIC_READ_POLICY_TEMPLATE, bucket);
                client.setBucketPolicy(
                        SetBucketPolicyArgs.builder().bucket(bucket).config(policy).build());
                log.info("Set public-read policy on MinIO bucket: {}", bucket);
            } catch (Exception e) {
                log.warn("Could not ensure MinIO bucket '{}': {}", bucket, e.getMessage());
            }
        }
    }

    /** Customer chat images live in a separate bucket that never receives a public-read policy. */
    public static class ChatPrivateBucketInitializer {
        private final MinioClient client;
        private final String publicBucket;
        private final String privateBucket;

        public ChatPrivateBucketInitializer(
                MinioClient client, String publicBucket, String privateBucket) {
            this.client = client;
            this.publicBucket = publicBucket == null ? "" : publicBucket.trim();
            this.privateBucket = privateBucket == null ? "" : privateBucket.trim();
        }

        @PostConstruct
        public void ensurePrivateBucket() {
            if (privateBucket.isBlank()) {
                throw new IllegalStateException("Private chat image bucket is not configured");
            }
            if (privateBucket.equals(publicBucket)) {
                throw new IllegalStateException(
                        "Private chat image bucket must differ from the public media bucket");
            }
            try {
                boolean exists = client.bucketExists(
                        BucketExistsArgs.builder().bucket(privateBucket).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(privateBucket).build());
                    log.info("Created private MinIO bucket for customer chat images");
                }
                try {
                    client.deleteBucketPolicy(
                            DeleteBucketPolicyArgs.builder().bucket(privateBucket).build());
                    log.info("Removed public bucket policy from private customer chat storage");
                } catch (Exception noPolicyOrUnsupported) {
                    log.debug("Private MinIO chat bucket has no removable public policy: {}",
                            noPolicyOrUnsupported.getClass().getSimpleName());
                }
            } catch (Exception exception) {
                log.warn("Could not ensure private MinIO chat bucket: {}",
                        exception.getClass().getSimpleName());
            }
        }
    }
}
