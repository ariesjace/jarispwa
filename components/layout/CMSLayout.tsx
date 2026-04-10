"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  CMSLayout — full responsive shell
//
//  Desktop  (≥1024 px):  Sidebar (collapsible) + AppHeader + content
//  Mobile   (< 1024 px): AppHeader (greeting + avatar dropdown) + BottomNav + FAB
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
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
        body { margin: 0; font-family: 'Inter', 'DM Sans', system-ui, sans-serif; }
        * { box-sizing: border-box; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
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
          />

          {/* Content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingBottom: isMobile ? 100 : 24,
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
                  style={{ padding: 24, minHeight: "60vh" }}
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
                  style={{ padding: 24, minHeight: "calc(100vh - 200px)" }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── MOBILE: bottom nav + FAB ─────────────────────────────────── */}
        {isMobile && (
          <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
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