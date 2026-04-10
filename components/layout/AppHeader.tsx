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
  CheckCheck, AlertCircle, ShoppingCart, Users,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
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

// ── NotificationsButton ───────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { id: 1, Icon: ShoppingCart, title: "New order received", meta: "Order #ORD-9922 — $240.00", time: "2m ago", unread: true, color: TOKEN.primary },
  { id: 2, Icon: Users, title: "New job application", meta: "Jamie Okonkwo — Senior Eng.", time: "18m ago", unread: true, color: TOKEN.secondary },
  { id: 3, Icon: AlertCircle, title: "Low stock alert", meta: "SKU: TF-PRO-001 — 3 left", time: "1h ago", unread: true, color: "#f59e0b" },
  { id: 4, Icon: CheckCheck, title: "Review approved", meta: "Taskflow Pro — ★★★★★", time: "3h ago", unread: false, color: "#22c55e" },
  { id: 5, Icon: ShoppingCart, title: "Order fulfilled", meta: "Order #ORD-9918 — Shipped", time: "5h ago", unread: false, color: TOKEN.primary },
];

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: `1px solid ${TOKEN.border}`,
          background: open ? `${TOKEN.primary}10` : TOKEN.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: open ? TOKEN.primary : TOKEN.textSec,
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: TOKEN.danger,
              border: `2px solid ${TOKEN.surface}`,
            }}
          />
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, scale: 0.93, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -6 }}
            transition={SPRING_MED}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 320,
              background: TOKEN.surface,
              borderRadius: 18,
              border: `1px solid ${TOKEN.border}`,
              boxShadow: "0 16px 48px -8px rgba(15,23,42,0.16)",
              overflow: "hidden",
              transformOrigin: "top right",
              zIndex: 200,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 12px",
                borderBottom: `1px solid ${TOKEN.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: TOKEN.textPri }}>
                  Notifications
                </p>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: TOKEN.danger,
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={markAllRead}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: TOKEN.primary,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  Mark all read
                </motion.button>
              )}
            </div>

            {/* Items */}
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {items.map((n) => (
                <motion.div
                  key={n.id}
                  whileHover={{ background: TOKEN.bg }}
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x))
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: `1px solid ${TOKEN.border}`,
                    cursor: "pointer",
                    background: n.unread ? `${TOKEN.primary}06` : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `${n.color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <n.Icon size={15} color={n.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12.5,
                          fontWeight: n.unread ? 700 : 600,
                          color: TOKEN.textPri,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.title}
                      </p>
                      {n.unread && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: TOKEN.primary,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11.5,
                        color: TOKEN.textSec,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.meta}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 10.5, color: TOKEN.textSec, opacity: 0.7 }}>
                      {n.time}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 16px" }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(false)}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  borderRadius: 10,
                  border: `1px solid ${TOKEN.border}`,
                  background: TOKEN.bg,
                  color: TOKEN.textSec,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View all notifications
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        background: `${TOKEN.bg}f0`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${TOKEN.border}`,
        /* Safe-area top: header background extends behind the status bar /
           Dynamic Island / Android cutout. Content inside is pushed below it.
           Mirrors React Native's SafeAreaView behaviour exactly. */
        paddingTop: "var(--sat, 0px)",
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
            <NotificationsButton />
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
            <NotificationsButton />
          </div>
        )}
      </div>
    </header>
  );
}