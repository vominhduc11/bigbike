"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookUser, Check, Mail, MapPin, Phone, Plus, SquarePen, Trash2 } from "lucide-react";
import { AccountSectionHeading, AccountShell, useAccount } from "@/components/layout/AccountShell";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress } from "@/lib/api/client-api";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// 2020-mockup field label: gray, sentence-case, red asterisk appended.
const LEGACY_LABEL = "text-sm text-[#555555]";

function ReqMark() {
  return <span className="text-brand">*</span>;
}

type AddressFormProps = {
  editing: CustomerAddress | null;
  accountEmail: string;
  saving: boolean;
  error: string;
  onSubmit: (payload: SaveAddressPayload) => void;
};

function AddressForm({ editing, accountEmail, saving, error, onSubmit }: AddressFormProps) {
  const t = useTranslations("Account.addresses");
  const [vnAddress, setVnAddress] = useState({
    province: editing?.province ?? "",
    district: editing?.district ?? "",
    ward: editing?.ward ?? "",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    onSubmit({
      type: editing?.type ?? "SHIPPING",
      fullName: (fd.get("fullName") as string).trim(),
      phone: (fd.get("phone") as string).trim(),
      email: email || undefined,
      province: vnAddress.province,
      district: vnAddress.district,
      ward: vnAddress.ward,
      addressLine1: (fd.get("addressLine1") as string).trim(),
      isDefault: fd.get("isDefault") === "on",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[12px_16px] mb-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("fullNameLabel")}<ReqMark /></label>
          <Input
            name="fullName"
            required
            defaultValue={editing?.fullName ?? ""}
            placeholder={t("fullNamePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("phoneLabel")}<ReqMark /></label>
          <Input
            name="phone"
            type="tel"
            required
            defaultValue={editing?.phone ?? ""}
            placeholder={t("phonePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
          <Input
            type="email"
            name="email"
            defaultValue={editing?.email ?? accountEmail}
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("addressLabel")}<ReqMark /></label>
          <Input
            name="addressLine1"
            required
            defaultValue={editing?.addressLine1 ?? ""}
            placeholder={t("addressPlaceholder")}
          />
        </div>
        <div className="sm:col-span-2 grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-3">
          <VnAddressFields
            value={vnAddress}
            onChange={(field, val) => setVnAddress((prev) => ({ ...prev, [field]: val }))}
            required
            labelClassName={LEGACY_LABEL}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Default-address toggle only on "add" — the 2020 edit modal has none;
            an existing address is made default via the card's "Đặt mặc định" button. */}
        {!editing && (
          <label className="flex items-center gap-2 text-sm text-[#555555]">
            <Checkbox name="isDefault" defaultChecked={false} />
            {t("setDefault")}
          </label>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="w-full sm:w-auto sm:min-w-[160px]"
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function AddressBookContent() {
  const t = useTranslations("Account.addresses");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const router = useRouter();
  const accountEmail = profile?.email ?? "";

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
    try {
      await updateAddress(addr.id, {
        type: addr.type,
        fullName: addr.fullName ?? "",
        phone: addr.phone ?? "",
        province: addr.province ?? "",
        district: addr.district ?? "",
        ward: addr.ward ?? "",
        addressLine1: addr.addressLine1 ?? "",
        isDefault: true,
      });
      const all = await fetchMyAddresses();
      setAddresses(all);
      setNotice(t("noticeDefault"));
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : t("errorSetDefault"));
    }
  }

  async function handleDelete(addr: CustomerAddress) {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteAddress(addr.id);
      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
      setNotice(t("noticeDeleted"));
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : t("errorDelete"));
    }
  }

  return (
    <>
      <AccountSectionHeading
        title={tNav("addresses")}
        icon={<BookUser className="h-7 w-7" strokeWidth={1.5} aria-hidden />}
      />

      {notice && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[12px_16px] mb-4 text-sm text-[var(--bb-state-success-text)]">
          {notice}
        </div>
      )}
      {listError && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[12px_16px] mb-4 text-sm text-destructive">
          {listError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="border border-border p-5">
              <span className="bb-skel bb-skel--title bb-skel-w-50" />
              <span className="bb-skel bb-skel--text bb-skel-w-60" style={{ marginTop: 14 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-80" style={{ marginTop: 8 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-100" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {addresses.length > 0 && (
            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
              {addresses.map((addr, idx) => (
                <div
                  key={addr.id}
                  className={`border bg-white p-5 ${addr.isDefault ? "border-[var(--bb-brand-primary-border)]" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <b className="font-display text-base font-semibold text-[#1a1a1a]">
                      {addr.fullName ?? "—"}
                    </b>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {t("addressItem", { index: idx + 1 })}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-[10px] text-sm text-[#555555]">
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
                      <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.04em] text-brand">
                        <Check className="h-4 w-4" aria-hidden />
                        {t("defaultBadge")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr)}
                        className="text-sm font-bold uppercase tracking-[0.04em] text-[#7c3aed] hover:underline"
                      >
                        {t("setDefaultButton")}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(addr)}
                        aria-label={t("editAria")}
                        className="p-1.5 text-[#555555] hover:text-brand"
                      >
                        <SquarePen className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(addr)}
                        aria-label={t("deleteAria")}
                        className="p-1.5 text-[#555555] hover:text-brand"
                      >
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={openAdd}
            className="mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-brand hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("addNew")}
          </button>

          {addresses.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
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
        <DialogContent className="max-w-[920px] w-[calc(100%-32px)] p-0">
          <DialogHeader className="p-6">
            <DialogTitle>{editing ? t("modalUpdate") : t("modalAdd")}</DialogTitle>
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

type Props = { params: Promise<{ type: string }> };

export default function EditAddressPage({ params }: Props) {
  // The 2020 "Sổ địa chỉ" is a single flat list; the [type] segment is kept
  // only so existing links (/edit-address/billing/) still resolve.
  const { type } = use(params);
  return (
    <AccountShell loginRedirect={`/tai-khoan/edit-address/${type}/`}>
      <AddressBookContent />
    </AccountShell>
  );
}
