"use client";

/**
 * app/products/page.tsx
 * ─────────────────────
 * Products section — wraps everything in RouteProtection so only
 * users with read:products (or wildcard) can reach this page.
 */

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import { Package } from "lucide-react";
import AllProductsPage from "@/components/pages/products/AllProducts";
import ProductRequestsPage from "@/components/pages/products/ProductRequests";
import { useAuth } from "@/lib/useAuth";
import { hasAccess } from "@/lib/rbac";

function ProductsSection({ tab }: { tab: string }) {
  const { user } = useAuth();

  const EmptyState = ({ label }: { label: string }) => (
    <div
      style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}
    >
      <Package
        size={48}
        style={{ marginBottom: 16, opacity: 0.2, margin: "0 auto" }}
      />
      <p style={{ fontSize: 13.5, fontWeight: 600 }}>
        {label} view is under construction.
      </p>
    </div>
  );

  switch (tab) {
    case "All Products":
      return <AllProductsPage />;

    case "Requests":
      // Requests tab is only reachable if the user has verify:products OR
      // write:products (submitters see their own requests).
      // The tab itself is hidden for read-only roles via nav-access.ts, but
      // we add a hard guard here for direct URL access.
      if (!user || !hasAccess(user, "write", "products")) {
        return <EmptyState label="No access" />;
      }
      return <ProductRequestsPage />;

    default:
      return <EmptyState label={tab} />;
  }
}

export default function ProductsPage() {
  return (
    // requiredRoutes tells RouteProtection which path prefix this layout guards
    <RouteProtection requiredRoutes={["/products"]}>
      <CMSLayout>
        {({ activeTab }) => (
          <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
            <ProductsSection tab={activeTab} />
            <style jsx global>{`
              @keyframes fadeIn {
                from {
                  opacity: 0;
                  transform: translateY(4px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        )}
      </CMSLayout>
    </RouteProtection>
  );
}
