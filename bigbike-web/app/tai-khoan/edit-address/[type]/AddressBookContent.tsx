"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, Mail, MapPin, Phone, Plus, SquarePen, Trash2 } from "lucide-react";
import { AccountSectionHeading, useAccount } from "@/components/account/AccountNav";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress } from "@/lib/api/client-api";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";
import { Button } from "@/components/ui/button";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { cn } from "@/lib/utils";
import { skelBase } from "@/lib/ui-classes";
import { Dialog, DialogContent, DialogDescription, DialogGrabber, DialogHeader, DialogTitle, dialogMobileBottomSheet } from "@/components/ui/dialog";
import { FormNotice } from "@/components/ui/FormNotice";
import { AddressForm } from "./address-book/AddressForm";

const ADDRESSES_PAGE_SIZE = 6;

export function AddressBookContent() {
  const t = useTranslations("Account.addresses");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const router = useRouter();
  const accountEmail = profile?.email ?? "";

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  // Address books are tiny in practice; paginate client-side so an unusually long
  // list keeps a fixed height instead of stretching the page.
  const [addrPage, setAddrPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Địa chỉ đang gọi API (đặt mặc định / xoá) — theo Set để 2 dòng có thể xử lý
  // độc lập cùng lúc mà không đè trạng thái pending của nhau.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  function markPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  useEffect(() => {
    let ignore = false;
    fetchMyAddresses()
      .then((all) => { if (!ignore) setAddresses(all); })
      .catch(() => { if (!ignore) setListError(t("errorLoad")); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  function openAdd() {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(addr: CustomerAddress) {
    setEditing(addr);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(payload: SaveAddressPayload) {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const updated = await updateAddress(editing.id, payload);
        setAddresses((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
      } else {
        const created = await createAddress(payload);
        setAddresses((prev) => [...prev, created]);
      }
      // Backend keeps a single default per type — re-sync if this one became default.
      if (payload.isDefault) {
        const all = await fetchMyAddresses();
        setAddresses(all);
      }
      setNotice(editing ? t("noticeUpdated") : t("noticeAdded"));
      setModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(addr: CustomerAddress) {
    if (pendingIds.has(addr.id)) return;
    markPending(addr.id, true);
    try {
      await updateAddress(addr.id, {
        type: addr.type,
        fullName: addr.fullName ?? "",
        phone: addr.phone ?? "",
        province: addr.province ?? "",
        ward: addr.ward ?? "",
        addressLine1: addr.addressLine1 ?? "",
        isDefault: true,
      });
      const all = await fetchMyAddresses();
      setAddresses(all);
      setNotice(t("noticeDefault"));
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : t("errorSetDefault"));
    } finally {
      markPending(addr.id, false);
    }
  }

  async function handleDelete(addr: CustomerAddress) {
    if (pendingIds.has(addr.id)) return;
    if (!window.confirm(t("confirmDelete"))) return;
    markPending(addr.id, true);
    try {
      await deleteAddress(addr.id);
      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
      setNotice(t("noticeDeleted"));
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : t("errorDelete"));
    } finally {
      markPending(addr.id, false);
    }
  }

  // Clamp the page in render so deleting from the last page never leaves us
  // stranded on an empty page (no need to reset on every list mutation).
  const totalAddressPages = Math.max(1, Math.ceil(addresses.length / ADDRESSES_PAGE_SIZE));
  const currentAddressPage = Math.min(addrPage, totalAddressPages);
  const pagedAddresses = addresses.slice(
    (currentAddressPage - 1) * ADDRESSES_PAGE_SIZE,
    currentAddressPage * ADDRESSES_PAGE_SIZE,
  );

  return (
    <>
      <AccountSectionHeading title={tNav("addresses")} />

      {notice && (
        <FormNotice tone="success" className="mb-4">{notice}</FormNotice>
      )}
      {listError && (
        <FormNotice tone="danger" className="mb-4">{listError}</FormNotice>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:gap-6" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="border border-border p-5">
              <span className={cn(skelBase, "h-[1.1em] w-1/2")} />
              <span className={cn(skelBase, "h-[0.85em] w-3/5")} style={{ marginTop: 14 }} />
              <span className={cn(skelBase, "h-[0.85em] w-4/5")} style={{ marginTop: 8 }} />
              <span className={cn(skelBase, "h-[0.85em] w-full")} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {addresses.length > 0 && (
            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:gap-6">
              {pagedAddresses.map((addr, idx) => {
                const isPending = pendingIds.has(addr.id);
                return (
                <div
                  key={addr.id}
                  className={`border bg-white p-5 ${addr.isDefault ? "border-brand-border" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <b className="font-body text-ui-18 max-md:text-ui-16 font-semibold text-foreground">
                      {addr.fullName ?? "—"}
                    </b>
                    <span className="shrink-0 text-ui-14 max-md:text-ui-12 text-muted-foreground">
                      {t("addressItem", { index: (currentAddressPage - 1) * ADDRESSES_PAGE_SIZE + idx + 1 })}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-[10px] text-ui-16 max-md:text-ui-14 text-muted-foreground">
                    {addr.phone && (
                      <p className="m-0 flex items-center gap-2.5">
                        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        {addr.phone}
                      </p>
                    )}
                    {(addr.email ?? accountEmail) && (
                      <p className="m-0 flex items-center gap-2.5">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        {addr.email ?? accountEmail}
                      </p>
                    )}
                    <p className="m-0 flex items-start gap-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>
                        {[addr.addressLine1, addr.ward, addr.district, addr.province]
                          .filter(Boolean)
                          .join(", ") || t("addressMissing")}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                    {addr.isDefault ? (
                      <span className="flex items-center gap-1.5 text-ui-14 max-md:text-ui-12 font-bold uppercase tracking-wide text-brand">
                        <Check className="h-4 w-4" aria-hidden />
                        {t("defaultBadge")}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => handleSetDefault(addr)}
                        disabled={isPending}
                        className="min-h-11 gap-1.5 px-0 text-ui-14 font-bold uppercase tracking-wide text-discount"
                      >
                        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                        {t("setDefaultButton")}
                      </Button>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(addr)}
                        aria-label={t("editAria")}
                        disabled={isPending}
                        className="h-11 w-11 text-muted-foreground hover:text-brand"
                      >
                        <SquarePen className="h-[18px] w-[18px]" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(addr)}
                        aria-label={t("deleteAria")}
                        disabled={isPending}
                        className="h-11 w-11 text-muted-foreground hover:text-brand"
                      >
                        {isPending ? (
                          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <PaginationNav
            page={currentAddressPage}
            totalPages={totalAddressPages}
            onPageChange={setAddrPage}
          />

          <Button
            type="button"
            variant="link"
            onClick={openAdd}
            className="mt-5 min-h-11 gap-2 px-0 text-ui-14 font-bold uppercase tracking-wide text-brand"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("addNew")}
          </Button>

          {addresses.length === 0 && (
            <p className="mt-3 text-ui-16 max-md:text-ui-14 text-muted-foreground">{t("empty")}</p>
          )}

          {/* "Cập nhật" — closes out the address book (each card already saves
              itself via the popup); returns to the account info screen. */}
          <Button
            type="button"
            variant="primary"
            onClick={() => router.push("/tai-khoan/edit-account/")}
            className="mt-6 w-full"
          >
            {t("updateButton")}
          </Button>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={`max-w-[920px] w-[calc(100%-32px)] p-0 ${dialogMobileBottomSheet}`}>
          <DialogGrabber />
          <DialogHeader className="p-6">
            <DialogTitle>{editing ? t("modalUpdate") : t("modalAdd")}</DialogTitle>
            <DialogDescription className="sr-only">{editing ? t("modalUpdate") : t("modalAdd")}</DialogDescription>
          </DialogHeader>
          <AddressForm
            key={editing?.id ?? "new"}
            editing={editing}
            accountEmail={accountEmail}
            saving={saving}
            error={formError}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
