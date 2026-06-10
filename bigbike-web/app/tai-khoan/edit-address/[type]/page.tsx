import { WpAccountShell } from "@/components/wp/WpAccountShell";
import { AddressBookContent } from "./AddressBookContent";

type Props = { params: Promise<{ type: string }> };

/**
 * Sổ địa chỉ — port từ woocommerce/myaccount/form-edit-address.php.
 * Server component await params (Next 15 Promise) rồi bọc WpAccountShell + nội dung client.
 * The 2020 "Sổ địa chỉ" is a single flat list; the [type] segment is kept only so
 * existing links (/edit-address/billing/) still resolve.
 */
export default async function EditAddressPage({ params }: Props) {
  const { type } = await params;

  return (
    <WpAccountShell loginRedirect={`/tai-khoan/edit-address/${type}/`}>
      <AddressBookContent />
    </WpAccountShell>
  );
}
