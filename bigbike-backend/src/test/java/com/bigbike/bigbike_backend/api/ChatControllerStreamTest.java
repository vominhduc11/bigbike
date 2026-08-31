package com.bigbike.bigbike_backend.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.chat.ChatController;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatMessageResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.config.ratelimit.RateLimitService;
import com.bigbike.bigbike_backend.service.chat.ChatService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ChatControllerStreamTest {

    @Test
    void streamEmitsOnlyFixedProgressEventsBeforeTheCompleteModeratedResult() throws Exception {
        UUID conversationId = UUID.randomUUID();
        ChatService service = mock(ChatService.class);
        when(service.send(any(ChatMessageRequest.class), isNull())).thenReturn(new ChatMessageResponse(
                conversationId, UUID.randomUUID(), "AI", "AI", "Em đã kiểm tra xong.",
                "PLAIN_TEXT", "ANSWER", 1, 40, 39, List.of(), null, List.of(),
                new ChatContactResponse("", "", "", "", ""), List.of(), "BROWSING", null,
                1, 40, 39, null));
        ChatController controller = new ChatController(
                service, mock(ApiResponseFactory.class), mock(RateLimitService.class));
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        MvcResult initial = mockMvc.perform(post("/api/v1/chat/messages/stream")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content("{\"message\":\"Kiểm tra sản phẩm\",\"lang\":\"vi\"," +
                                "\"requestId\":\"11111111-1111-4111-8111-111111111111\"}"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(initial))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("UNDERSTANDING"),
                        org.hamcrest.Matchers.containsString("CHECKING_PRODUCTS"),
                        org.hamcrest.Matchers.containsString("FINALIZING"),
                        org.hamcrest.Matchers.containsString("event:result"),
                        org.hamcrest.Matchers.containsString("\"resultKind\":\"ANSWER\""),
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("functionCall")))));
        verify(service).send(any(ChatMessageRequest.class), isNull());
    }
}
