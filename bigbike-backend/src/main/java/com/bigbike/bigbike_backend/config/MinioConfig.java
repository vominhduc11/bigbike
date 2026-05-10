package com.bigbike.bigbike_backend.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    private static final Logger log = LoggerFactory.getLogger(MinioConfig.class);

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
}
