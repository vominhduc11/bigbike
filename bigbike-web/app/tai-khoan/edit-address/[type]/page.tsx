import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { AddressBookContent } from "./AddressBookContent";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [];
}

export default function EditAddressPage() {
  return (
    <WpAccountShell>
      <AddressBookContent />
    </WpAccountShell>
  );
}
