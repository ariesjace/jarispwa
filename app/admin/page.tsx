"use client";

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import RecycleBinPage from "@/components/pages/admin/RecycleBin";
import AuditLogs from "@/components/pages/admin/AuditLogs";
import { Shield, Trash2, Users, ScrollText } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import UserManagement from "@/components/pages/admin/UserManagement";

function AdminSection({ tab }: { tab: string }) {
  const { user } = useAuth();

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
    case "Recycle Bin":
      return <RecycleBinPage />;
    case "Audit Logs":
      return <AuditLogs />;
    case "User Management":
      return user && user.role === "superadmin" ? (
        <UserManagement />
      ) : (
        <EmptyState
          icon={Shield}
          label={tab}
          description="You do not have permission to access this section."
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
