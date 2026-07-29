package com.bigbike.bigbike_backend.service.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Random;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class ImageCompressionServiceTest {

    private final ImageCompressionService service = new ImageCompressionService();

    @Test
    void doesNotUpscaleImagesSmallerThanTheTarget() {
        byte[] small = encode(noisyImage(100, 80, false), "jpg");
        byte[] result = service.compress(small, "image/jpeg", new CompressionProfile(2000, 2000, 0.85f, false));
        assertThat(result).isSameAs(small);
    }

    @Test
    void downscalesAndShrinksALargeJpeg() throws IOException {
        byte[] source = encode(noisyImage(1600, 1200, false), "jpg");
        byte[] result = service.compress(source, "image/jpeg", new CompressionProfile(800, 800, 0.7f, false));

        assertThat(result.length).isLessThan(source.length);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getWidth()).isEqualTo(800);
    }

    @Test
    void preservesAlphaChannelForPng() throws IOException {
        byte[] source = encode(noisyImage(900, 600, true), "png");
        byte[] result = service.compress(source, "image/png", new CompressionProfile(700, 700, 0.85f, false));

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getColorModel().hasAlpha()).isTrue();
        assertThat(decoded.getWidth()).isEqualTo(700);
    }

    @Test
    void squareCropsToExactBoxForAvatarProfile() throws IOException {
        byte[] source = encode(noisyImage(800, 400, false), "jpg");
        byte[] result = service.compress(source, "image/jpeg", new CompressionProfile(200, 200, 0.85f, true));

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getWidth()).isEqualTo(200);
        assertThat(decoded.getHeight()).isEqualTo(200);
    }

    @Test
    void doesNotUpscaleSquareCropWhenSourceIsAlreadySmaller() {
        byte[] source = encode(noisyImage(100, 100, false), "jpg");
        byte[] result = service.compress(source, "image/jpeg", new CompressionProfile(400, 400, 0.85f, true));
        assertThat(result).isSameAs(source);
    }

    @Test
    void passesThroughSvgUnchanged() {
        byte[] source = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>".getBytes(StandardCharsets.UTF_8);
        byte[] result = service.compress(source, "image/svg+xml", new CompressionProfile(400, 400, 0.85f, false));
        assertThat(result).isSameAs(source);
    }

    @Test
    void passesThroughGifUnchanged() {
        byte[] source = "not-a-real-gif-but-does-not-matter".getBytes(StandardCharsets.UTF_8);
        byte[] result = service.compress(source, "image/gif", new CompressionProfile(400, 400, 0.85f, false));
        assertThat(result).isSameAs(source);
    }

    @Test
    void failsSoftOnUndecodableBytes() {
        byte[] garbage = "definitely not an image".getBytes(StandardCharsets.UTF_8);
        byte[] result = service.compress(garbage, "image/jpeg", new CompressionProfile(400, 400, 0.85f, false));
        assertThat(result).isSameAs(garbage);
    }

    /**
     * Documents CODE_GAP_WEBP_2026-07-28 without silently changing the accepted format.
     * The fixture is a valid 2000x10 lossless WebP. Once a shared reader + MIME-safe
     * encoder is introduced, this test must be replaced by an assertion that the stored
     * result is at most 1600px wide.
     */
    @Test
    void webpCurrentlyFallsBackUnchangedWithoutAnImageIoReader() throws IOException {
        byte[] wideWebp = Base64.getDecoder().decode(
                "UklGRiIAAABXRUJQVlA4TBUAAAAvz0cCAAcQ9Y/+BwAU6f9/ieh/KhwA");

        assertThat(ImageIO.read(new ByteArrayInputStream(wideWebp))).isNull();
        byte[] result = service.compress(
                wideWebp, "image/webp", new CompressionProfile(1600, 1600, 0.85f, false));
        assertThat(result).isSameAs(wideWebp);
    }

    private static BufferedImage noisyImage(int width, int height, boolean alpha) {
        BufferedImage img = new BufferedImage(width, height,
                alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Random random = new Random(42);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = random.nextInt(0xFFFFFF);
                if (alpha) rgb |= 0x80 << 24;
                img.setRGB(x, y, rgb);
            }
        }
        return img;
    }

    private static byte[] encode(BufferedImage img, String format) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, format, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
