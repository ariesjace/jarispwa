"use client";

/**
 * JARIS CMS — Main Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Composes the full CMS shell and renders per-nav/tab content via the
 * CMSLayout render-prop pattern.
 *
 * Add real Firebase / API calls inside each *Section component.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  CMSLayout,
  TOKEN,
  type NavId,
} from "@/components/layout";

import {
  Package,
  Briefcase,
  FileText,
  Shield,
  LayoutGrid,
  Inbox,
  ShoppingBag,
  Star,
  Trash2,
  Users,
  Rss,
  HelpCircle,
  Layers,
  FolderOpen,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED UI ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

function PageShell({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ width: "100%" }}>
      {/* Hero strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "24px 0 28px",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `${accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={22} color={accent} />
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: TOKEN.textPri,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: TOKEN.textSec }}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Content slot */}
      {children}
    </div>
  );
}

/** Generic empty-state card for unbuilt tabs */
function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        border: `1.5px dashed ${TOKEN.border}`,
        borderRadius: 18,
        padding: "56px 32px",
        textAlign: "center",
        color: TOKEN.textSec,
        background: TOKEN.surface,
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: TOKEN.textPri }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 12.5 }}>
        This section is ready for your feature content.
      </p>
    </div>
  );
}

/** Stat card widget */
function StatCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: TOKEN.surface,
        border: `1px solid ${TOKEN.border}`,
        borderRadius: 16,
        padding: "20px 22px",
        flex: "1 1 160px",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: TOKEN.textSec, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, color: TOKEN.textPri, letterSpacing: "-0.03em" }}>
        {value}
      </p>
      {delta && (
        <p style={{ margin: 0, fontSize: 11.5, color: accent, fontWeight: 600 }}>
          {delta}
        </p>
      )}
    </div>
  );
}

