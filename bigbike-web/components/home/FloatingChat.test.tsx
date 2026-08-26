import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingChat } from "./FloatingChat";
import { CHAT_STORAGE_KEY, writeChatSnapshot } from "@/lib/chat/chat-persistence";

type TestAuthState =
  | { status: "anonymous" }
  | { status: "authenticated"; profile: { displayName: string | null; phone: string | null } };

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  openChatSession: vi.fn(),
  fetchChatHistory: vi.fn(),
  deleteChatHistory: vi.fn(),
  createChatRealtimeToken: vi.fn(),
  requestChatHandoff: vi.fn(),
  submitChatFeedback: vi.fn(),
  streamChatMessage: vi.fn(),
  offerChatLead: vi.fn(),
  captureChatLead: vi.fn(),
  declineChatLead: vi.fn(),
  recordChatInteraction: vi.fn(),
  uploadChatImage: vi.fn(),
  fetchChatImageBlob: vi.fn(),
}));

const auth = vi.hoisted(() => ({ state: { status: "anonymous" } as TestAuthState }));
const navigation = vi.hoisted(() => ({ pathname: "/" }));
const cart = vi.hoisted(() => ({ count: 0 }));
const intl = vi.hoisted(() => ({
  locale: "vi",
  translate: (key: string, values?: { count?: number; product?: string; name?: string }) => {
    if (values?.count != null) return `${key}:${values.count}`;
    if (values?.product) return `${key}:${values.product}`;
    if (values?.name) return `${key}:${values.name}`;
    return key;
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => intl.locale,
  useTranslations: () => intl.translate,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    fetchQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn(),
    invalidateQueries: () => Promise.resolve(),
  }),
}));

