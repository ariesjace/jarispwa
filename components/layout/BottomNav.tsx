"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  BottomNav — mobile-only fixed bottom navigation bar
//  Usage: <BottomNav activeNav={…} onNavChange={…} />
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion } from "framer-motion";
import { TOKEN, SPRING_FAST } from "./tokens";
import { NAV_SECTIONS, type NavId } from "./nav-data";

export interface BottomNavProps {
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
              position:       "relative",
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              gap:            3,
              padding:        "8px 16px",
              borderRadius:   12,
              border:         "none",
              background:     "transparent",
              color:          isActive ? TOKEN.secondary : TOKEN.textSec,
              cursor:         "pointer",
              transition:     "color 0.15s",
            }}
          >
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
