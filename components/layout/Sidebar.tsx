"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Sidebar — desktop collapsible left nav
//  Expanded: 17.5rem  |  Collapsed: 72px (icons only)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChevronRight, Zap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { TOKEN, SPRING_FAST, SPRING_MED } from "./tokens";
import { NavAvatar } from "./NavAvatar";
import { NAV_SECTIONS, type NavId, type NavSection, type CmsUser } from "./nav-data";

const EXPANDED_W = "17.5rem";
const COLLAPSED_W = "72px";

// ── SideNavItem ───────────────────────────────────────────────────────────────

interface SideNavItemProps {
  section: NavSection;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function SideNavItem({ section, isActive, collapsed, onClick }: SideNavItemProps) {
  const [hovered, setHovered] = useState(false);

  const fg = isActive ? TOKEN.secondary : hovered ? TOKEN.accent : TOKEN.textSec;
  const iconBg = isActive ? `${TOKEN.secondary}1c` : hovered ? `${TOKEN.accent}18` : `${TOKEN.textSec}10`;

  return (
    <motion.button
      role="menuitem"
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? section.label : undefined}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={collapsed ? { scale: 1.06 } : { x: 3 }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 12,
        padding: collapsed ? "10px 0" : "11px 16px",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        background: isActive ? `${TOKEN.secondary}13` : "transparent",
        color: fg,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {/* Active bar */}
      {isActive && (
        <motion.span
          layoutId="sidebarBar"
          transition={SPRING_FAST}
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 24,
            borderRadius: "0 4px 4px 0",
            background: TOKEN.secondary,
          }}
        />
      )}

      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <section.Icon size={16} />
      </div>

      {/* Label — hidden when collapsed */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: 13.5, fontWeight: 600, flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}
          >
            {section.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Chevron */}
      <AnimatePresence initial={false}>
        {isActive && !collapsed && (
          <motion.span
            key="chevron"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight size={13} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export interface SidebarProps {
  activeNav: NavId;
  onNavChange: (id: NavId) => void;
  onLogout: () => void;
  user: CmsUser;
}

export function Sidebar({ activeNav, onNavChange, onLogout, user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      role="navigation"
      aria-label="Main navigation"
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={SPRING_MED}
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        margin: 12,
        borderRadius: 18,
        background: TOKEN.surface,
        border: `1px solid ${TOKEN.border}`,
        boxShadow: "0 4px 24px -4px rgba(15,23,42,0.09), 0 1px 4px rgba(15,23,42,0.04)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* ── Brand + collapse toggle ──────────────────────────────────── */}
      <div
        style={{
          padding: collapsed ? "20px 0" : "20px 16px",
          borderBottom: `1px solid ${TOKEN.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 10,
          transition: "padding 0.2s",
        }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.secondary})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={15} color="#fff" />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="brand-text"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: TOKEN.textPri, letterSpacing: "-0.01em" }}>
                  JARIS CMS
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: TOKEN.textSec }}>
                  Admin Dashboard
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.button
              key="collapse-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${TOKEN.border}`,
                background: TOKEN.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: TOKEN.textSec,
                flexShrink: 0,
              }}
            >
              <PanelLeftClose size={14} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Expand toggle (collapsed state) */}
        <AnimatePresence initial={false}>
          {collapsed && (
            <motion.button
              key="expand-btn"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              style={{
                position: "absolute",
                top: 20,
                left: "50%",
                transform: "translateX(-50%)",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${TOKEN.border}`,
                background: TOKEN.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: TOKEN.textSec,
              }}
            >
              <PanelLeftOpen size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav items ───────────────────────────────────────────────── */}
      <nav
        role="menu"
        style={{
          flex: 1,
          padding: collapsed ? "12px 8px" : "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          transition: "padding 0.2s",
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <SideNavItem
            key={section.id}
            section={section}
            isActive={activeNav === section.id}
            collapsed={collapsed}
            onClick={() => onNavChange(section.id)}
          />
        ))}
      </nav>

      {/* ── User footer ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: collapsed ? "12px 8px" : "12px",
          borderTop: `1px solid ${TOKEN.border}`,
          transition: "padding 0.2s",
        }}
      >
        {collapsed ? (
          /* Collapsed: just avatar + logout stacked */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <NavAvatar initials={user.initials} size={34} />
            <motion.button
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.88 }}
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "none",
                background: `${TOKEN.danger}10`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: TOKEN.dangerText,
              }}
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        ) : (
          /* Expanded: full user row */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: TOKEN.bg,
            }}
          >
            <NavAvatar initials={user.initials} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TOKEN.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.role}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.14, color: TOKEN.danger }}
              whileTap={{ scale: 0.88 }}
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: TOKEN.textSec,
                flexShrink: 0,
              }}
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}