import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClampableHtmlSection } from "@/components/catalog/ClampableHtmlSection";
import { CollapsibleContent } from "@/components/ui/collapsible-content";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key === "showLess" ? "Thu gọn" : "Xem thêm",
}));

type ObservedTarget = {
  callback: ResizeObserverCallback;
  target: Element;
};

let observedTargets: ObservedTarget[] = [];

class ResizeObserverMock implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    observedTargets.push({ callback: this.callback, target });
  }

  unobserve(target: Element) {
    observedTargets = observedTargets.filter((entry) => entry.target !== target);
  }

  disconnect() {
    observedTargets = observedTargets.filter(
      (entry) => entry.callback !== this.callback,
    );
  }
}

function Content({ height, tail = "Nội dung cuối" }: { height: number; tail?: string }) {
  return (
    <div data-content-height={height}>
      <p>Nội dung đầu</p>
      <p>{tail}</p>
    </div>
  );
}

function notifyResize() {
  act(() => {
    for (const { callback } of observedTargets) {
      callback([], {} as ResizeObserver);
    }
  });
}

beforeEach(() => {
  observedTargets = [];
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      const measuredChild = this.querySelector<HTMLElement>("[data-content-height]");
      return Number(measuredChild?.dataset.contentHeight ?? 0);
    },
  });
});

describe("CollapsibleContent", () => {
  it("giữ nguyên nội dung ngắn và không hiện nút", () => {
    const { container } = render(
      <CollapsibleContent>
        <Content height={180} />
      </CollapsibleContent>,
    );

    const root = container.querySelector("[data-collapsible-content]");
    const region = root?.firstElementChild as HTMLElement;

    expect(root).toHaveAttribute("data-state", "static");
    expect(region.style.maxHeight).toBe("");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("thu gọn mặc định, giữ nội dung trong DOM và mở/đóng bằng bàn phím", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CollapsibleContent>
        <Content height={640} tail="Đoạn cuối vẫn có trong DOM" />
      </CollapsibleContent>,
    );

    const root = container.querySelector("[data-collapsible-content]");
    const region = root?.firstElementChild as HTMLElement;
    let button = screen.getByRole("button", { name: /xem thêm/i });

    expect(root).toHaveAttribute("data-state", "collapsed");
    expect(region.style.maxHeight).toBe("280px");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", region.id);
    expect(screen.getByText("Đoạn cuối vẫn có trong DOM")).toBeInTheDocument();

    button.focus();
    await user.keyboard("{Enter}");
    button = screen.getByRole("button", { name: /thu gọn/i });
    expect(root).toHaveAttribute("data-state", "expanded");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(region.style.maxHeight).toBe("640px");

    await user.keyboard(" ");
    button = screen.getByRole("button", { name: /xem thêm/i });
    expect(root).toHaveAttribute("data-state", "collapsed");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(region.style.maxHeight).toBe("280px");
  });

  it("quản lý trạng thái độc lập khi trang có nhiều khối", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CollapsibleContent>
          <Content height={600} tail="Khối thứ nhất" />
        </CollapsibleContent>
        <CollapsibleContent>
          <Content height={700} tail="Khối thứ hai" />
        </CollapsibleContent>
      </>,
    );

    const buttons = screen.getAllByRole("button", { name: /xem thêm/i });
    await user.click(buttons[0]);

    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
  });

  it("đo lại khi nội dung thay đổi và không giới hạn chiều cao lúc mở", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <CollapsibleContent>
        <Content height={180} />
      </CollapsibleContent>,
    );

    rerender(
      <CollapsibleContent>
        <Content height={720} />
      </CollapsibleContent>,
    );
    notifyResize();

    const root = container.querySelector("[data-collapsible-content]");
    const region = root?.firstElementChild as HTMLElement;
    await user.click(screen.getByRole("button", { name: /xem thêm/i }));
    expect(region.style.maxHeight).toBe("720px");

    rerender(
      <CollapsibleContent>
        <Content height={4200} />
      </CollapsibleContent>,
    );
    notifyResize();
    expect(region.style.maxHeight).toBe("4200px");

    rerender(
      <CollapsibleContent>
        <Content height={120} />
      </CollapsibleContent>,
    );
    notifyResize();
    expect(root).toHaveAttribute("data-state", "static");
    expect(region.style.maxHeight).toBe("");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("giữ API HTML hiện tại cho thông số kỹ thuật và bảng size", () => {
    const { container } = render(
      <ClampableHtmlSection
        html={'<div data-content-height="900"><p>Thông số đầu</p><p>Thông số cuối</p></div>'}
        contentClassName="overflow-x-auto"
      />,
    );

    expect(screen.getByText("Thông số cuối")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xem thêm/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument();
  });
});
