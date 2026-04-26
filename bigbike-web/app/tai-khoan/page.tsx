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
          <h1>Tài khoản của tôi</h1>
          <p className="sub">Xin chào, {profile.displayName ?? profile.email}</p>
        </div>
      </div>

      <div className="wp-info-grid">
        <div className="wp-info-card">
          <p className="wp-info-label">Email</p>
          <p className="wp-info-val">{profile.email}</p>
        </div>
        <div className="wp-info-card">
          <p className="wp-info-label">Số điện thoại</p>
          <p className="wp-info-val">{profile.phone ?? "Chưa cập nhật"}</p>
        </div>
        <div className="wp-info-card">
          <p className="wp-info-label">Trạng thái</p>
          <p className={`wp-info-val${profile.status === "ACTIVE" ? " wp-info-val--success" : ""}`}>
            {customerStatusLabel(profile.status)}
          </p>
        </div>
      </div>

      <div className="wp-nav-grid">
        <Link href="/tai-khoan/don-hang/" className="wp-nav-card">
          <p className="wp-nav-card-title">Đơn hàng</p>
          <p className="wp-nav-card-desc">Xem lịch sử đặt hàng →</p>
        </Link>
        <Link href="/tai-khoan/edit-account" className="wp-nav-card">
          <p className="wp-nav-card-title">Tài khoản</p>
          <p className="wp-nav-card-desc">Chỉnh sửa thông tin →</p>
        </Link>
        <Link href="/tai-khoan/edit-address/billing" className="wp-nav-card">
          <p className="wp-nav-card-title">Địa chỉ</p>
          <p className="wp-nav-card-desc">Quản lý địa chỉ →</p>
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
