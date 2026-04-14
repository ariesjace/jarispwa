"use client";

/**
 * components/layout/CMSShell.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The single persistent shell that wraps ALL CMS sections.
 *
 * KEY CHANGE vs old CMSLayout:
 *   handleNavChange now calls window.history.pushState() instead of
 *   router.push(). This means:
 *   - The URL updates correctly (bookmarks/refresh work)
 *   - Next.js does NOT navigate (no page unmount/remount)
 *   - The sidebar, header, and bottom nav NEVER re-mount
 *   - Bottom nav switching is instant — pure React state update
 *
 * Browser back/forward are handled via popstate listener.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Briefcase,
  FileText,
  Shield,
  BookOpen,
  HelpCircle,
  Megaphone,
  FolderOpen,
  Trash2,
  ScrollText,
  Users,
  Building2,
} from "lucide-react";

import { TOKEN, EASE_OUT } from "./tokens";
import { type NavId } from "./nav-data";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { LogoutModal } from "./LogoutModal";
import { useAuth } from "@/lib/useAuth";
import {
  getAccessibleNavSections,
  getAccessibleTabs,
  getInitials,
} from "@/lib/nav-access";
import { hasAccess } from "@/lib/rbac";
import type { NavSection, CmsUser } from "./nav-data";

// ── Lazy-import heavy section components ────────────────────────────────────
// These are only rendered when the user visits that section/tab.
import AllProductsPage from "@/components/pages/products/AllProducts";
import ProductRequestsPage from "@/components/pages/products/ProductRequests";

// ── Route map ───────────────────────────────────────────────────────────────
const NAV_ROUTES: Record<NavId, string> = {
  products: "/products",
  jobs: "/jobs",
  content: "/content",
  admin: "/admin",
};

// Reverse map: pathname → NavId
function navIdFromPath(path: string): NavId | null {
  for (const [id, route] of Object.entries(NAV_ROUTES)) {
    if (path === route || path.startsWith(route + "/")) {
      return id as NavId;
    }
  }
  return null;
}

// ── Section content components ───────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
}) {
  return (
    <div style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}>
      <Icon size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
      <p style={{ fontSize: 15, fontWeight: 700, color: TOKEN.textPri, marginBottom: 6 }}>
        {label}
      </p>
      {description && <p style={{ fontSize: 13, opacity: 0.7 }}>{description}</p>}
    </div>
  );
}

// Products — memoised so it doesn't re-render on unrelated state changes
const ProductsSection = memo(function ProductsSection({ tab }: { tab: string }) {
  const { user } = useAuth();

  switch (tab) {
    case "All Products":
      return <AllProductsPage />;
    case "Requests":
      if (!user || !hasAccess(user, "write", "products")) {
        return <EmptyState icon={Package} label="No access" />;
      }
      return <ProductRequestsPage />;
    default:
      return <EmptyState icon={Package} label={tab} description="Coming soon." />;
  }
});

const JobsSection = memo(function JobsSection({ tab }: { tab: string }) {
  switch (tab) {
    case "Careers":
      return <EmptyState icon={Building2} label="Careers" description="Manage job postings and open positions." />;
    case "Applications":
      return <EmptyState icon={Users} label="Applications" description="Review and manage job applications." />;
    default:
      return <EmptyState icon={Briefcase} label={tab} description="Coming soon." />;
  }
});

const ContentSection = memo(function ContentSection({ tab }: { tab: string }) {
  switch (tab) {
    case "Blogs":
      return <EmptyState icon={BookOpen} label="Blog Posts" description="Create and manage blog articles." />;
    case "FAQs":
      return <EmptyState icon={HelpCircle} label="FAQs" description="Manage frequently asked questions." />;
    case "Popups":
      return <EmptyState icon={Megaphone} label="Popups" description="Configure promotional popups." />;
    case "Projects":
      return <EmptyState icon={FolderOpen} label="Projects" description="Showcase and manage projects." />;
    default:
      return <EmptyState icon={FileText} label={tab} description="Coming soon." />;
  }
});

const AdminSection = memo(function AdminSection({ tab }: { tab: string }) {
  switch (tab) {
    case "Recycle Bin":
      return <EmptyState icon={Trash2} label="Recycle Bin" description="Restore or permanently delete removed items." />;
    case "Audit Logs":
      return <EmptyState icon={ScrollText} label="Audit Logs" description="View a full history of system actions." />;
    case "User Management":
      return <EmptyState icon={Users} label="User Management" description="Create and manage admin accounts." />;
    default:
      return <EmptyState icon={Shield} label={tab} description="Coming soon." />;
  }
});

// Top-level dispatcher — memoised key prevents AnimatePresence glitches
function SectionContent({ activeNav, activeTab }: { activeNav: NavId; activeTab: string }) {
  switch (activeNav) {
    case "products": return <ProductsSection tab={activeTab} />;
    case "jobs":     return <JobsSection tab={activeTab} />;
    case "content":  return <ContentSection tab={activeTab} />;
    case "admin":    return <AdminSection tab={activeTab} />;
    default:         return null;
  }
}

// ── CMSShell ─────────────────────────────────────────────────────────────────

export interface CMSShellProps {
  /** Initial section derived from the page's URL segment */
  initialNav: NavId;
}

