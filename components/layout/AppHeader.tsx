"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  AppHeader
//  Changes: accepts navSections (RBAC-filtered) and visibleTabs props
//  from CMSLayout so tabs are also role-aware.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  MessageSquare,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { TOKEN, SPRING_FAST, SPRING_MED } from "./tokens";
import { NavAvatar } from "./NavAvatar";
import {
  NAV_SECTIONS,
  type NavId,
  type NavSection,
  type CmsUser,
} from "./nav-data";

// ── PillTab ───────────────────────────────────────────────────────────────────

function PillTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const bg = isActive
    ? TOKEN.secondary
    : hovered
      ? `${TOKEN.accent}18`
      : TOKEN.surface;
  const borderColor = isActive
    ? TOKEN.secondary
    : hovered
      ? TOKEN.accent
      : TOKEN.border;
  const fg = isActive ? "#fff" : hovered ? TOKEN.accent : TOKEN.textSec;

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      role="tab"
      aria-selected={isActive}
      style={{
        position: "relative",
        padding: "6px 16px",
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background: bg,
        color: fg,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer",
        overflow: "hidden",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {isActive && (
        <motion.span
          layoutId="tabBg"
          transition={SPRING_FAST}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            background: TOKEN.secondary,
          }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
    </motion.button>
  );
}

// ── SidebarToggleButton ───────────────────────────────────────────────────────

function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        borderRadius: 10,
        border: `1px solid ${TOKEN.border}`,
        background: TOKEN.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: TOKEN.textSec,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </motion.button>
  );
}

// ── ChatButton ────────────────────────────────────────────────────────────────

function ChatButton({ onClick }: { onClick?: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label="Chats"
      style={{
        position: "relative",
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        border: `1px solid ${TOKEN.border}`,
        background: TOKEN.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: TOKEN.textSec,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <MessageSquare size={16} />
    </motion.button>
  );
}

// ── AvatarDropdown (mobile) ───────────────────────────────────────────────────

function AvatarDropdown({
  user,
  onLogout,
}: {
  user: CmsUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <NavAvatar initials={user.initials} size={34} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="avatar-dropdown"
            initial={{ opacity: 0, scale: 0.93, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -6 }}
            transition={SPRING_MED}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 220,
              background: TOKEN.surface,
              borderRadius: 16,
              border: `1px solid ${TOKEN.border}`,
              boxShadow: "0 12px 40px -8px rgba(15,23,42,0.16)",
              overflow: "hidden",
              transformOrigin: "top right",
              zIndex: 200,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 16px 14px",
                background: TOKEN.bg,
                borderBottom: `1px solid ${TOKEN.border}`,
              }}
            >
              <NavAvatar initials={user.initials} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: TOKEN.textPri,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: TOKEN.textSec,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textTransform: "capitalize",
                  }}
                >
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <div style={{ padding: "8px" }}>
              <motion.button
                whileHover={{ background: TOKEN.dangerBg }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  color: TOKEN.dangerText,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${TOKEN.danger}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <LogOut size={13} color={TOKEN.dangerText} />
                </div>
                Sign out
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AppHeader ─────────────────────────────────────────────────────────────────

export interface AppHeaderProps {
  activeNav: NavId;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onChatOpen?: () => void;
  user: CmsUser;
  isMobile?: boolean;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  /** RBAC-filtered nav sections from CMSLayout */
  navSections?: NavSection[];
  /** RBAC-filtered tabs for the active section */
  visibleTabs?: readonly string[];
}

export function AppHeader({
  activeNav,
  activeTab,
  onTabChange,
  onLogout,
  onChatOpen,
  user,
  isMobile = false,
  sidebarCollapsed = false,
  onSidebarToggle,
  navSections = NAV_SECTIONS as unknown as NavSection[],
  visibleTabs,
}: AppHeaderProps) {
  const section = navSections.find((s) => s.id === activeNav) ?? navSections[0];
  // Fall back to full section tabs if visibleTabs not provided
  const tabs = visibleTabs ?? section?.tabs ?? [];

  if (!section) return null;

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100 }}>
      {/* Status-bar fill (iOS safe area) */}
      <div
        aria-hidden="true"
        style={{ height: "var(--sat, 0px)", background: TOKEN.primary }}
      />

      <div
        style={{
          background: `${TOKEN.bg}f0`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${TOKEN.border}`,
        }}
      >
        {/* Mobile greeting row */}
        {isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 16px 6px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: TOKEN.textPri,
                  lineHeight: 1.3,
                }}
              >
                Hello, {user.name.split(" ")[0]}!
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: TOKEN.textSec,
                  textTransform: "capitalize",
                }}
              >
                {user.role.replace(/_/g, " ")}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <ChatButton onClick={onChatOpen} />
              <NotificationsDropdown />
              <AvatarDropdown user={user} onLogout={onLogout} />
            </div>
          </div>
        )}

        {/* Tabs + actions row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "6px 16px 10px" : "10px 20px",
            minWidth: 0,
          }}
        >
          {!isMobile && onSidebarToggle && (
            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onToggle={onSidebarToggle}
            />
          )}
          {!isMobile && (
            <div
              style={{
                width: 1,
                height: 22,
                background: TOKEN.border,
                flexShrink: 0,
                borderRadius: 1,
              }}
            />
          )}

          {/* Scrollable pill tabs — only role-accessible tabs */}
          <div
            role="tablist"
            aria-label={`${section.label} pages`}
            style={{
              flex: 1,
              display: "flex",
              gap: 6,
              overflowX: "auto",
              scrollbarWidth: "none",
              minWidth: 0,
            }}
          >
            {tabs.map((tab) => (
              <PillTab
                key={tab}
                label={tab}
                isActive={activeTab === tab}
                onClick={() => onTabChange(tab)}
              />
            ))}
          </div>

          {!isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <ChatButton onClick={onChatOpen} />
              <NotificationsDropdown />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
