"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, EASE_OUT } from "./tokens";
import { type NavId } from "./nav-data";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { LogoutModal } from "./LogoutModal";
import { FABProvider, useFABContext } from "./FABContext";
import { useAuth } from "@/lib/useAuth";
import {
  getAccessibleNavSections,
  getAccessibleTabs,
  getInitials,
} from "@/lib/nav-access";
import type { NavSection, CmsUser } from "./nav-data";

const NAV_ROUTES: Record<NavId, string> = {
  products: "/products",
  jobs: "/jobs",
  content: "/content",
  admin: "/admin",
};

export interface CMSLayoutProps {
  /** Which nav section this page represents — set by each root page */
  currentNavId: NavId;
  children?: (ctx: { activeNav: NavId; activeTab: string }) => React.ReactNode;
  onChatOpen?: () => void;
}

// ─── Inner layout (reads FAB context) ────────────────────────────────────────
// Split from the outer wrapper so useFABContext() has access to the provider.

function CMSLayoutInner({
  currentNavId,
  children,
  onChatOpen,
}: CMSLayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { actions: fabActions } = useFABContext();

  const cmsUser: CmsUser = useMemo(() => {
    if (!user) return { name: "—", role: "—", initials: "?" };
    return {
      name: user.name,
      role: user.role,
      initials: getInitials(user.name),
    };
  }, [user]);

  const accessibleSections = useMemo<NavSection[]>(() => {
    if (!user) return [];
    return getAccessibleNavSections(user.role);
  }, [user]);

  // Active tab resets when the nav section changes
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    if (user) {
      const tabs = getAccessibleTabs(currentNavId, user.role);
      setActiveTab(tabs[0] ?? "");
    }
  }, [currentNavId, user]);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleNavChange = (id: NavId) => {
    router.push(NAV_ROUTES[id]);
  };

  const visibleTabs = user ? getAccessibleTabs(currentNavId, user.role) : [];

  if (!activeTab) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
        {/* Desktop sidebar */}
        {!isMobile && (
          <Sidebar
            activeNav={currentNavId}
            onNavChange={handleNavChange}
            onLogout={() => setLogoutOpen(true)}
            user={cmsUser}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            navSections={accessibleSections}
          />
        )}

        {/* Main column */}
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
            activeNav={currentNavId}
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
              {children && (
                <motion.div
                  key={`${currentNavId}__${activeTab}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={EASE_OUT}
                  style={{ padding: isMobile ? 16 : 0, minHeight: "60vh" }}
                >
                  {children({ activeNav: currentNavId, activeTab })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile bottom nav */}
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
              activeNav={currentNavId}
              onNavChange={handleNavChange}
              navSections={accessibleSections}
            />
          </div>
        )}

        {/*
         * Context-driven FAB — only rendered on mobile when a page has
         * registered actions via usePageFAB(). Pages that don't call
         * usePageFAB get no FAB at all.
         */}
        {isMobile && fabActions.length > 0 && (
          <FAB actions={fabActions} bottomOffset={80} />
        )}

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

// ─── Public export — wraps inner layout in FABProvider ────────────────────────

export function CMSLayout(props: CMSLayoutProps) {
  return (
    <FABProvider>
      <CMSLayoutInner {...props} />
    </FABProvider>
  );
}

export default CMSLayout;