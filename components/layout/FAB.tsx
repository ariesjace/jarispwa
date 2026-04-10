"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  FAB — floating action button with speed-dial
//  Usage: <FAB bottomOffset={80} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { TOKEN, SPRING_MED } from "./tokens";
import { FAB_QUICK_ACTIONS } from "./nav-data";

export interface FABProps {
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
                  display:       "flex",
                  alignItems:    "center",
                  gap:           10,
                  paddingLeft:   14,
                  paddingRight:  6,
                  paddingTop:    6,
                  paddingBottom: 6,
                  borderRadius:  16,
                  border:        `1px solid ${TOKEN.border}`,
                  background:    TOKEN.surface,
                  cursor:        "pointer",
                  boxShadow:     "0 4px 16px -4px rgba(15,23,42,0.12)",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKEN.textPri }}>
                  {action.label}
                </span>
                <div
                  style={{
                    width:          32,
                    height:         32,
                    borderRadius:   10,
                    background:     action.color,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
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
          width:          52,
          height:         52,
          borderRadius:   "50%",
          border:         "none",
          background:     TOKEN.primary,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          cursor:         "pointer",
          boxShadow:      `0 8px 24px -4px ${TOKEN.primary}70`,
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