export function CMSShell({ initialNav }: CMSShellProps) {
  const { user, logout } = useAuth();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [activeNav, setActiveNav] = useState<NavId>(initialNav);
  const [activeTab, setActiveTab] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Derived / memoised ─────────────────────────────────────────────────────
  const cmsUser: CmsUser = useMemo(() => {
    if (!user) return { name: "—", role: "—", initials: "?" };
    return { name: user.name, role: user.role, initials: getInitials(user.name) };
  }, [user]);

  const accessibleSections = useMemo<NavSection[]>(() => {
    if (!user) return [];
    return getAccessibleNavSections(user.role);
  }, [user]);

  const visibleTabs = useMemo(
    () => (user ? getAccessibleTabs(activeNav, user.role) : []),
    [activeNav, user],
  );

  // ── Sync tab when section changes ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const tabs = getAccessibleTabs(activeNav, user.role);
    setActiveTab(tabs[0] ?? "");
  }, [activeNav, user]);

  // ── Responsive breakpoint ──────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── Browser back/forward support ──────────────────────────────────────────
  // Since we bypass Next.js routing with pushState, we must handle popstate
  // ourselves so the back button still works correctly.
  useEffect(() => {
    const onPopState = () => {
      const id = navIdFromPath(window.location.pathname);
      if (id) setActiveNav(id);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── KEY: state-only nav change (no router.push!) ───────────────────────────
  const handleNavChange = useCallback((id: NavId) => {
    if (id === activeNav) return; // no-op if already there
    setActiveNav(id);
    // Update URL without triggering Next.js navigation.
    // The page component (sidebar, header, bottom nav) NEVER unmounts.
    window.history.pushState(null, "", NAV_ROUTES[id]);
  }, [activeNav]);

  const handleLogout = useCallback(async () => {
    setLogoutOpen(false);
    await logout();
  }, [logout]);

  // ── Wait until tab resolves ────────────────────────────────────────────────
  if (!activeTab) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        background: TOKEN.bg,
        color: TOKEN.textPri,
        overflow: "hidden",
      }}
    >
      {/* Desktop sidebar — never unmounts */}
      {!isMobile && (
        <Sidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          onLogout={() => setLogoutOpen(true)}
          user={cmsUser}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          navSections={accessibleSections}
        />
      )}

      {/* Main content column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Header with tabs — never unmounts */}
        <AppHeader
          activeNav={activeNav}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={() => setLogoutOpen(true)}
          user={cmsUser}
          isMobile={isMobile}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed((v) => !v)}
          navSections={accessibleSections}
          visibleTabs={visibleTabs}
        />

        {/* Section content — animated on section/tab change */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile
              ? "0 16px calc(64px + var(--sab, 0px))"
              : "0 24px 24px",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeNav}__${activeTab}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={EASE_OUT}
              style={{ padding: isMobile ? 16 : 0, minHeight: "60vh" }}
            >
              <SectionContent activeNav={activeNav} activeTab={activeTab} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile bottom nav — never unmounts */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 110,
            paddingBottom: "var(--sab, 0px)",
            background: TOKEN.surface,
            borderTop: `1px solid ${TOKEN.border}`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <BottomNav
            activeNav={activeNav}
            onNavChange={handleNavChange}
            navSections={accessibleSections}
          />
        </div>
      )}

      {isMobile && <FAB bottomOffset={80} />}

      <LogoutModal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default CMSShell;