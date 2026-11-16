package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaFolderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaTagJdbc;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.tika.Tika;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

/** Real 64x64 H.264 MP4 plus bounded content-signature rejection controls. */
@ExtendWith(MockitoExtension.class)
class AdminMediaMp4UploadTest {

    @Mock MediaJpaRepository mediaRepo;
    @Mock MediaFolderJpaRepository folderRepo;
    @Mock AuditLogWriter auditWriter;
    @Mock AuditLogFactory auditFactory;
    @Mock MinioClient minio;
    @Mock MediaReferenceService references;
    @Mock MediaTagJdbc tags;
    @Mock ImageVariantService variants;
    @Mock ImageCompressionService compression;
    private AdminMediaService service;

    @BeforeEach
    void setUp() {
        service = new AdminMediaService(mediaRepo, folderRepo, auditWriter, auditFactory,
                minio, new MinioProperties(), new ObjectMapper(), references, tags, variants, compression);
    }

    @Test
    void realMp4FixtureReproducesTikaGenericQuickTimeDetection() throws Exception {
        byte[] video = video();
        assertThat(new String(video, 4, 4, StandardCharsets.US_ASCII)).isEqualTo("ftyp");
        assertThat(new String(video, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("isom");
        assertThat(new String(video, 28, 4, StandardCharsets.US_ASCII)).isEqualTo("mp41");
        assertThat(new Tika().detect(video)).isEqualTo("video/quicktime");
        assertThat(new Tika().detect(Arrays.copyOf(video, Math.min(video.length, 8192))))
                .isEqualTo("video/quicktime");
    }

    @ParameterizedTest
    @CsvSource({"isom,mp41", "isom,mp42", "iso2,mp41", "iso2,mp42", "mp41,mp41", "mp42,mp42"})
    void storesRealMp4BytesAndMimeForExplicitMp4Brands(String major, String compatible) throws Exception {
        byte[] video = video();
        brand(video, 8, major);
        brand(video, 28, compatible);
        assertStoredVideo(video);
    }

    private void assertStoredVideo(byte[] video) throws Exception {
        when(mediaRepo.findByContentSha256(anyString())).thenReturn(Optional.empty());
        when(variants.generateAndUpload(any(), anyString(), anyString())).thenReturn(Map.of());
        when(mediaRepo.save(any())).thenAnswer(call -> {
            MediaEntity media = call.getArgument(0);
            media.setId(UUID.randomUUID());
            return media;
        });
        AtomicReference<byte[]> stored = new AtomicReference<>();
        when(minio.putObject(any(PutObjectArgs.class))).thenAnswer(call -> {
            PutObjectArgs args = call.getArgument(0);
            stored.set(args.stream().readAllBytes());
            assertThat(args.contentType()).isEqualTo("video/mp4");
            return null;
        });

        // A filename hint cannot be responsible for accepting this valid content.
        var result = service.storeMediaBytes(video, "synthetic-video.payload", "video/mp4",
                "Video kiểm thử tổng hợp", null, false, UUID.randomUUID());

        assertThat(result.mimeType()).isEqualTo("video/mp4");
        assertThat(result.fileSize()).isEqualTo((long) video.length);
        assertThat(result.width()).isNull();
        assertThat(result.height()).isNull();
        assertThat(result.publicUrl()).startsWith("/media/uploads/");
        assertThat(stored.get()).containsExactly(video);
        ArgumentCaptor<MediaEntity> entity = ArgumentCaptor.forClass(MediaEntity.class);
        verify(mediaRepo).save(entity.capture());
        assertThat(entity.getValue().getContentSha256())
                .isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(video)));
        verifyNoInteractions(compression);
    }

    @ParameterizedTest
    @ValueSource(strings = {"isom", "iso2", "qt  ", "M4A ", "avif"})
    void rejectsBareIsoBaseAndNonMp4MajorBrands(String major) {
        byte[] header = ftyp(major, "isom");
        if (!major.equals("isom") && !major.equals("iso2")) {
            brand(header, 16, "mp41");
        }
        reject(header, "video/mp4", "MIME_MISMATCH");
    }

    @Test
    void rejectsMp4BrandOutsideTheDeclaredFtypBox() {
        byte[] header = Arrays.copyOf(ftyp("isom", "iso2"), 24);
        brand(header, 20, "mp41");
        reject(header, "video/mp4", "MIME_MISMATCH");
    }

    @ParameterizedTest
    @ValueSource(longs = {0, 1, 12, 16, 19, 21, 28, 2147483668L, 4294967295L})
    void rejectsUnsupportedTruncatedMisalignedAndUnsignedFtypSizes(long claimedSize) {
        byte[] header = Arrays.copyOf(ftyp("isom", "mp41"), 24);
        ByteBuffer.wrap(header).putInt((int) claimedSize);
        reject(header, "video/mp4", "MIME_MISMATCH");
    }

    @Test
    void rejectsCompleteFtypBoxBeyondTheExistingDetectionBudget() {
        byte[] header = Arrays.copyOf(ftyp("isom", "mp41"), 8196);
        ByteBuffer.wrap(header).putInt(header.length);
        reject(header, "video/mp4", "MIME_MISMATCH");
    }

