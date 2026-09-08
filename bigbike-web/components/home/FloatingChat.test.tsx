import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingChat } from "./FloatingChat";
import { requestChatOpen } from "@/lib/chat/chat-launcher";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

const api = vi.hoisted(() => ({
  fetchChatAvailability: vi.fn(),
  openChatSession: vi.fn(),
  fetchChatHistory: vi.fn(),
  deleteChatHistory: vi.fn(),
  streamChatMessage: vi.fn(),
  uploadChatImage: vi.fn(),
  uploadChatVideo: vi.fn(),
  fetchChatVideoBlob: vi.fn(),
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
vi.mock("@/lib/api/client-api", async (original) => ({
  ...(await original<typeof import("@/lib/api/client-api")>()),
  ...api,
}));
vi.mock("@/lib/auth/auth-store", () => ({ useAuth: () => ({ status: "anonymous" }) }));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
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
  navigation.pathname = "/";
  window.localStorage.clear();
  window.sessionStorage.clear();
  api.fetchChatAvailability.mockResolvedValue({
    mode: "AI",
    maxTurns: 40,
    contacts: {},
    videos: {
      enabled: true,
      maxBytes: 40 * 1024 * 1024,
      maxDurationSeconds: 15,
      maxPerTurn: 1,
      maxPerConversation: 2,
      dailyLimit: 10,
    },
    images: {
      enabled: true,
      maxBytes: 8 * 1024 * 1024,
      maxPerTurn: 3,
      maxPerConversation: 9,
      dailyLimit: 60,
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
  api.fetchChatVideoBlob.mockResolvedValue(new Blob(["video"], { type: "video/mp4" }));
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
  it("waits for the restored visitor token before loading a private video", async () => {
    URL.createObjectURL = vi.fn(() => "blob:restored-video");
    URL.revokeObjectURL = vi.fn();
    const video = {
      id: "video-restore",
      contentPath: "/api/v1/chat/videos/video-restore/content",
      status: "READY",
      mimeType: "video/mp4",
      sizeBytes: 128,
      durationSeconds: 12,
      hasAudio: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    window.sessionStorage.setItem(
      "bb_ai_chat_session_v1",
      JSON.stringify({
        version: 5,
        expiresAt: Date.now() + 86400000,
        locale: "vi",
        conversationId: "conversation-1",
        remainingTurns: 39,
        serviceMode: "AI",
        messages: [
          { id: "customer-video", role: "USER", content: "Video đã gửi", videos: [video] },
        ],
      }),
    );
    let finishSession!: (value: unknown) => void;
    api.openChatSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSession = resolve;
        }),
    );
    api.fetchChatVideoBlob.mockImplementation((_id, token) =>
      token
        ? Promise.resolve(new Blob(["video"], { type: "video/mp4" }))
        : Promise.reject(new Error("Visitor token is not restored yet")),
    );
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "open" }));
    await waitFor(() => expect(api.openChatSession).toHaveBeenCalled());
    expect(api.fetchChatVideoBlob).not.toHaveBeenCalled();
    await act(async () =>
      finishSession({ visitorToken: "visitor-token", activeConversationId: null }),
    );
    await waitFor(() =>
      expect(document.querySelector("video")).toHaveAttribute("src", "blob:restored-video"),
    );
  });

  it("sends a video without a caption and keeps photo/video selection exclusive", async () => {
    URL.createObjectURL = vi.fn(() => "blob:test-video");
    URL.revokeObjectURL = vi.fn();
    api.uploadChatVideo.mockResolvedValue({
      conversationId: "conversation-1",
      video: {
        id: "video-1",
        contentPath: "/api/v1/chat/videos/video-1/content",
        status: "PENDING",
        mimeType: "video/mp4",
        sizeBytes: 128,
        durationSeconds: 12,
        hasAudio: true,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const user = userEvent.setup();
    await openReadyChat(user);
    const input = document.querySelector('input[type="file"][accept^="video"]') as HTMLInputElement;
    await user.upload(input, new File(["video bytes"], "E2E_video.mp4", { type: "video/mp4" }));
    expect(screen.getByRole("button", { name: "chooseImage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "chooseVideo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalled());
    const args = api.streamChatMessage.mock.calls[0];
    expect(args[0]).toBe("");
    expect(args[9]).toEqual([]);
    expect(args[10]).toEqual(["video-1"]);
    expect(api.uploadChatImage).not.toHaveBeenCalled();
    expect(screen.getByLabelText("customerVideoAlt")).toHaveAttribute("controls");
  });

  it("rejects oversized videos before upload without consuming an AI turn", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    const input = document.querySelector('input[type="file"][accept^="video"]') as HTMLInputElement;
    const file = new File(["video"], "E2E_large.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 40 * 1024 * 1024 + 1 });
    await user.upload(input, file);
    expect(screen.getByRole("alert")).toHaveTextContent("videoTooLarge");
    expect(api.uploadChatVideo).not.toHaveBeenCalled();
    expect(api.streamChatMessage).not.toHaveBeenCalled();
  });

  it.each([
    "/dat-hang",
    "/dat-hang/",
    "/en/order/",
    "/en/dat-hang/",
    "/tai-khoan/edit-account/",
    "/en/account/edit-account/",
    "/tai-khoan/edit-address/billing/",
    "/tai-khoan/edit-address/shipping/",
    "/en/account/edit-address/billing/",
    "/en/account/edit-address/shipping/",
  ])("hides the floating launcher on the focused form %s", async (pathname) => {
    navigation.pathname = pathname;
    render(<FloatingChat />);
    await waitFor(() => expect(api.fetchChatAvailability).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "open" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.openChatSession).not.toHaveBeenCalled();
  });

  it.each([
    "/",
    "/en/",
    "/product/mu-bao-hiem/",
    "/en/search/",
    "/gio-hang/",
    "/en/cart/",
    "/don-hang/xac-nhan/",
    "/en/orders/confirm/",
    "/tai-khoan/don-hang/",
    "/en/account/orders/123/",
    "/en/policy/return-policy/",
  ])("keeps the floating launcher on %s", async (pathname) => {
    navigation.pathname = pathname;
    render(<FloatingChat />);
    await waitFor(() => expect(api.fetchChatAvailability).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "open" })).toBeInTheDocument();
  });

  it("closes on entering checkout and reopens the same draft from inline support", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "open" }));
    await user.type(await screen.findByLabelText("messageLabel"), "Cần tư vấn thêm");

    navigation.pathname = "/en/order/";
    rerender(<FloatingChat />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "open" })).not.toBeInTheDocument();

    const trigger = document.createElement("button");
    document.body.append(trigger);
    try {
      act(() => requestChatOpen(trigger));
      expect(await screen.findByLabelText("messageLabel")).toHaveValue("Cần tư vấn thêm");
      expect(api.streamChatMessage).not.toHaveBeenCalled();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("button", { name: "open" })).not.toBeInTheDocument();
    } finally {
      trigger.remove();
    }

    navigation.pathname = "/gio-hang/";
    rerender(<FloatingChat />);
    expect(screen.getByRole("button", { name: "open" })).toBeInTheDocument();
  });

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
  // contact/delete/close buttons plus the desktop size toggle (2026-09-07); the old trash strip is gone, and the
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
    expect(headerButtons).toHaveLength(4);
    for (const name of ["contactToggleOpen", "deleteConversation", "expandPanel", "close"]) {
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

  it("preserves the conversation, draft and revealed products when expanding and collapsing", async () => {
    const products = Array.from({ length: 4 }, (_, index) => ({
      ...defaultResult.products[0],
      slug: `helmet-${index}`,
      name: `Mũ bảo hiểm ${index + 1}`,
    }));
    api.streamChatMessage.mockResolvedValue({ ...defaultResult, products });
    const user = userEvent.setup();
    const input = await openReadyChat(user);
    await user.click(input);
    await user.paste("Tư vấn mũ đi phượt");
    await user.click(screen.getByRole("button", { name: "send" }));
    expect(await screen.findByText(products[0].name)).toBeInTheDocument();
    expect(screen.queryByText(products[3].name)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "viewMoreProducts:1" }));
    await user.click(input);
    await user.paste("Mẫu thứ hai có size M không?");

    const panel = document.querySelector("[data-bigbike-assistant]");
    const firstCard = document.querySelector("[data-bigbike-product-card]");
    const sessionCalls = api.openChatSession.mock.calls.length;
    for (const [button, size] of [
      ["expandPanel", "wide"],
      ["collapsePanel", "standard"],
    ]) {
      await user.click(screen.getByRole("button", { name: button }));
      expect(panel).toHaveAttribute("data-bigbike-panel-size", size);
      expect(screen.getByLabelText("messageLabel")).toBe(input);
      expect(input).toHaveValue("Mẫu thứ hai có size M không?");
      expect(document.querySelector("[data-bigbike-product-card]")).toBe(firstCard);
      expect(screen.getByText(products[3].name)).toBeInTheDocument();
      expect(screen.getAllByText(defaultResult.answer).length).toBeGreaterThan(0);
    }
    expect(api.streamChatMessage).toHaveBeenCalledTimes(1);
    expect(api.openChatSession).toHaveBeenCalledTimes(sessionCalls);
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

  it("uploads three photos in one conversation and sends them in selection order", async () => {
    URL.createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
    api.uploadChatImage.mockImplementation(async ({ file }: { file: File }) => ({
      conversationId: "photo-conversation",
      image: { id: file.name, mimeType: "image/png", width: 800, height: 600, sizeBytes: 10 },
    }));
    const user = userEvent.setup();
    await openReadyChat(user);
    const input = document.querySelector(
      'input[type="file"][accept="image/jpeg,image/png,image/webp"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      [1, 2, 3].map((index) => new File(["image"], `photo-${index}.png`, { type: "image/png" })),
    );
    expect(screen.getAllByAltText(/selectedImageAlt/)).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalled());
    expect(api.uploadChatImage).toHaveBeenCalledTimes(3);
    expect(api.uploadChatImage.mock.calls[1][0].conversationId).toBe("photo-conversation");
    expect(api.uploadChatImage.mock.calls[2][0].conversationId).toBe("photo-conversation");
    expect(api.streamChatMessage.mock.calls[0][9]).toEqual([
      "photo-1.png",
      "photo-2.png",
      "photo-3.png",
    ]);
    expect(window.sessionStorage.getItem("bb_ai_chat_session_v1") ?? "").not.toContain("blob:");
  });

  it("rejects four photos before upload and lets the customer choose again", async () => {
    const user = userEvent.setup();
    await openReadyChat(user);
    const input = document.querySelector(
      'input[type="file"][accept="image/jpeg,image/png,image/webp"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      [1, 2, 3, 4].map((index) => new File(["image"], `photo-${index}.png`, { type: "image/png" })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("imageTurnLimit:3");
    expect(api.uploadChatImage).not.toHaveBeenCalled();
    expect(api.streamChatMessage).not.toHaveBeenCalled();
  });

  it("reuses completed uploads after a partial upload failure", async () => {
    URL.createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
    api.uploadChatImage
      .mockResolvedValueOnce({
        conversationId: "photos",
        image: { id: "one", mimeType: "image/png" },
      })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        conversationId: "photos",
        image: { id: "two", mimeType: "image/png" },
      });
    const user = userEvent.setup();
    await openReadyChat(user);
    const input = document.querySelector(
      'input[type="file"][accept="image/jpeg,image/png,image/webp"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      [1, 2].map((index) => new File(["image"], `photo-${index}.png`, { type: "image/png" })),
    );
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("imageUploadFailed"));
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(api.streamChatMessage).toHaveBeenCalled());
    expect(api.uploadChatImage).toHaveBeenCalledTimes(3);
    expect(api.uploadChatImage.mock.calls[1][0].requestId).toBe(
      api.uploadChatImage.mock.calls[2][0].requestId,
    );
    expect(api.streamChatMessage.mock.calls[0][9]).toEqual(["one", "two"]);
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
