import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage, streamChatMessage } from "@/lib/api/client-api";

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
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
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
      leadPrompt: false,
      actions: [],
      contacts: {},
    }) as never);

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
      leadPrompt: false,
      actions: [],
      contacts: {},
    };
    const body = [
      'event: progress\ndata: {"code":"UNDERSTANDING"}\n\n',
      'event: progress\ndata: {"code":"MODEL_PARTIAL_TEXT"}\n\n',
      `event: result\ndata: ${JSON.stringify(payload)}\n\n`,
    ].join("");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }));
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
});
