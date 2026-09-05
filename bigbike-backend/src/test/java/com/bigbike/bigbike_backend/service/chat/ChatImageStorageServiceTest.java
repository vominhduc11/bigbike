package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class ChatImageStorageServiceTest {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    @Test
    void validPngIsReprocessedAndStoredInThePrivateBucket() throws Exception {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        when(compression.reencodeWithoutMetadata(any(), any(), any())).thenReturn(ONE_PIXEL_PNG);
        when(minio.putObject(any(PutObjectArgs.class))).thenReturn(null);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);

        ChatImageStorageService.StoredImage stored = service.store(
                UUID.randomUUID(), UUID.randomUUID(),
                new MockMultipartFile(
                        "file", "helmet.png", "image/png", ONE_PIXEL_PNG));

        assertThat(stored.bucket()).isEqualTo("bigbike-chat-private");
        assertThat(stored.mimeType()).isEqualTo("image/png");
        assertThat(stored.width()).isEqualTo(1);
        assertThat(stored.height()).isEqualTo(1);
        assertThat(stored.objectKey()).startsWith("chat/").endsWith(".png");
        assertThat(stored.sha256()).hasSize(64);
        verify(minio).putObject(any(PutObjectArgs.class));
    }

    @Test
    void refusesToStoreCustomerImageWhenPrivateBucketStillHasAnyPolicy() throws Exception {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        when(compression.reencodeWithoutMetadata(any(), any(), any())).thenReturn(ONE_PIXEL_PNG);
        when(minio.getBucketPolicy(any())).thenReturn("{\"Statement\":[{\"Effect\":\"Allow\"}]}");
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);

        assertThatThrownBy(() -> service.store(
                UUID.randomUUID(), UUID.randomUUID(),
                new MockMultipartFile("file", "helmet.png", "image/png", ONE_PIXEL_PNG)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("bảo vệ riêng tư");

        verify(minio, never()).putObject(any(PutObjectArgs.class));
    }

    @Test
    void oversizedImageIsRejectedBeforeDecodeOrStorage() {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);
        byte[] tooLarge = new byte[(int) ChatImageStorageService.MAX_UPLOAD_BYTES + 1];

        assertCode(
                () -> service.store(
                        UUID.randomUUID(), UUID.randomUUID(),
                        new MockMultipartFile(
                                "file", "large.jpg", "image/jpeg", tooLarge)),
                "CHAT_IMAGE_TOO_LARGE");
        verifyNoInteractions(minio, compression);
    }

    @Test
    void excessivePixelCountIsRejectedFromHeadersBeforeRasterDecode() throws Exception {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);
        byte[] compressedBomb = pngHeader(10_000, 10_000);

        assertCode(
                () -> service.store(
                        UUID.randomUUID(), UUID.randomUUID(),
                        new MockMultipartFile(
                                "file", "compressed-bomb.png", "image/png",
                                compressedBomb)),
                "CHAT_IMAGE_INVALID");

        verifyNoInteractions(minio, compression);
    }

    @Test
    void nonImageContentIsRejectedClearlyWhateverTheFileClaimsToBe() {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);

        assertCode(
                () -> service.store(
                        UUID.randomUUID(), UUID.randomUUID(),
                        new MockMultipartFile(
                                "file", "not-an-image.jpg", "image/jpeg",
                                "this is not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8))),
                "CHAT_IMAGE_UNSUPPORTED_TYPE");
        assertCode(
                () -> service.store(
                        UUID.randomUUID(), UUID.randomUUID(),
                        new MockMultipartFile(
                                "file", "clip.gif", "image/gif", GIF_HEADER)),
                "CHAT_IMAGE_UNSUPPORTED_TYPE");
        verifyNoInteractions(minio, compression);
    }

    /**
     * Phones and browsers routinely mislabel a perfectly good photo ("image/jpg", an empty type,
     * or an extension that does not match). The sniffed content decides, so those uploads must get
     * past validation instead of being turned away with an unsupported-type error.
     */
    @Test
    void mislabelledButValidPhotoIsAcceptedByContent() {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);

        for (String declared : new String[] {"image/jpg", "application/octet-stream", ""}) {
            // Compression is mocked to return null, so a file that clears validation stops at the
            // later re-encode step. Reaching CHAT_IMAGE_INVALID proves it was not type-rejected.
            assertCode(
                    () -> service.store(
                            UUID.randomUUID(), UUID.randomUUID(),
                            new MockMultipartFile("file", "helmet.gif", declared, ONE_PIXEL_PNG)),
                    "CHAT_IMAGE_INVALID");
        }
    }

    @Test
    void customerJpegIsFreshlyEncodedSoTrailingPrivateMetadataIsNotStored() throws Exception {
        BufferedImage source = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        source.setRGB(10, 10, Color.RED.getRGB());
        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        ImageIO.write(source, "jpg", encoded);
        encoded.write("GPSLatitude=10.123;Customer Name".getBytes(StandardCharsets.UTF_8));
        byte[] upload = encoded.toByteArray();

        MinioClient minio = mock(MinioClient.class);
        AtomicReference<byte[]> stored = new AtomicReference<>();
        when(minio.putObject(any(PutObjectArgs.class))).thenAnswer(invocation -> {
            PutObjectArgs args = invocation.getArgument(0);
            stored.set(args.stream().readAllBytes());
            return null;
        });
        ChatImageStorageService service = new ChatImageStorageService(
                minio, new ImageCompressionService());

        service.store(UUID.randomUUID(), UUID.randomUUID(),
                new MockMultipartFile("file", "customer.jpg", "image/jpeg", upload));

        assertThat(new String(stored.get(), StandardCharsets.ISO_8859_1))
                .doesNotContain("GPSLatitude", "Customer Name");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(stored.get()))).isNotNull();
    }

    @Test
    void webpFallbackRemovesExifAndXmpChunksAndClearsTheirFlags() throws Exception {
        ByteArrayOutputStream source = new ByteArrayOutputStream();
        source.write("RIFF".getBytes(StandardCharsets.US_ASCII));
        source.write(new byte[] {0, 0, 0, 0});
        source.write("WEBP".getBytes(StandardCharsets.US_ASCII));
        source.write("VP8X".getBytes(StandardCharsets.US_ASCII));
        source.write(new byte[] {10, 0, 0, 0});
        source.write(new byte[] {0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0});
        source.write("EXIF".getBytes(StandardCharsets.US_ASCII));
        source.write(new byte[] {4, 0, 0, 0});
        source.write("GPS!".getBytes(StandardCharsets.US_ASCII));
        byte[] webp = source.toByteArray();
        int riffSize = webp.length - 8;
        for (int i = 0; i < 4; i++) webp[4 + i] = (byte) (riffSize >>> (i * 8));

        byte[] clean = ChatImageStorageService.stripWebpPrivateMetadata(webp);

        assertThat(clean).isNotNull();
        assertThat(new String(clean, StandardCharsets.ISO_8859_1)).doesNotContain("EXIF", "GPS!");
        assertThat(clean[20] & 0x0c).isZero();
    }

    @Test
    void webpWithoutRuntimeDecoderCannotBypassTheStored1600PixelLimit() throws Exception {
        MinioClient minio = mock(MinioClient.class);
        ImageCompressionService compression = mock(ImageCompressionService.class);
        when(compression.reencodeWithoutMetadata(any(), any(), any())).thenReturn(null);
        ChatImageStorageService service = new ChatImageStorageService(minio, compression);
        byte[] wideWebp = extendedWebpHeader(2_000, 1_000);

        assertCode(
                () -> service.store(
                        UUID.randomUUID(), UUID.randomUUID(),
                        new MockMultipartFile(
                                "file", "wide.webp", "image/webp", wideWebp)),
                "CHAT_IMAGE_INVALID");

        verify(minio, never()).putObject(any(PutObjectArgs.class));
    }

    /** A real GIF: a supported-looking extension that is genuinely an unsupported format. */
    private static final byte[] GIF_HEADER = new byte[] {
            'G', 'I', 'F', '8', '9', 'a', 1, 0, 1, 0, (byte) 0x80, 0, 0,
            0, 0, 0, (byte) 0xff, (byte) 0xff, (byte) 0xff, 0x2c, 0, 0, 0, 0,
            1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b};

    private static void assertCode(ThrowingCall call, String expectedCode) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(ValidationException.class, exception ->
                        assertThat(exception.details()).singleElement()
                                .extracting(detail -> detail.code())
                                .isEqualTo(expectedCode));
    }

    private static byte[] pngHeader(int width, int height) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream output = new DataOutputStream(bytes);
        output.write(new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10});
        ByteArrayOutputStream headerBytes = new ByteArrayOutputStream();
        DataOutputStream header = new DataOutputStream(headerBytes);
        header.writeInt(width);
        header.writeInt(height);
        header.write(new byte[] {8, 2, 0, 0, 0});
        writePngChunk(output, "IHDR", headerBytes.toByteArray());
        writePngChunk(output, "IEND", new byte[0]);
        return bytes.toByteArray();
    }

    private static byte[] extendedWebpHeader(int width, int height) throws Exception {
        ByteArrayOutputStream source = new ByteArrayOutputStream();
        source.write("RIFF".getBytes(StandardCharsets.US_ASCII));
        source.write(new byte[] {22, 0, 0, 0});
        source.write("WEBP".getBytes(StandardCharsets.US_ASCII));
        source.write("VP8X".getBytes(StandardCharsets.US_ASCII));
        source.write(new byte[] {10, 0, 0, 0});
        source.write(0);
        source.write(new byte[] {0, 0, 0});
        writeLittle24(source, width - 1);
        writeLittle24(source, height - 1);
        return source.toByteArray();
    }

    private static void writeLittle24(ByteArrayOutputStream output, int value) {
        output.write(value & 0xff);
        output.write((value >>> 8) & 0xff);
        output.write((value >>> 16) & 0xff);
    }

    private static void writePngChunk(DataOutputStream output, String type, byte[] data)
            throws Exception {
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        output.writeInt(data.length);
        output.write(typeBytes);
        output.write(data);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        output.writeInt((int) crc.getValue());
    }

    @FunctionalInterface
    private interface ThrowingCall {
        void run();
    }
}
