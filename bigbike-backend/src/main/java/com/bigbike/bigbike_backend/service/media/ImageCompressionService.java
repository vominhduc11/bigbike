package com.bigbike.bigbike_backend.service.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;
import net.coobird.thumbnailator.geometry.Positions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Single shared place for decode → resize → encode logic used by every image upload path
 * (admin media originals + variants, review photos, customer avatars). Centralizing this
 * means the "no upscale / preserve alpha / skip SVG-GIF / fail soft" rules only exist once.
 */
@Service
@Slf4j
public class ImageCompressionService {

    /**
     * Compresses a raster image according to {@code profile}. Always fails soft: any input
     * that can't be safely processed (not an image, SVG/GIF, undecodable, encode error, or a
     * result that isn't actually smaller) comes back as the original {@code source} bytes
     * unchanged — callers never need to fall back themselves.
     */
    public byte[] compress(byte[] source, String mimeType, CompressionProfile profile) {
        if (source == null || source.length == 0) return source;
        String mime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (!mime.startsWith("image/")) return source;
        // Vector (SVG) and animated (GIF) formats aren't safe to run through a raster
        // resize — SVG isn't a bitmap at all, and GIF would lose every frame but the first.
        if (mime.equals("image/svg+xml") || mime.equals("image/gif")) return source;

        BufferedImage decoded;
        try {
            decoded = ImageIO.read(new ByteArrayInputStream(source));
        } catch (IOException e) {
            log.warn("Could not decode image for compression: {}", e.getMessage());
            return source;
        }
        if (decoded == null) return source;

        int sourceWidth = decoded.getWidth();
        int sourceHeight = decoded.getHeight();
        int relevantDimension = profile.squareCrop() ? Math.min(sourceWidth, sourceHeight) : sourceWidth;
        // Never upscale — an image already smaller than the target is left exactly as-is.
        if (relevantDimension <= profile.maxWidth()) return source;

        // PNG/WebP (and any source that already decoded with an alpha channel) must stay PNG —
        // encoding as JPEG would flatten transparency onto a black/white background.
        boolean preserveAlpha = mime.equals("image/png") || mime.equals("image/webp")
                || decoded.getColorModel().hasAlpha();
        String outputFormat = preserveAlpha ? "png" : "jpg";

        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            var builder = Thumbnails.of(decoded).outputFormat(outputFormat);
            if (profile.squareCrop()) {
                int side = Math.min(sourceWidth, sourceHeight);
                builder = builder.sourceRegion(Positions.CENTER, side, side)
                        .size(profile.maxWidth(), profile.maxHeight());
            } else {
                builder = builder.width(profile.maxWidth());
            }
            // Quality only applies to lossy formats — Thumbnailator ignores it for PNG.
            if (!preserveAlpha) {
                builder = builder.outputQuality(profile.jpegQuality());
            }
            builder.toOutputStream(out);
            byte[] compressed = out.toByteArray();
            // Some sources (already-optimized JPEGs) can come back larger after re-encoding —
            // keep whichever is smaller.
            return compressed.length < source.length ? compressed : source;
        } catch (Exception e) {
            log.warn("Image compression failed, keeping original: {}", e.getMessage());
            return source;
        }
    }
}
