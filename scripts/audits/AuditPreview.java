package audit;

import com.bigbike.bigbike_backend.BigbikeBackendApplication;
import com.bigbike.bigbike_backend.service.chat.ChatAiQuotaService;
import com.bigbike.bigbike_backend.service.chat.ChatImageDailyQuotaService;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

/** Opt-in, isolated audit launcher. Never packaged in the application. */
@Configuration(proxyBeanMethods = false)
public class AuditPreview {
    public static void main(String[] args) {
        SpringApplication.run(new Class<?>[]{BigbikeBackendApplication.class, AuditPreview.class}, args);
    }

    @Bean
    org.springframework.boot.ApplicationRunner verifyNoScheduledJobs(org.springframework.context.ApplicationContext context) {
        return args -> {
            if (!context.getBeansOfType(org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor.class).isEmpty()) {
                throw new IllegalStateException("Audit preview must not start scheduled jobs");
            }
            System.out.println("AUDIT_PREVIEW_SCHEDULED_JOBS_DISABLED");
        };
    }

    @Bean
    static BeanFactoryPostProcessor disableScheduledJobs() {
        return factory -> {
            var registry = (BeanDefinitionRegistry) factory;
            String scheduled = org.springframework.scheduling.config.TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME;
            if (registry.containsBeanDefinition(scheduled)) registry.removeBeanDefinition(scheduled);
        };
    }

    @Bean
    org.springframework.boot.ApplicationRunner auditDiagnostics(
            com.bigbike.bigbike_backend.service.chat.ChatToolService chat,
            com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings settings,
            Environment environment) {
        return args -> {
            String destination = environment.getProperty("audit.diagnostic.file");
            if (destination == null) return;
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var inputs = mapper.readTree(java.nio.file.Files.readString(
                    java.nio.file.Path.of(environment.getRequiredProperty("audit.diagnostic.cases"))));
            var rows = new java.util.ArrayList<java.util.Map<String, Object>>();
            Object diagnosticTarget = chat instanceof org.springframework.aop.framework.Advised proxy
                    ? proxy.getTargetSource().getTarget() : chat;
            var type = com.bigbike.bigbike_backend.service.chat.ChatToolService.class;
            var resolve = type.getDeclaredMethod("resolveCatalogIntent", String.class, String.class);
            resolve.setAccessible(true);
            var extract = type.getDeclaredMethod("extractProductQuery", String.class, java.util.Set.class);
            extract.setAccessible(true);
            for (var input : inputs) {
                String question = input.path("question").asText();
                String lang = input.path("lang").asText();
                Object intent = resolve.invoke(diagnosticTarget, question, lang);
                var metadata = intent.getClass().getDeclaredMethod("metadataTokens");
                metadata.setAccessible(true);
                Object query = extract.invoke(diagnosticTarget, question, metadata.invoke(intent));
                var row = new java.util.LinkedHashMap<String, Object>();
                row.put("id", input.path("id").asText());
                row.put("intent", intent.toString());
                row.put("query", query.toString());
                try { row.put("fastPath", chat.resolveFastPath(question, lang, null, settings.load(lang))
                        .map(Object::toString).orElse("AI_REQUIRED")); }
                catch (Exception failure) { row.put("error", failure.getClass().getSimpleName()); }
                rows.add(row);
            }
            java.nio.file.Files.writeString(java.nio.file.Path.of(destination), mapper.writeValueAsString(rows));
        };
    }

    @Bean
    org.springframework.boot.ApplicationRunner advisorDiagnostic(
            com.bigbike.bigbike_backend.service.chat.ChatToolService chat,
            com.bigbike.bigbike_backend.service.chat.ChatSalesAdvisorService advisor,
            com.bigbike.bigbike_backend.service.chat.ChatResponseGuard guard,
            com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings settings,
            Environment environment) {
        return args -> {
            String path = environment.getProperty("audit.advisor.diagnostic");
            if (path == null) return;
            String question = "Can you give me an extra 20% discount on the AGV K1S?";
            var context = com.bigbike.bigbike_backend.service.chat.ChatToolService.ConversationContext.empty();
            var outcome = chat.resolveFastPath(question, "en", null, settings.load("en"), context).orElseThrow();
            var conversation = new com.bigbike.bigbike_backend.persistence.entity.chat.ChatConversationEntity();
            conversation.setLocale("en");
            var advice = advisor.advise(conversation, question, "en", settings.load("en"), context,
                    outcome.localAnswer(), outcome.products(), outcome.source(), "PRODUCT_RESULTS", null, outcome.actions());
            String reason = guard.rejectionReason(advice.answer(), advice.products(), "en", java.util.List.of(), java.util.Set.of());
            java.nio.file.Files.writeString(java.nio.file.Path.of(path), new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(java.util.Map.of("advice",advice,"reason",reason)));
        };
    }

    private static DriverManagerDataSource liveQuotaDataSource(Environment environment) {
        // Only the two quota services receive this connection. Catalog, chats and storage use
        // the isolated datasource. Real provider attempts count against the shop's real day.
        return new DriverManagerDataSource(environment.getRequiredProperty("audit.live.url"),
                environment.getRequiredProperty("audit.live.username"),
                environment.getRequiredProperty("audit.live.password"));
    }

    @Bean @Primary
    ChatAiQuotaService auditTextQuota(Environment environment) {
        var source = liveQuotaDataSource(environment);
        return new ChatAiQuotaService(new JdbcTemplate(source), new DataSourceTransactionManager(source));
    }

    @Bean @Primary
    ChatImageDailyQuotaService auditImageQuota(Environment environment) {
        return new ChatImageDailyQuotaService(new JdbcTemplate(liveQuotaDataSource(environment)));
    }
}
