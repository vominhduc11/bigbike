"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { lookupWarranty, type WarrantyLookupResult } from "@/lib/api/client-api";
import { formatDate } from "@/lib/utils/format";

function StatusBadge({ status, daysLeft }: { status: WarrantyLookupResult["status"]; daysLeft: number }) {
  if (status === "VOIDED") {
    return <Badge variant="outline">{"Đã huỷ"}</Badge>;
  }
  if (status === "EXPIRED") {
    return <Badge variant="destructive">{"Hết hạn"}</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge variant="warning">{`Sắp hết hạn (${daysLeft} ngày)`}</Badge>;
  }
  return <Badge variant="success">{`Còn hiệu lực (${daysLeft} ngày)`}</Badge>;
}

export function WarrantyContent() {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
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
        const data = await lookupWarranty(trimmed);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tìm thấy thông tin bảo hành.");
      }
    });
  }

  return (
    <div className="bb-container max-w-[560px] py-10">
      <div className="mb-7 pb-[22px] border-b border-border">
        <span className="text-sm tracking-[0.18em] uppercase text-brand font-bold block mb-2">{"Hậu mãi · BigBike"}</span>
        <h1 className="font-display uppercase text-[clamp(1.375rem,5vw,2.8rem)] tracking-[0.01em] leading-[1.1] m-0 text-foreground">{"Tra cứu bảo hành"}</h1>
        <p className="text-muted-foreground text-sm mt-2 m-0">{"Nhập số serial trên tem sản phẩm để kiểm tra hạn bảo hành."}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serial-input" className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground">
            {"Số serial "}<span className="text-brand ml-[3px]">*</span>
          </label>
          <div className="flex gap-2 max-sm:flex-col">
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
          <p className="text-muted-foreground text-sm mt-1.5 m-0">
            {"Số serial in trên tem dán trong hộp sản phẩm hoặc trên thân sản phẩm."}
          </p>
        </div>
      </form>

      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] text-sm text-destructive mt-4">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="m-0">{"Thông tin bảo hành"}</h3>
            <StatusBadge status={result.status} daysLeft={result.daysLeft} />
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="text-muted-foreground text-sm w-[40%] py-1.5">{"Sản phẩm"}</td>
                <td className="py-1.5 font-semibold">{result.productName}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"Số serial"}</td>
                <td className="py-1.5 font-mono">{result.serialNumber}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"Ngày bắt đầu"}</td>
                <td className="py-1.5">{formatDate(result.startDate)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"Ngày kết thúc"}</td>
                <td className="py-1.5">{formatDate(result.endDate)}</td>
              </tr>
            </tbody>
          </table>

          {result.status === "ACTIVE" && (
            <p className="text-muted-foreground text-sm mt-3 m-0">
              {"Vui lòng giữ số serial để xuất trình khi yêu cầu bảo hành tại cửa hàng hoặc qua hotline."}
            </p>
          )}
          {result.status === "VOIDED" && (
            <p className="mt-3 text-sm text-destructive m-0">
              {"Phiếu bảo hành này đã bị huỷ. Liên hệ cửa hàng để được hỗ trợ."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
