package com.bigbike.bigbike_backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "bigbike.jwt")
public class JwtProperties {

    private String secret = "dev-change-me-in-production-needs-32chars!!";
    private int accessTokenTtlSeconds = 900;
    private int refreshTokenTtlSeconds = 604800;

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }

    public int getAccessTokenTtlSeconds() { return accessTokenTtlSeconds; }
    public void setAccessTokenTtlSeconds(int accessTokenTtlSeconds) { this.accessTokenTtlSeconds = accessTokenTtlSeconds; }

    public int getRefreshTokenTtlSeconds() { return refreshTokenTtlSeconds; }
    public void setRefreshTokenTtlSeconds(int refreshTokenTtlSeconds) { this.refreshTokenTtlSeconds = refreshTokenTtlSeconds; }
}
