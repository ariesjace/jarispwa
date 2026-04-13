"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LucideIcon } from "lucide-react";
import { TOKEN, SPRING_MED } from "./tokens";
import { FAB_QUICK_ACTIONS } from "./nav-data";

export interface FABAction {
  label: string;
  Icon: LucideIcon;
  color: string;
  onClick?: () => void;
}

export interface FABProps {
  bottomOffset?: number;
  actions?: FABAction[];
}

export function FAB({ bottomOffset = 80, actions }: FABProps) {
  const [open, setOpen] = useState(false);
  const displayActions = actions || FAB_QUICK_ACTIONS;

  return (
    <div
      style={{
        position: "fixed",
        bottom: bottomOffset,
        right: 20,
        zIndex: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={SPRING_MED}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}
          >
            {displayActions.map((action, i) => (
              <motion.button
                key={i}
                onClick={() => { (action as any).onClick?.(); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 14px",
                  borderRadius: 14,
                  border: `1px solid ${TOKEN.border}`,
                  background: TOKEN.surface,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: TOKEN.textPri }}>
                  {action.label}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: action.color,
                    display: "flex",
                    alignItems: "center",
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

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: TOKEN.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: `0 8px 24px -4px ${TOKEN.primary}60`,
        }}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }}>
          <Plus size={24} color="#fff" />
        </motion.div>
      </motion.button>
    </div>
  );
}