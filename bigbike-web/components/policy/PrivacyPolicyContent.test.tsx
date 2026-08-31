import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";

describe("PrivacyPolicyContent customer-image disclosure", () => {
  it("states Google AI sharing, private access and 90-day deletion in Vietnamese", () => {
    render(<PrivacyPolicyContent locale="vi" />);

    expect(screen.getByText("7. Ảnh gửi trong Trợ lý BigBike")).toBeInTheDocument();
    expect(screen.getByText("Có hiệu lực từ ngày 27/08/2026.")).toBeInTheDocument();
    expect(screen.getByText(/luôn sẵn sàng khi dịch vụ AI Google đã được BigBike cấu hình/i)).toBeInTheDocument();
    expect(screen.getAllByText(/dịch vụ AI Google \(Gemini\)/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/chỉ nhân viên có quyền xem hội thoại mới xem được/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/hết hạn lưu 90 ngày/i)).toBeInTheDocument();
    expect(screen.getByText(/quyền xem ảnh đã lưu/i)).toBeInTheDocument();
    expect(screen.getByText(/xoá lịch sử trò chuyện/i)).toBeInTheDocument();
    expect(screen.getByText(/nên che tên, số điện thoại, địa chỉ, mã đơn/i)).toBeInTheDocument();
  });

  it("provides the same mandatory disclosure in English", () => {
    render(<PrivacyPolicyContent locale="en" />);

    expect(screen.getByText("7. Images sent to BigBike Assistant")).toBeInTheDocument();
    expect(screen.getByText("Effective from 27 August 2026.")).toBeInTheDocument();
    expect(screen.getByText(/always available when BigBike has configured Google's AI service/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Google's AI service \(Gemini\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/only staff permitted to view conversations/i)).toBeInTheDocument();
    expect(screen.getByText(/90-day retention period/i)).toBeInTheDocument();
    expect(screen.getByText(/view images saved in your own history/i)).toBeInTheDocument();
    expect(screen.getByText(/Deleting chat history also deletes images/i)).toBeInTheDocument();
    expect(
      screen.getByText(/cover names, phone numbers, addresses, order codes/i),
    ).toBeInTheDocument();
  });
});
