"use client";

/**
 * JARIS CMS — Layout System
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure UI implementation. No Firebase, no API calls, no business logic.
 * Drop-in layout shell ready for future feature injection.
 *
 * Exports:
 *   default        → CMSLayout  (the full responsive shell)
 *   Sidebar        → desktop-only fixed sidebar
 *   AppHeader      → sticky header with scrollable page tabs
 *   BottomNav      → mobile-only fixed bottom navigation
 *   FAB            → floating action button with speed-dial
 *   LogoutModal    → animated confirmation modal (UI only)
 *   NavAvatar      → user avatar pill component
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Briefcase,
  FileText,
  Shield,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Plus,
  Search,
  Bell,
  Zap,
  Trash2,
  Users,
  AlertTriangle,
  LayoutGrid,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN = {
  primary:    "#2563EB",
  secondary:  "#4F46E5",
  accent:     "#06B6D4",
  bg:         "#F8FAFC",
  surface:    "#FFFFFF",
  textPri:    "#0F172A",
  textSec:    "#64748B",
  border:     "#E2E8F0",
  borderHov:  "#CBD5E1",
  danger:     "#EF4444",
  dangerBg:   "#FEF2F2",
  dangerText: "#B91C1C",
} as const;

// spring presets
const SPRING_FAST  = { type: "spring" as const, stiffness: 420, damping: 32 };
const SPRING_MED   = { type: "spring" as const, stiffness: 350, damping: 30 };
const EASE_OUT     = { duration: 0.2, ease: "easeOut" as const };

// ═══════════════════════════════════════════════════════════════════════════════
//  NAV DATA
// ═══════════════════════════════════════════════════════════════════════════════

export type NavId = "products" | "jobs" | "content" | "admin";

export interface NavSection {
  id:    NavId;
  label: string;
  Icon:  React.ElementType;
  tabs:  readonly string[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "products",
    label: "Products",
    Icon: Package,
    tabs: [
      "All Products", "Taskflow",     "Shopify",    "Requests",
      "Applications", "Brands",       "Families",   "Orders",
      "Reviews",      "Solutions",    "Series",     "Specs",
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    Icon: Briefcase,
    tabs: ["Applications", "Careers"],
  },
  {
    id: "content",
    label: "Content",
    Icon: FileText,
    tabs: ["Blogs", "FAQs", "Popups", "Projects"],
  },
  {
    id: "admin",
    label: "Admin",
    Icon: Shield,
    tabs: ["Recycle Bin", "User Management"],
  },
] as const;

const FAB_QUICK_ACTIONS = [
  { id: "search",  label: "Search",    Icon: Search,     color: TOKEN.primary   },
  { id: "add",     label: "Add New",   Icon: Plus,       color: TOKEN.secondary },
  { id: "alerts",  label: "Alerts",    Icon: Bell,       color: TOKEN.accent    },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
//  PLACEHOLDER USER (UI ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

const PLACEHOLDER_USER = {
  name:     "Alex Rivera",
  role:     "Director / Sales",
  initials: "AR",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
//  ATOM: NavAvatar
// ═══════════════════════════════════════════════════════════════════════════════

interface NavAvatarProps {
  initials: string;
  size?:    number;
}

export function NavAvatar({ initials, size = 36 }: NavAvatarProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width:           size,
        height:          size,
        borderRadius:    10,
        background:      `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.accent})`,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        color:           "#fff",
        fontSize:        size * 0.34,
        fontWeight:      700,
        flexShrink:      0,
        userSelect:      "none",
        letterSpacing:   "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ATOM: SideNavItem
// ═══════════════════════════════════════════════════════════════════════════════

interface SideNavItemProps {
  section:  NavSection;
  isActive: boolean;
  onClick:  () => void;
}

function SideNavItem({ section, isActive, onClick }: SideNavItemProps) {
  const [hovered, setHovered] = useState(false);

  const fg = isActive
    ? TOKEN.secondary
    : hovered
    ? TOKEN.accent
    : TOKEN.textSec;

  const iconBg = isActive
    ? `${TOKEN.secondary}1c`
    : hovered
    ? `${TOKEN.accent}18`
    : `${TOKEN.textSec}10`;

  return (
    <motion.button
      role="menuitem"
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
      style={{
        position:        "relative",
        width:           "100%",
        display:         "flex",
        alignItems:      "center",
        gap:             12,
        padding:         "11px 16px",
        borderRadius:    12,
        border:          "none",
        cursor:          "pointer",
        textAlign:       "left",
        background:      isActive ? `${TOKEN.secondary}13` : "transparent",
        color:           fg,
        transition:      "background 0.15s, color 0.15s",
      }}
    >
      {/* Active left-bar indicator */}
      {isActive && (
        <motion.span
          layoutId="sidebarBar"
          transition={SPRING_FAST}
          style={{
            position:     "absolute",
            left:         0,
            top:          "50%",
            transform:    "translateY(-50%)",
            width:        3,
            height:       24,
            borderRadius: "0 4px 4px 0",
            background:   TOKEN.secondary,
          }}
        />
      )}

      {/* Icon container */}
      <div
        style={{
          width:           32,
          height:          32,
          borderRadius:    8,
          background:      iconBg,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          flexShrink:      0,
          transition:      "background 0.15s",
        }}
      >
        <section.Icon size={16} />
      </div>

      <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>
        {section.label}
      </span>

      {isActive && (
        <ChevronRight size={13} style={{ opacity: 0.4 }} />
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ATOM: PillTab
// ═══════════════════════════════════════════════════════════════════════════════

interface PillTabProps {
  label:    string;
  isActive: boolean;
  onClick:  () => void;
}

function PillTab({ label, isActive, onClick }: PillTabProps) {
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
        position:       "relative",
        padding:        "6px 16px",
        borderRadius:   999,
        border:         `1px solid ${borderColor}`,
        background:     bg,
        color:          fg,
        fontSize:       12.5,
        fontWeight:     600,
        whiteSpace:     "nowrap",
        flexShrink:     0,
        cursor:         "pointer",
        overflow:       "hidden",
        transition:     "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {isActive && (
        <motion.span
          layoutId="tabBg"
          transition={SPRING_FAST}
          style={{
            position:     "absolute",
            inset:        0,
            borderRadius: 999,
            background:   TOKEN.secondary,
          }}
        />
      )}
      <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: LogoutModal
// ═══════════════════════════════════════════════════════════════════════════════

interface LogoutModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onLogout: () => void;
}

