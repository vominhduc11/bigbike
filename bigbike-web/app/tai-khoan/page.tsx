"use client";

import Link from "next/link";
import { AccountShell, useAccount } from "@/components/layout/AccountShell";
import { customerStatusLabel } from "@/lib/utils/format";

function AccountOverview() {
  const profile = useAccount()!;

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Tổng quan</h2>
          <p className="sub">Xin chào, {profile.displayName ?? profile.email}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 28 }}>
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "20px 22px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 10 }}>
            Email
          </p>
          <p style={{ fontSize: 14, color: "#fff", margin: 0 }}>{profile.email}</p>
        </div>
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "20px 22px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 10 }}>
            Số điện thoại
          </p>
          <p style={{ fontSize: 14, color: "#fff", margin: 0 }}>{profile.phone ?? "Chưa cập nhật"}</p>
        </div>
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "20px 22px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 10 }}>
            Trạng thái
          </p>
          <p style={{ fontSize: 14, color: profile.status === "ACTIVE" ? "#62bb46" : "var(--bb-text-muted)", margin: 0, fontWeight: 700 }}>
            {customerStatusLabel(profile.status)}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Link
          href="/tai-khoan/don-hang/"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px", textDecoration: "none", display: "block" }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-brand-primary)", marginBottom: 6 }}>Đơn hàng</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>Xem lịch sử đặt hàng →</p>
        </Link>
        <Link
          href="/tai-khoan/edit-account"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px", textDecoration: "none", display: "block" }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-brand-primary)", marginBottom: 6 }}>Tài khoản</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>Chỉnh sửa thông tin →</p>
        </Link>
        <Link
          href="/tai-khoan/edit-address/billing"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px", textDecoration: "none", display: "block" }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-brand-primary)", marginBottom: 6 }}>Địa chỉ</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>Quản lý địa chỉ →</p>
        </Link>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan">
      <AccountOverview />
    </AccountShell>
  );
}
