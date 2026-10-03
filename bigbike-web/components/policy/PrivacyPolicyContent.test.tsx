import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";

describe("PrivacyPolicyContent after assistant retirement", () => {
  it("discloses retained history and direct deletion requests in Vietnamese", () => {
    const { container } = render(<PrivacyPolicyContent locale="vi" />);

    expect(screen.getByText("Dữ liệu từ chức năng trợ lý trước đây")).toBeInTheDocument();
    expect(screen.getByText(/website không còn nhận câu hỏi, ảnh hoặc video/i)).toBeInTheDocument();
    expect(screen.getByText(/Tệp còn trong thời hạn lưu/i)).toHaveTextContent(
      /90 ngày.*7 ngày.*riêng tư/,
    );
    expect(screen.getByText(/yêu cầu xem hoặc xóa dữ liệu đã lưu trước đây/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /nút xoá cuộc trò chuyện|gửi tới dịch vụ AI Google|Video tối đa 15 giây/,
    );
  });

  it("keeps the current measurement disclosure without promising assistant tracking", () => {
    render(<PrivacyPolicyContent locale="vi" />);

    expect(screen.getByText("Cập nhật ngày 02/10/2026.")).toBeInTheDocument();
    expect(screen.getByText(/Google Analytics 4 ghi nhận/i)).toHaveTextContent(
      /xác nhận COD.*đặt\/huỷ đơn.*bảng size.*gửi đánh giá/i,
    );
    expect(screen.getByText(/Google Analytics 4 ghi nhận/i)).not.toHaveTextContent(
      /Trợ lý BigBike/i,
    );
    expect(screen.getByText(/Microsoft Clarity tạo bản xem lại/i)).toHaveTextContent(
      /đăng nhập.*tài khoản.*thanh toán.*được che/i,
    );
    expect(screen.getByText(/Meta Pixel \(Facebook\) ghi nhận/i)).toHaveTextContent(
      /thêm giỏ thành công.*xác nhận COD.*bấm gọi\/Zalo\/Messenger/i,
    );
    expect(screen.getByText(/chỉ gửi mã khách hàng nội bộ/i)).toHaveTextContent(
      /không gửi tên, email, số điện thoại, địa chỉ/i,
    );
  });

  it("provides the same retirement and retention disclosure in English", () => {
    const { container } = render(<PrivacyPolicyContent locale="en" />);

    expect(screen.getByText("Data from the former assistant feature")).toBeInTheDocument();
    expect(
      screen.getByText(/website no longer accepts questions, images or videos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Files within their retention period/i)).toHaveTextContent(
      /90-day expiry.*7-day expiry.*remain private/i,
    );
    expect(
      screen.getByText(/request access to or deletion of previously stored data/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /clear-conversation button|Google's AI service|15 seconds and 40 MB/i,
    );
  });
});
