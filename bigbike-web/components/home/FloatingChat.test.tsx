import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { FloatingChat } from "./FloatingChat";

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  sendChatMessage: vi.fn(),
  captureChatLead: vi.fn(),
  declineChatLead: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { count?: number }) => (
    values?.count == null ? key : `${key}:${values.count}`
  ),
}));

vi.mock("@/lib/api/client-api", () => api);
vi.mock("next/image", () => ({
  default: ({ fill, ...props }: { fill?: boolean; src?: string; alt?: string; className?: string; onError?: () => void }) => {
    void fill;
    return createElement("img", { ...props, alt: props.alt ?? "" });
  },
}));
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ altFallback }: { altFallback: string }) => <div aria-label={altFallback} />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  HTMLElement.prototype.scrollTo = vi.fn();
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI",
    greeting: "Xin chào từ Bi",
    quickPrompts: ["Tìm mũ"],
    maxTurns: 12,
    contacts: {},
  });
  api.sendChatMessage.mockResolvedValue({
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
});

describe("FloatingChat", () => {
  it("opens Bi, returns a real product card, and keeps Talk to staff available", async () => {
    const user = userEvent.setup();
    render(<FloatingChat hotline="0901 234 567" zaloUrl="https://zalo.me/bigbike" />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("Xin chào từ Bi")).toBeInTheDocument();

    await user.type(screen.getByLabelText("messageLabel"), "Cho em mũ 3/4");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findByText("Em tìm thấy sản phẩm thật này.")).toBeInTheDocument();
    expect(screen.getByText("Mũ 3/4 Test")).toBeInTheDocument();
    expect(screen.getByText(/1\.590\.000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talkToStaff/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /talkToStaff/ }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
  });

  it("shows branded onboarding tiles, a local Bi avatar, and a safe avatar fallback", async () => {
    api.fetchChatAvailability.mockResolvedValue({
      mode: "AI",
      greeting: "Xin chào từ Bi",
      quickPrompts: ["Tìm theo nhu cầu", "Lọc theo ngân sách", "So sánh sản phẩm", "Kiểm tra còn hàng"],
      maxTurns: 12,
      contacts: {},
    });
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole("button", { name: "open" }));
    expect(await screen.findByText("Xin chào từ Bi")).toBeInTheDocument();
    expect(document.body.querySelector("[data-bi-onboarding]")).toBeInTheDocument();
    expect(document.body.querySelectorAll("[data-bi-onboarding] button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "talkToStaff" })).toBeInTheDocument();

    const avatar = document.body.querySelector('[data-bi-avatar] img[src="/brand/bi-assistant.png"]');
    expect(avatar).toBeInTheDocument();
    fireEvent.error(avatar!);
    expect(document.body.querySelector('[data-bi-avatar] img[src="/brand/bi-assistant.png"]')).not.toBeInTheDocument();
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
    expect(document.querySelector("[data-bi-contact-view]")).not.toBeInTheDocument();
    await waitFor(() => expect(api.sendChatMessage).not.toHaveBeenCalled());
  });

  it("locks the composer after a closed conversation while keeping the answer in the chat flow", async () => {
    api.sendChatMessage.mockResolvedValueOnce({
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
    expect(document.querySelector("[data-bi-contact-view]")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "talkToStaff" }));
    expect(await screen.findByText("contactTitle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "contactToggleClose" }));
    expect(screen.queryByText("contactTitle")).not.toBeInTheDocument();
  });

  it("keeps the composer open and returns the draft after a network failure", async () => {
    api.sendChatMessage.mockRejectedValue(new Error("network failure"));
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

  it("keeps asking after a technical fallback response", async () => {
    api.sendChatMessage
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

    expect(await screen.findByText("fallback kỹ thuật")).toBeInTheDocument();
    expect(input).not.toBeDisabled();

    await user.type(input, "Câu hỏi tiếp theo");
    await user.click(screen.getByRole("button", { name: "send" }));

    expect(await screen.findByText("Em đã kiểm tra được thông tin này. Anh/chị có thể xem tiếp nhé.")).toBeInTheDocument();
    expect(api.sendChatMessage).toHaveBeenCalledTimes(2);
  });

  it("maps every backend action to a fixed local route", async () => {
    api.sendChatMessage.mockResolvedValue({
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

    expect(await screen.findByRole("link", { name: "orderLogin" })).toHaveAttribute("href", expect.stringContaining("/dang-nhap/"));
    expect(screen.getByRole("link", { name: "orderHistory" })).toHaveAttribute("href", expect.stringContaining("/tai-khoan/don-hang/"));
    expect(screen.getByRole("link", { name: "orderLookup" })).toHaveAttribute("href", expect.stringContaining("/don-hang/xac-nhan/"));
  });

  it("disables new questions when the backend reports no remaining turns", async () => {
    api.sendChatMessage.mockResolvedValue({
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
    api.sendChatMessage.mockResolvedValue({
      conversationId: "conversation-lead-decline",
      mode: "AI",
      answer: "Bi có thể nhờ BigBike liên hệ lại nếu anh/chị đồng ý.",
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

    await waitFor(() => expect(api.declineChatLead).toHaveBeenCalledWith("conversation-lead-decline"));
    expect(await screen.findByText("leadDeclined")).toBeInTheDocument();
  });
});
