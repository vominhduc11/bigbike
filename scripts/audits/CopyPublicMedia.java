package audit;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.URI;
import java.util.Properties;

/** Copy only public catalog images into isolated storage. No customer files or writes to source. */
public class CopyPublicMedia {
    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        Properties properties = new Properties();
        try (var in = Files.newInputStream(directory.resolve("application-audit.properties"))) { properties.load(in); }
        MinioClient destination = MinioClient.builder()
                .endpoint(properties.getProperty("bigbike.minio.endpoint"))
                .credentials(properties.getProperty("bigbike.minio.access-key"), properties.getProperty("bigbike.minio.secret-key"))
                .build();
        int copied = 0, missing = 0;
        for (String key : Files.readAllLines(directory.resolve("catalog-image-keys.txt"))) {
            if (key.contains("..") || key.startsWith("/")) throw new IllegalArgumentException("Invalid catalog key");
            try {
                var connection = URI.create("http://localhost:9000/bigbike-media/" + key.replace(" ", "%20")).toURL().openConnection();
                connection.setConnectTimeout(5000); connection.setReadTimeout(15000);
                try (var source = connection.getInputStream()) {
                    byte[] bytes = source.readNBytes(40 * 1024 * 1024 + 1);
                    if (bytes.length > 40 * 1024 * 1024) throw new IllegalStateException("Catalog image too large");
                    destination.putObject(PutObjectArgs.builder().bucket("bigbike-media").object(key)
                            .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                            .contentType(connection.getContentType()).build());
                }
                copied++;
            } catch (Exception unavailable) { missing++; }
        }
        System.out.println("Public catalog images copied=" + copied + " unavailable=" + missing);
    }
}