    @Test
    void rejectsLaterFtypInsteadOfScanningArbitraryPayload() {
        byte[] header = new byte[28];
        ByteBuffer.wrap(header).putInt(8).put("free".getBytes(StandardCharsets.US_ASCII));
        System.arraycopy(ftyp("isom", "mp41"), 0, header, 8, 20);
        reject(header, "video/mp4", "MIME_MISMATCH");
    }

    @Test
    void declaredMimeAndAllowedImageTypesStillMustMatchActualContent() throws Exception {
        reject(video(), "image/jpeg", "MIME_MISMATCH");
        reject(video(), "video/quicktime", "INVALID_MIME");
        reject(new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10}, "video/mp4", "MIME_MISMATCH");
    }

    @Test
    void rejectsRealAudioOnlyIsoBaseMp4EvenWhenDeclaredAsVideo() throws Exception {
        try (var input = Objects.requireNonNull(getClass().getResourceAsStream("/media/admin-isom-audio.mp4"))) {
            byte[] audio = input.readAllBytes();
            assertThat(new String(audio, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("isom");
            assertThat(new Tika().detect(audio)).isEqualTo("video/quicktime");
            reject(audio, "video/mp4", "MIME_MISMATCH");
        }
    }

    @Test
    void acceptsRealVideoWithMovieMetadataAfterMediaPayload() throws Exception {
        try (var input = Objects.requireNonNull(getClass().getResourceAsStream("/media/admin-isom-tail-video.mp4"))) {
            byte[] video = input.readAllBytes();
            String markers = new String(video, StandardCharsets.ISO_8859_1);
            assertThat(markers.indexOf("mdat")).isLessThan(markers.indexOf("moov"));
            assertStoredVideo(video);
        }
    }

    @Test
    void doesNotSearchForFakeVideoHandlerInsidePayloadOrWrongContainerPath() {
        byte[] videoMetadata = box("moov", box("trak", box("mdia", videoHandler())));
        for (byte[] payload : new byte[][] {box("mdat", videoMetadata), box("free", videoMetadata),
                box("moov", videoHandler()), box("moov", box("udta", videoMetadata))}) {
            reject(join(ftyp("isom", "mp41"), payload), "video/mp4", "MIME_MISMATCH");
        }
    }

    @Test
    void recognizesExtendedContainerHeadersWithoutIntegerOverflow() throws Exception {
        byte[] track = box("trak", box("mdia", videoHandler()));
        byte[] extended = ByteBuffer.allocate(track.length + 16).putInt(1)
                .put("moov".getBytes(StandardCharsets.US_ASCII)).putLong(track.length + 16L).put(track).array();
        // Structural signature control; full codec validation is outside this detector.
        assertStoredVideo(join(ftyp("isom", "mp41"), extended));
    }

    @Test
    void rejectsTruncatedAndOverflowingNestedBoxes() {
        for (long length : new long[] {1, 7, 19, 128, 2147483648L, 4294967295L}) {
            byte[] handler = videoHandler();
            ByteBuffer.wrap(handler).putInt((int) length);
            reject(join(ftyp("isom", "mp41"), box("moov", box("trak", box("mdia", handler)))),
                    "video/mp4", "MIME_MISMATCH");
        }
    }

    @Test
    void rejectsExhaustedMetadataBudgetBeforeAcceptingLaterVideoMarker() {
        ByteBuffer boxes = ByteBuffer.allocate(1024 * 8);
        for (int index = 0; index < 1024; index++) boxes.put(box("free", new byte[0]));
        reject(join(ftyp("isom", "mp41"), join(boxes.array(), box("moov", box("trak", box("mdia", videoHandler()))))),
                "video/mp4", "MIME_MISMATCH");
    }

    private static byte[] box(String type, byte[] payload) {
        return ByteBuffer.allocate(payload.length + 8).putInt(payload.length + 8)
                .put(type.getBytes(StandardCharsets.US_ASCII)).put(payload).array();
    }

    private static byte[] videoHandler() {
        byte[] payload = new byte[24];
        brand(payload, 8, "vide");
        return box("hdlr", payload);
    }

    private static byte[] join(byte[] first, byte[] second) {
        return ByteBuffer.allocate(first.length + second.length).put(first).put(second).array();
    }

    private void reject(byte[] bytes, String declared, String detailCode) {
        assertThatThrownBy(() -> service.storeMediaBytes(bytes, "renamed.mp4", declared,
                "", null, false, UUID.randomUUID()))
                .isInstanceOfSatisfying(ValidationException.class,
                        error -> assertThat(error.details().get(0).code()).isEqualTo(detailCode));
        verifyNoInteractions(mediaRepo, minio, variants, compression);
    }

    private static byte[] video() throws Exception {
        try (var input = Objects.requireNonNull(AdminMediaMp4UploadTest.class
                .getResourceAsStream("/media/admin-isom-video.mp4"))) {
            return input.readAllBytes();
        }
    }

    private static byte[] ftyp(String major, String compatible) {
        return ByteBuffer.allocate(20).putInt(20).put("ftyp".getBytes(StandardCharsets.US_ASCII))
                .put(major.getBytes(StandardCharsets.US_ASCII)).putInt(0)
                .put(compatible.getBytes(StandardCharsets.US_ASCII)).array();
    }

    private static void brand(byte[] bytes, int offset, String value) {
        System.arraycopy(value.getBytes(StandardCharsets.US_ASCII), 0, bytes, offset, 4);
    }
}
