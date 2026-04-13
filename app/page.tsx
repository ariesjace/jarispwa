"use client";

/**
 * app/page.tsx
 * ────────────
 * Root route (/).
 *
 * Behaviour:
 *  - Unauthenticated → redirect to /auth/login
 *  - Authenticated   → redirect to their primary route via getPrimaryRouteForRole
 *
 * This keeps "/" as a thin redirect hub. The actual CMS shell lives in
 * /products, /jobs, /content, /admin etc. so each section can have its
 * own RouteProtection and metadata.
 *
 * For the initial MVP where all sections are rendered in a single CMSLayout
 * wrapper, this page handles the redirect and the CMSLayout in /products
 * becomes the canonical entry point.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getPrimaryRouteForRole } from "@/lib/roleAccess";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    router.replace(getPrimaryRouteForRole(user.role));
  }, [user, isLoading, router]);

  // Full-screen spinner while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
