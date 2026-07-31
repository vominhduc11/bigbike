package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import io.jsonwebtoken.Claims;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;

class WebSocketConfigAccessTest {

    private static final UUID ADMIN_ID = UUID.fromString("5ea801f9-7188-4d16-bf84-8c33ab177d97");
    private static final String SESSION_ID = "admin-session";

    private JwtService jwtService;
    private AdminAccountStatusService accountStatusService;
    private AdminPermissionService permissionService;
    private ChannelInterceptor inbound;
    private ChannelInterceptor outbound;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        accountStatusService = mock(AdminAccountStatusService.class);
        permissionService = mock(AdminPermissionService.class);
        WebSocketConfig config = new WebSocketConfig(
                jwtService, accountStatusService, permissionService, "http://localhost:4000");

        inbound = captureInboundInterceptor(config);
        outbound = captureOutboundInterceptor(config);
        when(accountStatusService.getSnapshot(ADMIN_ID))
                .thenReturn(new AdminAccountStatusService.Snapshot("LIMITED", "ACTIVE", 0L));
        when(permissionService.getPermissionsForRole("LIMITED")).thenReturn(List.of("orders.read"));
        Claims currentClaims = claims(0L);
        when(jwtService.parseAccessToken("access-token")).thenReturn(currentClaims);
    }

    @Test
    void existingTopicSubscriptionStopsReceivingMessagesWhenPermissionIsRemoved() {
        assertThat(inbound.preSend(connectMessage(), mock(MessageChannel.class))).isNotNull();
        assertThat(inbound.preSend(subscribeMessage("/topic/admin/orders"), mock(MessageChannel.class))).isNotNull();

        Message<?> delivery = outboundMessage("/topic/admin/orders");
        assertThat(outbound.preSend(delivery, mock(MessageChannel.class))).isSameAs(delivery);

        when(permissionService.getPermissionsForRole("LIMITED")).thenReturn(List.of());
        assertThat(outbound.preSend(delivery, mock(MessageChannel.class))).isNull();
    }

    @Test
    void ownAccessQueueRequiresCurrentActiveSessionButNoTopicPermission() {
        when(permissionService.getPermissionsForRole("LIMITED")).thenReturn(List.of());

        assertThat(inbound.preSend(connectMessage(), mock(MessageChannel.class))).isNotNull();
        assertThat(inbound.preSend(subscribeMessage("/user/queue/admin/access"), mock(MessageChannel.class)))
                .isNotNull();
    }

    @Test
    void connectRejectsTokenWithOldAccessVersion() {
        when(accountStatusService.getSnapshot(ADMIN_ID))
                .thenReturn(new AdminAccountStatusService.Snapshot("LIMITED", "ACTIVE", 1L));

        assertThatThrownBy(() -> inbound.preSend(connectMessage(), mock(MessageChannel.class)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private ChannelInterceptor captureInboundInterceptor(WebSocketConfig config) {
        ChannelRegistration registration = mock(ChannelRegistration.class);
        config.configureClientInboundChannel(registration);
        ArgumentCaptor<ChannelInterceptor> interceptor = ArgumentCaptor.forClass(ChannelInterceptor.class);
        verify(registration).interceptors(interceptor.capture());
        return interceptor.getValue();
    }

    private ChannelInterceptor captureOutboundInterceptor(WebSocketConfig config) {
        ChannelRegistration registration = mock(ChannelRegistration.class);
        config.configureClientOutboundChannel(registration);
        ArgumentCaptor<ChannelInterceptor> interceptor = ArgumentCaptor.forClass(ChannelInterceptor.class);
        verify(registration).interceptors(interceptor.capture());
        return interceptor.getValue();
    }

    private Message<?> connectMessage() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId(SESSION_ID);
        accessor.addNativeHeader("Authorization", "Bearer access-token");
        return message(accessor);
    }

    private Message<?> subscribeMessage(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionId(SESSION_ID);
        accessor.setDestination(destination);
        return message(accessor);
    }

    private Message<?> outboundMessage(String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.MESSAGE);
        accessor.setSessionId(SESSION_ID);
        accessor.setDestination(destination);
        return message(accessor);
    }

    private Message<?> message(StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Claims claims(long accessVersion) {
        Claims claims = mock(Claims.class);
        when(claims.getSubject()).thenReturn(ADMIN_ID.toString());
        when(claims.get("accessVersion", Number.class)).thenReturn(accessVersion);
        return claims;
    }
}
