"use client";

import { RouteProtection } from "@/components/route-protection";
import { CMSShell } from "@/components/layout/CMSShell";

export default function ProductsPage() {
  return (
    <RouteProtection requiredRoutes={["/products"]}>
      <CMSShell initialNav="products" />
    </RouteProtection>
  );
}

