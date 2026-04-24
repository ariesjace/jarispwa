"use client";

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import { Package } from "lucide-react";
import AllProductsPage from "@/components/pages/products/AllProducts";
import ProductRequestsPage from "@/components/pages/products/ProductRequests";
import TaskflowPage from "@/components/pages/products/Taskflow";
import FamiliesPage from "@/components/pages/products/Families";
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
      <p style={{ fontSize: 13.5, fontWeight: 600 }}>{label} — coming soon.</p>
    </div>
  );

  switch (tab) {
    case "All Products":
      return <AllProductsPage />;
    case "Taskflow":
      return <TaskflowPage />;
    case "Families":
      return <FamiliesPage />;
    case "Requests":
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
    <RouteProtection requiredRoutes={["/products"]}>
      <CMSLayout currentNavId="products">
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
