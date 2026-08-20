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
  streamChatMessage: vi.fn(),
  captureChatLead: vi.fn(),
  declineChatLead: vi.fn(),
  recordChatInteraction: vi.fn(),
}));

const auth = vi.hoisted(() => ({ state: { status: "anonymous" } as TestAuthState }));
const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { count?: number }) => (
    values?.count == null ? key : `${key}:${values.count}`
  ),
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
  useCart: () => ({ addToCart: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ altFallback }: { altFallback: string }) => <div aria-label={altFallback} />,
}));

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  auth.state = { status: "anonymous" };
  navigation.pathname = "/";
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  HTMLElement.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI",
    greeting: "Xin chào từ Trợ lý BigBike",
    quickPrompts: ["Tìm mũ"],
    maxTurns: 12,
    contacts: {},
  });
  api.streamChatMessage.mockResolvedValue({
    conversationId: "conversation-1",
    mode: "AI",
    answer: "Em tìm thấy sản phẩm thật này.",
    turnCount: 1,
    maxTurns: 12,
    remainingTurns: 11,
    products: [{
      slug: "mu-34-test",
      name: "Mũ 3/4 Test",
      retailPrice: 1590000,
      currency: "VND",
      stockState: "IN_STOCK",
    }],
    handoffRecommended: false,
    leadPrompt: false,
    actions: [],
    contacts: {},
  });
  api.declineChatLead.mockResolvedValue({ declined: true });
  api.captureChatLead.mockResolvedValue({ captured: true });
  api.recordChatInteraction.mockResolvedValue({ recorded: true, interactionId: "interaction-1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FloatingChat", () => {
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
    expect(screen.getByRole("link", { name: "viewProduct" })).toHaveAttribute("href", expect.stringContaining("/product/"));
    expect(screen.getByRole("button", { name: /talkToStaff/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /talkToStaff/ }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
  });

  it("shows branded onboarding tiles and the chat-bubble avatar", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Trợ lý BigBike",
      quickPrompts: ["Tìm theo nhu cầu", "Lọc theo ngân sách", "So sánh sản phẩm", "Kiểm tra còn hàng"],
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
      answer: "Hội thoại đã kết thúc theo quy định. Anh/chị có thể gặp nhân viên BigBike để được hỗ trợ tiếp.",
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

    expect(await screen.findAllByText("Hội thoại đã kết thúc theo quy định. Anh/chị có thể gặp nhân viên BigBike để được hỗ trợ tiếp.")).not.toHaveLength(0);
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

    expect(await screen.findAllByText("Em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé.")).not.toHaveLength(0);
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

  it("shows the lead invitation proactively and records each displayed sequence once", async () => {
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

    expect(await screen.findByRole("button", { name: "leadPromptAccept" })).toBeInTheDocument();
    await waitFor(() => expect(api.recordChatInteraction).toHaveBeenCalledWith(expect.objectContaining({
      assistantMessageId: "assistant-sequence-1",
      type: "LEAD_PROMPT_VIEWED",
      leadPromptSequence: 1,
    })));

    await user.type(screen.getByLabelText("messageLabel"), "Mẫu này còn size M không?");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.recordChatInteraction).toHaveBeenCalledWith(expect.objectContaining({
      assistantMessageId: "assistant-sequence-2",
      leadPromptSequence: 2,
    })));
    expect(document.querySelectorAll("[data-bigbike-lead-prompt]")).toHaveLength(1);
    expect(api.recordChatInteraction.mock.calls.filter((call) =>
      call[0]?.type === "LEAD_PROMPT_VIEWED")).toHaveLength(2);
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
    expect(api.recordChatInteraction).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conversation-action-chain",
      assistantMessageId: "assistant-action-source",
      type: "ACTION_CLICKED",
      actionType: "CHECK_SIZE",
    }));
    expect(api.streamChatMessage).toHaveBeenLastCalledWith(
      "actionCheckSize",
      "vi",
      "conversation-action-chain",
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      "interaction-1",
    );
    expect(api.recordChatInteraction.mock.invocationCallOrder[0])
      .toBeLessThan(api.streamChatMessage.mock.invocationCallOrder[1]);
  });

  it("sends verified product page context only from a product route", async () => {
    navigation.pathname = "/product/mu-agv-k3/";
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Mẫu này còn hàng không?");
    await user.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalledWith(
      "Mẫu này còn hàng không?",
      "vi",
      undefined,
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      { type: "PRODUCT", productSlug: "mu-agv-k3" },
      undefined,
    ));
  });

  it("disables new questions when the backend reports no remaining turns", async () => {
    api.streamChatMessage.mockResolvedValue({
      conversationId: "conversation-limit",
      mode: "AI",
      answer: "Hội thoại này đã đến lượt cuối. Anh/chị có thể xem thông tin vừa nhận. BigBike vẫn giữ kênh nhân viên bên dưới.",
      turnCount: 12,
      maxTurns: 12,
      remainingTurns: 0,
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

    expect(await screen.findByText("turnLimit")).toBeInTheDocument();
    expect(input).toBeDisabled();
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
    expect(screen.getByLabelText("leadPhone")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "leadDecline" }));

    await waitFor(() => expect(api.declineChatLead).toHaveBeenCalledWith("conversation-lead-decline"));
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
    await waitFor(() => expect(api.captureChatLead).toHaveBeenCalledWith({
      conversationId: "conversation-account",
      contactSource: "ACCOUNT",
    }));
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

    await waitFor(() => expect(api.captureChatLead).toHaveBeenCalledWith({
      conversationId: "conversation-other-number",
      name: "Nguyễn Minh",
      phone: "0909123456",
      note: undefined,
      contactSource: "FORM",
    }));
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

    await waitFor(() => expect(api.declineChatLead).toHaveBeenCalledWith("conversation-account-decline"));
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
    expect(await screen.findAllByText("Em vẫn đang giữ phần tư vấn này cho anh/chị.")).not.toHaveLength(0);
    await waitFor(() => expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull());

    firstRender.unmount();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "open" }));

    expect(await screen.findAllByText("Em vẫn đang giữ phần tư vấn này cho anh/chị.")).not.toHaveLength(0);
    expect(screen.getByText("remainingWarning:3")).toBeInTheDocument();
    const input = screen.getByLabelText("messageLabel");
    await user.type(input, "Câu hỏi nối tiếp");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenLastCalledWith(
      "Câu hỏi nối tiếp",
      "vi",
      "conversation-restored",
      expect.any(String),
      expect.any(Function),
      expect.any(AbortSignal),
      null,
      undefined,
    ));
  });

  it("deletes the local conversation immediately from the chat header", async () => {
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
    expect(screen.queryByText("Nội dung cần xoá ngay.")).not.toBeInTheDocument();
    expect(document.querySelector("[data-bigbike-onboarding]")).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("restores a finished conversation as locked and does not show a declined lead offer again", async () => {
    writeChatSnapshot({
      version: 2,
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
    expect(screen.queryByRole("button", { name: "requestCallback" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(CHAT_STORAGE_KEY)).not.toBeNull();
  });
});