vi.mock("@/lib/api/client-api", () => api);
vi.mock("@/lib/auth/auth-store", () => ({ useAuth: () => auth.state }));
vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({ addToCart: vi.fn(), cartCount: cart.count }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ altFallback }: { altFallback: string }) => <div aria-label={altFallback} />,
}));

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  auth.state = { status: "anonymous" };
  navigation.pathname = "/";
  cart.count = 0;
  intl.locale = "vi";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  URL.createObjectURL = vi.fn(() => "blob:chat-image-preview");
  URL.revokeObjectURL = vi.fn();
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI",
    greeting: "Xin chào từ Trợ lý BigBike",
    quickPrompts: ["Tìm mũ"],
    maxTurns: 16,
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
  api.openChatSession.mockResolvedValue({
    visitorToken: "visitor-token",
    rememberedThrough: "2026-09-24T00:00:00Z",
    memoryEnabled: true,
    activeConversationId: null,
    rememberedContextSummary: null,
  });
  api.fetchChatHistory.mockResolvedValue({
    conversationId: "conversation-1",
    threadId: "thread-1",
    channelState: "AI_ACTIVE",
    latestSequence: 0,
    messages: [],
    handoff: null,
  });
  api.deleteChatHistory.mockResolvedValue({ deleted: true });
  api.createChatRealtimeToken.mockRejectedValue(new Error("realtime disabled in unit test"));
  api.requestChatHandoff.mockImplementation(async ({ conversationId }: { conversationId?: string }) => ({
    handoffId: "handoff-1",
    conversationId: conversationId || "conversation-handoff",
    channelState: "WAITING_FOR_STAFF",
    withinBusinessHours: true,
    businessHoursText: "09:00–21:00",
  }));
  api.submitChatFeedback.mockResolvedValue({ saved: true });
  api.streamChatMessage.mockResolvedValue({
    conversationId: "conversation-1",
    mode: "AI",
    answer: "Em tìm thấy sản phẩm thật này.",
    turnCount: 1,
    maxTurns: 16,
    remainingTurns: 15,
    products: [
      {
        slug: "mu-34-test",
        name: "Mũ 3/4 Test",
        retailPrice: 1590000,
        currency: "VND",
        stockState: "IN_STOCK",
      },
    ],
    handoffRecommended: false,
    leadPrompt: false,
    actions: [],
    contacts: {},
  });
  api.declineChatLead.mockResolvedValue({ declined: true });
  api.offerChatLead.mockImplementation(async ({ conversationId }: { conversationId?: string }) => ({
    conversationId: conversationId || "conversation-offer",
    offered: true,
  }));
  api.captureChatLead.mockResolvedValue({ captured: true });
  api.recordChatInteraction.mockResolvedValue({ recorded: true, interactionId: "interaction-1" });
  api.uploadChatImage.mockResolvedValue({
    conversationId: "conversation-image",
    image: {
      id: "image-1",
      contentPath: "/api/v1/chat/images/image-1/content",
      mimeType: "image/png",
      width: 800,
      height: 600,
      sizeBytes: 1024,
      status: "PENDING",
      createdAt: "2026-08-26T08:00:00Z",
    },
  });
  api.fetchChatImageBlob.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FloatingChat", () => {
  it("keeps image upload hidden by default", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));

    expect(screen.queryByLabelText("chooseImage")).not.toBeInTheDocument();
    expect(document.querySelector("[data-chat-image-disclosure]")).toBeNull();
  });

  it("shows the disclosure, previews an enabled image, uploads it, and sends its private id", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: ["Tìm mũ"],
      maxTurns: 40,
      contacts: {},
      images: {
        enabled: true,
        maxBytes: 8 * 1024 * 1024,
        maxPerTurn: 1,
        maxPerConversation: 3,
        dailyLimit: 20,
        disclosure: "Ảnh được gửi tới dịch vụ AI Google và xoá sau 90 ngày.",
      },
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("Ảnh được gửi tới dịch vụ AI Google và xoá sau 90 ngày.")).toBeInTheDocument();
    const file = new File([new Uint8Array([1, 2, 3])], "helmet.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("chooseImage", { selector: "input" }), file);
    expect(await screen.findByAltText("selectedImageAlt")).toBeInTheDocument();
    await user.type(screen.getByLabelText("messageLabel"), "Shop có bán mẫu này không?");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(api.uploadChatImage).toHaveBeenCalledWith(expect.objectContaining({
      file,
      lang: "vi",
      visitorToken: "visitor-token",
    })));
    expect(api.streamChatMessage).toHaveBeenCalledWith(
      "Shop có bán mẫu này không?",
      "vi",
      "conversation-image",
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      undefined,
      undefined,
      "visitor-token",
      ["image-1"],
    );
    expect(await screen.findByAltText("customerImageAlt")).toBeInTheDocument();
  });

  it("rejects an oversized or unsupported image without breaking text chat", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: ["Tìm mũ"],
      maxTurns: 40,
      contacts: {},
      images: {
        enabled: true, maxBytes: 8, maxPerTurn: 1, maxPerConversation: 3,
        dailyLimit: 20, disclosure: "AI Google",
      },
    });
    const user = userEvent.setup({ applyAccept: false });
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.upload(
      screen.getByLabelText("chooseImage", { selector: "input" }),
      new File([new Uint8Array(9)], "large.png", { type: "image/png" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("imageTooLarge");
    await user.upload(
      screen.getByLabelText("chooseImage", { selector: "input" }),
      new File(["gif"], "helmet.gif", { type: "image/gif" }),
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("imageUnsupported");
    });

    await user.type(screen.getByLabelText("messageLabel"), "Tư vấn bằng chữ giúp tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalled());
    expect(api.uploadChatImage).not.toHaveBeenCalled();
  });

  it("renders dynamic clarification choices and sends the verified selection metadata", async () => {
    api.streamChatMessage
      .mockResolvedValueOnce({
        conversationId: "conversation-clarification",
        assistantMessageId: "assistant-clarification",
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
        leadPrompt: false,
        actions: [{ type: "CHECK_SIZE" }],
        contacts: {},
      })
      .mockResolvedValueOnce({
        conversationId: "conversation-clarification",
        assistantMessageId: "assistant-final",
        mode: "AI",
        answer: "Em hiển thị ngay các lựa chọn phù hợp.",
        answerFormat: "PLAIN_TEXT",
        resultKind: "PRODUCT_RESULTS",
        turnCount: 2,
        maxTurns: 16,
        remainingTurns: 14,
        products: [
          {
            slug: "helmet-final",
            name: "Mũ phù hợp",
            retailPrice: 2_000_000,
            currency: "VND",
            stockState: "IN_STOCK",
          },
        ],
        clarification: null,
        handoffRecommended: false,
        leadPrompt: false,
        actions: [],
        contacts: {},
      });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Dưới 5 triệu");
    await user.click(screen.getByRole("button", { name: "send" }));

    const helmetChoice = await screen.findByRole("button", { name: "Mũ bảo hiểm (13)" });
    expect(screen.getByRole("button", { name: "Cứ cho em xem tất cả" })).toBeEnabled();
    expect(screen.queryByText("noResults")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "actionCheckSize" })).not.toBeInTheDocument();
    await user.click(helmetChoice);

    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalledTimes(2));
    expect(api.streamChatMessage).toHaveBeenLastCalledWith(
      "Mũ bảo hiểm",
      "vi",
      "conversation-clarification",
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      undefined,
      {
        clarificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        optionId: "group-helmet",
      },
      "visitor-token",
    );
    expect(await screen.findByText("Mũ phù hợp")).toBeInTheDocument();
    expect(helmetChoice).toBeDisabled();
  });

  it("opens BigBike Assistant, returns a real product card, and keeps Talk to staff available", async () => {
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" zaloUrl="https://zalo.me/bigbike" />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("Xin chào từ Trợ lý BigBike")).toBeInTheDocument();

    await user.type(screen.getByLabelText("messageLabel"), "Cho em mũ 3/4");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findAllByText("Em tìm thấy sản phẩm thật này.")).not.toHaveLength(0);
    expect(screen.getByText("Mũ 3/4 Test")).toBeInTheDocument();
    expect(screen.getByText(/1\.590\.000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "chooseBuy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talkToStaff/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /talkToStaff/ }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
  });

  it("shows branded onboarding tiles and the chat-bubble avatar", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: [
        "Tìm theo nhu cầu",
        "Lọc theo ngân sách",
        "So sánh sản phẩm",
        "Kiểm tra còn hàng",
      ],
      maxTurns: 12,
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("Xin chào từ Trợ lý BigBike")).toBeInTheDocument();
    expect(document.body.querySelector("[data-bigbike-onboarding]")).toBeInTheDocument();
    expect(document.body.querySelectorAll("[data-bigbike-onboarding] button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "talkToStaff" })).toBeInTheDocument();

    const avatar = document.body.querySelector("[data-bigbike-avatar] svg");
    expect(avatar).toBeInTheDocument();
  });

  it("keeps the desktop page interactive and uses a mobile-only backdrop", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await waitFor(() =>
      expect(document.querySelector("[data-bigbike-assistant]")).toBeInTheDocument(),
    );
    const panel = document.querySelector("[data-bigbike-assistant]");
    expect(panel).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("shows three vertical product cards first and expands the remaining results on demand", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-products",
      mode: "AI",
      answer: "Shop có 5 mẫu phù hợp.",
      turnCount: 1,
      maxTurns: 16,
      remainingTurns: 15,
      products: Array.from({ length: 5 }, (_, index) => ({
        slug: `mu-${index + 1}`,
        name: `Mũ ${index + 1}`,
        retailPrice: 1_000_000 + index,
        currency: "VND",
        stockState: "IN_STOCK",
      })),
      handoffRecommended: false,
      leadPrompt: false,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Tìm mũ");
    await user.click(screen.getByRole("button", { name: "send" }));

    await screen.findByText("Mũ 3");
    expect(document.querySelectorAll("[data-bigbike-product-card]")).toHaveLength(3);
    expect(screen.queryByText("Mũ 4")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "viewMoreProducts:2" }));
    expect(await screen.findByText("Mũ 5")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-bigbike-product-card]")).toHaveLength(5);
  });

  it("locks the composer for CONTACT and opens the inline contact card on demand", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "CONTACT",
      reason: "DISABLED",
      quickPrompts: [],
      maxTurns: 12,
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" messengerUrl="https://m.me/bigbike" />);

    await user.click(screen.getByRole("button", { name: "open" }));

    expect(await screen.findByText("fallbackNotice")).toBeInTheDocument();
    const input = screen.getByLabelText("messageLabel");
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "send" })).toBeDisabled();
    expect(screen.queryByText("contactTitle")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "talkToStaff" }));

    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
    expect(screen.getByText("messenger")).toBeInTheDocument();
    expect(document.querySelector("[data-bigbike-contact-view]")).not.toBeInTheDocument();
    await waitFor(() => expect(api.streamChatMessage).not.toHaveBeenCalled());
  });

  it("locks the composer after a closed conversation while keeping the answer in the chat flow", async () => {
    api.streamChatMessage.mockResolvedValueOnce({
      conversationId: "conversation-closed",
      mode: "CONTACT",
      answer:
        "Hội thoại đã kết thúc theo quy định. Anh/chị có thể gặp nhân viên BigBike để được hỗ trợ tiếp.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: true,
      leadPrompt: false,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" />);

    await user.click(screen.getByRole("button", { name: "open" }));
    const input = await screen.findByLabelText("messageLabel");
    await user.type(input, "Cần nhân viên hỗ trợ");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(
      await screen.findAllByText(
        "Hội thoại đã kết thúc theo quy định. Anh/chị có thể gặp nhân viên BigBike để được hỗ trợ tiếp.",
      ),
    ).not.toHaveLength(0);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "messagePlaceholderLocked");
    expect(screen.getByRole("button", { name: "send" })).toBeDisabled();
    expect(document.querySelector("[data-bigbike-contact-view]")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "talkToStaff" }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "contactToggleClose" }));
    expect(screen.queryByText("contactTitle")).not.toBeInTheDocument();
  });

  it("keeps the composer open and returns the draft after a network failure", async () => {
    api.streamChatMessage.mockRejectedValue(new Error("network failure"));
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Tìm mũ bảo hiểm");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findByText("fallbackNotice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
    expect(screen.getByLabelText("messageLabel")).not.toBeDisabled();
    expect(screen.getByLabelText("messageLabel")).toHaveValue("Tìm mũ bảo hiểm");
    expect(screen.queryByText("contactTitle")).not.toBeInTheDocument();
    expect(screen.queryByText(/stack trace|exception|functionCall|SQL/i)).not.toBeInTheDocument();
  });

  it("stops waiting after 75 seconds, restores the draft, and retries with the same request id", async () => {
    vi.useFakeTimers();
    api.streamChatMessage.mockImplementationOnce(() => new Promise(() => {}));
    render(<FloatingChat hotline="0901 234 567" />);

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = screen.getByLabelText("messageLabel");
    fireEvent.change(input, { target: { value: "Tìm mũ trong tầm giá này" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75_000);
    });

    expect(screen.getByText("timeoutNotice")).toBeInTheDocument();
    expect(input).toHaveValue("Tìm mũ trong tầm giá này");
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talkToStaff/ })).toBeInTheDocument();

    api.streamChatMessage.mockResolvedValueOnce({
      conversationId: "conversation-after-timeout",
      mode: "AI",
      answer: "Em đã kiểm tra lại được yêu cầu này.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: false,
      actions: [],
      contacts: {},
    });
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const firstRequestId = api.streamChatMessage.mock.calls[0]?.[3];
    expect(api.streamChatMessage).toHaveBeenLastCalledWith(
      "Tìm mũ trong tầm giá này",
      "vi",
      undefined,
      firstRequestId,
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      undefined,
      undefined,
      "visitor-token",
    );
    expect(screen.getAllByText("Em đã kiểm tra lại được yêu cầu này.")).not.toHaveLength(0);
  });

  it("keeps asking after a technical fallback response", async () => {
    api.streamChatMessage
      .mockResolvedValueOnce({
        conversationId: "conversation-fallback",
        mode: "AI",
        answer: "fallback kỹ thuật",
        turnCount: 0,
        maxTurns: 12,
        remainingTurns: 12,
        products: [],
        handoffRecommended: false,
        leadPrompt: false,
        actions: [],
        contacts: {},
      })
      .mockResolvedValueOnce({
        conversationId: "conversation-fallback",
        mode: "AI",
        answer: "Em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé.",
        turnCount: 1,
        maxTurns: 12,
        remainingTurns: 11,
        products: [],
        handoffRecommended: false,
        leadPrompt: false,
        actions: [],
        contacts: {},
      });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    const input = await screen.findByLabelText("messageLabel");
    await user.type(input, "Câu hỏi bị lỗi");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findAllByText("fallback kỹ thuật")).not.toHaveLength(0);
    expect(input).not.toBeDisabled();

    await user.type(input, "Câu hỏi tiếp theo");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(
      await screen.findAllByText("Em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé."),
    ).not.toHaveLength(0);
    expect(api.streamChatMessage).toHaveBeenCalledTimes(2);
  });

  it("maps every backend action to a fixed local route", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-actions",
      mode: "AI",
      answer: "Anh/chị có thể dùng các trang tài khoản hiện có.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: false,
      actions: [
        { type: "LOGIN" as const },
        { type: "ORDER_HISTORY" as const },
        { type: "ORDER_LOOKUP" as const },
      ],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Đơn hàng của tôi");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findByRole("button", { name: "orderLogin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "orderHistory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "orderLookup" })).toBeInTheDocument();
  });

  it("does not show or record automatic lead invitations returned by an older backend", async () => {
    api.streamChatMessage
      .mockResolvedValueOnce({
        conversationId: "conversation-lead-sequences",
        assistantMessageId: "assistant-sequence-1",
        mode: "AI",
        answer: "Em đã tìm được lựa chọn phù hợp.",
        turnCount: 1,
        maxTurns: 12,
        remainingTurns: 11,
        products: [],
        handoffRecommended: false,
        leadPrompt: true,
        leadPromptSequence: 1,
        actions: [],
        contacts: {},
      })
      .mockResolvedValueOnce({
        conversationId: "conversation-lead-sequences",
        assistantMessageId: "assistant-sequence-2",
        mode: "AI",
        answer: "Em đã kiểm tra size của đúng mẫu này.",
        turnCount: 2,
        maxTurns: 12,
        remainingTurns: 10,
        products: [],
        handoffRecommended: false,
        leadPrompt: true,
        leadPromptSequence: 2,
        actions: [],
        contacts: {},
      });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Tìm mẫu phù hợp");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findAllByText("Em đã tìm được lựa chọn phù hợp.")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "leadPromptAccept" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("messageLabel"), "Mẫu này còn size M không?");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect(await screen.findAllByText("Em đã kiểm tra size của đúng mẫu này.")).not.toHaveLength(0);
    expect(document.querySelectorAll("[data-bigbike-lead-prompt]")).toHaveLength(0);
    expect(
      api.recordChatInteraction.mock.calls.filter((call) => call[0]?.type === "LEAD_PROMPT_VIEWED"),
    ).toHaveLength(0);
  });

  it("records a fixed suggestion click before sending the attributed follow-up", async () => {
    api.streamChatMessage
      .mockResolvedValueOnce({
        conversationId: "conversation-action-chain",
        assistantMessageId: "assistant-action-source",
        mode: "AI",
        answer: "Anh/chị có thể kiểm tra size tiếp.",
        turnCount: 1,
        maxTurns: 12,
        remainingTurns: 11,
        products: [],
        handoffRecommended: false,
        leadPrompt: false,
        leadPromptSequence: 0,
        actions: [{ type: "CHECK_SIZE" as const }],
        contacts: {},
      })
      .mockResolvedValueOnce({
        conversationId: "conversation-action-chain",
        assistantMessageId: "assistant-action-result",
        mode: "AI",
        answer: "Anh/chị cho em biết mẫu cần kiểm tra.",
        turnCount: 2,
        maxTurns: 12,
        remainingTurns: 10,
        products: [],
        handoffRecommended: false,
        leadPrompt: false,
        leadPromptSequence: 0,
        actions: [],
        contacts: {},
      });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Tư vấn giúp tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "actionCheckSize" }));

    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalledTimes(2));
    expect(api.recordChatInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conversation-action-chain",
        assistantMessageId: "assistant-action-source",
        type: "ACTION_CLICKED",
        actionType: "CHECK_SIZE",
      }),
    );
    expect(api.streamChatMessage).toHaveBeenLastCalledWith(
      "actionCheckSize",
      "vi",
      "conversation-action-chain",
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      "interaction-1",
      undefined,
      "visitor-token",
    );
    expect(api.recordChatInteraction.mock.invocationCallOrder[0]).toBeLessThan(
      api.streamChatMessage.mock.invocationCallOrder[1],
    );
  });

  it("sends verified product page context only from a product route", async () => {
    navigation.pathname = "/product/mu-agv-k3/";
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Mẫu này còn hàng không?");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() =>
      expect(api.streamChatMessage).toHaveBeenCalledWith(
        "Mẫu này còn hàng không?",
        "vi",
        undefined,
        expect.any(String),
        expect.any(Function),
        expect.any(AbortSignal),
        { type: "PRODUCT", productSlug: "mu-agv-k3" },
        undefined,
        undefined,
        "visitor-token",
      ),
    );
  });

  it("continues in a linked conversation instead of cutting off the customer", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-continued",
      mode: "AI",
      answer:
        "Em đã mở phần tiếp theo và giữ nguyên nhu cầu size/còn hàng anh/chị đang hỏi.",
      turnCount: 0,
      maxTurns: 40,
      remainingTurns: 40,
      turnsRemaining: 40,
      continuation: {
        available: true,
        threadId: "thread-1",
        successorConversationId: "conversation-continued",
        message: "conversationContinued",
      },
      products: [],
      handoffRecommended: false,
      leadPrompt: false,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    const input = await screen.findByLabelText("messageLabel");
    await user.type(input, "Câu hỏi cuối");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findByText("conversationContinued")).toBeInTheDocument();
    expect(input).toBeEnabled();
  });

  it("keeps the composer open at zero remaining turns so the backend can open the linked continuation", async () => {
    api.streamChatMessage
      .mockResolvedValueOnce({
        conversationId: "conversation-at-cap",
        mode: "AI",
        answer: "Em vẫn giữ nguyên nhu cầu size và tồn kho anh/chị đang hỏi.",
        turnCount: 40,
        maxTurns: 40,
        remainingTurns: 0,
        turnsRemaining: 0,
        continuation: {
          available: true,
          threadId: "thread-1",
          successorConversationId: null,
          message: "conversationContinued",
        },
        products: [],
        handoffRecommended: true,
        leadPrompt: false,
        actions: [],
        contacts: {},
      })
      .mockResolvedValueOnce({
        conversationId: "conversation-successor",
        mode: "AI",
        answer: "Em tiếp tục ngay trong phần mới, anh/chị không cần kể lại.",
        turnCount: 0,
        maxTurns: 40,
        remainingTurns: 40,
        turnsRemaining: 40,
        continuation: {
          available: true,
          threadId: "thread-1",
          successorConversationId: "conversation-successor",
          message: "conversationContinued",
        },
        products: [],
        handoffRecommended: false,
        leadPrompt: false,
        actions: [],
        contacts: {},
      });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    const input = await screen.findByLabelText("messageLabel");
    await user.type(input, "Câu thứ 40");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect(await screen.findByText("conversationContinued")).toBeInTheDocument();
    expect(input).toBeEnabled();

    await user.type(input, "Hỏi tiếp về size M");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalledTimes(2));
    expect(input).toBeEnabled();
  });

  it("AC6/18: labels live staff clearly and records an unhelpful reason on an assistant message", async () => {
    const assistantMessageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    api.openChatSession.mockResolvedValue({
      visitorToken: "visitor-token",
      rememberedThrough: "2026-09-24T00:00:00Z",
      memoryEnabled: true,
      activeConversationId: "conversation-live-staff",
      rememberedContextSummary: "Đang hỏi size M",
    });
    api.fetchChatHistory.mockResolvedValue({
      conversationId: "conversation-live-staff",
      threadId: "thread-live-staff",
      channelState: "STAFF_ACTIVE",
      latestSequence: 3,
      messages: [
        {
          id: assistantMessageId,
          sequenceNo: 1,
          role: "ASSISTANT",
          content: "Em đang kiểm tra size M cho anh/chị.",
          createdAt: "2026-08-25T02:00:00Z",
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sequenceNo: 2,
          role: "STAFF",
          content: "Size M hiện vẫn còn hàng ạ.",
          staffDisplayName: "Minh",
          createdAt: "2026-08-25T02:01:00Z",
        },
      ],
      handoff: {
        id: "handoff-live-staff",
        status: "ACTIVE",
        requestedAt: "2026-08-25T02:00:30Z",
        channelState: "STAFF_ACTIVE",
        assignedDisplayName: "Minh",
        withinBusinessHours: true,
      },
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await waitFor(() => expect(api.fetchChatHistory).toHaveBeenCalledWith(
      "conversation-live-staff", "visitor-token", 0,
    ));
    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("staffMessageLabel:Minh")).toBeInTheDocument();
    expect(screen.getByText("Size M hiện vẫn còn hàng ạ.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "feedbackUnhelpful" }));
    await user.click(screen.getByRole("button", { name: "feedbackReason_WRONG_ANSWER" }));
    await waitFor(() => expect(api.submitChatFeedback).toHaveBeenCalledWith({
      messageId: assistantMessageId,
      rating: "UNHELPFUL",
      reason: "WRONG_ANSWER",
      visitorToken: "visitor-token",
    }));
  });

  it("records a declined callback invitation without sending contact details", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-lead-decline",
      mode: "AI",
      answer: "Trợ lý BigBike có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Gọi lại cho tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "talkToStaff" }));
    await user.click(await screen.findByRole("button", { name: "requestCallback" }));
    await waitFor(() =>
      expect(api.offerChatLead).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-lead-decline",
          locale: "vi",
        }),
      ),
    );
    expect(screen.getByLabelText("leadPhone")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "leadDecline" }));

    await waitFor(() =>
      expect(api.declineChatLead).toHaveBeenCalledWith(
        "conversation-lead-decline",
        "visitor-token",
      ),
    );
    expect(await screen.findAllByText("leadDeclined")).not.toHaveLength(0);
  });

  it("shows the masked account contact and only captures after explicit consent", async () => {
    auth.state = {
      status: "authenticated",
      profile: { displayName: "Nguyễn Minh", phone: "0909 123 456" },
    };
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-account",
      mode: "AI",
      answer: "Em có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Gọi lại cho tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "talkToStaff" }));
    await user.click(await screen.findByRole("button", { name: "requestCallback" }));

    expect(await screen.findByTestId("bigbike-lead-quick")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Minh")).toBeInTheDocument();
    expect(screen.getByText("090 ••••• 56")).toBeInTheDocument();
    expect(api.captureChatLead).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "leadUseAccount" }));
    await waitFor(() =>
      expect(api.captureChatLead).toHaveBeenCalledWith({
        conversationId: "conversation-account",
        contactSource: "ACCOUNT",
        visitorToken: "visitor-token",
      }),
    );
  });

  it("opens the editable prefilled form when a signed-in customer chooses another number", async () => {
    auth.state = {
      status: "authenticated",
      profile: { displayName: "Nguyễn Minh", phone: "0909123456" },
    };
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-other-number",
      mode: "AI",
      answer: "Em có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Gọi lại cho tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "talkToStaff" }));
    await user.click(await screen.findByRole("button", { name: "requestCallback" }));
    await user.click(await screen.findByRole("button", { name: "leadUseOther" }));

    expect(screen.queryByTestId("bigbike-lead-quick")).not.toBeInTheDocument();
    expect(screen.getByLabelText("leadName")).toHaveValue("Nguyễn Minh");
    expect(screen.getByLabelText("leadPhone")).toHaveValue("0909123456");
    await user.click(screen.getByLabelText("leadConsent"));
    await user.click(screen.getByRole("button", { name: "leadSubmit" }));

    await waitFor(() =>
      expect(api.captureChatLead).toHaveBeenCalledWith({
        conversationId: "conversation-other-number",
        name: "Nguyễn Minh",
        phone: "0909123456",
        note: undefined,
        contactSource: "FORM",
        visitorToken: "visitor-token",
      }),
    );
  });

  it("lets a signed-in customer decline the quick contact invitation without capturing a lead", async () => {
    auth.state = {
      status: "authenticated",
      profile: { displayName: "Nguyễn Minh", phone: "0909123456" },
    };
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-account-decline",
      mode: "AI",
      answer: "Em có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Gọi lại cho tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "talkToStaff" }));
    await user.click(await screen.findByRole("button", { name: "requestCallback" }));
    await user.click(await screen.findByRole("button", { name: "leadDecline" }));

    await waitFor(() =>
      expect(api.declineChatLead).toHaveBeenCalledWith(
        "conversation-account-decline",
        "visitor-token",
      ),
    );
    expect(api.captureChatLead).not.toHaveBeenCalled();
  });

  it("keeps the full form for a signed-in customer without a usable phone", async () => {
    auth.state = {
      status: "authenticated",
      profile: { displayName: "Nguyễn Minh", phone: null },
    };
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-no-phone",
      mode: "AI",
      answer: "Em có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Gọi lại cho tôi");
    await user.click(screen.getByRole("button", { name: "send" }));
    await user.click(await screen.findByRole("button", { name: "talkToStaff" }));
    await user.click(await screen.findByRole("button", { name: "requestCallback" }));

    expect(screen.queryByTestId("bigbike-lead-quick")).not.toBeInTheDocument();
    expect(screen.getByLabelText("leadPhone")).toBeInTheDocument();
    expect(screen.getByLabelText("leadName")).toHaveValue("");
  });

  it("restores the same conversation and remaining turns after remount", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-restored",
      mode: "AI",
      answer: "Em vẫn đang giữ phần tư vấn này cho anh/chị.",
      turnCount: 2,
      maxTurns: 12,
      remainingTurns: 3,
      products: [],
      handoffRecommended: false,
      leadPrompt: true,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    const firstRender = render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Tư vấn tiếp giúp em");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect(
      await screen.findAllByText("Em vẫn đang giữ phần tư vấn này cho anh/chị."),
    ).not.toHaveLength(0);
    await waitFor(() => expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull());

    firstRender.unmount();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "open" }));

    expect(
      await screen.findAllByText("Em vẫn đang giữ phần tư vấn này cho anh/chị."),
    ).not.toHaveLength(0);
    expect(screen.getByText("remainingWarning:3")).toBeInTheDocument();
    const input = screen.getByLabelText("messageLabel");
    await user.type(input, "Câu hỏi nối tiếp");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() =>
      expect(api.streamChatMessage).toHaveBeenLastCalledWith(
        "Câu hỏi nối tiếp",
        "vi",
        "conversation-restored",
        expect.any(String),
        expect.any(Function),
        expect.any(AbortSignal),
        null,
        undefined,
        undefined,
        "visitor-token",
      ),
    );
  });

  it("confirms and deletes the customer's server history from the chat header", async () => {
    api.streamChatMessage.mockResolvedValueOnce({
      conversationId: "conversation-delete",
      mode: "AI",
      answer: "Nội dung cần xoá ngay.",
      turnCount: 1,
      maxTurns: 12,
      remainingTurns: 11,
      products: [],
      handoffRecommended: false,
      leadPrompt: false,
      actions: [],
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Lưu câu này");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect(await screen.findAllByText("Nội dung cần xoá ngay.")).not.toHaveLength(0);
    await waitFor(() => expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull());

    await user.click(screen.getByRole("button", { name: "deleteConversation" }));
    expect(screen.getByText("confirmDeleteHistory")).toBeInTheDocument();
    expect(screen.getAllByText("Nội dung cần xoá ngay.")).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmDeleteAction" }));
    await waitFor(() => expect(api.deleteChatHistory).toHaveBeenCalledWith("visitor-token"));
    expect(screen.queryAllByText("Nội dung cần xoá ngay.")).toHaveLength(0);
    expect(document.querySelector("[data-bigbike-onboarding]")).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("restores a finished conversation as locked but lets the customer reopen the callback form explicitly", async () => {
    writeChatSnapshot({
      version: 3,
      expiresAt: Date.now() + 60_000,
      locale: "vi",
      conversationId: "conversation-finished",
      messages: [
        { id: "user-1", role: "USER", content: "Câu hỏi cũ" },
        { id: "assistant-1", role: "ASSISTANT", content: "Cuộc trò chuyện đã kết thúc." },
      ],
      remainingTurns: 0,
      serviceMode: "CONTACT",
      leadPromptSequence: 0,
      viewedLeadSequences: [],
      leadCaptured: false,
      leadDeclined: true,
    });
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findAllByText("Cuộc trò chuyện đã kết thúc.")).not.toHaveLength(0);
    expect(screen.getByLabelText("messageLabel")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "talkToStaff" }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "requestCallback" }));
    await waitFor(() =>
      expect(api.offerChatLead).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conversation-finished",
          locale: "vi",
        }),
      ),
    );
    expect(await screen.findByLabelText("leadPhone")).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull();
  });

  it("AC20: proactive chat remains off until the owner enables it", async () => {
    vi.useFakeTimers();
    navigation.pathname = "/product/ls2-stream";
    render(
      <>
        <h1 data-bigbike-product-name>Mũ LS2 Stream</h1>
        <FloatingChat />
      </>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });

    expect(screen.queryByText("proactiveProductPrompt:Mũ LS2 Stream")).not.toBeInTheDocument();
  });

  it("AC21/23 VI: shows one product-specific prompt and never repeats after dismissal", async () => {
    vi.useFakeTimers();
    navigation.pathname = "/product/ls2-stream";
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: ["Tìm mũ"],
      maxTurns: 40,
      contacts: {},
      proactive: { enabled: true, productSeconds: 15, cartSeconds: 30 },
    });
    render(
      <>
        <h1 data-bigbike-product-name>Mũ LS2 Stream</h1>
        <FloatingChat />
      </>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.getByText("proactiveProductPrompt:Mũ LS2 Stream")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "dismissProactive" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });

    expect(screen.queryByText("proactiveProductPrompt:Mũ LS2 Stream")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("bb_chat_proactive_shown_v1")).toBe("true");
  });

  it("AC22: never opens proactively on checkout even when the setting is enabled", async () => {
    vi.useFakeTimers();
    navigation.pathname = "/checkout";
    cart.count = 2;
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: ["Tìm mũ"],
      maxTurns: 40,
      contacts: {},
      proactive: { enabled: true, productSeconds: 15, cartSeconds: 15 },
    });
    render(<FloatingChat />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });

    expect(screen.queryByText("proactiveCartPrompt")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("bb_chat_proactive_shown_v1")).toBeNull();
  });

  it("AC20/21 EN: product-specific proactive copy is bilingual and still once per session", async () => {
    vi.useFakeTimers();
    intl.locale = "en";
    navigation.pathname = "/en/product/ls2-stream";
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Hello from BigBike Assistant",
      quickPrompts: ["Find a helmet"],
      maxTurns: 40,
      contacts: {},
      proactive: { enabled: true, productSeconds: 15, cartSeconds: 30 },
    });
    render(
      <>
        <h1 data-bigbike-product-name>LS2 Stream Helmet</h1>
        <FloatingChat />
      </>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(screen.getByText("proactiveProductPrompt:LS2 Stream Helmet")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("bb_chat_proactive_shown_v1")).toBe("true");
  });
});
