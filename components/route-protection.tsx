"use client";

/**
 * components/route-protection.tsx
 * ────────────────────────────────
 * Guards any route subtree.
 *
 * Logic:
 *  1. While auth is loading → show spinner (prevents flash of redirect)
 *  2. Public /auth/* routes → render immediately (no auth required)
 *  3. No user → redirect to /auth/login
 *  4. User present but no access → redirect to /access-denied?from=<path>
 *  5. Admins (admin/superadmin/director) bypass route-level checks — RBAC
 *     is enforced at the tab/action level via lib/rbac.ts
 *  6. All good → render children
 */

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { canAccessRoute } from "@/lib/roleAccess";

interface RouteProtectionProps {
  children: ReactNode;
  /**
   * Route prefixes this protection applies to.
   * e.g. ["/products"] protects /products and /products/*.
   */
  requiredRoutes: string[];
}

export function RouteProtection({
  children,
  requiredRoutes,
}: RouteProtectionProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  // usePathname is SSR-safe; window.location.pathname is not
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(false);

  const normalizedRole = String(user?.role ?? "")
    .toLowerCase()
    .trim();
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "superadmin" ||
    normalizedRole === "director";

  // Is the current path within the scope of this protection layer?
  const inScope = requiredRoutes.some((route) => {
    const r = route.replace(/\/$/, "");
    const p = (pathname ?? "").replace(/\/$/, "");
    return p === r || p.startsWith(r + "/");
  });

  // Access check — admins bypass route-level rules (action-level RBAC still applies)
  const hasAccess =
    !inScope ||
    isAdmin ||
    (!!user && canAccessRoute(user.role, pathname ?? ""));

  useEffect(() => {
    if (isLoading) return;

    // /auth/* routes are always public
    if ((pathname ?? "").startsWith("/auth")) {
      setShouldRender(true);
      return;
    }

    if (!user) {
      router.push("/auth");
      return;
    }

    if (!hasAccess) {
      router.push(`/access-denied?from=${encodeURIComponent(pathname ?? "")}`);
      return;
    }

    setShouldRender(true);
  }, [user, hasAccess, isLoading, router, pathname]);

  // Full-screen spinner during auth check
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (shouldRender) return <>{children}</>;

  // Redirecting — render nothing to avoid flash
  return null;
}
