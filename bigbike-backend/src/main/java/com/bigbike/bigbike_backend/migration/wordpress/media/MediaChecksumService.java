package com.bigbike.bigbike_backend.migration.wordpress.media;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

/**
 * Streaming checksum computation for media files.
 * Reads files in 64 KB chunks — never loads the entire file into memory.
 */
@Component
public class MediaChecksumService {

    private static final int BUFFER_SIZE = 64 * 1024;

    public String md5Hex(Path file) throws IOException {
        return hexDigest("MD5", file);
    }

    public String sha256Hex(Path file) throws IOException {
        return hexDigest("SHA-256", file);
    }

    private String hexDigest(String algorithm, Path file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance(algorithm);
        } catch (NoSuchAlgorithmException e) {
            throw new IOException("Digest algorithm not available: " + algorithm, e);
        }
        byte[] buf = new byte[BUFFER_SIZE];
        try (InputStream in = new BufferedInputStream(Files.newInputStream(file), BUFFER_SIZE)) {
            int n;
            while ((n = in.read(buf)) != -1) {
                digest.update(buf, 0, n);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
