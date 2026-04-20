export const SECTION_ROUTE_ALIASES: Record<string, string> = {
  account: "connections",
  accounts: "connections",
  api: "operations",
  "api-dashboard": "operations",
  connection: "connections",
};

export const SECTION_ROUTE_IDS = [
  "create",
  "calendar",
  "drafts",
  "published",
  "failed",
  "operations",
  "connections",
  "settings",
  "profile",
] as const;

export type SectionRoute = (typeof SECTION_ROUTE_IDS)[number];

export function normalizeSectionRoute(section: string): SectionRoute {
  const normalized = SECTION_ROUTE_ALIASES[section] ?? section;
  return (SECTION_ROUTE_IDS as readonly string[]).includes(normalized) ? (normalized as SectionRoute) : "create";
}

export function getSectionHref(section: string): `/${SectionRoute}` {
  return `/${normalizeSectionRoute(section)}`;
}