export function LogoutModal({ isOpen, onClose, onLogout }: LogoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="logout-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position:   "fixed",
              inset:      0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex:     200,
            }}
          />

          {/* Dialog */}
          <div
            style={{
              position:       "fixed",
              inset:          0,
              zIndex:         201,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              padding:        24,
              pointerEvents:  "none",
            }}
          >
            <motion.div
              key="logout-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.88, y: 20 }}
              transition={SPRING_MED}
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirm logout"
              style={{
                pointerEvents: "auto",
                width:         "100%",
                maxWidth:      360,
                background:    TOKEN.surface,
                borderRadius:  20,
                border:        `1px solid ${TOKEN.border}`,
                boxShadow:     "0 24px 64px -12px rgba(15,23,42,0.22)",
                padding:       28,
              }}
            >
              {/* Icon */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div
                  style={{
                    width:          52,
                    height:         52,
                    borderRadius:   14,
                    background:     TOKEN.dangerBg,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                  }}
                >
                  <AlertTriangle size={24} color={TOKEN.danger} />
                </div>
              </div>

              <p
                style={{
                  fontSize:    16,
                  fontWeight:  700,
                  textAlign:   "center",
                  color:       TOKEN.textPri,
                  margin:      "0 0 8px",
                }}
              >
                Sign out of JARIS CMS?
              </p>
              <p
                style={{
                  fontSize:    13.5,
                  textAlign:   "center",
                  color:       TOKEN.textSec,
                  margin:      "0 0 24px",
                  lineHeight:  1.6,
                }}
              >
                You'll need to log in again to access the dashboard.
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  style={{
                    flex:         1,
                    padding:      "11px 0",
                    borderRadius: 12,
                    border:       `1px solid ${TOKEN.border}`,
                    background:   TOKEN.bg,
                    color:        TOKEN.textSec,
                    fontSize:     13.5,
                    fontWeight:   600,
                    cursor:       "pointer",
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onLogout}
                  style={{
                    flex:         1,
                    padding:      "11px 0",
                    borderRadius: 12,
                    border:       "none",
                    background:   TOKEN.danger,
                    color:        "#fff",
                    fontSize:     13.5,
                    fontWeight:   600,
                    cursor:       "pointer",
                  }}
                >
                  Yes, sign out
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: Sidebar (desktop only)
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarProps {
  activeNav:    NavId;
  onNavChange:  (id: NavId) => void;
  onLogout:     () => void;
  user:         typeof PLACEHOLDER_USER;
}

export function Sidebar({ activeNav, onNavChange, onLogout, user }: SidebarProps) {
  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      style={{
        display:        "flex",
        flexDirection:  "column",
        width:          "17.5rem",
        flexShrink:     0,
        margin:         12,
        borderRadius:   18,
        background:     TOKEN.surface,
        border:         `1px solid ${TOKEN.border}`,
        boxShadow:      "0 4px 24px -4px rgba(15,23,42,0.09), 0 1px 4px rgba(15,23,42,0.04)",
        overflow:       "hidden",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding:      "24px 20px 20px",
          borderBottom: `1px solid ${TOKEN.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width:           36,
              height:          36,
              borderRadius:    10,
              background:      `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.secondary})`,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              flexShrink:      0,
            }}
          >
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TOKEN.textPri, letterSpacing: "-0.01em" }}>
              JARIS CMS
            </p>
            <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}>
              Admin Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────── */}
      <nav
        role="menu"
        style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 2 }}
      >
        {NAV_SECTIONS.map((section) => (
          <SideNavItem
            key={section.id}
            section={section}
            isActive={activeNav === section.id}
            onClick={() => onNavChange(section.id)}
          />
        ))}
      </nav>

      {/* ── User footer ───────────────────────────────────────────────── */}
      <div
        style={{
          padding:    "12px",
          borderTop:  `1px solid ${TOKEN.border}`,
        }}
      >
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            padding:      "10px 12px",
            borderRadius: 12,
            background:   TOKEN.bg,
          }}
        >
          <NavAvatar initials={user.initials} size={36} />

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
              width:           32,
              height:          32,
              borderRadius:    8,
              border:          "none",
              background:      "transparent",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              cursor:          "pointer",
              color:           TOKEN.textSec,
              flexShrink:      0,
            }}
          >
            <LogOut size={15} />
          </motion.button>
        </div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: AppHeader
// ═══════════════════════════════════════════════════════════════════════════════

interface AppHeaderProps {
  activeNav:     NavId;
  activeTab:     string;
  onTabChange:   (tab: string) => void;
  onMenuOpen:    () => void;
  user:          typeof PLACEHOLDER_USER;
  /** true on mobile to show greeting */
  isMobile?:     boolean;
}

export function AppHeader({
  activeNav,
  activeTab,
  onTabChange,
  onMenuOpen,
  user,
  isMobile = false,
}: AppHeaderProps) {
  const section = NAV_SECTIONS.find((s) => s.id === activeNav)!;

  return (
    <header
      style={{
        position:             "sticky",
        top:                  0,
        zIndex:               100,
        background:           `${TOKEN.bg}f0`,
        backdropFilter:       "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom:         `1px solid ${TOKEN.border}`,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          12,
          padding:      "12px 20px 10px",
        }}
      >
        {/* Mobile hamburger */}
        {isMobile && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onMenuOpen}
            aria-label="Open menu"
            style={{
              width:           36,
              height:          36,
              borderRadius:    10,
              border:          `1px solid ${TOKEN.border}`,
              background:      TOKEN.surface,
              color:           TOKEN.textSec,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              cursor:          "pointer",
              flexShrink:      0,
            }}
          >
            <Menu size={17} />
          </motion.button>
        )}

        {/* Greeting (mobile) or page title (desktop) */}
        <div style={{ flex: 1 }}>
          {isMobile ? (
            <>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TOKEN.textPri, lineHeight: 1.3 }}>
                Hello, {user.name.split(" ")[0]}!
              </p>
              <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}>
                {user.role}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TOKEN.textPri }}>
              {section.label}
            </p>
          )}
        </div>

        {/* Mobile: avatar */}
        {isMobile && <NavAvatar initials={user.initials} size={34} />}
      </div>

      {/* Scrollable tab row */}
      <div
        role="tablist"
        aria-label={`${section.label} pages`}
        style={{
          display:         "flex",
          gap:             8,
          padding:         "0 20px 10px",
          overflowX:       "auto",
          scrollbarWidth:  "none",
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
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: BottomNav (mobile only)
// ═══════════════════════════════════════════════════════════════════════════════

interface BottomNavProps {
  activeNav:   NavId;
  onNavChange: (id: NavId) => void;
}

export function BottomNav({ activeNav, onNavChange }: BottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      style={{
        position:        "fixed",
        bottom:          0,
        left:            0,
        right:           0,
        zIndex:          100,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-around",
        padding:         "8px 4px",
        background:      TOKEN.surface,
        borderTop:       `1px solid ${TOKEN.border}`,
        boxShadow:       "0 -4px 20px -4px rgba(15,23,42,0.07)",
      }}
    >
      {NAV_SECTIONS.map((section) => {
        const isActive = activeNav === section.id;

        return (
          <motion.button
            key={section.id}
            onClick={() => onNavChange(section.id)}
            whileTap={{ scale: 0.84 }}
            aria-label={section.label}
            aria-current={isActive ? "page" : undefined}
            style={{
              position:        "relative",
              display:         "flex",
              flexDirection:   "column",
              alignItems:      "center",
              gap:             3,
              padding:         "8px 16px",
              borderRadius:    12,
              border:          "none",
              background:      "transparent",
              color:           isActive ? TOKEN.secondary : TOKEN.textSec,
              cursor:          "pointer",
              transition:      "color 0.15s",
            }}
          >
            {/* Animated pill background */}
            {isActive && (
              <motion.span
                layoutId="bottomNavBg"
                transition={SPRING_FAST}
                style={{
                  position:     "absolute",
                  inset:        0,
                  borderRadius: 12,
                  background:   `${TOKEN.secondary}13`,
                }}
              />
            )}

            {/* Top indicator dot */}
            {isActive && (
              <motion.span
                layoutId="bottomNavDot"
                transition={SPRING_FAST}
                style={{
                  position:     "absolute",
                  top:          -1,
                  left:         "50%",
                  transform:    "translateX(-50%)",
                  width:        20,
                  height:       3,
                  borderRadius: "0 0 4px 4px",
                  background:   TOKEN.secondary,
                }}
              />
            )}

            <section.Icon size={20} style={{ position: "relative", zIndex: 1 }} />
            <span
              style={{
                fontSize:   10.5,
                fontWeight: 600,
                position:   "relative",
                zIndex:     1,
                lineHeight: 1,
              }}
            >
              {section.label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: FAB (mobile only)
// ═══════════════════════════════════════════════════════════════════════════════

interface FABProps {
  bottomOffset?: number;
}

export function FAB({ bottomOffset = 80 }: FABProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position:      "fixed",
        bottom:        bottomOffset,
        right:         16,
        zIndex:        110,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           10,
      }}
    >
      {/* Speed-dial actions */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{   opacity: 0, y: 10, scale: 0.9 }}
            transition={SPRING_MED}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}
          >
            {FAB_QUICK_ACTIONS.map((action, i) => (
              <motion.button
                key={action.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0,  opacity: 1 }}
                exit={{   x: 20, opacity: 0 }}
                transition={{ ...SPRING_MED, delay: i * 0.055 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                aria-label={action.label}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  paddingLeft:  14,
                  paddingRight: 6,
                  paddingTop:   6,
                  paddingBottom:6,
                  borderRadius: 16,
                  border:       `1px solid ${TOKEN.border}`,
                  background:   TOKEN.surface,
                  cursor:       "pointer",
                  boxShadow:    "0 4px 16px -4px rgba(15,23,42,0.12)",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKEN.textPri }}>
                  {action.label}
                </span>
                <div
                  style={{
                    width:           32,
                    height:          32,
                    borderRadius:    10,
                    background:      action.color,
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                  }}
                >
                  <action.Icon size={15} color="#fff" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.91 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close actions" : "Open actions"}
        aria-expanded={open}
        style={{
          width:           52,
          height:          52,
          borderRadius:    "50%",
          border:          "none",
          background:      TOKEN.primary,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          cursor:          "pointer",
          boxShadow:       `0 8px 24px -4px ${TOKEN.primary}70`,
        }}
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
        >
          <Plus size={22} color="#fff" />
        </motion.div>
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: EmptyPage (placeholder for all routes)
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyPageProps {
  navId:  NavId;
  tab:    string;
}

function EmptyPage({ navId, tab }: EmptyPageProps) {
  return (
    <motion.div
      key={`${navId}__${tab}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{   opacity: 0, y: -8  }}
      transition={EASE_OUT}
      role="main"
      aria-label={`${tab} content`}
      style={{
        flex:         1,
        padding:      "24px",
        minHeight:    "calc(100vh - 200px)",
        /* ↑ inject feature content here */
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT: MobileSidebarDrawer
// ═══════════════════════════════════════════════════════════════════════════════

interface MobileSidebarDrawerProps {
  isOpen:      boolean;
  onClose:     () => void;
  activeNav:   NavId;
  onNavChange: (id: NavId) => void;
  onLogout:    () => void;
  user:        typeof PLACEHOLDER_USER;
}

function MobileSidebarDrawer({
  isOpen,
  onClose,
  activeNav,
  onNavChange,
  onLogout,
  user,
}: MobileSidebarDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position:   "fixed",
              inset:      0,
              background: "rgba(15,23,42,0.42)",
              backdropFilter: "blur(4px)",
              zIndex:     150,
            }}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={SPRING_MED}
            role="navigation"
            aria-label="Main navigation"
            style={{
              position:      "fixed",
              top:           12,
              bottom:        12,
              left:          12,
              zIndex:        151,
              width:         "17.5rem",
              borderRadius:  18,
              background:    TOKEN.surface,
              boxShadow:     "0 12px 48px -8px rgba(15,23,42,0.22)",
              display:       "flex",
              flexDirection: "column",
              overflow:      "hidden",
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                justifyContent:"space-between",
                padding:      "18px 16px 14px",
                borderBottom: `1px solid ${TOKEN.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <NavAvatar initials={user.initials} size={38} />
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: TOKEN.textPri }}>
                    {user.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}>
                    {user.role}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                aria-label="Close menu"
                style={{
                  width:           32,
                  height:          32,
                  borderRadius:    8,
                  border:          "none",
                  background:      TOKEN.bg,
                  color:           TOKEN.textSec,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  cursor:          "pointer",
                }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Nav */}
            <nav
              role="menu"
              style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: 2 }}
            >
              {NAV_SECTIONS.map((section) => (
                <SideNavItem
                  key={section.id}
                  section={section}
                  isActive={activeNav === section.id}
                  onClick={() => {
                    onNavChange(section.id);
                    onClose();
                  }}
                />
              ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: "12px", borderTop: `1px solid ${TOKEN.border}` }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { onClose(); onLogout(); }}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "11px 16px",
                  borderRadius: 12,
                  border:       "none",
                  background:   TOKEN.dangerBg,
                  color:        TOKEN.dangerText,
                  fontSize:     13.5,
                  fontWeight:   600,
                  cursor:       "pointer",
                }}
              >
                <LogOut size={16} />
                Logout
              </motion.button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT: CMSLayout  (the full responsive shell)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Drop-in layout wrapper.
 *
 * Usage (desktop+mobile, automated via CSS breakpoints):
 *
 *   <CMSLayout>
 *     {({ activeNav, activeTab }) => (
 *       <YourFeatureComponent nav={activeNav} tab={activeTab} />
 *     )}
 *   </CMSLayout>
 *
 * The layout manages:
 *   - Which nav section is active
 *   - Which sub-tab is active
 *   - Sidebar / bottom nav visibility
 *   - Logout modal state
 *
 * Children receive the current nav + tab so they can render accordingly.
 */

interface CMSLayoutProps {
  children?: (ctx: { activeNav: NavId; activeTab: string }) => React.ReactNode;
}

export default function CMSLayout({ children }: CMSLayoutProps) {
  const [activeNav,     setActiveNav]     = useState<NavId>("products");
  const [activeTab,     setActiveTab]     = useState("All Products");
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [logoutOpen,    setLogoutOpen]    = useState(false);
  const [isMobileView, setMobileView]    = useState(false);

  // Responsive detection (pure CSS media query via useEffect-free SSR-safe approach)
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobileView(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleNavChange = (id: NavId) => {
    setActiveNav(id);
    setActiveTab(NAV_SECTIONS.find((s) => s.id === id)!.tabs[0]);
  };

  const handleLogout = () => {
    // UI only — wire up real logout here
    setLogoutOpen(false);
  };

  return (
    <>
      {/* ── Scrollbar hide ─────────────────────────────────────────────── */}
      <style>{`
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
        body { margin: 0; font-family: 'Inter', 'DM Sans', system-ui, sans-serif; }
        * { box-sizing: border-box; }
      `}</style>

      <div
        style={{
          minHeight:  "100vh",
          display:    "flex",
          background: TOKEN.bg,
          color:      TOKEN.textPri,
          overflow:   "hidden",
        }}
      >
        {/* ── DESKTOP SIDEBAR ────────────────────────────────────────── */}
        {!isMobileView && (
          <Sidebar
            activeNav={activeNav}
            onNavChange={handleNavChange}
            onLogout={() => setLogoutOpen(true)}
            user={PLACEHOLDER_USER}
          />
        )}

        {/* ── MOBILE DRAWER ──────────────────────────────────────────── */}
        {isMobileView && (
          <MobileSidebarDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            activeNav={activeNav}
            onNavChange={handleNavChange}
            onLogout={() => setLogoutOpen(true)}
            user={PLACEHOLDER_USER}
          />
        )}

        {/* ── MAIN COLUMN ────────────────────────────────────────────── */}
        <div
          style={{
            flex:          1,
            display:       "flex",
            flexDirection: "column",
            minWidth:      0,
            overflow:      "hidden",
          }}
        >
          <AppHeader
            activeNav={activeNav}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onMenuOpen={() => setDrawerOpen(true)}
            user={PLACEHOLDER_USER}
            isMobile={isMobileView}
          />

          {/* ── CONTENT AREA (intentionally empty) ────────────────── */}
          <div
            style={{
              flex:       1,
              overflowY:  "auto",
              paddingBottom: isMobileView ? 100 : 24,
            }}
          >
            <AnimatePresence mode="wait">
              {children ? (
                <motion.div
                  key={`${activeNav}__${activeTab}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0  }}
                  exit={{   opacity: 0, y: -8  }}
                  transition={EASE_OUT}
                  style={{ padding: 24, minHeight: "60vh" }}
                >
                  {children({ activeNav, activeTab })}
                </motion.div>
              ) : (
                <EmptyPage key={`${activeNav}__${activeTab}`} navId={activeNav} tab={activeTab} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────── */}
        {isMobileView && (
          <BottomNav activeNav={activeNav} onNavChange={handleNavChange} />
        )}

        {/* ── FAB (mobile only) ──────────────────────────────────────── */}
        {isMobileView && <FAB bottomOffset={80} />}

        {/* ── LOGOUT MODAL ───────────────────────────────────────────── */}
        <LogoutModal
          isOpen={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onLogout={handleLogout}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTE PLACEHOLDER COMPONENTS
//  One per page — all empty, ready for feature injection.
// ═══════════════════════════════════════════════════════════════════════════════

export function ProductsPage()       { return null; }
export function AllProductsPage()    { return null; }
export function TaskflowPage()       { return null; }
export function ShopifyPage()        { return null; }
export function RequestsPage()       { return null; }
export function ApplicationsPage()   { return null; }
export function BrandsPage()         { return null; }
export function FamiliesPage()       { return null; }
export function OrdersPage()         { return null; }
export function ReviewsPage()        { return null; }
export function SolutionsPage()      { return null; }
export function SeriesPage()         { return null; }
export function SpecsPage()          { return null; }

export function JobsPage()           { return null; }
export function JobApplicationsPage(){ return null; }
export function CareersPage()        { return null; }

export function ContentPage()        { return null; }
export function BlogsPage()          { return null; }
export function FAQsPage()           { return null; }
export function PopupsPage()         { return null; }
export function ProjectsPage()       { return null; }

export function AdminPage()          { return null; }
export function RecycleBinPage()     { return null; }
export function UserManagementPage() { return null; }