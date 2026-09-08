import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";

describe("PrivacyPolicyContent customer-media disclosure", () => {
  it("states whole-video/audio sharing, private access and distinct retention periods in Vietnamese", () => {
    render(<PrivacyPolicyContent locale="vi" />);

    expect(screen.getByText("7. Ảnh và video gửi trong Trợ lý BigBike")).toBeInTheDocument();
    expect(screen.getByText("Cập nhật ngày 08/09/2026.")).toBeInTheDocument();
    expect(screen.getByText(/Video tối đa 15 giây, 40 MB/i)).toHaveTextContent(/2 video.*10 video/);
    expect(screen.getByText(/máy chủ nhận xong tệp/i)).toHaveTextContent(
      /60 giây.*Thời gian tải tệp lên không nằm trong 60 giây/,
    );
    expect(screen.getAllByText(/dịch vụ AI Google \(Gemini\)/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/chỉ nhân viên có quyền xem hội thoại mới xem được/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ảnh tự động bị xoá sau 90 ngày/i)).toHaveTextContent(
      /video tự động bị xoá sau 7 ngày/,
    );
    expect(screen.getByText(/quyền xem ảnh và video đã lưu/i)).toBeInTheDocument();
    expect(screen.getByText(/xoá lịch sử trò chuyện/i)).toBeInTheDocument();
    expect(screen.getByText(/nút xoá cuộc trò chuyện ngay trong khung chat/i)).toBeInTheDocument();
    expect(screen.getByText(/nên che tên, số điện thoại, địa chỉ, mã đơn/i)).toBeInTheDocument();
  });

  it("no longer claims the chat panel shows an image disclosure before you attach one", () => {
    // The in-chat disclosure line was removed on 06/09/2026 and this page became the only place
    // the disclosure lives, so promising a chat-side notice here would be untrue.
    const { container } = render(<PrivacyPolicyContent locale="vi" />);

    expect(container.textContent).not.toMatch(/khung chat sẽ nhắc/i);
    expect(screen.getByText(/Mục này công bố cách BigBike xử lý các tệp đó/i)).toBeInTheDocument();
  });

  it("provides the same mandatory disclosure in English", () => {
    render(<PrivacyPolicyContent locale="en" />);

    expect(screen.getByText("7. Images and videos sent to BigBike Assistant")).toBeInTheDocument();
    expect(screen.getByText("Updated on 8 September 2026.")).toBeInTheDocument();
    expect(screen.getByText(/15 seconds and 40 MB/i)).toHaveTextContent(
      /2 videos per conversation and 10 videos/,
    );
    expect(screen.getByText(/after the server receives the complete file/i)).toHaveTextContent(
      /Upload time is excluded/,
    );
    expect(screen.getAllByText(/Google's AI service \(Gemini\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/only staff permitted to view conversations/i)).toBeInTheDocument();
    expect(screen.getByText(/Images are automatically deleted after 90 days/i)).toHaveTextContent(
      /video files are automatically deleted after 7 days/,
    );
    expect(
      screen.getByText(/view images and videos saved in your own history/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/clear-conversation button in the chat panel/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Deleting chat history also deletes its attached images and videos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cover names, phone numbers, addresses, order codes/i),
    ).toBeInTheDocument();
  });
});
