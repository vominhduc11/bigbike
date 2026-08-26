package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.mapper.ChatMapper;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatAiUsageEventJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatInteractionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatLeadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatOrderAttributionJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.cart.CartItemJpaRepository;
import com.bigbike.bigbike_backend.service.chat.ChatAiQuotaService;
import com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings;
import com.bigbike.bigbike_backend.service.chat.ChatImageService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdminChatServiceStage4StatsTest {

    @Test
    void separatesProviderFallbackRateFromTheFourteenDayGiveUpBaselineAndLatency() {
        ChatConversationJpaRepository conversations = mock(ChatConversationJpaRepository.class);
        ChatAiUsageEventJpaRepository usage = mock(ChatAiUsageEventJpaRepository.class);
        ChatMessageJpaRepository messages = mock(ChatMessageJpaRepository.class);
        ChatLeadJpaRepository leads = mock(ChatLeadJpaRepository.class);
        ChatOrderAttributionJpaRepository attributions = mock(ChatOrderAttributionJpaRepository.class);
        ChatInteractionJpaRepository interactions = mock(ChatInteractionJpaRepository.class);
        CartItemJpaRepository cartItems = mock(CartItemJpaRepository.class);
        ChatAssistantSettings assistantSettings = mock(ChatAssistantSettings.class);
        ChatAiQuotaService quota = mock(ChatAiQuotaService.class);

        ChatMessageJpaRepository.TelemetrySummary telemetry =
                mock(ChatMessageJpaRepository.TelemetrySummary.class);
        ChatMessageJpaRepository.QualitySummary quality =
                mock(ChatMessageJpaRepository.QualitySummary.class);
        when(messages.summarizeBetween(any(), any())).thenReturn(telemetry);
        when(messages.summarizeQualityBetween(any(), any())).thenReturn(quality);
        ChatAssistantSettings.Snapshot snapshot = mock(ChatAssistantSettings.Snapshot.class);
        when(snapshot.dailyLimit()).thenReturn(400);
        when(snapshot.monthlyCostWarningUsd()).thenReturn(new BigDecimal("25"));
        when(assistantSettings.load("vi")).thenReturn(snapshot);

        LocalDate date = LocalDate.of(2026, 8, 26);
        Instant monitorFrom = Instant.parse("2026-08-12T17:00:00Z");
        Instant monitorTo = Instant.parse("2026-08-26T17:00:00Z");
        when(messages.countFallbackMessagesBetween(monitorFrom, monitorTo)).thenReturn(4L);
        when(messages.countAssistantRepliesBetween(monitorFrom, monitorTo)).thenReturn(58L);
        when(messages.findAiReplyLatenciesBetween(monitorFrom, monitorTo))
                .thenReturn(List.of(100, 200, 300, 1_000));

        AdminChatService service = new AdminChatService(
                conversations, usage, messages, leads, attributions, interactions, cartItems,
                assistantSettings, quota, mock(ChatImageService.class), mock(ChatMapper.class));

        var stats = service.stats(date);

        assertThat(stats.fallbacks().giveUpCount14Days()).isEqualTo(4);
        assertThat(stats.fallbacks().replyCount14Days()).isEqualTo(58);
        assertThat(stats.fallbacks().giveUpRate14Days()).isEqualByComparingTo("0.068966");
        assertThat(stats.fallbacks().baselineGiveUpRate()).isEqualByComparingTo("0.086207");
        assertThat(stats.fallbacks().p50LatencyMs14Days()).isEqualTo(200);
        assertThat(stats.fallbacks().p95LatencyMs14Days()).isEqualTo(1_000);
    }
}
