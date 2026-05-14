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
    return <Badge variant="outline">{"\u0110\u00e3 hu\u1ef7"}</Badge>;
  }
  if (status === "EXPIRED") {
    return <Badge variant="destructive">{"H\u1ebft h\u1ea1n"}</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge variant="warning">{`S\u1eafp h\u1ebft h\u1ea1n (${daysLeft} ng\u00e0y)`}</Badge>;
  }
  return <Badge variant="success">{`C\u00f2n hi\u1ec7u l\u1ef1c (${daysLeft} ng\u00e0y)`}</Badge>;
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
          setError(payload.error?.message ?? "Kh\u00f4ng t\u00ecm th\u1ea5y th\u00f4ng tin b\u1ea3o h\u00e0nh.");
          return;
        }
        setResult(payload.data ?? null);
      } catch {
        setError("L\u1ed7i k\u1ebft n\u1ed1i. Vui l\u00f2ng th\u1eed l\u1ea1i.");
      }
    });
  }

  return (
    <div className="bb-container max-w-[560px] py-10">
      <div className="mb-7 pb-[22px] border-b border-border">
        <span className="text-[11px] tracking-[0.18em] uppercase text-brand font-bold block mb-2">{"H\u1eadu m\u00e3i \u00b7 BigBike"}</span>
        <h1 className="font-display uppercase text-[clamp(1.375rem,5vw,2.8rem)] tracking-[0.01em] leading-[1.1] m-0 text-foreground">{"Tra c\u1ee9u b\u1ea3o h\u00e0nh"}</h1>
        <p className="text-muted-foreground text-sm mt-2 m-0">{"Nh\u1eadp s\u1ed1 serial tr\u00ean tem s\u1ea3n ph\u1ea9m \u0111\u1ec3 ki\u1ec3m tra h\u1ea1n b\u1ea3o h\u00e0nh."}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serial-input" className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">
            {"S\u1ed1 serial "}<span className="text-brand ml-[3px]">*</span>
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
              {isPending ? "\u0110ang tra..." : "Tra c\u1ee9u"}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-1.5 m-0">
            {"S\u1ed1 serial in tr\u00ean tem d\u00e1n trong h\u1ed9p s\u1ea3n ph\u1ea9m ho\u1eb7c tr\u00ean th\u00e2n s\u1ea3n ph\u1ea9m."}
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
            <h3 className="m-0">{"Th\u00f4ng tin b\u1ea3o h\u00e0nh"}</h3>
            <StatusBadge status={result.status} daysLeft={result.daysLeft} />
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="text-muted-foreground text-sm w-[40%] py-1.5">{"S\u1ea3n ph\u1ea9m"}</td>
                <td className="py-1.5 font-semibold">{result.productName}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"S\u1ed1 serial"}</td>
                <td className="py-1.5 font-mono">{result.serialNumber}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"Ng\u00e0y b\u1eaft \u0111\u1ea7u"}</td>
                <td className="py-1.5">{formatDate(result.startDate)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{"Ng\u00e0y k\u1ebft th\u00fac"}</td>
                <td className="py-1.5">{formatDate(result.endDate)}</td>
              </tr>
            </tbody>
          </table>

          {result.status === "ACTIVE" && (
            <p className="text-muted-foreground text-sm mt-3 m-0">
              {"Vui l\u00f2ng gi\u1eef s\u1ed1 serial \u0111\u1ec3 xu\u1ea5t tr\u00ecnh khi y\u00eau c\u1ea7u b\u1ea3o h\u00e0nh t\u1ea1i c\u1eeda h\u00e0ng ho\u1eb7c qua hotline."}
            </p>
          )}
          {result.status === "VOIDED" && (
            <p className="mt-3 text-sm text-destructive m-0">
              {"Phi\u1ebfu b\u1ea3o h\u00e0nh n\u00e0y \u0111\u00e3 b\u1ecb hu\u1ef7. Li\u00ean h\u1ec7 c\u1eeda h\u00e0ng \u0111\u1ec3 \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
