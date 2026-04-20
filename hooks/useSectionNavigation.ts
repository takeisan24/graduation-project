"use client";

import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useNavigationStore } from "@/store";
import { getSectionHref, normalizeSectionRoute, type SectionRoute } from "@/lib/navigation/sectionRoutes";

export function useSectionNavigation() {
  const router = useRouter();
  const setActiveSection = useNavigationStore((state) => state.setActiveSection);

  return useCallback((section: string) => {
    const normalizedSection = normalizeSectionRoute(section) as SectionRoute;
    setActiveSection(normalizedSection);
    router.push(getSectionHref(normalizedSection));
  }, [router, setActiveSection]);
}
