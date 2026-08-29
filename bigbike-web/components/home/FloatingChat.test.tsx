import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingChat } from "./FloatingChat";

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  openChatSession: vi.fn(),
  fetchChatHistory: vi.fn(),
  deleteChatHistory: vi.fn(),
  createChatRealtimeToken: vi.fn(),
  requestChatHandoff: vi.fn(),
  streamChatMessage: vi.fn(),
  uploadChatImage: vi.fn(),
  fetchChatImageBlob: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { count?: number; days?: number; reason?: string }) =>
    values?.count != null ? `${key}:${values.count}` : values?.days != null ? `${key}:${values.days}` : values?.reason ? `${key}:${values.reason}` : key,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    fetchQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn(),
    invalidateQueries: () => Promise.resolve(),
  }),
}));
vi.mock("@/lib/api/client-api", () => api);
vi.mock("@/lib/auth/auth-store", () => ({ useAuth: () => ({ status: "anonymous" }) }));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ altFallback }: { altFallback: string }) => <div aria-label={altFallback} />,
}));

const defaultResult = {
  conversationId: "conversation-1",
  assistantMessageId: "assistant-1",
  mode: "AI",
  answer: "Em đã tìm được mẫu phù hợp.",
  answerFormat: "PLAIN_TEXT",
  resultKind: "PRODUCT_RESULTS",
  turnCount: 1,
  maxTurns: 40,
  remainingTurns: 39,
  products: [{ slug: "mu-34", name: "Mũ 3/4", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }],
  crossSellProducts: [],
  salesStage: "BROWSING",
  handoffRecommended: false,
  actions: [],
  contacts: {},
  channelState: "AI_ACTIVE",
  countedTurns: 1,
  turnLimit: 40,
  turnsRemaining: 39,
};

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI", greeting: "Xin chào", quickPrompts: ["Tìm mũ"], maxTurns: 40, contacts: {},
    images: { enabled: false, maxBytes: 8 * 1024 * 1024, maxPerTurn: 1, maxPerConversation: 3, dailyLimit: 20, disclosure: "" },
  });
  api.openChatSession.mockResolvedValue({
    visitorToken: "visitor-token", rememberedThrough: "2026-09-28T00:00:00Z", memoryEnabled: true,
    activeConversationId: null, rememberedContextSummary: null,
  });
  api.fetchChatHistory.mockResolvedValue({ conversationId: "conversation-1", threadId: "thread-1", channelState: "AI_ACTIVE", latestSequence: 0, messages: [] });
  api.createChatRealtimeToken.mockRejectedValue(new Error("disabled in test"));
  api.streamChatMessage.mockResolvedValue(defaultResult);
  api.requestChatHandoff.mockImplementation(async ({ conversationId }: { conversationId?: string }) => ({
    conversationId: conversationId || "conversation-handoff", handoffId: "handoff-1", status: "WAITING", channelState: "WAITING_FOR_STAFF", withinBusinessHours: true,
  }));
  api.deleteChatHistory.mockResolvedValue({ deleted: true });
  HTMLElement.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
});

afterEach(() => vi.useRealTimers());

async function openReadyChat(user: ReturnType<typeof userEvent.setup>) {
  render(<FloatingChat />);
  await waitFor(() => expect(api.openChatSession).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "open" }));
  return screen.findByLabelText("messageLabel");
}

describe("FloatingChat", () => {
  it("sends a consultation request and renders the returned product", async () => {
    const user = userEvent.setup();
    const input = await openReadyChat(user);
    await user.type(input, "Tư vấn mũ đi phượt");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalledWith(
      "Tư vấn mũ đi phượt", "vi", undefined, expect.any(String), expect.any(Function), expect.any(AbortSignal), null, undefined, "visitor-token",
    ));
    expect(await screen.findAllByText("Em đã tìm được mẫu phù hợp.")).not.toHaveLength(0);
    expect(screen.getByText("Mũ 3/4")).toBeInTheDocument();
  });

  it("lets the customer request a staff handoff", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    await user.click(screen.getByRole("button", { name: "talkToStaff" }));

    await waitFor(() => expect(api.requestChatHandoff).toHaveBeenCalledWith(expect.objectContaining({
      locale: "vi", visitorToken: "visitor-token",
    })));
    expect(await screen.findAllByText("handoffContinue")).not.toHaveLength(0);
  });

  it("shows the staff option when the provider-unavailable reply requests it", async () => {
    api.streamChatMessage.mockResolvedValue({
      ...defaultResult,
      products: [],
      answer: "Xin lỗi, Trợ lý BigBike đang bận. Anh/chị có thể gặp nhân viên hỗ trợ.",
      resultKind: "CONTACT",
      actions: [{ type: "CONTACT_STAFF" }],
    });
    const user = userEvent.setup();
    const input = await openReadyChat(user);
    await user.type(input, "Kiểm tra size M");
    await user.click(screen.getByRole("button", { name: "send" }));

    await user.click((await screen.findAllByRole("button", { name: "talkToStaff" }))[0]);
    await waitFor(() => expect(api.requestChatHandoff).toHaveBeenCalled());
  });

  it("keeps image upload hidden while the owner has it turned off", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.queryByLabelText("chooseImage")).not.toBeInTheDocument();
  });
});
