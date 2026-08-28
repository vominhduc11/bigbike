package com.bigbike.bigbike_backend.service.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;

/**
 * Reads raster dimensions with a small WebP header fallback for JREs without a WebP ImageIO
 * reader. It deliberately returns {@code null} when the bytes cannot be identified as an image.
 */
public final class ImageDimensions {

    private ImageDimensions() {}

    public static Dimensions read(byte[] bytes, String mimeType) {
        if (bytes == null || bytes.length == 0) return null;
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image != null && image.getWidth() > 0 && image.getHeight() > 0) {
                return new Dimensions(image.getWidth(), image.getHeight());
            }
        } catch (Exception ignored) {
            // The WebP header fallback below handles runtimes without a WebP reader.
        }
        if ("image/webp".equalsIgnoreCase(mimeType)) return readWebp(bytes);
        return null;
    }

    public static Dimensions readWebp(byte[] bytes) {
        if (bytes == null || bytes.length < 16
                || !"RIFF".equals(ascii(bytes, 0, 4))
                || !"WEBP".equals(ascii(bytes, 8, 4))) return null;
        String chunk = ascii(bytes, 12, 4);
        if ("VP8X".equals(chunk) && bytes.length >= 30) {
            int width = 1 + little24(bytes, 24);
            int height = 1 + little24(bytes, 27);
            return new Dimensions(width, height);
        }
        if ("VP8 ".equals(chunk) && bytes.length >= 30) {
            int width = (bytes[26] & 0xff) | ((bytes[27] & 0x3f) << 8);
            int height = (bytes[28] & 0xff) | ((bytes[29] & 0x3f) << 8);
            return new Dimensions(width, height);
        }
        if ("VP8L".equals(chunk) && bytes.length >= 25 && (bytes[20] & 0xff) == 0x2f) {
            int b1 = bytes[21] & 0xff;
            int b2 = bytes[22] & 0xff;
            int b3 = bytes[23] & 0xff;
            int b4 = bytes[24] & 0xff;
            int width = 1 + b1 + ((b2 & 0x3f) << 8);
            int height = 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10);
            return new Dimensions(width, height);
        }
        return null;
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        return new String(bytes, offset, length, StandardCharsets.US_ASCII);
    }

    private static int little24(byte[] bytes, int offset) {
        return (bytes[offset] & 0xff)
                | ((bytes[offset + 1] & 0xff) << 8)
                | ((bytes[offset + 2] & 0xff) << 16);
    }

    public record Dimensions(int width, int height) {}
}
