package db.migration;

import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Di chuyển dữ liệu từ 2 bảng con {@code product_gallery_images}/{@code product_videos}
 * sang 2 cột JSONB mới trên {@code products} (thêm ở V334) — dùng đúng record domain
 * {@link GalleryMedia}/{@link VideoAsset}/{@link ImageAsset} (không hand-roll JSON) để output
 * khớp đúng những gì {@code ProductGalleryConverter}/{@code ProductVideosConverter} tự đọc lại
 * được, và khớp logic lọc dòng rỗng mà {@code JpaCatalogReadRepository.toGalleryMedia} vẫn áp
 * dụng ở runtime (ảnh thiếu url / video thiếu videoUrl bị bỏ).
 *
 * <p>CHỈ áp dụng cho gallery/video CẤP SẢN PHẨM ({@code product_gallery_images}/{@code
 * product_videos}) — KHÔNG đụng {@code product_variant_gallery_images} (gallery theo biến thể
 * màu/size), bảng đó giữ nguyên @OneToMany.
 *
 * <p>Đã audit dữ liệu thật trước khi viết migration này (225 sản phẩm, Postgres đang chạy):
 * {@code product_gallery_images} 960 dòng / 209 sản phẩm (959 {@code image} / 1 {@code video},
 * 0 dòng rỗng — ảnh thiếu {@code image_url} hoặc video thiếu {@code video_url}),
 * {@code product_videos} 2 dòng / 1 sản phẩm (0 dòng thiếu {@code video_url}).
 *
 * <p>Prerequisite cho V336 xoá 2 bảng con này.
 */
public class V335__MigrateProductGalleryVideosToJsonb extends BaseJavaMigration {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection conn = context.getConnection();
        int gallery = migrateGallery(conn);
        int videos = migrateVideos(conn);
        System.out.printf(
                "[V335] migrated gallery for %d, videos for %d product(s) into JSONB%n",
                gallery, videos);
    }

    private int migrateGallery(Connection conn) throws Exception {
        Map<String, List<GalleryMedia>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, media_type, video_url, video_provider, "
                        + "image_id, image_url, image_alt, image_width, image_height, image_mime_type "
                        + "FROM product_gallery_images ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                String mediaType = rs.getString("media_type");
                ImageAsset image = toImageAsset(rs);

                if ("video".equals(mediaType)) {
                    String videoUrl = rs.getString("video_url");
                    // Khớp toGalleryMedia() runtime: item video thiếu videoUrl bị bỏ.
                    if (videoUrl == null || videoUrl.isBlank()) {
                        continue;
                    }
                    byProduct.computeIfAbsent(productId, k -> new ArrayList<>())
                            .add(GalleryMedia.ofVideo(image, videoUrl, rs.getString("video_provider")));
                } else {
                    // Khớp toGalleryMedia() runtime: item ảnh thiếu image (url null/blank) bị bỏ.
                    if (image == null) {
                        continue;
                    }
                    byProduct.computeIfAbsent(productId, k -> new ArrayList<>())
                            .add(GalleryMedia.ofImage(image));
                }
            }
        }
        return writeJsonColumn(conn, "gallery", byProduct);
    }

    private int migrateVideos(Connection conn) throws Exception {
        Map<String, List<VideoAsset>> byProduct = new LinkedHashMap<>();
        try (PreparedStatement select = conn.prepareStatement(
                "SELECT product_id, video_id, video_url, title, provider, description, "
                        + "thumbnail_id, thumbnail_url, thumbnail_alt, thumbnail_width, thumbnail_height, thumbnail_mime_type "
                        + "FROM product_videos ORDER BY product_id, sort_order");
             ResultSet rs = select.executeQuery()) {
            while (rs.next()) {
                String productId = rs.getString("product_id");
                String thumbUrl = rs.getString("thumbnail_url");
                ImageAsset thumbnail = (thumbUrl == null || thumbUrl.isBlank())
                        ? null
                        : new ImageAsset(
                                rs.getString("thumbnail_id"), thumbUrl, rs.getString("thumbnail_alt"),
                                (Integer) rs.getObject("thumbnail_width"), (Integer) rs.getObject("thumbnail_height"),
                                rs.getString("thumbnail_mime_type"));
                byProduct.computeIfAbsent(productId, k -> new ArrayList<>()).add(new VideoAsset(
                        rs.getString("video_id"),
                        rs.getString("video_url"),
                        rs.getString("title"),
                        thumbnail,
                        rs.getString("provider"),
                        rs.getString("description")));
            }
        }
        return writeJsonColumn(conn, "videos", byProduct);
    }

    private ImageAsset toImageAsset(ResultSet rs) throws Exception {
        String url = rs.getString("image_url");
        if (url == null || url.isBlank()) {
            return null;
        }
        return new ImageAsset(
                rs.getString("image_id"), url, rs.getString("image_alt"),
                (Integer) rs.getObject("image_width"), (Integer) rs.getObject("image_height"),
                rs.getString("image_mime_type"));
    }

    private <T> int writeJsonColumn(Connection conn, String column, Map<String, T> byProduct) throws Exception {
        int updated = 0;
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE products SET " + column + " = ?::jsonb WHERE id = ?")) {
            for (Map.Entry<String, T> entry : byProduct.entrySet()) {
                update.setString(1, MAPPER.writeValueAsString(entry.getValue()));
                update.setString(2, entry.getKey());
                update.executeUpdate();
                updated++;
            }
        }
        return updated;
    }
}
