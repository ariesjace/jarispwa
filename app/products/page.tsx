"use client";

import React from "react";
import { CMSLayout, TOKEN } from "@/components/layout";
import { Package } from "lucide-react";
import AllProductsPage from "@/components/pages/products/AllProducts";

/**
 * PRODUCTS SECTION RESOLVER
 * Renders the content based on the active tab state from CMSLayout.
 */
function ProductsSection({ tab }: { tab: string }) {
  const EmptyState = ({ label }: { label: string }) => (
    <div style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}>
      <Package size={48} style={{ marginBottom: 16, opacity: 0.2, margin: "0 auto" }} />
      <p style={{ fontSize: 13.5, fontWeight: 600 }}>{label} view is under construction.</p>
    </div>
  );

  switch (tab) {
    case "All Products":
      return <AllProductsPage />;
    case "Inventory":
      return <EmptyState label="Inventory" />;
    case "Collections":
      return <EmptyState label="Collections" />;
    case "Featured":
      return <EmptyState label="Featured" />;
    case "Archive":
      return <EmptyState label="Archive" />;
    default:
      return <AllProductsPage />;
  }
}

export default function ProductsPage() {
  return (
    <CMSLayout>
      {({ activeTab }) => (
        <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
          <ProductsSection tab={activeTab} />

          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </CMSLayout>
  );
}