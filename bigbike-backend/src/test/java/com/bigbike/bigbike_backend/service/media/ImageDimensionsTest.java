package com.bigbike.bigbike_backend.service.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class ImageDimensionsTest {

    @Test
    void readsImageIoDimensions() throws Exception {
        BufferedImage image = new BufferedImage(640, 480, BufferedImage.TYPE_INT_RGB);
        byte[] bytes;
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            bytes = output.toByteArray();
        }

        assertThat(ImageDimensions.read(bytes, "image/png"))
                .isEqualTo(new ImageDimensions.Dimensions(640, 480));
    }

    @Test
    void readsVp8xWebpDimensionsWithoutAWebpImageIoReader() {
        byte[] bytes = new byte[30];
        putAscii(bytes, 0, "RIFF");
        putAscii(bytes, 8, "WEBP");
        putAscii(bytes, 12, "VP8X");
        putLittle24(bytes, 24, 799);
        putLittle24(bytes, 27, 599);

        assertThat(ImageDimensions.readWebp(bytes))
                .isEqualTo(new ImageDimensions.Dimensions(800, 600));
    }

    @Test
    void rejectsUnidentifiedBytes() {
        assertThat(ImageDimensions.read(new byte[] {1, 2, 3}, "image/webp")).isNull();
        assertThat(ImageDimensions.readWebp(new byte[] {1, 2, 3})).isNull();
    }

    private static void putAscii(byte[] bytes, int offset, String value) {
        for (int i = 0; i < value.length(); i++) bytes[offset + i] = (byte) value.charAt(i);
    }

    private static void putLittle24(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) value;
        bytes[offset + 1] = (byte) (value >>> 8);
        bytes[offset + 2] = (byte) (value >>> 16);
    }
}
