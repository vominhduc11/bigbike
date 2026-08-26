package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class ChatTransactionBoundaryTest {

    @Test
    void fullCustomerTurnDoesNotOpenADatabaseTransactionAroundTheProviderWait() throws Exception {
        Method send = ChatService.class.getMethod("send", ChatMessageRequest.class, UUID.class);

        assertThat(AnnotatedElementUtils.findMergedAnnotation(send, Transactional.class))
                .as("ChatService.send must not hold a connection while waiting up to 65 seconds for AI")
                .isNull();
    }

    @Test
    void everyPublicProviderAnswerEntryPointExplicitlySuspendsAnyCallerTransaction() {
        assertThat(Arrays.stream(AiChatClient.class.getDeclaredMethods())
                .filter(method -> method.getName().equals("answer"))
                .filter(method -> java.lang.reflect.Modifier.isPublic(method.getModifiers()))
                .toList())
                .isNotEmpty()
                .allSatisfy(method -> {
                    Transactional annotation = AnnotatedElementUtils.findMergedAnnotation(
                            method, Transactional.class);
                    assertThat(annotation).isNotNull();
                    assertThat(annotation.propagation()).isEqualTo(Propagation.NOT_SUPPORTED);
                });
    }
}
