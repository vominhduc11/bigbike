package audit;

import java.nio.file.*;
import java.util.*;
import java.sql.*;
import io.minio.*;
import io.minio.errors.ErrorResponseException;

/** Authenticated object stat for an explicitly enumerated, owner-authorized expired fixture. */
public class CheckVideoObject {
    public static void main(String[] args) throws Exception {
        var props = new Properties();
        try (var input = Files.newInputStream(Path.of(args[0]))) { props.load(input); }
        if (!props.getProperty("spring.datasource.url", "").contains(":55438/")) throw new IllegalArgumentException("Only isolated audit data");
        try (var db = DriverManager.getConnection(props.getProperty("spring.datasource.url"),
                props.getProperty("spring.datasource.username"), props.getProperty("spring.datasource.password"));
             var query = db.prepareStatement("select storage_bucket,storage_object_key,status from chat_videos where id=?")) {
            query.setObject(1, UUID.fromString(args[1]));
            try (var rows = query.executeQuery()) {
                if (!rows.next() || !"DELETED".equals(rows.getString(3))) throw new IllegalStateException("Expected the expired fixture");
                var client = MinioClient.builder().endpoint(props.getProperty("bigbike.minio.endpoint"))
                        .credentials(props.getProperty("bigbike.minio.access-key"), props.getProperty("bigbike.minio.secret-key"))
                        .region("us-east-1").build();
                try {
                    client.statObject(StatObjectArgs.builder().bucket(rows.getString(1)).object(rows.getString(2)).build());
                    throw new IllegalStateException("Expired object still exists");
                } catch (ErrorResponseException absent) {
                    if (!"NoSuchKey".equals(absent.errorResponse().code())) throw absent;
                    System.out.println("{\"caseId\":\"V_EXPIRED_OBJECT_PHYSICALLY_DELETED\",\"metadata\":\"DELETED\",\"authenticatedObjectStat\":\"NoSuchKey\"}");
                }
            }
        }
    }
}
