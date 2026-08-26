package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.config.MinioProperties;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatProductImageFingerprintEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatProductImageFingerprintJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Strict, provider-free comparison between one customer image and public catalog images.
 *
 * <p>The stored fingerprints belong only to public product media. The customer descriptor is a
 * local variable and is discarded when this method returns. A specific product is accepted only
 * for an exact content hash or a high shape/color/aspect score with a clear margin over runner-up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatProductImageFingerprintService {

    static final String FINGERPRINT_VERSION = "local-visual-v1";
    private static final long MAX_CATALOG_IMAGE_BYTES = 16L * 1024 * 1024;
    private static final Pattern THUMB_URL = Pattern.compile(
            "\\\"thumb\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final double MIN_SHAPE_SIMILARITY = 0.90d;
    private static final double MIN_COLOR_SIMILARITY = 0.88d;
    private static final double MIN_ASPECT_SIMILARITY = 0.92d;
    private static final double MIN_TOTAL_SIMILARITY = 0.91d;
    private static final double MIN_RUNNER_UP_MARGIN = 0.035d;

    private final ChatProductImageFingerprintJpaRepository fingerprintRepo;
    private final MediaJpaRepository mediaRepo;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    /**
     * Synchronized because the current deployment is one backend instance and concurrent first
     * image turns must not race the unique product/version row while warming the catalog index.
     */
    public synchronized Optional<VisualMatch> findStrictMatch(
            byte[] customerBytes,
            String customerSha256,
            List<Product> products
    ) {
        Optional<Fingerprint> customer = fingerprint(customerBytes);
        if (customer.isEmpty()) return Optional.empty();
        List<Product> sellable = products == null ? List.of() : products.stream()
                .filter(product -> product != null && product.id() != null
                        && product.slug() != null && product.image() != null)
                .filter(product -> "IN_STOCK".equals(ChatToolService.toCard(product).stockState()))
                .sorted(Comparator.comparing(Product::id))
                .limit(500)
                .toList();
        if (sellable.isEmpty()) return Optional.empty();

        Map<String, ResolvedImage> resolved = resolveCatalogImages(sellable);
        if (resolved.isEmpty()) return Optional.empty();
        Map<String, ChatProductImageFingerprintEntity> existing = fingerprintRepo
                .findByProductIdInAndFingerprintVersion(resolved.keySet(), FINGERPRINT_VERSION)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        ChatProductImageFingerprintEntity::getProductId,
                        item -> item,
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        List<CatalogFingerprint> catalog = new ArrayList<>();
        int refreshFailures = 0;
        for (Product product : sellable) {
            ResolvedImage source = resolved.get(product.id());
            if (source == null) continue;
            ChatProductImageFingerprintEntity row = existing.get(product.id());
            Optional<Fingerprint> value = reusable(row, source)
                    ? decode(row)
                    : Optional.empty();
            if (value.isEmpty()) {
                try {
                    value = readAndFingerprint(source);
                    if (value.isPresent()) {
                        row = saveFingerprint(row, product.id(), source, value.get());
                    }
                } catch (RuntimeException exception) {
                    refreshFailures++;
                }
            }
            if (value.isPresent()) {
                catalog.add(new CatalogFingerprint(
                        product.id(), product.slug(), source.contentSha256(), value.get()));
            }
        }
        if (refreshFailures > 0) {
            log.warn("chat_product_fingerprint_refresh_partial failures={} indexed={}",
                    refreshFailures, catalog.size());
        }
        if (catalog.isEmpty()) return Optional.empty();

        String normalizedCustomerSha = normalizedSha(customerSha256);
        if (normalizedCustomerSha != null) {
            List<CatalogFingerprint> exact = catalog.stream()
                    .filter(item -> normalizedCustomerSha.equals(item.contentSha256()))
                    .toList();
            if (exact.size() == 1) {
                CatalogFingerprint item = exact.get(0);
                return Optional.of(new VisualMatch(
                        item.productId(), item.slug(), BigDecimal.ONE, "CONTENT_SHA256"));
            }
            // One public image assigned to multiple products is ambiguous; never pick one.
            if (exact.size() > 1) return Optional.empty();
        }

        List<Scored> scored = catalog.stream()
                .map(item -> score(customer.get(), item))
                .sorted(Comparator.comparingDouble(Scored::total).reversed())
                .toList();
        Scored best = scored.get(0);
        double runnerUp = scored.size() > 1 ? scored.get(1).total() : 0d;
        if (best.shape() < MIN_SHAPE_SIMILARITY
                || best.color() < MIN_COLOR_SIMILARITY
                || best.aspect() < MIN_ASPECT_SIMILARITY
                || best.total() < MIN_TOTAL_SIMILARITY
                || best.total() - runnerUp < MIN_RUNNER_UP_MARGIN) {
            return Optional.empty();
        }
        return Optional.of(new VisualMatch(
                best.item().productId(), best.item().slug(),
                BigDecimal.valueOf(best.total()).setScale(4, RoundingMode.HALF_UP),
                "LOCAL_VISUAL_FINGERPRINT"));
    }

    private Map<String, ResolvedImage> resolveCatalogImages(List<Product> products) {
        Set<UUID> mediaIds = new LinkedHashSet<>();
        Set<Long> legacyIds = new LinkedHashSet<>();
        Set<String> urls = new LinkedHashSet<>();
        Set<String> objectKeys = new LinkedHashSet<>();
        for (Product product : products) {
            ImageAsset image = product.image();
            String id = image.id() == null ? "" : image.id().trim();
            if (id.matches("\\d+")) {
                try {
                    legacyIds.add(Long.parseLong(id));
                } catch (NumberFormatException ignored) {
                    // Out-of-range historical id cannot resolve a media row.
                }
            } else {
                parseUuid(id).ifPresent(mediaIds::add);
            }
            if (image.url() != null && !image.url().isBlank()) urls.add(image.url().trim());
            objectKey(image.url()).ifPresent(objectKeys::add);
        }

        List<MediaEntity> media = new ArrayList<>();
        if (!mediaIds.isEmpty()) media.addAll(mediaRepo.findAllById(mediaIds));
        if (!legacyIds.isEmpty()) media.addAll(mediaRepo.findByLegacyIdIn(legacyIds));
        if (!urls.isEmpty()) media.addAll(mediaRepo.findByPublicUrlIn(urls));
        if (!objectKeys.isEmpty()) media.addAll(mediaRepo.findByFilePathIn(objectKeys));

        Map<UUID, MediaEntity> byId = new HashMap<>();
        Map<Long, MediaEntity> byLegacy = new HashMap<>();
        Map<String, MediaEntity> byUrl = new HashMap<>();
        Map<String, MediaEntity> byPath = new HashMap<>();
        for (MediaEntity item : media) {
            if (item == null) continue;
            if (item.getId() != null) byId.putIfAbsent(item.getId(), item);
            if (item.getLegacyId() != null) byLegacy.putIfAbsent(item.getLegacyId(), item);
            if (item.getPublicUrl() != null) byUrl.putIfAbsent(item.getPublicUrl(), item);
            if (item.getFilePath() != null) byPath.putIfAbsent(item.getFilePath(), item);
        }

        Map<String, ResolvedImage> result = new LinkedHashMap<>();
        for (Product product : products) {
            ImageAsset image = product.image();
            String id = image.id() == null ? "" : image.id().trim();
            MediaEntity item = null;
            if (id.matches("\\d+")) {
                try {
                    item = byLegacy.get(Long.parseLong(id));
                } catch (NumberFormatException ignored) {
                    // Already treated as unresolved above.
                }
            } else {
                item = parseUuid(id).map(byId::get).orElse(null);
            }
            if (item == null && image.url() != null) item = byUrl.get(image.url().trim());
            Optional<String> parsedKey = objectKey(image.url());
            if (item == null && parsedKey.isPresent()) item = byPath.get(parsedKey.get());
            if (item == null
                    || !"MINIO".equalsIgnoreCase(item.getStorageProvider())
                    || item.getFilePath() == null || item.getFilePath().isBlank()) {
                continue;
            }
            String bucket = item.getBucket() == null || item.getBucket().isBlank()
                    ? minioProperties.getBucket() : item.getBucket().trim();
            String readKey = thumbObjectKey(item.getSizes()).orElse(item.getFilePath());
            String sourceVersion = normalizedSha(item.getContentSha256());
            String contentSha = sourceVersion;
            if (sourceVersion == null) {
                sourceVersion = sha256((item.getId() + "|" + item.getFilePath() + "|"
                        + item.getFileSize() + "|" + item.getUpdatedAt() + "|" + item.getSizes())
                        .getBytes(StandardCharsets.UTF_8));
            }
            result.put(product.id(), new ResolvedImage(
                    item.getId(), bucket, item.getFilePath(), readKey, sourceVersion, contentSha));
        }
        return result;
    }

    private Optional<Fingerprint> readAndFingerprint(ResolvedImage source) {
        try (InputStream input = minioClient.getObject(GetObjectArgs.builder()
                .bucket(source.bucket()).object(source.readObjectKey()).build())) {
            byte[] bytes = input.readNBytes((int) MAX_CATALOG_IMAGE_BYTES + 1);
            if (bytes.length > MAX_CATALOG_IMAGE_BYTES) return Optional.empty();
            return fingerprint(bytes);
        } catch (Exception exception) {
            throw new IllegalStateException("Catalog image is unavailable", exception);
        }
    }

    private ChatProductImageFingerprintEntity saveFingerprint(
            ChatProductImageFingerprintEntity row,
            String productId,
            ResolvedImage source,
            Fingerprint value
    ) {
        ChatProductImageFingerprintEntity entity = row == null
                ? new ChatProductImageFingerprintEntity() : row;
        entity.setProductId(productId);
        entity.setMediaId(source.mediaId());
        entity.setImageRef(source.originalObjectKey());
        entity.setSourceVersionHash(source.sourceVersionHash());
        entity.setFingerprintVersion(FINGERPRINT_VERSION);
        entity.setDHashHex(String.format(Locale.ROOT, "%016x", value.dHash()));
        entity.setColorHistogram(encodeHistogram(value.histogram()));
        entity.setAspectRatio(BigDecimal.valueOf(value.aspectRatio())
                .setScale(6, RoundingMode.HALF_UP));
        return fingerprintRepo.save(entity);
    }

    private static boolean reusable(
            ChatProductImageFingerprintEntity row,
            ResolvedImage source
    ) {
        return row != null
                && FINGERPRINT_VERSION.equals(row.getFingerprintVersion())
                && source.originalObjectKey().equals(row.getImageRef())
                && source.sourceVersionHash().equals(row.getSourceVersionHash());
    }

    private static Optional<Fingerprint> decode(ChatProductImageFingerprintEntity row) {
        try {
            long hash = Long.parseUnsignedLong(row.getDHashHex(), 16);
            double[] histogram = decodeHistogram(row.getColorHistogram());
            double aspect = row.getAspectRatio().doubleValue();
            if (histogram.length != 12 || aspect <= 0d) return Optional.empty();
            return Optional.of(new Fingerprint(hash, histogram, aspect));
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    static Optional<Fingerprint> fingerprint(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return Optional.empty();
        try {
            BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(bytes));
            if (decoded == null || decoded.getWidth() <= 0 || decoded.getHeight() <= 0) {
                return Optional.empty();
            }
            BufferedImage opaque = new BufferedImage(
                    decoded.getWidth(), decoded.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D base = opaque.createGraphics();
            base.setColor(Color.WHITE);
            base.fillRect(0, 0, opaque.getWidth(), opaque.getHeight());
            base.setComposite(AlphaComposite.SrcOver);
            base.drawImage(decoded, 0, 0, null);
            base.dispose();

            BufferedImage hashImage = resize(opaque, 9, 8);
            long dHash = 0L;
            int bit = 0;
            for (int y = 0; y < 8; y++) {
                for (int x = 0; x < 8; x++) {
                    if (luminance(hashImage.getRGB(x, y))
                            > luminance(hashImage.getRGB(x + 1, y))) {
                        dHash |= 1L << bit;
                    }
                    bit++;
                }
            }

            BufferedImage colorImage = resize(opaque, 64, 64);
            double[] histogram = new double[12];
            for (int y = 0; y < colorImage.getHeight(); y++) {
                for (int x = 0; x < colorImage.getWidth(); x++) {
                    int rgb = colorImage.getRGB(x, y);
                    histogram[((rgb >>> 16) & 0xff) / 64]++;
                    histogram[4 + ((rgb >>> 8) & 0xff) / 64]++;
                    histogram[8 + (rgb & 0xff) / 64]++;
                }
            }
            double pixels = colorImage.getWidth() * colorImage.getHeight();
            for (int i = 0; i < histogram.length; i++) histogram[i] /= pixels;
            return Optional.of(new Fingerprint(
                    dHash, histogram, (double) decoded.getWidth() / decoded.getHeight()));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private static Scored score(Fingerprint customer, CatalogFingerprint item) {
        Fingerprint catalog = item.fingerprint();
        double shape = 1d - Long.bitCount(customer.dHash() ^ catalog.dHash()) / 64d;
        double colorDistance = 0d;
        for (int i = 0; i < customer.histogram().length; i++) {
            colorDistance += Math.abs(customer.histogram()[i] - catalog.histogram()[i]);
        }
        double color = Math.max(0d, 1d - colorDistance / 6d);
        double aspect = Math.exp(-2d * Math.abs(Math.log(
                customer.aspectRatio() / catalog.aspectRatio())));
        double total = 0.45d * shape + 0.45d * color + 0.10d * aspect;
        return new Scored(item, shape, color, aspect, total);
    }

    private static BufferedImage resize(BufferedImage source, int width, int height) {
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = resized.createGraphics();
        graphics.setRenderingHint(
                RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        graphics.setRenderingHint(
                RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(source, 0, 0, width, height, null);
        graphics.dispose();
        return resized;
    }

    private static int luminance(int rgb) {
        int red = (rgb >>> 16) & 0xff;
        int green = (rgb >>> 8) & 0xff;
        int blue = rgb & 0xff;
        return (299 * red + 587 * green + 114 * blue) / 1000;
    }

    private static String encodeHistogram(double[] values) {
        List<String> encoded = new ArrayList<>(values.length);
        for (double value : values) encoded.add(String.format(Locale.ROOT, "%.8f", value));
        return String.join(",", encoded);
    }

    private static double[] decodeHistogram(String value) {
        if (value == null || value.isBlank()) return new double[0];
        String[] parts = value.split(",");
        double[] result = new double[parts.length];
        for (int i = 0; i < parts.length; i++) result[i] = Double.parseDouble(parts[i]);
        return result;
    }

    private static Optional<String> thumbObjectKey(String sizes) {
        if (sizes == null || sizes.isBlank()) return Optional.empty();
        Matcher matcher = THUMB_URL.matcher(sizes);
        if (!matcher.find()) return Optional.empty();
        return objectKey(matcher.group(1));
    }

    private static Optional<String> objectKey(String url) {
        if (url == null || url.isBlank()) return Optional.empty();
        String clean = url.trim().replace("\\/", "/");
        int media = clean.indexOf("/media/");
        if (media >= 0 && media + 7 < clean.length()) {
            return Optional.of(clean.substring(media + 7).split("[?#]", 2)[0]);
        }
        return Optional.empty();
    }

    private static Optional<UUID> parseUuid(String value) {
        try {
            return value == null || value.isBlank()
                    ? Optional.empty() : Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private static String normalizedSha(String value) {
        if (value == null) return null;
        String clean = value.trim().toLowerCase(Locale.ROOT);
        return clean.matches("[0-9a-f]{64}") ? clean : null;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public record VisualMatch(
            String productId,
            String slug,
            BigDecimal score,
            String evidence
    ) {}

    record Fingerprint(long dHash, double[] histogram, double aspectRatio) {}

    private record ResolvedImage(
            UUID mediaId,
            String bucket,
            String originalObjectKey,
            String readObjectKey,
            String sourceVersionHash,
            String contentSha256
    ) {}

    private record CatalogFingerprint(
            String productId,
            String slug,
            String contentSha256,
            Fingerprint fingerprint
    ) {}

    private record Scored(
            CatalogFingerprint item,
            double shape,
            double color,
            double aspect,
            double total
    ) {}
}
