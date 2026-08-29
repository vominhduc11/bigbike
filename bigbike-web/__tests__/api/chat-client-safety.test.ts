import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage, streamChatMessage, uploadChatImage } from "@/lib/api/client-api";

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  };
}

describe("chat client safety normalization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps verified sellable cards when another returned card is unsafe", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        conversationId: "conversation-safe-cards",
        mode: "AI",
        answer: "Dạ, em đã kiểm tra các lựa chọn đang bán. Anh/chị xem mẫu phù hợp bên dưới nhé.",
        turnCount: 1,
        maxTurns: 12,
        remainingTurns: 11,
        products: [
          {
            slug: "mu-hop-le",
            name: "Mũ hợp lệ",
            retailPrice: 1_590_000,
            salePrice: null,
            currency: "VND",
            stockState: "IN_STOCK",
          },
          {
            slug: "mu-het-hang",
            name: "Mũ hết hàng",
            retailPrice: 2_000_000,
            salePrice: null,
            currency: "VND",
            stockState: "OUT_OF_STOCK",
          },
          {
            slug: "mu-sai-gia",
            name: "Mũ sai giá",
            retailPrice: 2_000_000,
            salePrice: 2_100_000,
            currency: "VND",
            stockState: "IN_STOCK",
          },
        ],
        handoffRecommended: false,
        actions: [],
        contacts: {},
      }) as never,
    );

    const response = await sendChatMessage("Tìm mũ", "vi");

    expect(response.mode).toBe("AI");
    expect(response.products).toEqual([expect.objectContaining({ slug: "mu-hop-le" })]);
  });

  it("accepts only fixed progress codes and exposes the moderated result once", async () => {
    const payload = {
      conversationId: "conversation-stream",
      mode: "AI",
      answer: "Em đã kiểm tra xong.",
      answerFormat: "PLAIN_TEXT",
      resultKind: "ANSWER",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      actions: [],
      contacts: {},
    };
    const body = [
      'event: progress\ndata: {"code":"UNDERSTANDING"}\n\n',
      'event: progress\ndata: {"code":"MODEL_PARTIAL_TEXT"}\n\n',
      `event: result\ndata: ${JSON.stringify(payload)}\n\n`,
    ].join("");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const progress = vi.fn();

    const response = await streamChatMessage(
      "Kiểm tra giúp tôi",
      "vi",
      "conversation-stream",
      "11111111-1111-4111-8111-111111111111",
      progress,
    );

    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith("UNDERSTANDING");
    expect(response).toMatchObject({ answer: "Em đã kiểm tra xong.", resultKind: "ANSWER" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      conversationId: "conversation-stream",
      requestId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("uploads image bytes with the private visitor token and sends only the resulting id", async () => {
    const image = {
      id: "image-1",
      contentPath: "/api/v1/chat/images/image-1/content",
      mimeType: "image/png",
      width: 800,
      height: 600,
      sizeBytes: 1234,
      status: "PENDING",
      createdAt: "2026-08-26T08:00:00Z",
    };
    const streamPayload = {
      conversationId: "conversation-image",
      mode: "AI",
      answer: "Ảnh này trông giống mẫu đang bán; đây không phải khẳng định cùng sản phẩm.",
      resultKind: "PRODUCT_RESULTS",
      turnCount: 1,
      maxTurns: 40,
      remainingTurns: 39,
      products: [],
      actions: [],
      contacts: {},
    };
    const streamBody = `event: result\ndata: ${JSON.stringify(streamPayload)}\n\n`;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ conversationId: "conversation-image", image }) as never)
      .mockResolvedValueOnce(new Response(streamBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }));
    const file = new File([new Uint8Array([1, 2, 3])], "helmet.png", { type: "image/png" });

    const uploaded = await uploadChatImage({
      file,
      requestId: "11111111-1111-4111-8111-111111111111",
      conversationId: "conversation-image",
      lang: "vi",
      visitorToken: "private-visitor-token",
    });
    await streamChatMessage(
      "Shop có mẫu này không?", "vi", uploaded.conversationId,
      "22222222-2222-4222-8222-222222222222", vi.fn(), undefined,
      null, undefined, "private-visitor-token", [uploaded.image.id],
    );

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/chat/images?");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "X-Chat-Visitor-Token": "private-visitor-token" }),
      body: expect.any(FormData),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      conversationId: "conversation-image",
      imageIds: ["image-1"],
      visitorToken: "private-visitor-token",
    });
  });

  it("surfaces the specific image validation code from the standard API error details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          details: [{
            field: "file",
            code: "CHAT_IMAGE_UNSUPPORTED_TYPE",
            message: "Only JPG, PNG, or WebP is accepted.",
          }],
        },
      }),
    } as Response);

    await expect(uploadChatImage({
      file: new File([new Uint8Array([1, 2, 3])], "document.pdf", { type: "application/pdf" }),
      requestId: "33333333-3333-4333-8333-333333333333",
      lang: "en",
    })).rejects.toMatchObject({
      status: 400,
      code: "CHAT_IMAGE_UNSUPPORTED_TYPE",
      fieldErrors: { file: "Only JPG, PNG, or WebP is accepted." },
    });
  });

  it("keeps a valid clarification, suppresses fixed actions, and sends its selection metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        conversationId: "conversation-clarification",
        mode: "AI",
        answer: "Trong tầm giá này, anh/chị cần nhóm nào ạ?",
        answerFormat: "PLAIN_TEXT",
        resultKind: "CLARIFICATION",
        turnCount: 1,
        maxTurns: 16,
        remainingTurns: 15,
        products: [],
        clarification: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          criterion: "GROUP",
          options: [
            { id: "group-helmet", label: "Mũ bảo hiểm", count: 13, kind: "FILTER" },
            { id: "show-all", label: "Cứ cho em xem tất cả", count: null, kind: "BYPASS" },
          ],
        },
        handoffRecommended: false,
        actions: [{ type: "CHECK_SIZE" }],
        contacts: {},
      }) as never,
    );

    const response = await sendChatMessage(
      "Mũ bảo hiểm",
      "vi",
      "conversation-clarification",
      undefined,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      null,
      {
        clarificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        optionId: "group-helmet",
      },
    );

    expect(response.mode).toBe("AI");
    expect(response.clarification?.criterion).toBe("GROUP");
    expect(response.clarification?.options).toHaveLength(2);
    expect(response.actions).toEqual([]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      clarificationSelection: {
        clarificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        optionId: "group-helmet",
      },
    });
  });

  it("rejects malformed clarification copy instead of exposing unsafe buttons", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        mode: "AI",
        answer: "Please choose one option.",
        turnCount: 1,
        maxTurns: 16,
        remainingTurns: 15,
        products: [],
        clarification: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          criterion: "GROUP",
          options: [{ id: "bad", label: "IN_STOCK", count: 1, kind: "FILTER" }],
        },
        handoffRecommended: false,
        actions: [],
        contacts: {},
      }) as never,
    );

    const response = await sendChatMessage("Show products", "en");

    expect(response.mode).toBe("CONTACT");
    expect(response.clarification).toBeNull();
    expect(response.actions).toEqual([]);
  });
});
