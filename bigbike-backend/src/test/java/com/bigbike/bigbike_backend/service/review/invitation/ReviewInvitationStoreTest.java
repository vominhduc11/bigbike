package com.bigbike.bigbike_backend.service.review.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationCampaignEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationDeliveryEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationOptOutEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationCampaignJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDailyQuotaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDeliveryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationOptOutJpaRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class ReviewInvitationStoreTest {

    private static final Instant ACTIVATED_AT = Instant.parse("2026-08-31T02:00:00Z");
    private static final Instant NOW = Instant.parse("2026-09-08T02:00:00Z");
    private static final UUID CAMPAIGN_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    @Mock private ReviewInvitationSettings settings;
    @Mock private ReviewInvitationTokenService tokenService;
    @Mock private ReviewInvitationCampaignJpaRepository campaignRepository;
    @Mock private ReviewInvitationDeliveryJpaRepository deliveryRepository;
    @Mock private ReviewInvitationItemJpaRepository itemRepository;
    @Mock private ReviewInvitationOptOutJpaRepository optOutRepository;
    @Mock private ReviewInvitationDailyQuotaJpaRepository quotaRepository;
    @Mock private OrderJpaRepository orderRepository;
    @Mock private OrderLineItemJpaRepository lineItemRepository;
    @Mock private ProductJpaRepository productRepository;
    @Mock private ReviewJpaRepository reviewRepository;

    @InjectMocks private ReviewInvitationStore store;

    private ReviewInvitationCampaignEntity campaign;

    @BeforeEach
    void setUp() {
        campaign = new ReviewInvitationCampaignEntity();
        campaign.setId(CAMPAIGN_ID);
        campaign.setActivatedAt(ACTIVATED_AT);
        lenient().when(settings.get()).thenReturn(new ReviewInvitationSettings.Snapshot(true, 7, 20));
        lenient().when(campaignRepository.findActiveForUpdate()).thenReturn(Optional.of(campaign));
        lenient().when(deliveryRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            ReviewInvitationDeliveryEntity delivery = invocation.getArgument(0);
            if (delivery.getId() == null) {
                delivery.setId(UUID.randomUUID());
            }
            return delivery;
        });
    }

    @Test
    void newCompletedOrderIsQueuedOnlyOnceWithSevenDayDelay() {
        OrderEntity order = order("COMPLETED", "rider@example.com", ACTIVATED_AT.plus(1, ChronoUnit.DAYS));
        when(orderRepository.findReviewInvitationCandidates(eq(ACTIVATED_AT), any(Pageable.class)))
                .thenReturn(List.of(order));
        when(deliveryRepository.existsByOrderId(order.getId())).thenReturn(false, true);
        when(lineItemRepository.findByOrderId(order.getId())).thenReturn(List.of(line(order, "helmet-1")));

        assertThat(store.queueEligibleOrders(NOW)).isEqualTo(1);
        assertThat(store.queueEligibleOrders(NOW.plusSeconds(60))).isZero();

        ArgumentCaptor<ReviewInvitationDeliveryEntity> deliveryCaptor =
                ArgumentCaptor.forClass(ReviewInvitationDeliveryEntity.class);
        verify(deliveryRepository, times(1)).saveAndFlush(deliveryCaptor.capture());
        ReviewInvitationDeliveryEntity saved = deliveryCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(ReviewInvitationStatus.PENDING);
        assertThat(saved.getDueAt()).isEqualTo(order.getCompletedAt().plus(7, ChronoUnit.DAYS));
        assertThat(saved.getLocale()).isEqualTo("vi");
        verify(itemRepository, times(1)).save(any(ReviewInvitationItemEntity.class));
    }

    @Test
    void importedAndPreActivationOrdersAreNeverQueued() {
        OrderEntity imported = order("COMPLETED", "legacy@example.com", ACTIVATED_AT.plusSeconds(1));
        imported.setLegacyId(123L);
        OrderEntity tooOld = order("COMPLETED", "old@example.com", ACTIVATED_AT.minusSeconds(1));
        when(orderRepository.findReviewInvitationCandidates(eq(ACTIVATED_AT), any(Pageable.class)))
                .thenReturn(List.of(imported, tooOld));

        assertThat(store.queueEligibleOrders(NOW)).isZero();
        verify(deliveryRepository, never()).saveAndFlush(any());
        verify(lineItemRepository, never()).findByOrderId(any());
    }

    @Test
    void cancelledAndMissingEmailOrdersAreIgnoredQuietly() {
        OrderEntity cancelled = order("CANCELLED", "cancelled@example.com", ACTIVATED_AT.plusSeconds(1));
        OrderEntity missingEmail = order("COMPLETED", "  ", ACTIVATED_AT.plusSeconds(2));
        when(orderRepository.findReviewInvitationCandidates(eq(ACTIVATED_AT), any(Pageable.class)))
                .thenReturn(List.of(cancelled, missingEmail));

        assertThat(store.queueEligibleOrders(NOW)).isZero();
        verify(deliveryRepository, never()).saveAndFlush(any());
    }

    @Test
    void customerOptOutCreatesAVisibleSkippedRecordAndNeverAClaim() {
        OrderEntity order = order("COMPLETED", "OptOut@Example.com", ACTIVATED_AT.plusSeconds(1));
        when(orderRepository.findReviewInvitationCandidates(eq(ACTIVATED_AT), any(Pageable.class)))
                .thenReturn(List.of(order));
        when(lineItemRepository.findByOrderId(order.getId())).thenReturn(List.of(line(order, "helmet-1")));
        when(optOutRepository.existsByEmailNormalized("optout@example.com")).thenReturn(true);

        assertThat(store.queueEligibleOrders(NOW)).isEqualTo(1);
        ArgumentCaptor<ReviewInvitationDeliveryEntity> captor =
                ArgumentCaptor.forClass(ReviewInvitationDeliveryEntity.class);
        verify(deliveryRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ReviewInvitationStatus.SKIPPED);
        assertThat(captor.getValue().getSkipReason()).isEqualTo("OPTED_OUT");
    }

    @Test
    void unsubscribeLinkPermanentlyOptsOutEmailAndStopsEveryPendingDelivery() {
        ReviewInvitationDeliveryEntity sent = pendingDelivery();
        sent.setStatus(ReviewInvitationStatus.SENT);
        sent.setRecipientEmail("Rider@Example.com");
        sent.setRecipientEmailNormalized("rider@example.com");
        sent.setUnsubscribeTokenHash("hashed-token");
        when(tokenService.hash("raw-token")).thenReturn("hashed-token");
        when(deliveryRepository.findByUnsubscribeTokenHashForUpdate("hashed-token"))
                .thenReturn(Optional.of(sent));
        when(optOutRepository.existsByEmailNormalized("rider@example.com")).thenReturn(false);

        store.unsubscribe("raw-token", NOW);

        ArgumentCaptor<ReviewInvitationOptOutEntity> optOutCaptor =
                ArgumentCaptor.forClass(ReviewInvitationOptOutEntity.class);
        verify(optOutRepository).save(optOutCaptor.capture());
        assertThat(optOutCaptor.getValue().getEmail()).isEqualTo("Rider@Example.com");
        assertThat(optOutCaptor.getValue().getEmailNormalized()).isEqualTo("rider@example.com");
        assertThat(optOutCaptor.getValue().getOptedOutAt()).isEqualTo(NOW);
        verify(deliveryRepository).skipPendingByNormalizedEmail("rider@example.com", NOW);
    }

    @Test
    void productsAlreadyReviewedAreNotInvitedAgain() {
        OrderEntity order = order("COMPLETED", "reviewed@example.com", ACTIVATED_AT.plusSeconds(1));
        when(orderRepository.findReviewInvitationCandidates(eq(ACTIVATED_AT), any(Pageable.class)))
                .thenReturn(List.of(order));
        when(lineItemRepository.findByOrderId(order.getId())).thenReturn(List.of(line(order, "helmet-1")));
        when(reviewRepository.existsByProductIdAndNormalizedAuthorEmail("helmet-1", "reviewed@example.com"))
                .thenReturn(true);

        assertThat(store.queueEligibleOrders(NOW)).isEqualTo(1);

        ArgumentCaptor<ReviewInvitationDeliveryEntity> deliveryCaptor =
                ArgumentCaptor.forClass(ReviewInvitationDeliveryEntity.class);
        verify(deliveryRepository).saveAndFlush(deliveryCaptor.capture());
        ReviewInvitationDeliveryEntity finalDelivery = deliveryCaptor.getValue();
        verify(deliveryRepository).save(finalDelivery);
        assertThat(finalDelivery.getStatus()).isEqualTo(ReviewInvitationStatus.SKIPPED);
        assertThat(finalDelivery.getSkipReason()).isEqualTo("ALREADY_REVIEWED");
        ArgumentCaptor<ReviewInvitationItemEntity> itemCaptor =
                ArgumentCaptor.forClass(ReviewInvitationItemEntity.class);
        verify(itemRepository).save(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getReviewedAt()).isEqualTo(NOW);
    }

    @Test
    void cancelledOrderIsRecheckedImmediatelyBeforeSend() {
        ReviewInvitationDeliveryEntity delivery = pendingDelivery();
        OrderEntity cancelled = order("CANCELLED", "rider@example.com", delivery.getCompletedAt());
        cancelled.setId(delivery.getOrderId());
        when(deliveryRepository.findNextDueForUpdate(NOW))
                .thenReturn(Optional.of(delivery), Optional.empty());
        when(orderRepository.findById(delivery.getOrderId())).thenReturn(Optional.of(cancelled));

        assertThat(store.claimNext(NOW, LocalDate.of(2026, 9, 8))).isEmpty();
        assertThat(delivery.getStatus()).isEqualTo(ReviewInvitationStatus.SKIPPED);
        assertThat(delivery.getSkipReason()).isEqualTo("ORDER_CANCELLED");
        verify(tokenService, never()).issue();
    }

    @Test
    void dailyAttemptLimitStopsFurtherSends() {
        ReviewInvitationDeliveryEntity delivery = pendingDelivery();
        OrderEntity order = order("COMPLETED", "rider@example.com", delivery.getCompletedAt());
        order.setId(delivery.getOrderId());
        ReviewInvitationItemEntity item = new ReviewInvitationItemEntity();
        item.setId(UUID.randomUUID());
        item.setDeliveryId(delivery.getId());
        item.setProductId("helmet-1");
        item.setCreatedAt(delivery.getCreatedAt());
        ProductEntity product = new ProductEntity();
        product.setId("helmet-1");
        product.setName("Mũ bảo hiểm");
        product.setSlug("mu-bao-hiem");
        product.setPublishStatus(PublishStatus.PUBLISHED);

        when(deliveryRepository.findNextDueForUpdate(NOW)).thenReturn(Optional.of(delivery));
        when(orderRepository.findById(delivery.getOrderId())).thenReturn(Optional.of(order));
        when(itemRepository.findByDeliveryIdOrderByCreatedAtAsc(delivery.getId())).thenReturn(List.of(item));
        when(productRepository.findAllById(List.of("helmet-1"))).thenReturn(List.of(product));
        when(quotaRepository.reserveAttempt(LocalDate.of(2026, 9, 8), 20, NOW)).thenReturn(0);

        assertThat(store.claimNext(NOW, LocalDate.of(2026, 9, 8))).isEmpty();
        assertThat(delivery.getStatus()).isEqualTo(ReviewInvitationStatus.PENDING);
        verify(quotaRepository).ensureRow(LocalDate.of(2026, 9, 8), NOW);
        verify(tokenService, never()).issue();
        verify(deliveryRepository, never()).saveAndFlush(delivery);
    }

    private static OrderEntity order(String status, String email, Instant completedAt) {
        OrderEntity order = new OrderEntity();
        order.setId(UUID.randomUUID());
        order.setOrderNumber("BB-" + order.getId().toString().substring(0, 8));
        order.setStatus(status);
        order.setCustomerEmail(email);
        order.setCustomerName("Minh");
        order.setLocale("vi");
        order.setCompletedAt(completedAt);
        return order;
    }

    private static OrderLineItemEntity line(OrderEntity order, String productId) {
        OrderLineItemEntity line = new OrderLineItemEntity();
        line.setOrder(order);
        line.setProductPk(productId);
        line.setProductName("Mũ bảo hiểm");
        return line;
    }

    private static ReviewInvitationDeliveryEntity pendingDelivery() {
        ReviewInvitationDeliveryEntity delivery = new ReviewInvitationDeliveryEntity();
        delivery.setId(UUID.randomUUID());
        delivery.setCampaignId(CAMPAIGN_ID);
        delivery.setOrderId(UUID.randomUUID());
        delivery.setOrderNumber("BB-1001");
        delivery.setRecipientEmail("rider@example.com");
        delivery.setRecipientEmailNormalized("rider@example.com");
        delivery.setLocale("vi");
        delivery.setStatus(ReviewInvitationStatus.PENDING);
        delivery.setCompletedAt(ACTIVATED_AT.plusSeconds(1));
        delivery.setDueAt(NOW.minusSeconds(1));
        delivery.setCreatedAt(ACTIVATED_AT.plusSeconds(1));
        delivery.setUpdatedAt(ACTIVATED_AT.plusSeconds(1));
        return delivery;
    }
}
