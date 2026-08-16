import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage } from "@/lib/api/client-api";

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
});
