"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type WarrantyResult = {
  serialNumber: string;
  productName: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "EXPIRED" | "VOIDED";
  daysLeft: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

function StatusBadge({ status, daysLeft }: { status: WarrantyResult["status"]; daysLeft: number }) {
  if (status === "VOIDED") {
    return <Badge variant="outline">Đã huỷ</Badge>;
  }
  if (status === "EXPIRED") {
    return <Badge variant="destructive">Hết hạn</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge variant="warning">Sắp hết hạn ({daysLeft} ngày)</Badge>;
  }
  return <Badge variant="success">Còn hiệu lực ({daysLeft} ngày)</Badge>;
}

export default function WarrantyLookupPage() {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = serial.trim();
    if (!trimmed) return;

    setResult(null);
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/warranties/lookup?serial=${encodeURIComponent(trimmed)}`,
          { headers: { Accept: "application/json" } }
        );
        const payload = await res.json() as { data?: WarrantyResult; error?: { message?: string } };
        if (!res.ok) {
          setError(payload.error?.message ?? "Không tìm thấy thông tin bảo hành.");
          return;
        }
        setResult(payload.data ?? null);
      } catch {
        setError("Lỗi kết nối. Vui lòng thử lại.");
      }
    });
  }

  return (
    <div className="bb-container" style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <div className="wp-page-head">
        <span className="kicker">Hậu mãi · BigBike</span>
        <h1>Tra cứu bảo hành</h1>
        <p>Nhập số serial trên tem sản phẩm để kiểm tra hạn bảo hành.</p>
      </div>

      <form onSubmit={handleSubmit} className="wp-checkout-section" style={{ marginTop: 24 }}>
        <div className="wp-field">
          <label htmlFor="serial-input">
            Số serial <span className="req">*</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              id="serial-input"
              className="flex-1"
              placeholder="VD: AGV-2024-001234"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || !serial.trim()}
            >
              {isPending ? "Đang tra..." : "Tra cứu"}
            </Button>
          </div>
          <p className="wp-muted-text" style={{ marginTop: 6 }}>
            Số serial in trên tem dán trong hộp sản phẩm hoặc trên thân sản phẩm.
          </p>
        </div>
      </form>

      {error && (
        <div className="wp-alert-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="wp-checkout-section" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Thông tin bảo hành</h3>
            <StatusBadge status={result.status} daysLeft={result.daysLeft} />
          </div>

          <table className="wp-info-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td className="wp-muted-text" style={{ padding: "6px 0", width: "40%" }}>Sản phẩm</td>
                <td style={{ padding: "6px 0", fontWeight: 600 }}>{result.productName}</td>
              </tr>
              <tr>
                <td className="wp-muted-text" style={{ padding: "6px 0" }}>Số serial</td>
                <td style={{ padding: "6px 0", fontFamily: "monospace" }}>{result.serialNumber}</td>
              </tr>
              <tr>
                <td className="wp-muted-text" style={{ padding: "6px 0" }}>Ngày bắt đầu</td>
                <td style={{ padding: "6px 0" }}>{formatDate(result.startDate)}</td>
              </tr>
              <tr>
                <td className="wp-muted-text" style={{ padding: "6px 0" }}>Ngày kết thúc</td>
                <td style={{ padding: "6px 0" }}>{formatDate(result.endDate)}</td>
              </tr>
            </tbody>
          </table>

          {result.status === "ACTIVE" && (
            <p className="wp-muted-text" style={{ marginTop: 12, fontSize: "0.85em" }}>
              Vui lòng giữ số serial để xuất trình khi yêu cầu bảo hành tại cửa hàng hoặc qua hotline.
            </p>
          )}
          {result.status === "VOIDED" && (
            <p style={{ marginTop: 12, fontSize: "0.85em", color: "var(--c-error, #dc2626)" }}>
              Phiếu bảo hành này đã bị huỷ. Liên hệ cửa hàng để được hỗ trợ.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
