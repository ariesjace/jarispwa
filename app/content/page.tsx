"use client";

import React from "react";
import { RouteProtection } from "@/components/route-protection";
import { CMSLayout, TOKEN } from "@/components/layout";
import {
  FileText,
  BookOpen,
  HelpCircle,
  Megaphone,
  FolderOpen,
} from "lucide-react";

function ContentSection({ tab }: { tab: string }) {
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
    case "Blogs":
      return (
        <EmptyState
          icon={BookOpen}
          label="Blog Posts"
          description="Create and manage blog articles."
        />
      );
    case "FAQs":
      return (
        <EmptyState
          icon={HelpCircle}
          label="FAQs"
          description="Manage frequently asked questions."
        />
      );
    case "Popups":
      return (
        <EmptyState
          icon={Megaphone}
          label="Popups"
          description="Configure promotional popups."
        />
      );
    case "Projects":
      return (
        <EmptyState
          icon={FolderOpen}
          label="Projects"
          description="Showcase and manage projects."
        />
      );
    default:
      return (
        <EmptyState
          icon={FileText}
          label={tab}
          description="This section is under construction."
        />
      );
  }
}

export default function ContentPage() {
  return (
    <RouteProtection requiredRoutes={["/content"]}>
      <CMSLayout currentNavId="content">
        {({ activeTab }) => (
          <div style={{ width: "100%", animation: "fadeIn 0.4s ease-out" }}>
            <ContentSection tab={activeTab} />
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
