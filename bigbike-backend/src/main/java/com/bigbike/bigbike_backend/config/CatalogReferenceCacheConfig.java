package com.bigbike.bigbike_backend.config;

import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.annotation.CachingConfigurerSupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

/** Chỉ lưu tạm bản chiếu bất biến của danh mục; kho dữ liệu luôn là phương án dự phòng. */
@Configuration
@Slf4j
public class CatalogReferenceCacheConfig extends CachingConfigurerSupport {

    @Bean
    CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration defaults = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .disableCachingNullValues()
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(catalogReferenceValueSerializer()));
        return RedisCacheManager.builder(connectionFactory).cacheDefaults(defaults).build();
    }

    static GenericJackson2JsonRedisSerializer catalogReferenceValueSerializer() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        mapper.activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder()
                        .allowIfSubType("com.bigbike.bigbike_backend.domain.catalog.")
                        .allowIfSubType("com.bigbike.bigbike_backend.api.admin.dto.")
                        .allowIfSubType("java.time.")
                        .allowIfSubType("java.util.")
                        .build(),
                ObjectMapper.DefaultTyping.EVERYTHING,
                JsonTypeInfo.As.PROPERTY);
        return GenericJackson2JsonRedisSerializer.builder()
                .objectMapper(mapper)
                .defaultTyping(false)
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Không đọc được bộ nhớ đệm Redis {}:{}; chuyển sang đọc PostgreSQL.", cache.getName(), key, exception);
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Không ghi được bộ nhớ đệm Redis {}:{}; yêu cầu vẫn tiếp tục bằng kho dữ liệu.", cache.getName(), key, exception);
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Không xoá được bộ nhớ đệm Redis {}:{}.", cache.getName(), key, exception);
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Không xoá được toàn bộ bộ nhớ đệm Redis {}.", cache.getName(), exception);
            }
        };
    }
}
