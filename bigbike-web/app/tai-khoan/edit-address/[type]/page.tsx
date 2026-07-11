import { AccountShell } from "@/components/layout/AccountShell";
import { AddressBookContent } from "./AddressBookContent";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [];
}

export default function EditAddressPage() {
  return (
    <AccountShell>
      <AddressBookContent />
    </AccountShell>
  );
}
