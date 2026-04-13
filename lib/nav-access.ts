/**
 * lib/nav-access.ts
 * ──────────────────
 * Maps the user's role → which CMSLayout nav sections they can see.
 *
 * The canonical permission source is lib/roleAccess.ts (canAccessRoute).
 * This module just translates route-level access into nav-section-level
 * visibility so CMSLayout can render a filtered sidebar.
 */

import {
  canAccessRoute,
  roleAccessConfig,
  type UserRole,
} from "@/lib/roleAccess";
import {
  NAV_SECTIONS,
  type NavId,
  type NavSection,
} from "@/components/layout/nav-data";

/**
 * Representative routes for each nav section.
 * Access to ANY of these routes means the section is visible.
 */
const NAV_REPRESENTATIVE_ROUTES: Record<NavId, string[]> = {
  products: [
    "/products/all-products",
    "/products/requests",
    "/admin/deleted-products",
  ],
  jobs: ["/jobs/applications", "/jobs/careers"],
  content: ["/content", "/content/blogs"],
  admin: ["/admin/register", "/admin/audit-logs"],
};

/**
 * Tabs within each section that require extra permission checks.
 * If a tab route is not accessible, the tab is hidden.
 * Tabs not listed here are always shown if the section is visible.
 */
const TAB_ROUTE_MAP: Partial<Record<NavId, Record<string, string>>> = {
  products: {
    Requests: "/products/requests",
    Applications: "/products/applications",
  },
  admin: {
    "Recycle Bin": "/admin/deleted-products",
    "User Management": "/admin/register",
    "Audit Logs": "/admin/audit-logs",
  },
};

/**
 * Returns the subset of NAV_SECTIONS the given role can access.
 * Admins / superadmins get all sections.
 */
export function getAccessibleNavSections(role: string): NavSection[] {
  const normalized = role.toLowerCase().trim() as UserRole;
  const allowedRoutes = roleAccessConfig[normalized] ?? [];

  // Wildcard roles see everything
  if (allowedRoutes.includes("*"))
    return NAV_SECTIONS as unknown as NavSection[];

  return (NAV_SECTIONS as unknown as NavSection[]).filter((section) => {
    const representatives = NAV_REPRESENTATIVE_ROUTES[section.id] ?? [];
    return representatives.some((route) => canAccessRoute(role, route));
  });
}

/**
 * Returns the visible tabs for a given nav section and role.
 * Tabs with an explicit route mapping are checked; others are kept.
 */
export function getAccessibleTabs(
  navId: NavId,
  role: string,
): readonly string[] {
  const section = (NAV_SECTIONS as unknown as NavSection[]).find(
    (s) => s.id === navId,
  );
  if (!section) return [];

  const tabRoutes = TAB_ROUTE_MAP[navId] ?? {};
  return section.tabs.filter((tab) => {
    const route = tabRoutes[tab];
    if (!route) return true; // no restriction → always visible
    return canAccessRoute(role, route);
  });
}

/**
 * Derives CmsUser.initials from a full name string.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
