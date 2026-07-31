package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.service.auth.AdminAccountStatusService;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Configuration
@EnableWebSocketMessageBroker
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String ORDERS_PERMISSION = "orders.read";
    private static final String INVENTORY_PERMISSION = "inventory.read";
    private static final String REVIEWS_PERMISSION = "reviews.read";
    private static final String CUSTOMERS_PERMISSION = "customers.read";
    private static final String PRODUCTS_PERMISSION = "products.read";
    private static final String PRESENCE_DESTINATION = "/app/admin/presence";
    private static final String ACCESS_DESTINATION = "/user/queue/admin/access";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String SESSION_ATTR_ADMIN_USER_ID = "adminUserId";
    private static final String SESSION_ATTR_ACCESS_VERSION = "accessVersion";

    private final JwtService jwtService;
    private final AdminAccountStatusService adminAccountStatusService;
    private final AdminPermissionService adminPermissionService;
    private final List<String> allowedOrigins;
    private final Map<String, SessionAccess> sessions = new ConcurrentHashMap<>();

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
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
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
                        long accessVersion = accessVersionFrom(claims);
                        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(userId);
                        if (snapshot == null
                                || !STATUS_ACTIVE.equals(snapshot.status())
                                || snapshot.accessVersion() != accessVersion) {
                            log.warn("WS CONNECT rejected: account not active for {}", claims.getSubject());
                            throw new IllegalArgumentException("Admin account is not active.");
                        }
                        String sessionId = accessor.getSessionId();
                        if (sessionId == null) {
                            throw new IllegalArgumentException("WebSocket session is required.");
                        }
                        sessions.put(sessionId, new SessionAccess(userId, accessVersion));
                        if (accessor.getSessionAttributes() != null) {
                            accessor.getSessionAttributes().put(SESSION_ATTR_ADMIN_USER_ID, userId);
                            accessor.getSessionAttributes().put(SESSION_ATTR_ACCESS_VERSION, accessVersion);
                        }
                        // A stable admin-id principal lets Spring resolve /user destinations to every
                        // open session of exactly this account. The JWT role is never trusted here.
                        accessor.setUser(new UsernamePasswordAuthenticationToken(userId.toString(), null, List.of()));
                        log.debug("WS CONNECT accepted for admin {}", claims.getSubject());
                    } catch (JwtException | IllegalArgumentException e) {
                        log.warn("WS CONNECT rejected: invalid token — {}", e.getMessage());
                        throw new IllegalArgumentException("Invalid or expired token.");
                    }
                    return message;
                }

                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    SessionAccess session = sessionAccess(accessor);
                    String destination = accessor.getDestination();
                    boolean allowedAccessQueue = ACCESS_DESTINATION.equals(destination) && isCurrentAccess(session);
                    if (!allowedAccessQueue && (session == null || !hasPermissionForDestination(session, destination))) {
                        log.warn("WS SUBSCRIBE rejected for {} to {}", session, destination);
                        throw new IllegalArgumentException("Not permitted to subscribe to " + destination + ".");
                    }
                }

                if (StompCommand.SEND.equals(accessor.getCommand())) {
                    SessionAccess session = sessionAccess(accessor);
                    if (session == null
                            || !PRESENCE_DESTINATION.equals(accessor.getDestination())
                            || !isCurrentAccess(session)) {
                        log.warn("WS SEND rejected for {} to {}", session, accessor.getDestination());
                        throw new IllegalArgumentException("Invalid admin presence destination.");
                    }
                }

                if (StompCommand.DISCONNECT.equals(accessor.getCommand()) && accessor.getSessionId() != null) {
                    sessions.remove(accessor.getSessionId());
                }

                return message;
            }

            private boolean hasPermissionForDestination(SessionAccess session, String destination) {
                if (destination == null) {
                    return false;
                }
                String requiredPermission = switch (destination) {
                    case "/topic/admin/orders" -> ORDERS_PERMISSION;
                    case "/topic/admin/inventory" -> INVENTORY_PERMISSION;
                    case "/topic/admin/reviews" -> REVIEWS_PERMISSION;
                    case "/topic/admin/customers" -> CUSTOMERS_PERMISSION;
                    default -> {
                        if (destination.startsWith("/topic/admin/presence/order/")) yield ORDERS_PERMISSION;
                        if (destination.startsWith("/topic/admin/presence/product/")) yield PRODUCTS_PERMISSION;
                        yield null;
                    }
                };
                return requiredPermission != null && hasPermission(session, requiredPermission);
            }
        });
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        if (event.getSessionId() != null) {
            sessions.remove(event.getSessionId());
        }
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || !requiresPermission(accessor.getDestination())) {
                    return message;
                }

                SessionAccess session = accessor.getSessionId() == null ? null : sessions.get(accessor.getSessionId());
                if (session == null || !hasPermissionForDestination(session, accessor.getDestination())) {
                    // Returning null prevents a pre-existing subscription from receiving an event
                    // after the account becomes inactive, its token version is revoked, or the
                    // current role no longer carries this topic's permission.
                    log.debug("WS outbound message blocked for {} to {}", session, accessor.getDestination());
                    return null;
                }
                return message;
            }
        });
    }

    private SessionAccess sessionAccess(StompHeaderAccessor accessor) {
        return accessor.getSessionId() == null ? null : sessions.get(accessor.getSessionId());
    }

    private boolean hasPermissionForDestination(SessionAccess session, String destination) {
        String requiredPermission = requiredPermission(destination);
        return requiredPermission != null && hasPermission(session, requiredPermission);
    }

    private static boolean requiresPermission(String destination) {
        return requiredPermission(destination) != null;
    }

    private static String requiredPermission(String destination) {
        if (destination == null) return null;
        return switch (destination) {
            case "/topic/admin/orders" -> ORDERS_PERMISSION;
            case "/topic/admin/inventory" -> INVENTORY_PERMISSION;
            case "/topic/admin/reviews" -> REVIEWS_PERMISSION;
            case "/topic/admin/customers" -> CUSTOMERS_PERMISSION;
            default -> {
                if (destination.startsWith("/topic/admin/presence/order/")) yield ORDERS_PERMISSION;
                if (destination.startsWith("/topic/admin/presence/product/")) yield PRODUCTS_PERMISSION;
                yield null;
            }
        };
    }

    private boolean hasPermission(SessionAccess session, String requiredPermission) {
        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(session.userId());
        if (snapshot == null
                || !STATUS_ACTIVE.equals(snapshot.status())
                || snapshot.accessVersion() != session.accessVersion()) {
            return false;
        }
        List<String> permissions = adminPermissionService.getPermissionsForRole(snapshot.role());
        return permissions.contains("*") || permissions.contains(requiredPermission);
    }

    private boolean isCurrentAccess(SessionAccess session) {
        if (session == null) return false;
        AdminAccountStatusService.Snapshot snapshot = adminAccountStatusService.getSnapshot(session.userId());
        return snapshot != null
                && STATUS_ACTIVE.equals(snapshot.status())
                && snapshot.accessVersion() == session.accessVersion();
    }

    private static long accessVersionFrom(Claims claims) {
        Number accessVersion = claims.get("accessVersion", Number.class);
        if (accessVersion == null) {
            throw new IllegalArgumentException("Missing admin access version.");
        }
        return accessVersion.longValue();
    }

    private record SessionAccess(UUID userId, long accessVersion) {}
}
