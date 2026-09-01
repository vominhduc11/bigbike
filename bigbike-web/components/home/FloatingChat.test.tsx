import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingChat } from "./FloatingChat";

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  openChatSession: vi.fn(),
  fetchChatHistory: vi.fn(),
  deleteChatHistory: vi.fn(),
  streamChatMessage: vi.fn(),
  uploadChatImage: vi.fn(),
  fetchChatImageBlob: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations:
    () => (key: string, values?: { count?: number; days?: number; reason?: string }) =>
      values?.count != null
        ? `${key}:${values.count}`
        : values?.days != null
          ? `${key}:${values.days}`
          : values?.reason
            ? `${key}:${values.reason}`
            : key,
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
  products: [
    {
      slug: "mu-34",
      name: "Mũ 3/4",
      retailPrice: 1_590_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
  ],
  crossSellProducts: [],
  salesStage: "BROWSING",
  actions: [],
  contacts: {},
  countedTurns: 1,
  turnLimit: 40,
  turnsRemaining: 39,
};

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI",
    maxTurns: 40,
    contacts: {},
    images: {
      enabled: true,
      maxBytes: 8 * 1024 * 1024,
      maxPerTurn: 1,
      maxPerConversation: 3,
      dailyLimit: 20,
      disclosure: "imageDisclosure",
    },
  });
  api.openChatSession.mockResolvedValue({
    visitorToken: "visitor-token",
    rememberedThrough: "2026-09-28T00:00:00Z",
    memoryEnabled: true,
    activeConversationId: null,
    rememberedContextSummary: null,
  });
  api.fetchChatHistory.mockResolvedValue({
    conversationId: "conversation-1",
    threadId: "thread-1",
    latestSequence: 0,
    messages: [],
  });
  api.streamChatMessage.mockResolvedValue(defaultResult);
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

    await waitFor(() =>
      expect(api.streamChatMessage).toHaveBeenCalledWith(
        "Tư vấn mũ đi phượt",
        "vi",
        undefined,
        expect.any(String),
        expect.any(Function),
        expect.any(AbortSignal),
        null,
        undefined,
        "visitor-token",
      ),
    );
    expect(await screen.findAllByText("Em đã tìm được mẫu phù hợp.")).not.toHaveLength(0);
    expect(screen.getByText("Mũ 3/4")).toBeInTheDocument();
  });

  it("shows the bilingual AI disclosure and opens direct shop contacts without creating a request", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.getByText("aiDisclosure")).toBeInTheDocument();
    expect(screen.getByLabelText("messageLabel")).toBeVisible();
    expect(screen.queryByText("defaultGreeting")).not.toBeInTheDocument();
    expect(screen.queryByText("quickFind")).not.toBeInTheDocument();
    expect(screen.queryByText("quickFilter")).not.toBeInTheDocument();
    expect(screen.queryByText("quickCompare")).not.toBeInTheDocument();
    expect(screen.queryByText("quickCheck")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "contactToggleOpen" }));

    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(api.streamChatMessage).not.toHaveBeenCalled();
  });

  it("does not expose a human-chat action when the assistant cannot answer", async () => {
    api.streamChatMessage.mockResolvedValue({
      ...defaultResult,
      products: [],
      answer: "Vui lòng liên hệ shop qua các kênh bên dưới.",
      resultKind: "CONTACT",
      mode: "CONTACT",
      actions: [],
    });
    const user = userEvent.setup();
    const input = await openReadyChat(user);
    await user.type(input, "Kiểm tra size M");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(screen.queryByRole("button", { name: /staff|nhân viên/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "contactToggleOpen" })).toBeInTheDocument();
  });

  it("keeps image upload available without an owner setting", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.getByRole("button", { name: "chooseImage" })).toBeInTheDocument();
  });

  it("keeps the composer outside the scrolling conversation and exposes only close in the header", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);

    const panel = document.querySelector("[data-bigbike-assistant]");
    const header = document.querySelector("[data-bigbike-chat-header]");
    const memoryBar = document.querySelector("[data-bigbike-memory-bar]");
    const composer = document.querySelector("[data-bigbike-composer]");

    expect(panel).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(memoryBar).toBeInTheDocument();
    expect(composer?.parentElement).toBe(panel);
    expect(
      within(header as HTMLElement).getByRole("button", { name: "close" }),
    ).toBeInTheDocument();
    expect(
      within(header as HTMLElement).queryByRole("button", { name: "minimize" }),
    ).not.toBeInTheDocument();
    expect(
      within(header as HTMLElement).queryByRole("button", { name: "deleteConversation" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(memoryBar as HTMLElement).getByRole("button", { name: "deleteConversation" }),
    );
    expect(screen.getByText("confirmDeleteHistory")).toBeInTheDocument();
    expect(api.deleteChatHistory).not.toHaveBeenCalled();
  });

  it("keeps the conversation when the customer closes and reopens the panel", async () => {
    const user = userEvent.setup();
    const input = await openReadyChat(user);
    await user.type(input, "Tư vấn mũ đi phượt");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect((await screen.findAllByText("Em đã tìm được mẫu phù hợp.")).length).toBeGreaterThan(0);

    await user.click(
      within(document.querySelector("[data-bigbike-chat-header]") as HTMLElement).getByRole(
        "button",
        {
          name: "close",
        },
      ),
    );
    await waitFor(() => expect(screen.queryByLabelText("messageLabel")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "open" }));
    expect((await screen.findAllByText("Em đã tìm được mẫu phù hợp.")).length).toBeGreaterThan(0);
  });

  it("hides the image control when the AI image service is unavailable", async () => {
    api.fetchChatAvailability.mockResolvedValueOnce({
      mode: "AI",
      maxTurns: 40,
      contacts: {},
      images: {
        enabled: false,
        maxBytes: 8 * 1024 * 1024,
        maxPerTurn: 1,
        maxPerConversation: 3,
        dailyLimit: 20,
        disclosure: "",
      },
    });
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.queryByLabelText("chooseImage")).not.toBeInTheDocument();
  });
});
