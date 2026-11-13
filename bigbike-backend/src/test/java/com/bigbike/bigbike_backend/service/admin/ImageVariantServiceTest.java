package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.util.Random;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

class ImageVariantServiceTest {
    private final MinioClient storage = mock(MinioClient.class);
    private final ImageCompressionService compression = mock(ImageCompressionService.class);
    private final ImageVariantService service = new ImageVariantService(storage, new MinioProperties(), compression);

    @ParameterizedTest
    @ValueSource(strings = {"image/jpeg", "image/png", "image/webp"})
    void unchangedOriginalDoesNotCreateDuplicateObjects(String mime) throws Exception {
        byte[] source = image(1800, 20, false, "png");
        when(compression.compress(eq(source), eq(mime), any(), any(BufferedImage.class))).thenReturn(source);
        assertThat(service.generateAndUpload(source, "uploads/test/source.png", mime)).isEmpty();
        var decoded = ArgumentCaptor.forClass(BufferedImage.class);
        verify(compression, times(3)).compress(eq(source), eq(mime), any(), decoded.capture());
        assertThat(decoded.getAllValues()).allSatisfy(image ->
                assertThat(image).isSameAs(decoded.getAllValues().get(0)));
        verify(compression, never()).compress(any(), any(), any());
        verifyNoInteractions(storage);
    }

    @Test
    void realTransparentVariantsRetainDimensionsMimeAlphaAndCustomBucket() throws Exception {
        byte[] source = image(1800, 200, true, "png");
        var real = new ImageVariantService(storage, new MinioProperties(), new ImageCompressionService());
        var result = real.generateAndUpload(source, "uploads/test/source.png", "image/png", "isolated-test");
        assertThat(result).containsOnlyKeys("thumb", "medium", "large");
        var args = ArgumentCaptor.forClass(PutObjectArgs.class);
        verify(storage, times(3)).putObject(args.capture());
        for (var upload : args.getAllValues()) {
            assertThat(upload.bucket()).isEqualTo("isolated-test");
            assertThat(upload.contentType()).isEqualTo("image/png");
            byte[] bytes = upload.stream().readAllBytes();
            assertThat(bytes.length).isLessThan(source.length);
            var decoded = ImageIO.read(new ByteArrayInputStream(bytes));
            int expectedWidth = upload.object().contains(".thumb.") ? 300
                    : upload.object().contains(".medium.") ? 800 : 1600;
            assertThat(decoded.getWidth()).isEqualTo(expectedWidth);
            assertThat(decoded.getColorModel().hasAlpha()).isTrue();
            assertThat(decoded.getRGB(0, 0) >>> 24).isLessThan(255);
            assertThat(result).containsValue("/media/" + upload.object());
        }
    }

    @Test
    void mixedSkippedAndStoredVariantsAndStorageFailureRemainIndependent() throws Exception {
        byte[] source = image(1800, 20, false, "png");
        byte[] resized = image(300, 3, false, "jpg");
        when(compression.compress(eq(source), eq("image/jpeg"), any(), any(BufferedImage.class))).thenAnswer(call -> {
            CompressionProfile profile = call.getArgument(2);
            return profile.maxWidth() == 800 ? source : resized;
        });
        doAnswer(call -> {
            PutObjectArgs upload = call.getArgument(0);
            if (upload.object().contains(".large.")) throw new java.io.IOException("test storage failure");
            return null;
        }).when(storage).putObject(any());
        assertThat(service.generateAndUpload(source, "uploads/test/source.jpg", "image/jpeg"))
                .containsOnlyKeys("thumb");
        verify(storage, times(2)).putObject(any());
    }

    @Test
    void smallAndInvalidInputsNeverUpload() throws Exception {
        assertThat(service.generateAndUpload(image(200, 20, false, "png"), "small.png", "image/png")).isEmpty();
        assertThat(service.generateAndUpload(new byte[]{1, 2}, "bad.png", "image/png")).isEmpty();
        assertThat(service.generateAndUpload(null, "empty.png", "image/png")).isEmpty();
        assertThat(service.generateAndUpload(new byte[]{1}, "video.mp4", "video/mp4")).isEmpty();
        verifyNoInteractions(storage, compression);
    }

    private static byte[] image(int width, int height, boolean alpha, String format) throws Exception {
        var image = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        var random = new Random(17);
        for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
            image.setRGB(x, y, (alpha ? 0x60000000 : 0xff000000) | random.nextInt(0x1000000));
        }
        var output = new ByteArrayOutputStream();
        ImageIO.write(image, format, output);
        return output.toByteArray();
    }
}
