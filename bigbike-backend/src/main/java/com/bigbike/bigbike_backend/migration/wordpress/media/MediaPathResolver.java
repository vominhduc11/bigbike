package com.bigbike.bigbike_backend.migration.wordpress.media;

import java.io.File;
import java.net.URI;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

/**
 * Resolves WordPress attachment file paths to local source paths and MinIO storage keys.
 *
 * WP stores paths like "2024/05/image.jpg" in _wp_attached_file.
 * These are resolved relative to the uploads directory on disk,
 * and prefixed with "wp-uploads/" when stored as MinIO object keys.
 */
@Component
public class MediaPathResolver {

    static final String KEY_PREFIX = "wp-uploads/";

    /** Resolves the absolute source path on disk for a WP file path. */
    public Path sourceFile(Path uploadsDir, String wpFilePath) {
        String normalized = wpFilePath.replace('/', File.separatorChar);
        return uploadsDir.resolve(normalized);
    }

    /** Converts a WP file path to a MinIO object key. */
    public String storageKey(String wpFilePath) {
        String path = wpFilePath.startsWith("/") ? wpFilePath.substring(1) : wpFilePath;
        return KEY_PREFIX + path.replace('\\', '/');
    }

    /** Builds the public URL for an object in the given bucket. */
    public String publicUrl(String endpoint, String bucket, String key) {
        String base = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
        URI.create(base); // validates endpoint is a proper URI
        return base + "/" + bucket + "/" + key;
    }
}
