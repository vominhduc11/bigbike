package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.ImportBrandLogoUrlRequest;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.service.media.ImageDimensions;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.Dns;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;

/**
 * Downloads a brand-logo source into the internal media library. Redirects and DNS lookups are
 * revalidated on every hop so this endpoint cannot be used as an SSRF proxy.
 */
@Service
public class BrandLogoUrlImportService {

    private static final long MAX_SOURCE_BYTES = BrandLogoValidationService.MAX_BYTES;
    private static final int MAX_REDIRECTS = 5;
    private static final Set<String> SUPPORTED_MIMES = BrandLogoValidationService.SUPPORTED_MIMES;
    private static final Tika TIKA = new Tika();

    private final AdminMediaService adminMediaService;
    private final OkHttpClient httpClient;

    public BrandLogoUrlImportService(AdminMediaService adminMediaService) {
        this.adminMediaService = adminMediaService;
        this.httpClient = new OkHttpClient.Builder()
                .followRedirects(false)
                .followSslRedirects(false)
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .callTimeout(30, TimeUnit.SECONDS)
                .dns(new SafeDns())
                .build();
    }

    public AdminMediaDetailResponse importUrl(
            ImportBrandLogoUrlRequest request,
            UUID adminId
    ) {
        URI uri = validateUrl(request.url());
        byte[] bytes = download(uri);
        String mimeType = validateImage(bytes);
        String filename = filenameFor(uri);
        return adminMediaService.storeMediaBytes(
                bytes,
                filename,
                mimeType,
                request.altText(),
                request.folderId(),
                false,
                adminId);
    }

