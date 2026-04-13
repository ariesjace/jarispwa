"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  AppHeader — single sticky row
//
//  Desktop:  [SidebarToggle] [scrollable pill tabs ···] [Chat] [Notifications]
//  Mobile:   [Greeting]                                  [Chat] [Notif] [Avatar]
//            [scrollable pill tabs ···]
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, MessageSquare, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { TOKEN, SPRING_FAST, SPRING_MED } from "./tokens";
import { NavAvatar } from "./NavAvatar";
import { NAV_SECTIONS, type NavId, type CmsUser } from "./nav-data";

// ── PillTab ───────────────────────────────────────────────────────────────────

interface PillTabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function PillTab({ label, isActive, onClick }: PillTabProps) {
  const [hovered, setHovered] = useState(false);
  const bg = isActive ? TOKEN.secondary : hovered ? `${TOKEN.accent}18` : TOKEN.surface;
  const borderColor = isActive ? TOKEN.secondary : hovered ? TOKEN.accent : TOKEN.border;
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

interface SidebarToggleButtonProps {
  collapsed: boolean;
  onToggle: () => void;
}

function SidebarToggleButton({ collapsed, onToggle }: SidebarToggleButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      onClick={onToggle}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

interface ChatButtonProps {
  onClick?: () => void;
}

function ChatButton({ onClick }: ChatButtonProps) {
  const UNREAD_CHATS = 2;
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={`Chats${UNREAD_CHATS ? ` (${UNREAD_CHATS} unread)` : ""}`}
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
      {UNREAD_CHATS > 0 && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 14,
            height: 14,
            borderRadius: 999,
            background: TOKEN.secondary,
            border: `2px solid ${TOKEN.surface}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            fontWeight: 800,
            color: "#fff",
            padding: "0 2px",
          }}
        >
          {UNREAD_CHATS}
        </span>
      )}
    </motion.button>
  );
}

// ── AvatarDropdown (mobile only) ──────────────────────────────────────────────

interface AvatarDropdownProps {
  user: CmsUser;
  onLogout: () => void;
}

function AvatarDropdown({ user, onLogout }: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
                  }}
                >
                  {user.role}
                </p>
              </div>
            </div>
            <div style={{ padding: "8px" }}>
              <motion.button
                whileHover={{ background: TOKEN.dangerBg }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setOpen(false); onLogout(); }}
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
  /** Desktop only — controlled by CMSLayout */
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
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
}: AppHeaderProps) {
  const section = NAV_SECTIONS.find((s) => s.id === activeNav)!;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        // No top-level background — the two zones below each own their background
      }}
    >
      {/* ── Status-bar fill ──────────────────────────────────────────────
           Height = env(safe-area-inset-top) — exactly the status bar zone.
           Background = TOKEN.primary (brand blue) so white system icons
           (clock, battery, signal) remain legible. On devices with no notch
           --sat resolves to 0px and this div collapses to nothing.
           This mirrors React Native's:
             <StatusBar barStyle="light-content" backgroundColor={TOKEN.primary} />
      ─────────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          height: "var(--sat, 0px)",
          background: TOKEN.primary,
        }}
      />

      {/* ── Header content ───────────────────────────────────────────── */}
      <div
        style={{
          background: `${TOKEN.bg}f0`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${TOKEN.border}`,
        }}
      >
        {/* ── Mobile: greeting row ─────────────────────────────────────── */}
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
              <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}>
                {user.role}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <ChatButton onClick={onChatOpen} />
              <NotificationsDropdown />
              <AvatarDropdown user={user} onLogout={onLogout} />
            </div>
          </div>
        )}

        {/* ── Single tab + actions row ─────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "6px 16px 10px" : "10px 20px",
            minWidth: 0,
          }}
        >
          {/* Sidebar toggle — desktop only */}
          {!isMobile && onSidebarToggle && (
            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onToggle={onSidebarToggle}
            />
          )}

          {/* Divider — desktop only */}
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

          {/* Scrollable pill tabs — takes all remaining space */}
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
            {section.tabs.map((tab) => (
              <PillTab
                key={tab}
                label={tab}
                isActive={activeTab === tab}
                onClick={() => onTabChange(tab)}
              />
            ))}
          </div>

          {/* Right actions — desktop only (mobile handled in greeting row) */}
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