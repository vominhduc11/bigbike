package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String ORDERS_PERMISSION = "orders.read";
    private static final String INVENTORY_PERMISSION = "inventory.read";
    private static final String REVIEWS_PERMISSION = "reviews.read";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String SESSION_ATTR_ADMIN_USER_ID = "adminUserId";

    private final JwtService jwtService;
    private final AdminAccountStatusService adminAccountStatusService;
    private final AdminPermissionService adminPermissionService;
    private final List<String> allowedOrigins;

    public WebSocketConfig(
            JwtService jwtService,
            AdminAccountStatusService adminAccountStatusService,
            AdminPermissionService adminPermissionService,
            @Value("${bigbike.cors.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001}") String allowedOriginsRaw
    ) {
        this.jwtService = jwtService;
        this.adminAccountStatusService = adminAccountStatusService;
        this.adminPermissionService = adminPermissionService;
        this.allowedOrigins = Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.toArray(String[]::new));
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null) {
                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String auth = accessor.getFirstNativeHeader("Authorization");
                    if (auth == null || !auth.startsWith("Bearer ")) {
                        log.warn("WS CONNECT rejected: missing or malformed Authorization header");
                        throw new IllegalArgumentException("Admin JWT required to connect.");
                    }

                    String token = auth.substring(7);
                    try {
                        Claims claims = jwtService.parseAccessToken(token);
                        UUID userId = UUID.fromString(claims.getSubject());
                        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(userId);
                        if (snapshot == null || !STATUS_ACTIVE.equals(snapshot.status())) {
                            log.warn("WS CONNECT rejected: account not active for {}", claims.getSubject());
                            throw new IllegalArgumentException("Admin account is not active.");
                        }
                        if (accessor.getSessionAttributes() != null) {
                            accessor.getSessionAttributes().put(SESSION_ATTR_ADMIN_USER_ID, userId);
                        }
                        log.debug("WS CONNECT accepted for admin {}", claims.getSubject());
                    } catch (JwtException | IllegalArgumentException e) {
                        log.warn("WS CONNECT rejected: invalid token — {}", e.getMessage());
                        throw new IllegalArgumentException("Invalid or expired token.");
                    }
                    return message;
                }

                // SUBSCRIBE is rechecked every time (not just cached from CONNECT) so that an admin
                // whose orders.read permission or account status changes mid-session is cut off on
                // their next subscribe, not just at the initial connect.
                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    Object rawUserId = accessor.getSessionAttributes() != null
                            ? accessor.getSessionAttributes().get(SESSION_ATTR_ADMIN_USER_ID) : null;
                    String destination = accessor.getDestination();
                    if (!(rawUserId instanceof UUID userId) || !hasPermissionForDestination(userId, destination)) {
                        log.warn("WS SUBSCRIBE rejected for {} to {}", rawUserId, destination);
                        throw new IllegalArgumentException("Not permitted to subscribe to " + destination + ".");
                    }
                }

                return message;
            }

            private boolean hasPermissionForDestination(UUID userId, String destination) {
                if (destination == null) {
                    return false;
                }
                String requiredPermission = switch (destination) {
                    case "/topic/admin/orders" -> ORDERS_PERMISSION;
                    case "/topic/admin/inventory" -> INVENTORY_PERMISSION;
                    case "/topic/admin/reviews" -> REVIEWS_PERMISSION;
                    default -> null;
                };
                return requiredPermission != null && hasPermission(userId, requiredPermission);
            }

            private boolean hasPermission(UUID userId, String requiredPermission) {
                AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(userId);
                if (snapshot == null || !STATUS_ACTIVE.equals(snapshot.status())) {
                    return false;
                }
                List<String> permissions = adminPermissionService.getPermissionsForRole(snapshot.role());
                return permissions.contains("*") || permissions.contains(requiredPermission);
            }
        });
    }
}
