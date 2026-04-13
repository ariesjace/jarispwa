"use client";

/**
 * app/auth/layout.tsx
 * ───────────────────
 * Wrapper for all /auth/* routes.
 * - No RouteProtection (these pages are public by definition)
 * - Redirects already-authenticated users to their primary route
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getPrimaryRouteForRole } from "@/lib/roleAccess";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      // Already logged in → bounce to their primary destination
      router.replace(getPrimaryRouteForRole(user.role));
    }
  }, [user, isLoading, router]);

  // While checking auth, show nothing (prevents flash of login form)
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Authenticated users see nothing while the redirect fires
  if (user) return null;

  return <>{children}</>;
}