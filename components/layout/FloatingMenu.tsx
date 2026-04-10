"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  FloatingMenu — mobile-only floating nav panel (replaces sidebar on mobile)
//
//  Renders a floating pill button (top-left). Tap to expand a compact card
//  showing nav sections + logout. No sidebar, no drawer — pure floating UI.
//
//  Usage: <FloatingMenu activeNav={…} onNavChange={…} onLogout={…} user={…} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Zap, ChevronRight } from "lucide-react";
import { TOKEN, SPRING_MED, SPRING_FAST } from "./tokens";
import { NavAvatar } from "./NavAvatar";
import { NAV_SECTIONS, type NavId, type CmsUser } from "./nav-data";

export interface FloatingMenuProps {
  activeNav:   NavId;
  onNavChange: (id: NavId) => void;
  onLogout:    () => void;
  user:        CmsUser;
}

export function FloatingMenu({
  activeNav,
  onNavChange,
  onLogout,
  user,
}: FloatingMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on nav change
  const handleNav = (id: NavId) => {
    onNavChange(id);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top:      14,
        left:     14,
        zIndex:   120,
      }}
    >
      {/* ── Trigger pill ───────────────────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            8,
          paddingLeft:    10,
          paddingRight:   14,
          paddingTop:     7,
          paddingBottom:  7,
          borderRadius:   999,
          border:         `1px solid ${TOKEN.border}`,
          background:     TOKEN.surface,
          boxShadow:      "0 4px 20px -4px rgba(15,23,42,0.12)",
          cursor:         "pointer",
        }}
      >
        {/* Brand icon */}
        <div
          style={{
            width:          26,
            height:         26,
            borderRadius:   8,
            background:     `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.secondary})`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}
        >
          <Zap size={13} color="#fff" />
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKEN.textPri, letterSpacing: "-0.01em" }}>
          JARIS
        </span>

        {/* Animated chevron */}
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={SPRING_FAST}
          style={{ display: "flex", color: TOKEN.textSec, marginLeft: 2 }}
        >
          <ChevronRight size={13} />
        </motion.span>
      </motion.button>

      {/* ── Floating panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="floating-menu"
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: -8 }}
            transition={SPRING_MED}
            style={{
              position:      "absolute",
              top:           "calc(100% + 10px)",
              left:          0,
              width:         "15rem",
              background:    TOKEN.surface,
              borderRadius:  18,
              border:        `1px solid ${TOKEN.border}`,
              boxShadow:     "0 16px 48px -8px rgba(15,23,42,0.18)",
              overflow:      "hidden",
              transformOrigin: "top left",
            }}
          >
            {/* User strip */}
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                padding:      "14px 14px 12px",
                borderBottom: `1px solid ${TOKEN.border}`,
                background:   TOKEN.bg,
              }}
            >
              <NavAvatar initials={user.initials} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TOKEN.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: TOKEN.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.role}
                </p>
              </div>
            </div>

            {/* Nav items */}
            <nav
              role="menu"
              style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 2 }}
            >
              {NAV_SECTIONS.map((section, i) => {
                const isActive = activeNav === section.id;
                return (
                  <motion.button
                    key={section.id}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING_MED, delay: i * 0.04 }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNav(section.id)}
                    style={{
                      position:   "relative",
                      display:    "flex",
                      alignItems: "center",
                      gap:        10,
                      padding:    "10px 12px",
                      borderRadius: 12,
                      border:     "none",
                      background: isActive ? `${TOKEN.secondary}13` : "transparent",
                      color:      isActive ? TOKEN.secondary : TOKEN.textSec,
                      cursor:     "pointer",
                      textAlign:  "left",
                      width:      "100%",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.span
                        layoutId="floatNavBar"
                        transition={SPRING_FAST}
                        style={{
                          position:     "absolute",
                          left:         0,
                          top:          "50%",
                          transform:    "translateY(-50%)",
                          width:        3,
                          height:       20,
                          borderRadius: "0 4px 4px 0",
                          background:   TOKEN.secondary,
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        width:          28,
                        height:         28,
                        borderRadius:   8,
                        background:     isActive ? `${TOKEN.secondary}1c` : `${TOKEN.textSec}10`,
                        display:        "flex",
                        alignItems:     "center",
                        justifyContent: "center",
                        flexShrink:     0,
                      }}
                    >
                      <section.Icon size={14} />
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                      {section.label}
                    </span>

                    {isActive && (
                      <ChevronRight size={12} style={{ opacity: 0.4 }} />
                    )}
                  </motion.button>
                );
              })}
            </nav>

            {/* Logout */}
            <div style={{ padding: "8px", borderTop: `1px solid ${TOKEN.border}` }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setOpen(false); onLogout(); }}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "10px 12px",
                  borderRadius: 12,
                  border:       "none",
                  background:   TOKEN.dangerBg,
                  color:        TOKEN.dangerText,
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       "pointer",
                }}
              >
                <div
                  style={{
                    width:          28,
                    height:         28,
                    borderRadius:   8,
                    background:     `${TOKEN.danger}20`,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                  }}
                >
                  <LogOut size={13} color={TOKEN.dangerText} />
                </div>
                Logout
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
