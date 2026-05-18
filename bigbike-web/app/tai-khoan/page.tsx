import { redirect } from "next/navigation";

// The 2020 account area has no separate "overview" screen — the landing
// page is "Thông tin tài khoản". Send /tai-khoan/ straight there.
export default function AccountIndexPage() {
  redirect("/tai-khoan/edit-account/");
}
