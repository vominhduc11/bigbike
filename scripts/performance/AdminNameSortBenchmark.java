import java.text.CollationKey;
import java.text.Collator;
import java.text.Normalizer;
import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

/**
 * Standalone computational benchmark, not an API or database benchmark.
 * Run: java -Xmx256m scripts/performance/AdminNameSortBenchmark.java
 * Both paths use the same synthetic data, locale, strength, direction and id tie-break.
 * No production records, files, database connections or network requests are used.
 */
public class AdminNameSortBenchmark {
    private record Row(String id, String name) {}
    private record Timing(double milliseconds, long allocatedBytes) {}
    private static final Collator COLLATOR = collator();
    private static final com.sun.management.ThreadMXBean THREADS =
            (com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean();
    private static final String[] NAMES = {
        "Mũ bảo hiểm LS2", "Áo giáp Taichi", "Găng tay bảo hộ", "Đồ bảo hộ", "Dây đai",
        "Kính chắn gió", "Ủng chống nước", "Balo Givi", "Túi đeo hông", "Ốp pô",
        "Ăn ten xe", "Âm thanh", "Áo mưa", "Ép lốp", "Ê tô", "Ô đỡ", "Ơ tô", "Ưu đãi",
        "Đen bóng", "đen bóng", "DEN BONG", "Trắng ngọc trai", "Xanh dương", "Vàng ánh kim"
    };

    private static Collator collator() {
        Collator value = Collator.getInstance(new Locale("vi"));
        value.setStrength(Collator.SECONDARY);
        return value;
    }

    private static Comparator<Row> original(boolean descending) {
        Comparator<Row> byName = Comparator.comparing(Row::name, COLLATOR::compare);
        return (descending ? byName.reversed() : byName).thenComparing(Row::id);
    }

    private static Comparator<Row> candidate(boolean descending) {
        Collator local = (Collator) COLLATOR.clone();
        Map<String, CollationKey> keys = new HashMap<>();
        Comparator<Row> byName = Comparator.comparing(row -> keys.computeIfAbsent(row.name(), local::getCollationKey));
        return (descending ? byName.reversed() : byName).thenComparing(Row::id);
    }

    private static List<Row> data(int size) {
        Random random = new Random(20261113L + size);
        List<Row> result = new ArrayList<>();
        for (int index = 0; index < size; index++) {
            String name = NAMES[random.nextInt(NAMES.length)] + " " + random.nextInt(Math.max(1, size / 3));
            if (index % 7 == 0) name = Normalizer.normalize(name, Normalizer.Form.NFD);
            result.add(new Row(String.format(Locale.ROOT, "product-%08d", index), name));
        }
        Collections.shuffle(result, random);
        return result;
    }

    private static List<Row> sorted(List<Row> rows, boolean optimized, boolean descending) {
        return rows.stream().sorted(optimized ? candidate(descending) : original(descending)).toList();
    }

    private static Timing time(List<Row> rows, boolean optimized) {
        long allocatedBefore = THREADS.getThreadAllocatedBytes(Thread.currentThread().getId());
        long begin = System.nanoTime();
        List<Row> result = sorted(rows, optimized, false);
        double elapsed = (System.nanoTime() - begin) / 1_000_000d;
        long allocated = THREADS.getThreadAllocatedBytes(Thread.currentThread().getId()) - allocatedBefore;
        if (result.size() != rows.size()) throw new AssertionError("Rows lost");
        return new Timing(elapsed, allocated);
    }

    public static void main(String[] args) {
        System.out.println("{\"scope\":\"single-thread synthetic Java name sorting only; excludes DB, hydration and API\",\"java\":\""
                + System.getProperty("java.version") + "\",\"samples\":[");
        int[] sizes = {235, 267, 1000, 10000};
        Random order = new Random(20261113);
        for (int index = 0; index < sizes.length; index++) {
            List<Row> rows = data(sizes[index]);
            for (boolean desc : new boolean[] {false, true}) {
                if (!sorted(rows, false, desc).equals(sorted(rows, true, desc))) {
                    throw new AssertionError("Ordering differs, size=" + rows.size() + ", descending=" + desc);
                }
            }
            for (int warmup = 0; warmup < 3; warmup++) {
                time(rows, false);
                time(rows, true);
            }
            List<Timing> before = new ArrayList<>();
            List<Timing> after = new ArrayList<>();
            // Seeded random order reduces ordering bias; paths never run concurrently.
            for (int run = 0; run < 5; run++) {
                if (order.nextBoolean()) { before.add(time(rows, false)); after.add(time(rows, true)); }
                else { after.add(time(rows, true)); before.add(time(rows, false)); }
            }
            System.out.printf(Locale.ROOT,
                    "%s{\"rows\":%d,\"exact_order_both_directions\":true,\"before_ms\":%s,\"after_ms\":%s,\"before_allocated_bytes\":%s,\"after_allocated_bytes\":%s}%n",
                    index == 0 ? "" : ",", rows.size(),
                    before.stream().map(Timing::milliseconds).toList(), after.stream().map(Timing::milliseconds).toList(),
                    before.stream().map(Timing::allocatedBytes).toList(), after.stream().map(Timing::allocatedBytes).toList());
        }
        System.out.println("]}");
    }
}
