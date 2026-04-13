"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CMSLayout — full responsive shell
//
//  Changes from original:
//  • Reads real user from useAuth() instead of PLACEHOLDER_USER
//  • Filters nav sections and tabs by RBAC (getAccessibleNavSections /
//    getAccessibleTabs from lib/nav-access.ts)
//  • Derives CmsUser shape (name, role, initials) from auth user
//  • Passes filtered nav sections to Sidebar, AppHeader, BottomNav
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import type { NavSection, CmsUser } from "./nav-data";

export interface CMSLayoutProps {
  children?: (ctx: { activeNav: NavId; activeTab: string }) => React.ReactNode;
  onChatOpen?: () => void;
}

export function CMSLayout({ children, onChatOpen }: CMSLayoutProps) {
  const { user, logout } = useAuth();

  // ── Derive CmsUser from real auth user ─────────────────────────────────────
  const cmsUser: CmsUser = useMemo(() => {
    if (!user) return { name: "—", role: "—", initials: "?" };
    return {
      name: user.name,
      role: user.role,
      initials: getInitials(user.name),
    };
  }, [user]);

  // ── RBAC-filtered nav sections ─────────────────────────────────────────────
  const accessibleSections = useMemo<NavSection[]>(() => {
    if (!user) return [];
    return getAccessibleNavSections(user.role);
  }, [user]);

  // ── Active nav — default to first accessible section ──────────────────────
  const [activeNav, setActiveNav] = useState<NavId | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Set initial nav once sections are known
  useEffect(() => {
    if (accessibleSections.length > 0 && !activeNav) {
      const first = accessibleSections[0];
      setActiveNav(first.id);
      const firstTabs = user
        ? getAccessibleTabs(first.id, user.role)
        : first.tabs;
      setActiveTab(firstTabs[0] ?? "");
    }
  }, [accessibleSections, activeNav, user]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleNavChange = (id: NavId) => {
    setActiveNav(id);
    const section = accessibleSections.find((s) => s.id === id);
    if (section) {
      const tabs = user ? getAccessibleTabs(id, user.role) : section.tabs;
      setActiveTab(tabs[0] ?? "");
    }
  };

  // Guard: nothing renders until nav is resolved
  if (!activeNav || !activeTab) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Tabs visible to the current user for the active section
  const visibleTabs = user ? getAccessibleTabs(activeNav, user.role) : [];

  return (
    <>
      <div
        style={{
          height: "100dvh",
          display: "flex",
          background: TOKEN.bg,
          color: TOKEN.textPri,
          overflow: "hidden",
        }}
      >
        {/* ── Desktop sidebar ───────────────────────────────────────── */}
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

        {/* ── Main column ───────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <AppHeader
            activeNav={activeNav}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLogout={() => setLogoutOpen(true)}
            onChatOpen={onChatOpen}
            user={cmsUser}
            isMobile={isMobile}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={() => setSidebarCollapsed((v) => !v)}
            navSections={accessibleSections}
            visibleTabs={visibleTabs}
          />

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
              {children ? (
                <motion.div
                  key={`${activeNav}__${activeTab}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={EASE_OUT}
                  style={{ padding: isMobile ? 16 : 0, minHeight: "60vh" }}
                >
                  {children({ activeNav, activeTab })}
                </motion.div>
              ) : (
                <motion.div
                  key={`${activeNav}__${activeTab}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={EASE_OUT}
                  role="main"
                  style={{
                    padding: isMobile ? 16 : 0,
                    minHeight: "calc(100vh - 200px)",
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Mobile bottom nav ─────────────────────────────────────── */}
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

        {/* ── Logout modal ──────────────────────────────────────────── */}
        <LogoutModal
          isOpen={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onLogout={async () => {
            setLogoutOpen(false);
            await logout();
          }}
        />
      </div>
    </>
  );
}

export default CMSLayout;