/** Simple data row */
function DataRow({ label, meta, badge, badgeColor }: { label: string; meta: string; badge?: string; badgeColor?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderBottom: `1px solid ${TOKEN.border}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: TOKEN.textPri }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: TOKEN.textSec }}>{meta}</p>
      </div>
      {badge && (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: `${badgeColor ?? TOKEN.primary}18`,
            color: badgeColor ?? TOKEN.primary,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: TOKEN.surface,
        border: `1px solid ${TOKEN.border}`,
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 18px",
        borderBottom: `1px solid ${TOKEN.border}`,
      }}
    >
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: TOKEN.textPri }}>{title}</p>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: TOKEN.textSec,
            background: TOKEN.bg,
            border: `1px solid ${TOKEN.border}`,
            borderRadius: 999,
            padding: "2px 9px",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCTS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function ProductsSection({ tab }: { tab: string }) {
  if (tab === "All Products") {
    return (
      <PageShell
        icon={Package}
        title="All Products"
        subtitle="Manage your full product catalogue"
        accent={TOKEN.primary}
      >
        {/* Stats row */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total SKUs" value="1,248" delta="↑ 32 this month" accent="#22c55e" />
          <StatCard label="Active" value="1,094" accent={TOKEN.primary} />
          <StatCard label="Out of Stock" value="154" delta="↓ 8 from last week" accent="#f59e0b" />
          <StatCard label="Pending Review" value="23" accent={TOKEN.secondary} />
        </div>

        {/* Recent products */}
        <Card>
          <CardHeader title="Recent Products" count={12} />
          {[
            { name: "Taskflow Pro Seat", sku: "TF-PRO-001", badge: "Active", color: "#22c55e" },
            { name: "Analytics Add-on", sku: "TF-ANA-002", badge: "Draft", color: "#f59e0b" },
            { name: "Shopify Connector", sku: "SH-CON-001", badge: "Active", color: "#22c55e" },
            { name: "Enterprise Bundle", sku: "ENT-BUN-010", badge: "Active", color: "#22c55e" },
            { name: "Support Tier – Gold", sku: "SUP-GLD-003", badge: "Archived", color: TOKEN.textSec },
          ].map((p) => (
            <DataRow key={p.sku} label={p.name} meta={p.sku} badge={p.badge} badgeColor={p.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "Orders") {
    return (
      <PageShell
        icon={ShoppingBag}
        title="Orders"
        subtitle="Track and manage customer orders"
        accent="#f59e0b"
      >
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total Orders" value="4,821" delta="↑ 12% vs last month" accent="#22c55e" />
          <StatCard label="Pending" value="38" accent="#f59e0b" />
          <StatCard label="Fulfilled" value="4,700" accent={TOKEN.primary} />
          <StatCard label="Refunded" value="83" accent={TOKEN.danger} />
        </div>
        <Card>
          <CardHeader title="Recent Orders" count={38} />
          {[
            { name: "#ORD-9921 — Alex Rivera", meta: "2 items · $420.00", badge: "Pending", color: "#f59e0b" },
            { name: "#ORD-9920 — Sam Chen", meta: "1 item  · $89.00", badge: "Fulfilled", color: "#22c55e" },
            { name: "#ORD-9919 — Maria Santos", meta: "4 items · $1,240.00", badge: "Fulfilled", color: "#22c55e" },
            { name: "#ORD-9918 — Jordan Lee", meta: "1 item  · $59.00", badge: "Refunded", color: TOKEN.danger },
          ].map((o) => (
            <DataRow key={o.name} label={o.name} meta={o.meta} badge={o.badge} badgeColor={o.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "Reviews") {
    return (
      <PageShell icon={Star} title="Reviews" subtitle="Customer feedback and ratings" accent="#f59e0b">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Avg Rating" value="4.7★" delta="Based on 2,340 reviews" accent="#f59e0b" />
          <StatCard label="5 Star" value="1,820" accent="#22c55e" />
          <StatCard label="Pending" value="14" accent={TOKEN.primary} />
          <StatCard label="Flagged" value="3" accent={TOKEN.danger} />
        </div>
        <Card>
          <CardHeader title="Latest Reviews" count={14} />
          {[
            { name: "\"Absolutely love the product!\"", meta: "Taskflow Pro · ★★★★★", badge: "Published", color: "#22c55e" },
            { name: "\"Good but onboarding was rough\"", meta: "Analytics Add-on · ★★★★", badge: "Pending", color: "#f59e0b" },
            { name: "\"Does not work on Safari\"", meta: "Shopify Connector · ★★", badge: "Flagged", color: TOKEN.danger },
          ].map((r) => (
            <DataRow key={r.name} label={r.name} meta={r.meta} badge={r.badge} badgeColor={r.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  // All other product tabs → generic empty state
  return (
    <PageShell icon={Package} title={tab} subtitle="Products › " accent={TOKEN.primary}>
      <EmptyState label={tab} />
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JOBS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function JobsSection({ tab }: { tab: string }) {
  if (tab === "Applications") {
    return (
      <PageShell icon={Inbox} title="Applications" subtitle="Review and process job applicants" accent={TOKEN.secondary}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total" value="284" delta="↑ 18 this week" accent="#22c55e" />
          <StatCard label="Under Review" value="42" accent={TOKEN.secondary} />
          <StatCard label="Shortlisted" value="11" accent={TOKEN.primary} />
          <StatCard label="Rejected" value="231" accent={TOKEN.textSec} />
        </div>
        <Card>
          <CardHeader title="Recent Applicants" count={42} />
          {[
            { name: "Jamie Okonkwo", meta: "Senior Engineer · Applied 2 days ago", badge: "Shortlisted", color: TOKEN.primary },
            { name: "Priya Mehta", meta: "Product Designer · Applied 3 days ago", badge: "In Review", color: TOKEN.secondary },
            { name: "Lucas Ferreira", meta: "DevOps Lead · Applied 5 days ago", badge: "In Review", color: TOKEN.secondary },
            { name: "Yuki Tanaka", meta: "Data Analyst · Applied 1 week ago", badge: "Rejected", color: TOKEN.textSec },
          ].map((a) => (
            <DataRow key={a.name} label={a.name} meta={a.meta} badge={a.badge} badgeColor={a.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "Careers") {
    return (
      <PageShell icon={Briefcase} title="Careers" subtitle="Active and draft job postings" accent={TOKEN.secondary}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Open Roles" value="8" delta="2 added this month" accent="#22c55e" />
          <StatCard label="Draft" value="3" accent="#f59e0b" />
          <StatCard label="Closed" value="24" accent={TOKEN.textSec} />
        </div>
        <Card>
          <CardHeader title="Active Postings" count={8} />
          {[
            { name: "Senior Full-Stack Engineer", meta: "Remote · Full-time", badge: "Open", color: "#22c55e" },
            { name: "Product Designer", meta: "Manila · Full-time", badge: "Open", color: "#22c55e" },
            { name: "Growth Marketing Lead", meta: "Remote · Contract", badge: "Draft", color: "#f59e0b" },
            { name: "Customer Success Manager", meta: "Singapore · Full-time", badge: "Open", color: "#22c55e" },
          ].map((j) => (
            <DataRow key={j.name} label={j.name} meta={j.meta} badge={j.badge} badgeColor={j.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  return <PageShell icon={Briefcase} title={tab} subtitle="Jobs" accent={TOKEN.secondary}><EmptyState label={tab} /></PageShell>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTENT SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function ContentSection({ tab }: { tab: string }) {
  if (tab === "Blogs") {
    return (
      <PageShell icon={Rss} title="Blogs" subtitle="Manage editorial content and posts" accent={TOKEN.accent}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Published" value="142" delta="↑ 6 this month" accent="#22c55e" />
          <StatCard label="Drafts" value="19" accent="#f59e0b" />
          <StatCard label="Scheduled" value="7" accent={TOKEN.primary} />
        </div>
        <Card>
          <CardHeader title="Recent Posts" count={7} />
          {[
            { name: "Top 10 Shopify Automations in 2026", meta: "Published · Apr 9", badge: "Published", color: "#22c55e" },
            { name: "How We Built Our New Analytics Dashboard", meta: "Draft · Apr 8", badge: "Draft", color: "#f59e0b" },
            { name: "Product Update: Taskflow 3.2", meta: "Scheduled · Apr 12", badge: "Scheduled", color: TOKEN.primary },
          ].map((b) => (
            <DataRow key={b.name} label={b.name} meta={b.meta} badge={b.badge} badgeColor={b.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "FAQs") {
    return (
      <PageShell icon={HelpCircle} title="FAQs" subtitle="Help centre articles and answers" accent={TOKEN.accent}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total FAQs" value="89" accent={TOKEN.accent} />
          <StatCard label="Published" value="76" accent="#22c55e" />
          <StatCard label="Needs Review" value="13" accent="#f59e0b" />
        </div>
        <Card>
          <CardHeader title="Recent FAQs" count={13} />
          {[
            { name: "How do I reset my password?", meta: "Account · 4.9k views", badge: "Published", color: "#22c55e" },
            { name: "Can I export my data?", meta: "Data · 2.1k views", badge: "Needs Review", color: "#f59e0b" },
            { name: "What payment methods are supported?", meta: "Billing · 3.4k views", badge: "Published", color: "#22c55e" },
          ].map((f) => (
            <DataRow key={f.name} label={f.name} meta={f.meta} badge={f.badge} badgeColor={f.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "Projects") {
    return (
      <PageShell icon={FolderOpen} title="Projects" subtitle="Feature and content project tracker" accent={TOKEN.accent}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Active" value="6" delta="2 due this week" accent={TOKEN.primary} />
          <StatCard label="Completed" value="31" accent="#22c55e" />
          <StatCard label="On Hold" value="4" accent="#f59e0b" />
        </div>
        <Card>
          <CardHeader title="Active Projects" count={6} />
          {[
            { name: "Q2 Content Calendar", meta: "Due Apr 15 · 4 members", badge: "On Track", color: "#22c55e" },
            { name: "SEO Refresh — Blog", meta: "Due Apr 30 · 2 members", badge: "On Track", color: "#22c55e" },
            { name: "Case Studies Series", meta: "Due May 5  · 3 members", badge: "At Risk", color: "#f59e0b" },
            { name: "Help Centre Rewrite", meta: "Due May 12 · 5 members", badge: "On Hold", color: TOKEN.textSec },
          ].map((p) => (
            <DataRow key={p.name} label={p.name} meta={p.meta} badge={p.badge} badgeColor={p.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  return <PageShell icon={FileText} title={tab} subtitle="Content" accent={TOKEN.accent}><EmptyState label={tab} /></PageShell>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AdminSection({ tab }: { tab: string }) {
  if (tab === "Recycle Bin") {
    return (
      <PageShell icon={Trash2} title="Recycle Bin" subtitle="Deleted items pending permanent removal" accent={TOKEN.danger}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Items" value="17" delta="Auto-deletes in 30 days" accent={TOKEN.danger} />
          <StatCard label="Products" value="9" accent={TOKEN.textSec} />
          <StatCard label="Content" value="5" accent={TOKEN.textSec} />
          <StatCard label="Users" value="3" accent={TOKEN.textSec} />
        </div>
        <Card>
          <CardHeader title="Deleted Items" count={17} />
          {[
            { name: "SKU: TF-OLD-099", meta: "Product · Deleted Apr 1", badge: "29d left", color: TOKEN.danger },
            { name: "Blog: \"2024 in Review\"", meta: "Content · Deleted Apr 3", badge: "27d left", color: "#f59e0b" },
            { name: "User: bob@example.com", meta: "Account · Deleted Apr 8", badge: "22d left", color: "#f59e0b" },
          ].map((i) => (
            <DataRow key={i.name} label={i.name} meta={i.meta} badge={i.badge} badgeColor={i.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  if (tab === "User Management") {
    return (
      <PageShell icon={Users} title="User Management" subtitle="Accounts, roles and permissions" accent={TOKEN.secondary}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <StatCard label="Total Users" value="38" delta="3 pending invite" accent={TOKEN.secondary} />
          <StatCard label="Admins" value="4" accent={TOKEN.danger} />
          <StatCard label="Editors" value="14" accent={TOKEN.primary} />
          <StatCard label="Viewers" value="20" accent={TOKEN.textSec} />
        </div>
        <Card>
          <CardHeader title="All Users" count={38} />
          {[
            { name: "Alex Rivera", meta: "alex@jaris.io · Director / Sales", badge: "Admin", color: TOKEN.danger },
            { name: "Sam Chen", meta: "sam@jaris.io · Engineering Lead", badge: "Admin", color: TOKEN.danger },
            { name: "Priya Mehta", meta: "priya@jaris.io · Product Designer", badge: "Editor", color: TOKEN.primary },
            { name: "Lucas Ferreira", meta: "lucas@jaris.io · DevOps", badge: "Editor", color: TOKEN.primary },
            { name: "Yuki Tanaka", meta: "yuki@jaris.io · Analyst", badge: "Viewer", color: TOKEN.textSec },
          ].map((u) => (
            <DataRow key={u.name} label={u.name} meta={u.meta} badge={u.badge} badgeColor={u.color} />
          ))}
        </Card>
      </PageShell>
    );
  }

  return <PageShell icon={Shield} title={tab} subtitle="Admin" accent={TOKEN.danger}><EmptyState label={tab} /></PageShell>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTE RESOLVER
//  Maps activeNav + activeTab → the right section component
// ═══════════════════════════════════════════════════════════════════════════════

function resolveSection(nav: NavId, tab: string) {
  switch (nav) {
    case "products": return <ProductsSection tab={tab} />;
    case "jobs": return <JobsSection tab={tab} />;
    case "content": return <ContentSection tab={tab} />;
    case "admin": return <AdminSection tab={tab} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Page() {
  return (
    <CMSLayout>
      {({ activeNav, activeTab }) => resolveSection(activeNav, activeTab)}
    </CMSLayout>
  );
}