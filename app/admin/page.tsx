"use client";

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import { Shield, Trash2, ScrollText } from "lucide-react";
import UserManagementPage from "@/components/pages/admin/UserManagement";

function AdminSection({ tab }: { tab: string }) {
  const EmptyState = ({
    icon: Icon,
    label,
    description,
  }: {
    icon: React.ElementType;
    label: string;
    description?: string;
  }) => (
    <div
      style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}
    >
      <Icon size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: TOKEN.textPri,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      {description && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>{description}</p>
      )}
    </div>
  );

  switch (tab) {
    case "User Management":
      return <UserManagementPage />;
    case "Recycle Bin":
      return (
        <EmptyState
          icon={Trash2}
          label="Recycle Bin"
          description="Restore or permanently delete removed items."
        />
      );
    case "Audit Logs":
      return (
        <EmptyState
          icon={ScrollText}
          label="Audit Logs"
          description="View a full history of system actions."
        />
      );
    default:
      return (
        <EmptyState
          icon={Shield}
          label={tab}
          description="This section is under construction."
        />
      );
  }
}

export default function AdminPage() {
  return (
    <RouteProtection requiredRoutes={["/admin"]}>
      <CMSLayout currentNavId="admin">
        {({ activeTab }) => (
          <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
            <AdminSection tab={activeTab} />
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
