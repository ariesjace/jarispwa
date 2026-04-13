"use client";

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import { Briefcase, Users, Building2 } from "lucide-react";

function JobsSection({ tab }: { tab: string }) {
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
    case "Careers":
      return (
        <EmptyState
          icon={Building2}
          label="Careers"
          description="Manage job postings and open positions."
        />
      );
    case "Applications":
      return (
        <EmptyState
          icon={Users}
          label="Applications"
          description="Review and manage job applications."
        />
      );
    default:
      return (
        <EmptyState
          icon={Briefcase}
          label={tab}
          description="This section is under construction."
        />
      );
  }
}

export default function JobsPage() {
  return (
    <RouteProtection requiredRoutes={["/jobs"]}>
      <CMSLayout currentNavId="jobs">
        {({ activeTab }) => (
          <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
            <JobsSection tab={activeTab} />
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
