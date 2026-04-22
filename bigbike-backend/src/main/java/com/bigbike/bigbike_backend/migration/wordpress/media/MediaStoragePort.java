package com.bigbike.bigbike_backend.migration.wordpress.media;

import java.io.InputStream;
import java.util.Optional;

/**
 * Storage abstraction for Phase 2E media copy.
 * Decouples MediaCopyService from the MinIO SDK, enabling unit testing with mocks.
 */
public interface MediaStoragePort {

    /** Returns true if the object exists in the given bucket. */
    boolean exists(String bucket, String key) throws Exception;

    /**
     * Returns the ETag of an existing object, stripped of surrounding quotes.
     * For single-part uploads the ETag is the MD5 hex of the content.
     * For multipart uploads the ETag has the form {@code md5hash-partcount}.
     */
    Optional<String> etag(String bucket, String key) throws Exception;

    /** Streams {@code stream} (of known {@code size} bytes) to the object at {@code key}. */
    void put(String bucket, String key, InputStream stream, long size, String contentType) throws Exception;

    /** Returns the stored size in bytes of an existing object, or empty if unavailable. */
    Optional<Long> objectSize(String bucket, String key) throws Exception;

    /** Creates the bucket if it does not already exist. */
    void ensureBucket(String bucket) throws Exception;
}
