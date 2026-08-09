import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingChat } from "./FloatingChat";

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  sendChatMessage: vi.fn(),
  captureChatLead: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { count?: number }) => (
    values?.count == null ? key : `${key}:${values.count}`
  ),
}));

vi.mock("@/lib/api/client-api", () => api);
vi.mock("@/components/ui/MediaImage", () => ({
  MediaImage: ({ altFallback }: { altFallback: string }) => <div aria-label={altFallback} />,
}));

beforeEach(() => {
  vi.clearAllMocks();
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
    contacts: {},
  });
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

  it("shows the legacy contact channels when AI is disabled", async () => {
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
    expect(screen.getByText("0901234567")).toBeInTheDocument();
    expect(screen.getByText("messenger:")).toBeInTheDocument();
    await waitFor(() => expect(api.sendChatMessage).not.toHaveBeenCalled());
  });
});
