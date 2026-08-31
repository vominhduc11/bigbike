package com.bigbike.bigbike_backend.service.review.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.thymeleaf.context.Context;

@ExtendWith(MockitoExtension.class)
class ReviewInvitationEmailServiceTest {

    @Mock private EmailDispatchService emailDispatchService;

    @Test
    void vietnameseEmailLinksDirectlyToProductAndAnonymousOptOut() {
        ReviewInvitationEmailService service = new ReviewInvitationEmailService(
                emailDispatchService, "https://bigbike.vn/");
        ReviewInvitationDispatchClaim claim = claim("vi", "mu-3-4", "review-token", "stop-token");
        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        when(emailDispatchService.send(
                eq("rider@example.com"),
                eq("[BigBike] Anh/chị thấy món đồ bảo hộ vừa nhận thế nào?"),
                eq("review-invitation"),
                context.capture())).thenReturn(true);

        assertThat(service.send(claim)).isTrue();
        verify(emailDispatchService).send(
                eq("rider@example.com"),
                eq("[BigBike] Anh/chị thấy món đồ bảo hộ vừa nhận thế nào?"),
                eq("review-invitation"),
                context.capture());
        Context rendered = context.getAllValues().get(0);
        @SuppressWarnings("unchecked")
        List<ReviewInvitationEmailService.EmailProduct> products =
                (List<ReviewInvitationEmailService.EmailProduct>) rendered.getVariable("products");
        assertThat(products).singleElement().satisfies(product ->
                assertThat(product.getUrl()).isEqualTo(
                        "https://bigbike.vn/product/mu-3-4/#write-review=review-token"));
        assertThat(rendered.getVariable("unsubscribeUrl")).isEqualTo(
                "https://bigbike.vn/tu-choi-thu-moi-danh-gia/#token=stop-token");
        assertThat(rendered.getVariable("english")).isEqualTo(false);
    }

    @Test
    void englishEmailUsesTheEnglishRoutesAndCopy() {
        ReviewInvitationEmailService service = new ReviewInvitationEmailService(
                emailDispatchService, "https://bigbike.vn");
        ReviewInvitationDispatchClaim claim = claim("en", "full-face-helmet", "review-token", "stop-token");
        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        when(emailDispatchService.send(
                eq("rider@example.com"),
                eq("[BigBike] How’s your new riding gear?"),
                eq("review-invitation"),
                context.capture())).thenReturn(true);

        assertThat(service.send(claim)).isTrue();
        Context rendered = context.getValue();
        @SuppressWarnings("unchecked")
        List<ReviewInvitationEmailService.EmailProduct> products =
                (List<ReviewInvitationEmailService.EmailProduct>) rendered.getVariable("products");
        assertThat(products).singleElement().satisfies(product ->
                assertThat(product.getUrl()).isEqualTo(
                        "https://bigbike.vn/en/product/full-face-helmet/#write-review=review-token"));
        assertThat(rendered.getVariable("unsubscribeUrl")).isEqualTo(
                "https://bigbike.vn/en/review-invitations/unsubscribe/#token=stop-token");
        assertThat(rendered.getVariable("english")).isEqualTo(true);
    }

    private static ReviewInvitationDispatchClaim claim(
            String locale, String slug, String reviewToken, String optOutToken) {
        return new ReviewInvitationDispatchClaim(
                UUID.randomUUID(),
                "rider@example.com",
                "Minh",
                "BB-1001",
                locale,
                optOutToken,
                List.of(new ReviewInvitationDispatchClaim.ProductClaim(
                        "helmet-1", "Helmet", slug, reviewToken)));
    }
}
