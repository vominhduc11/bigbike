"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatVnd } from "@/lib/utils/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const POLL_INTERVAL_MS = 8000;

interface PaymentInfo {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  amountVnd: number;
  transferContent: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrVietQrUrl: string | null;
  expiresAt: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="bb-copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "✓ Đã sao chép" : "Sao chép"}
    </button>
  );
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) return <span className="bb-timer expired">Đã hết hạn</span>;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <span className={`bb-timer${remaining < 300 ? " urgent" : ""}`}>
      {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

export default function SepayQrPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchInfo() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/checkout/${orderId}/payment-info`);
        if (!res.ok) throw new Error("Không tải được thông tin thanh toán.");
        const json = await res.json();
        if (!cancelled) setInfo(json.data);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function pollStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/checkout/${orderId}/payment-status`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.data?.paymentStatus === "PAID") {
          setPaid(true);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.replace(`/don-hang/xac-nhan?so=${json.data.orderNumber}`), 1500);
        }
      } catch {}
    }

    fetchInfo().then(() => {
      if (!cancelled) {
        pollStatus();
        pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
      }
    });

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, router]);

  // Also poll when user returns to tab (e.g. after switching to banking app)
  useEffect(() => {
    function onFocus() {
      if (paid) return;
      fetch(`${API_BASE}/api/v1/checkout/${orderId}/payment-status`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data?.paymentStatus === "PAID") {
            setPaid(true);
            if (pollRef.current) clearInterval(pollRef.current);
            setTimeout(() => router.replace(`/don-hang/xac-nhan?so=${json.data.orderNumber}`), 1500);
          }
        })
        .catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [orderId, paid, router]);

  if (loading) {
    return (
      <div className="bb-container bb-sepay-page">
        <div className="bb-skel" style={{ width: 280, height: 280, borderRadius: 8, margin: "2rem auto" }} />
        <div className="bb-skel bb-skel--text bb-skel-w-60" style={{ margin: "1rem auto" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bb-container bb-sepay-page">
        <p className="wp-error-text">{error}</p>
        <Link href="/" className="bb-link">Về trang chủ</Link>
      </div>
    );
  }

  if (!info) return null;

  if (paid) {
    return (
      <div className="bb-container bb-sepay-page">
        <div className="bb-sepay-success">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--bb-brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <h2>Thanh toán thành công!</h2>
          <p>Đang chuyển đến trang xác nhận đơn hàng...</p>
        </div>
      </div>
    );
  }

  const qrUrl = info.qrVietQrUrl;

  return (
    <div className="bb-container bb-sepay-page">
      <div className="bb-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <span>Thanh toán đơn hàng</span>
      </div>

      <div className="bb-sepay-layout">
        {/* Left: QR */}
        <div className="bb-sepay-qr-block">
          <p className="bb-sepay-label">Quét QR để thanh toán</p>
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`QR thanh toán đơn ${info.orderNumber}`}
              width={280}
              height={280}
              className="bb-sepay-qr-img"
            />
          ) : (
            <div className="bb-sepay-qr-placeholder">
              <p>Vui lòng chuyển khoản theo thông tin bên cạnh.</p>
            </div>
          )}
          {info.expiresAt && (
            <div className="bb-sepay-timer-row">
              <span>Hết hạn sau:</span>
              <CountdownTimer expiresAt={info.expiresAt} />
            </div>
          )}
          <p className="bb-sepay-auto-note">
            Sau khi chuyển khoản, vui lòng đợi shop kiểm tra và xác nhận.
            Trang sẽ tự động cập nhật khi đơn hàng của bạn được duyệt.
          </p>
        </div>

        {/* Right: bank info */}
        <div className="bb-sepay-info-block">
          <h1 className="bb-sepay-title">Thông tin chuyển khoản</h1>
          <p className="bb-sepay-sub">Đơn hàng <strong>{info.orderNumber}</strong></p>

          <div className="bb-sepay-fields">
            {[
              { label: "Ngân hàng", value: info.bankName },
              { label: "Số tài khoản", value: info.accountNumber },
              { label: "Chủ tài khoản", value: info.accountHolder },
              { label: "Số tiền", value: formatVnd(info.amountVnd) },
              { label: "Nội dung CK", value: info.transferContent, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`bb-sepay-field${highlight ? " highlight" : ""}`}>
                <span className="bb-sepay-field-label">{label}</span>
                <div className="bb-sepay-field-row">
                  <span className="bb-sepay-field-value">{value}</span>
                  <CopyButton text={value} />
                </div>
              </div>
            ))}
          </div>

          <div className="bb-sepay-warn">
            <strong>Lưu ý:</strong> Vui lòng ghi nội dung chuyển khoản{" "}
            <strong>{info.transferContent}</strong> để shop dễ dàng đối soát giao dịch.
          </div>

          <div className="bb-sepay-polling">
            <span className="bb-pulse" aria-hidden="true" />
            Đang chờ shop xác nhận thanh toán...
          </div>
        </div>
      </div>
    </div>
  );
}
