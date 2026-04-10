"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CMSLayout — full responsive shell
//
//  Desktop  (≥1024 px):  Sidebar (controlled collapse) + AppHeader + content
//  Mobile   (< 1024 px): AppHeader (greeting + avatar dropdown) + BottomNav + FAB
//
//  sidebarCollapsed is lifted here so the AppHeader toggle button
//  and the Sidebar itself share the same source of truth.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, EASE_OUT } from "./tokens";
import { NAV_SECTIONS, PLACEHOLDER_USER, type NavId } from "./nav-data";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { LogoutModal } from "./LogoutModal";

export interface CMSLayoutProps {
  children?: (ctx: { activeNav: NavId; activeTab: string }) => React.ReactNode;
  user?: typeof PLACEHOLDER_USER;
  /** Called when the chat button is tapped — wire to your chat route */
  onChatOpen?: () => void;
}

export function CMSLayout({
  children,
  user = PLACEHOLDER_USER,
  onChatOpen,
}: CMSLayoutProps) {
  const [activeNav, setActiveNav] = useState<NavId>("products");
  const [activeTab, setActiveTab] = useState("All Products");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Sidebar collapsed state lifted here so AppHeader toggle is in sync
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleNavChange = (id: NavId) => {
    setActiveNav(id);
    setActiveTab(NAV_SECTIONS.find((s) => s.id === id)!.tabs[0]);
  };

  const handleLogout = () => setLogoutOpen(false); // wire real logout here

  return (
    <>
      <style>{`
        body { font-family: 'Inter', 'DM Sans', system-ui, sans-serif; }
      `}</style>

      <div
        style={{
          height: "100dvh",
          display: "flex",
          background: TOKEN.bg,
          color: TOKEN.textPri,
          overflow: "hidden",
        }}
      >
        {/* ── DESKTOP: collapsible sidebar ─────────────────────────────── */}
        {!isMobile && (
          <Sidebar
            activeNav={activeNav}
            onNavChange={handleNavChange}
            onLogout={() => setLogoutOpen(true)}
            user={user}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        )}

        {/* ── MAIN COLUMN ─────────────────────────────────────────────── */}
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
            user={user}
            isMobile={isMobile}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={() => setSidebarCollapsed((v) => !v)}
          />

          {/* Content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              /* Mobile: clear the bottom nav (64px) + home indicator safe area
                 Desktop: standard breathing room */
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
                  style={{ padding: isMobile ? 16 : 0, minHeight: "calc(100vh - 200px)" }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── MOBILE: bottom nav + FAB ─────────────────────────────────── */}
        {isMobile && (
          /* Safe-area wrapper: sits at the bottom of the viewport and adds
             env(safe-area-inset-bottom) padding so the nav bar clears the
             iOS home indicator and Android gesture bar on all devices. */
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
              /* Subtle backdrop so content scrolling beneath doesn't bleed */
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
          </div>
        )}
        {isMobile && <FAB bottomOffset={80} />}

        {/* ── LOGOUT MODAL ─────────────────────────────────────────────── */}
        <LogoutModal
          isOpen={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onLogout={handleLogout}
        />
      </div>
    </>
  );
}

export default CMSLayout;