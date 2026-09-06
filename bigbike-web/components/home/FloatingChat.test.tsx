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
  window.sessionStorage.clear();
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
    },
  });
  api.openChatSession.mockResolvedValue({
    visitorToken: "visitor-token",
    activeConversationId: null,
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
  // CHAT_RULE_049: the visitor session is created when the panel opens, never on page load.
  expect(api.openChatSession).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "open" }));
  await waitFor(() => expect(api.openChatSession).toHaveBeenCalled());
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

  // Owner decision 2026-09-06 (CHAT_RULE_001): the long "not a human staff member" sentence is
  // replaced by one short label that also absorbs the old "assistant ready" status line.
  it("shows the short AI label instead of the long disclosure and opens direct shop contacts without creating a request", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.getByText("aiHeaderTagline")).toBeInTheDocument();
    expect(screen.queryByText("aiDisclosure")).not.toBeInTheDocument();
    expect(screen.queryByText("aiStatus")).not.toBeInTheDocument();
    expect(screen.getByLabelText("messageLabel")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "contactToggleOpen" }));

    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(api.streamChatMessage).not.toHaveBeenCalled();
  });

  // CHAT_RULE_061 (owner decision 2026-09-06): the empty state carries a greeting plus exactly
  // four hardcoded suggestions; both disappear once the conversation starts.
  it("greets the customer with four fixed suggestions and drops them after the first message", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);

    expect(screen.getByText("greetingIntro")).toBeInTheDocument();
    const suggestions = [
      "suggestionHelmetBudget",
      "suggestionHelmetSize",
      "suggestionOrderStatus",
      "suggestionReturnPolicy",
    ];
    for (const key of suggestions) {
      expect(screen.getByRole("button", { name: key })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "suggestionHelmetBudget" }));

    await waitFor(() =>
      expect(api.streamChatMessage).toHaveBeenCalledWith(
        "suggestionHelmetBudget",
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
    await waitFor(() => expect(screen.queryByText("greetingIntro")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "suggestionHelmetSize" })).not.toBeInTheDocument();
  });

  // Owner decision 2026-09-06: the image-privacy line is gone from the chat frame; the wording
  // now lives only on the privacy-policy page.
  it("no longer renders an image privacy line in the chat frame", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(document.querySelector("[data-chat-image-disclosure]")).toBeNull();
    expect(screen.queryByText("imageDisclosure")).not.toBeInTheDocument();
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

  // Owner decision 2026-09-06 (CHAT_RULE_049 keeps the delete control): the header carries the
  // three icon buttons; the separate strip that used to hold only the trash icon is gone, and the
  // delete confirmation takes no height until the customer asks for it.
  it("keeps the composer outside the scrolling conversation and puts contact, delete and close in the header", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);

    const panel = document.querySelector("[data-bigbike-assistant]");
    const header = document.querySelector("[data-bigbike-chat-header]");
    const composer = document.querySelector("[data-bigbike-composer]");

    expect(panel).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(document.querySelector("[data-bigbike-memory-bar]")).toBeNull();
    expect(composer?.parentElement).toBe(panel);

    const headerButtons = within(header as HTMLElement).getAllByRole("button");
    expect(headerButtons).toHaveLength(3);
    for (const name of ["contactToggleOpen", "deleteConversation", "close"]) {
      expect(within(header as HTMLElement).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(
      within(header as HTMLElement).queryByRole("button", { name: "minimize" }),
    ).not.toBeInTheDocument();
    expect(
      within(composer as HTMLElement).queryByRole("button", { name: "contactToggleOpen" }),
    ).not.toBeInTheDocument();

    expect(document.querySelector("[data-bigbike-delete-confirm]")).toBeNull();
    await user.click(
      within(header as HTMLElement).getByRole("button", { name: "deleteConversation" }),
    );
    expect(document.querySelector("[data-bigbike-delete-confirm]")).toBeInTheDocument();
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
      },
    });
    const user = userEvent.setup();
    await openReadyChat(user);
    expect(screen.queryByLabelText("chooseImage")).not.toBeInTheDocument();
  });
});
