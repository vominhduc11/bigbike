import com.bigbike.bigbike_backend.service.media.CompressionProfile;
import com.bigbike.bigbike_backend.service.media.ImageCompressionService;
import com.sun.management.ThreadMXBean;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Random;
import javax.imageio.ImageIO;

/**
 * Offline component profile: no HTTP, database, storage, credentials or shop files.
 * Compile against an isolated copy of the actual compression source. Run modes in
 * separate JVMs with the same heap and fixtures; timings are descriptive lab data.
 * repeated = current variant pipeline (one inspection + one decode per variant).
 * reuse = the optional overload reusing the inspection's decoded source.
 * decode-four/decode-one isolate decode cost before proposing an implementation.
 */
public final class VariantDecodeProfile {
    private static final int[] WIDTHS = {300, 800, 1600};
    private static final int WARMUP = 2;
    private static volatile Object sink;

    private record Fixture(String name, String mime, byte[] bytes) {}
    private record Sample(long nanos, long allocatedBytes, List<byte[]> outputs, int decodes) {}

    public static void main(String[] args) throws Exception {
        if (args.length != 3) {
            throw new IllegalArgumentException("mode samples backend-test-resource-directory");
        }
        String mode = args[0];
        if (!List.of("repeated", "reuse", "decode-four", "decode-one").contains(mode)) {
            throw new IllegalArgumentException("Unknown profile mode");
        }
        int samples = Integer.parseInt(args[1]);
        if (samples < 3 || samples > 10) throw new IllegalArgumentException("Use 3..10 samples");
        ImageIO.scanForPlugins();
        ImageCompressionService service = new ImageCompressionService();
        Method decodedCompress = mode.equals("reuse")
                ? ImageCompressionService.class.getMethod("compress", byte[].class, String.class,
                        CompressionProfile.class, BufferedImage.class) : null;
        var bean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        if (!bean.isThreadAllocatedMemorySupported()) {
            throw new IllegalStateException("Thread allocation measurement unavailable");
        }
        bean.setThreadAllocatedMemoryEnabled(true);
        List<Fixture> fixtures = new ArrayList<>();
        fixtures.add(new Fixture("jpeg-noise-2000x1200", "image/jpeg", encode(false, "jpg")));
        fixtures.add(new Fixture("png-opaque-noise-2000x1200", "image/png", encode(false, "png")));
        fixtures.add(new Fixture("png-alpha-noise-2000x1200", "image/png", encode(true, "png")));
        for (String webp : List.of("customer-photo-wide.webp", "customer-photo-alpha.webp")) {
            fixtures.add(new Fixture(webp, "image/webp", Files.readAllBytes(Path.of(args[2], "chat", webp))));
        }
        List<String> results = new ArrayList<>();
        for (Fixture fixture : fixtures) {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(fixture.bytes));
            if (original == null) throw new IllegalStateException("Fixture decoder missing: " + fixture.name);
            for (int i = 0; i < WARMUP; i++) profile(mode, fixture, service, decodedCompress, bean);
            long[] nanos = new long[samples];
            long[] allocations = new long[samples];
            Sample last = null;
            for (int i = 0; i < samples; i++) {
                last = profile(mode, fixture, service, decodedCompress, bean);
                nanos[i] = last.nanos;
                allocations[i] = last.allocatedBytes;
            }
            List<String> outputs = new ArrayList<>();
            for (byte[] bytes : last.outputs) {
                BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(bytes));
                if (decoded == null) throw new IllegalStateException("Output decoder missing");
                outputs.add("{\"sha256\":\"" + hash(bytes) + "\",\"bytes\":" + bytes.length
                        + ",\"width\":" + decoded.getWidth() + ",\"height\":" + decoded.getHeight()
                        + ",\"alpha\":" + decoded.getColorModel().hasAlpha()
                        + ",\"corner_alpha\":" + (decoded.getRGB(0, 0) >>> 24) + "}");
            }
            long[] sortedNanos = nanos.clone();
            long[] sortedAllocations = allocations.clone();
            Arrays.sort(sortedNanos);
            Arrays.sort(sortedAllocations);
            results.add("{\"fixture\":\"" + fixture.name + "\",\"source_sha256\":\""
                    + hash(fixture.bytes) + "\",\"source_bytes\":" + fixture.bytes.length
                    + ",\"source_width\":" + original.getWidth() + ",\"source_height\":"
                    + original.getHeight() + ",\"decodes_per_set\":" + last.decodes
                    + ",\"sample_nanos\":" + Arrays.toString(nanos)
                    + ",\"sample_allocated_bytes\":" + Arrays.toString(allocations)
                    + ",\"median_millis\":" + sortedNanos[samples / 2] / 1_000_000.0
                    + ",\"median_allocated_bytes\":" + sortedAllocations[samples / 2]
                    + ",\"outputs\":[" + String.join(",", outputs) + "]}");
        }
        System.out.println("{\"scope\":\"Offline decode/compression component only; no upload/network/storage time; no capacity or field-CWV claim\","
                + "\"mode\":\"" + mode + "\",\"java_version\":\"" + System.getProperty("java.version")
                + "\",\"max_heap_bytes\":" + Runtime.getRuntime().maxMemory()
                + ",\"warmup_sets\":" + WARMUP + ",\"samples\":" + samples
                + ",\"results\":[" + String.join(",", results) + "]}");
    }

    private static Sample profile(String mode, Fixture fixture, ImageCompressionService service,
            Method decodedCompress, ThreadMXBean bean) throws Exception {
        long allocatedBefore = bean.getThreadAllocatedBytes(Thread.currentThread().getId());
        long start = System.nanoTime();
        List<byte[]> outputs = new ArrayList<>();
        int decodes = 0;
        if (mode.startsWith("decode-")) {
            int count = mode.equals("decode-four") ? 4 : 1;
            for (int i = 0; i < count; i++) {
                sink = ImageIO.read(new ByteArrayInputStream(fixture.bytes));
                decodes++;
            }
        } else {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(fixture.bytes));
            decodes++;
            for (int width : WIDTHS) {
                if (source.getWidth() <= width) continue;
                CompressionProfile profile = new CompressionProfile(width, width, 0.85f, false);
                byte[] resized;
                if (mode.equals("reuse")) {
                    resized = (byte[]) decodedCompress.invoke(service, fixture.bytes, fixture.mime, profile, source);
                } else {
                    resized = service.compress(fixture.bytes, fixture.mime, profile);
                    decodes++;
                }
                // Retain fail-soft results too: hashes must prove skipped variants unchanged.
                outputs.add(resized);
            }
            sink = source;
        }
        long elapsed = System.nanoTime() - start;
        long allocated = bean.getThreadAllocatedBytes(Thread.currentThread().getId()) - allocatedBefore;
        return new Sample(elapsed, allocated, outputs, decodes);
    }

    private static byte[] encode(boolean alpha, String format) throws Exception {
        var image = new BufferedImage(2000, 1200,
                alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        var random = new Random(17);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                image.setRGB(x, y, (alpha ? 0x60000000 : 0xff000000) | random.nextInt(0x1000000));
            }
        }
        var output = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, output)) throw new IllegalStateException("Fixture writer missing");
        return output.toByteArray();
    }

    private static String hash(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
