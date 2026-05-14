package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.service.auth.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final JwtService jwtService;
    private final List<String> allowedOrigins;

    public WebSocketConfig(
            JwtService jwtService,
            @Value("${bigbike.cors.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001}") String allowedOriginsRaw
    ) {
        this.jwtService = jwtService;
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

                if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
                    return message;
                }

                String auth = accessor.getFirstNativeHeader("Authorization");
                if (auth == null || !auth.startsWith("Bearer ")) {
                    log.warn("WS CONNECT rejected: missing or malformed Authorization header");
                    throw new IllegalArgumentException("Admin JWT required to connect.");
                }

                String token = auth.substring(7);
                try {
                    Claims claims = jwtService.parseAccessToken(token);
                    String role = claims.get("role", String.class);
                    if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
                        log.warn("WS CONNECT rejected: role '{}' is not admin", role);
                        throw new IllegalArgumentException("Admin role required.");
                    }
                    log.debug("WS CONNECT accepted for admin {}", claims.getSubject());
                } catch (JwtException e) {
                    log.warn("WS CONNECT rejected: invalid token — {}", e.getMessage());
                    throw new IllegalArgumentException("Invalid or expired token.");
                }

                return message;
            }
        });
    }
}
