package com.bigbike.bigbike_backend.service.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
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
    void failsSoftOnUndecodableBytes() {
        byte[] garbage = "definitely not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] result = service.compress(garbage, "image/jpeg", new CompressionProfile(400, 400, 0.85f, false));
        assertThat(result).isSameAs(garbage);
    }

    /**
     * Replaces the old CODE_GAP_WEBP_2026-07-28 placeholder: WebP now decodes, so the fixture is no
     * longer skipped for want of a reader. {@link ImageCompressionService#compress} still hands the
     * original back, but for the ordinary reason — nothing can write WebP here, and this picture
     * re-encoded as PNG is bigger than the WebP it came from, so the smaller file wins.
     * {@code ImageVariantService} therefore skips such a variant instead of storing WebP bytes
     * under a .png name.
     */
    @Test
    void webpNowDecodesAndIsKeptOnlyBecauseReencodingItWouldBeLarger() throws IOException {
        byte[] wideWebp = Base64.getDecoder().decode(
                "UklGRiIAAABXRUJQVlA4TBUAAAAvz0cCAAcQ9Y/+BwAU6f9/ieh/KhwA");

        assertThat(ImageIO.read(new ByteArrayInputStream(wideWebp))).isNotNull();
        byte[] result = service.compress(
                wideWebp, "image/webp", new CompressionProfile(1600, 1600, 0.85f, false));
        assertThat(result).isSameAs(wideWebp);
    }

    /**
     * The path the chat image upload uses. Unlike {@code compress} it never falls back to the
     * original, so a WebP wider than the profile really is resized instead of being refused —
     * which is what used to happen while a JPEG of the same size was quietly accepted.
     */
    @Test
    void reencodeResizesAWideWebpInsteadOfRefusingIt() throws IOException {
        byte[] wideWebp;
        try (java.io.InputStream input = getClass().getResourceAsStream("/chat/customer-photo-wide.webp")) {
            assertThat(input).isNotNull();
            wideWebp = input.readAllBytes();
        }

        byte[] result = service.reencodeWithoutMetadata(
                wideWebp, "image/webp", new CompressionProfile(1600, 1600, 0.85f, false));

        assertThat(result).isNotNull();
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded).isNotNull();
        assertThat(decoded.getWidth()).isLessThanOrEqualTo(1600);
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
