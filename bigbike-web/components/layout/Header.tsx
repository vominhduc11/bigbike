import { HeaderClient } from "@/components/layout/HeaderClient";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { listPublicSettings } from "@/lib/api/public-api";
import { pickSetting } from "@/lib/utils/settings";
import type { Locale } from "@/i18n/locale";

function filterMenuNodes(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes
    .filter((node) => !node.url?.includes("huong-dan-mua-hang"))
    .map((node) => ({ ...node, children: filterMenuNodes(node.children) }));
}

export async function Header({
  menuNodesVi,
  menuNodesEn,
  locale,
}: {
  menuNodesVi: HeaderNavNode[];
  menuNodesEn: HeaderNavNode[];
  locale: Locale;
}) {
  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult.data ?? [];

  return (
    <HeaderClient
      menuNodesVi={filterMenuNodes(menuNodesVi)}
      menuNodesEn={filterMenuNodes(menuNodesEn)}
      contact={{
        address: pickSetting(settings, ["contact_address"]),
        phones: [
          pickSetting(settings, ["hotline"]),
          pickSetting(settings, ["hotline_2"]),
          pickSetting(settings, ["hotline_3"]),
        ].filter(Boolean),
        hours: {
          weekday: pickSetting(settings, ["opening_hours_weekday"]),
          weekend: pickSetting(settings, ["opening_hours_weekend"]),
          holiday: pickSetting(settings, ["opening_hours_holiday"]),
        },
        descriptionVi: pickSetting(settings, ["footer_description"]),
        descriptionEn: pickSetting(settings, ["footer_description"]),
      }}
    />
  );
}