    private byte[] download(URI initial) {
        URI current = initial;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            validateResolvedHost(current);
            Request httpRequest = new Request.Builder()
                    .url(current.toString())
                    .header("Accept", "image/jpeg,image/png,image/webp,image/*;q=0.8")
                    .get()
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (response.isRedirect()) {
                    if (redirect == MAX_REDIRECTS) {
                        throw validation("url", "BRAND_LOGO_REDIRECT_LIMIT",
                                "URL logo chuyển hướng quá nhiều / the logo URL redirected too many times.");
                    }
                    String location = response.header("Location");
                    if (location == null || location.isBlank()) {
                        throw validation("url", "BRAND_LOGO_REDIRECT_INVALID",
                                "URL chuyển hướng logo không hợp lệ / the logo redirect URL is invalid.");
                    }
                    try {
                        current = validateUrl(current.resolve(location));
                    } catch (IllegalArgumentException e) {
                        throw validation("url", "BRAND_LOGO_REDIRECT_INVALID",
                                "URL chuyển hướng logo không hợp lệ / the logo redirect URL is invalid.");
                    }
                    continue;
                }
                if (!response.isSuccessful()) {
                    throw validation("url", "BRAND_LOGO_FETCH_FAILED",
                            "Không tải được ảnh logo từ URL / the logo URL could not be downloaded.");
                }
                ResponseBody body = response.body();
                if (body == null) {
                    throw validation("url", "BRAND_LOGO_FETCH_FAILED",
                            "URL không trả về nội dung ảnh / the logo URL returned no image content.");
                }
                long declaredLength = body.contentLength();
                if (declaredLength > MAX_SOURCE_BYTES) {
                    throw validation("url", "BRAND_LOGO_TOO_LARGE",
                            "Ảnh logo tối đa 300 KB / the logo must be at most 300 KB.");
                }
                return readLimited(body.byteStream());
            } catch (IOException e) {
                throw validation("url", "BRAND_LOGO_FETCH_FAILED",
                        "Không tải được ảnh logo từ URL / the logo URL could not be downloaded.");
            }
        }
        throw validation("url", "BRAND_LOGO_REDIRECT_LIMIT",
                "URL logo chuyển hướng quá nhiều / the logo URL redirected too many times.");
    }

    private byte[] readLimited(InputStream input) throws IOException {
        try (InputStream stream = input) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                if (output.size() > MAX_SOURCE_BYTES) {
                    throw validation("url", "BRAND_LOGO_TOO_LARGE",
                            "Ảnh logo tối đa 300 KB / the logo must be at most 300 KB.");
                }
            }
            return output.toByteArray();
        }
    }

    private String validateImage(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw validation("url", "BRAND_LOGO_FETCH_FAILED",
                    "URL không trả về nội dung ảnh / the logo URL returned no image content.");
        }
        String detected = TIKA.detect(bytes)
                .toLowerCase(Locale.ROOT);
        if (!SUPPORTED_MIMES.contains(detected)) {
            throw validation("url", "BRAND_LOGO_UNSUPPORTED_TYPE",
                    "Logo từ URL chỉ nhận JPEG/JPG, PNG hoặc WebP / a logo URL must point to a JPEG/JPG, PNG, or WebP image.");
        }
        ImageDimensions.Dimensions dimensions = ImageDimensions.read(bytes, detected);
        if (dimensions == null) {
            throw validation("url", "BRAND_LOGO_UNREADABLE",
                    "Không đọc được nội dung ảnh logo từ URL / the logo image content could not be read.");
        }
        if (dimensions.width() < BrandLogoValidationService.MIN_PIXELS
                || dimensions.height() < BrandLogoValidationService.MIN_PIXELS) {
            throw validation("url", "BRAND_LOGO_TOO_SMALL",
                    "Ảnh logo tối thiểu 400 × 400 điểm ảnh / the logo must be at least 400 × 400 pixels.");
        }
        return detected;
    }

    private static URI validateUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            throw validation("url", "BRAND_LOGO_URL_INVALID",
                    "URL logo không hợp lệ / the logo URL is invalid.");
        }
        try {
            return validateUrl(new URI(raw.trim()));
        } catch (URISyntaxException | IllegalArgumentException e) {
            throw validation("url", "BRAND_LOGO_URL_INVALID",
                    "URL logo không hợp lệ / the logo URL is invalid.");
        }
    }

    private static URI validateUrl(URI uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null
                || uri.getUserInfo() != null || uri.getFragment() != null
                || !("http".equalsIgnoreCase(uri.getScheme())
                || "https".equalsIgnoreCase(uri.getScheme()))) {
            throw new IllegalArgumentException("Unsafe URL");
        }
        validateResolvedHost(uri);
        return uri.normalize();
    }

    private static void validateResolvedHost(URI uri) {
        try {
            InetAddress[] addresses = InetAddress.getAllByName(uri.getHost());
            if (addresses.length == 0 || Arrays.stream(addresses).anyMatch(BrandLogoUrlImportService::isForbiddenAddress)) {
                throw validation("url", "BRAND_LOGO_URL_BLOCKED",
                        "URL logo trỏ tới địa chỉ mạng bị chặn / the logo URL resolves to a blocked network address.");
            }
        } catch (IOException e) {
            throw validation("url", "BRAND_LOGO_HOST_UNRESOLVED",
                    "Không phân giải được máy chủ URL logo / the logo URL host could not be resolved.");
        }
    }

    private static boolean isForbiddenAddress(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int a = bytes[0] & 0xff;
            int b = bytes[1] & 0xff;
            int c = bytes[2] & 0xff;
            return a == 0 || a == 10 || a == 127 || (a == 100 && b >= 64 && b <= 127)
                    || (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31)
                    || (a == 192 && (b == 0 || b == 168))
                    || (a == 192 && b == 0 && c == 2)
                    || (a == 198 && (b == 18 || b == 19 || b == 51))
                    || (a == 203 && b == 0 && c == 113)
                    || a >= 224;
        }
        int first = bytes[0] & 0xff;
        int second = bytes[1] & 0xff;
        boolean ipv4Mapped = true;
        for (int i = 0; i < 10; i++) {
            if (bytes[i] != 0) ipv4Mapped = false;
        }
        ipv4Mapped = ipv4Mapped && (bytes[10] & 0xff) == 0xff && (bytes[11] & 0xff) == 0xff;
        if (ipv4Mapped) {
            return isForbiddenIpv4(bytes, 12);
        }
        return (first == 0 && second == 0) || (first & 0xfe) == 0xfc
                || (first == 0xfe && (second & 0xc0) == 0x80);
    }

    private static boolean isForbiddenIpv4(byte[] bytes, int offset) {
        int a = bytes[offset] & 0xff;
        int b = bytes[offset + 1] & 0xff;
        int c = bytes[offset + 2] & 0xff;
        return a == 0 || a == 10 || a == 127 || (a == 100 && b >= 64 && b <= 127)
                || (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31)
                || (a == 192 && (b == 0 || b == 168))
                || (a == 192 && b == 0 && c == 2)
                || (a == 198 && (b == 18 || b == 19 || b == 51))
                || (a == 203 && b == 0 && c == 113)
                || a >= 224;
    }

    private static String filenameFor(URI uri) {
        String path = uri.getPath();
        if (path != null && !path.isBlank()) {
            int slash = path.lastIndexOf('/');
            String candidate = slash >= 0 ? path.substring(slash + 1) : path;
            if (candidate.matches("[A-Za-z0-9._-]{1,120}")) return candidate;
        }
        return "brand-logo.png";
    }

    private static ValidationException validation(String field, String code, String message) {
        return ValidationException.fromField(field, code, message);
    }

    private static final class SafeDns implements Dns {
        @Override
        public java.util.List<InetAddress> lookup(String hostname) throws java.net.UnknownHostException {
            java.util.List<InetAddress> addresses = Dns.SYSTEM.lookup(hostname);
            if (addresses.isEmpty() || addresses.stream().anyMatch(BrandLogoUrlImportService::isForbiddenAddress)) {
                throw new java.net.UnknownHostException("Blocked network address");
            }
            return addresses;
        }
    }
}
