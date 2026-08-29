package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.ImportBrandLogoUrlRequest;
import com.bigbike.bigbike_backend.api.admin.dto.media.AdminMediaDetailResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

class BrandLogoUrlImportServiceTest {

    private static final UUID ADMIN_ID = UUID.randomUUID();

    @Test
    void sourceAtOrBelowTenMegabytesIsDownloadedAndStoredInternally() throws Exception {
        AdminMediaService mediaService = mock(AdminMediaService.class);
        OkHttpClient httpClient = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        Response response = mock(Response.class);
        ResponseBody body = mock(ResponseBody.class);
        AdminMediaDetailResponse stored = mock(AdminMediaDetailResponse.class);
        byte[] image = paddedPngBytes(800, 800);

        when(httpClient.newCall(any(Request.class))).thenReturn(call);
        when(call.execute()).thenReturn(response);
        when(response.isRedirect()).thenReturn(false);
        when(response.isSuccessful()).thenReturn(true);
        when(response.body()).thenReturn(body);
        when(body.contentLength()).thenReturn((long) image.length);
        when(body.byteStream()).thenReturn(new ByteArrayInputStream(image));
        when(mediaService.storeMediaBytes(
                eq(image), anyString(), eq("image/png"), eq(null), eq(null), eq(false), eq(ADMIN_ID)))
                .thenReturn(stored);

        InetAddress publicAddress = InetAddress.getByAddress("example.com", new byte[] {8, 8, 8, 8});
        try (MockedStatic<InetAddress> addresses = Mockito.mockStatic(InetAddress.class)) {
            addresses.when(() -> InetAddress.getAllByName("example.com"))
                    .thenReturn(new InetAddress[] {publicAddress});

            BrandLogoUrlImportService service = new BrandLogoUrlImportService(mediaService, httpClient);
            AdminMediaDetailResponse result = service.importUrl(
                    new ImportBrandLogoUrlRequest("https://example.com/logo.png", null, null), ADMIN_ID);

            assertThat(result).isSameAs(stored);
            verify(mediaService).storeMediaBytes(
                    eq(image), eq("logo.png"), eq("image/png"), eq(null), eq(null), eq(false), eq(ADMIN_ID));
        }
    }

    @Test
    void declaredSourceLengthAboveTenMegabytesIsRejectedBeforeReading() throws Exception {
        AdminMediaService mediaService = mock(AdminMediaService.class);
        OkHttpClient httpClient = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        Response response = mock(Response.class);
        ResponseBody body = mock(ResponseBody.class);

        when(httpClient.newCall(any(Request.class))).thenReturn(call);
        when(call.execute()).thenReturn(response);
        when(response.isRedirect()).thenReturn(false);
        when(response.isSuccessful()).thenReturn(true);
        when(response.body()).thenReturn(body);
        when(body.contentLength()).thenReturn(BrandLogoUrlImportService.MAX_SOURCE_BYTES + 1);

        InetAddress publicAddress = InetAddress.getByAddress("example.com", new byte[] {8, 8, 8, 8});
        try (MockedStatic<InetAddress> addresses = Mockito.mockStatic(InetAddress.class)) {
            addresses.when(() -> InetAddress.getAllByName("example.com"))
                    .thenReturn(new InetAddress[] {publicAddress});

            BrandLogoUrlImportService service = new BrandLogoUrlImportService(mediaService, httpClient);

            assertThatThrownBy(() -> service.importUrl(
                    new ImportBrandLogoUrlRequest("https://example.com/logo.png", null, null), ADMIN_ID))
                    .isInstanceOf(ValidationException.class)
                    .satisfies(error -> {
                        ValidationException validation = (ValidationException) error;
                        assertThat(validation.details().get(0).code()).isEqualTo("BRAND_LOGO_TOO_LARGE");
                        assertThat(validation.details().get(0).message()).contains("10 MB");
                    });
            verify(body, never()).byteStream();
            verify(mediaService, never()).storeMediaBytes(
                    any(), anyString(), anyString(), any(), any(), anyBoolean(), any());
        }
    }

    @Test
    void streamedSourceAboveTenMegabytesIsRejectedEvenWithoutContentLength() throws Exception {
        AdminMediaService mediaService = mock(AdminMediaService.class);
        BrandLogoUrlImportService service = new BrandLogoUrlImportService(mediaService);
        byte[] oversized = new byte[(int) BrandLogoUrlImportService.MAX_SOURCE_BYTES + 1];

        assertThatThrownBy(() -> service.readLimited(new ByteArrayInputStream(oversized)))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> {
                    ValidationException validation = (ValidationException) error;
                    assertThat(validation.details().get(0).code()).isEqualTo("BRAND_LOGO_TOO_LARGE");
                    assertThat(validation.details().get(0).message()).contains("10 MB");
                });
    }

    private static byte[] paddedPngBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            byte[] encoded = output.toByteArray();
            return Arrays.copyOf(encoded, Math.max(encoded.length, 1024 * 1024));
        }
    }
}
