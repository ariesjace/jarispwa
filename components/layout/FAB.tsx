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
  hidden?: boolean;
}

export function FAB({ bottomOffset = 80, actions, hidden = false }: FABProps) {
  const [open, setOpen] = useState(false);
  const displayActions = actions || FAB_QUICK_ACTIONS;
  if (hidden) return null;

  // ── Single-action mode: tap FAB → directly call the action (no menu) ──────
  const isSingleAction = displayActions.length === 1;
  const singleAction = isSingleAction ? displayActions[0] : null;

  const handleMainButtonClick = () => {
    if (isSingleAction && singleAction) {
      singleAction.onClick?.();
    } else {
      setOpen((v) => !v);
    }
  };

  // Icon shown on the FAB button itself
  const MainIcon = singleAction ? singleAction.Icon : Plus;
  const mainColor = singleAction ? singleAction.color : TOKEN.primary;
  const shadowColor = mainColor;

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
      {/* Multi-action expanded menu (only shown for multiple actions) */}
      {!isSingleAction && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={SPRING_MED}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 10,
              }}
            >
              {displayActions.map((action, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => {
                    (action as any).onClick?.();
                    setOpen(false);
                  }}
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
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: TOKEN.textPri,
                    }}
                  >
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
      )}

      {/* Main FAB button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleMainButtonClick}
        aria-label={
          isSingleAction
            ? singleAction?.label
            : open
              ? "Close menu"
              : "Open menu"
        }
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: mainColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: `0 8px 24px -4px ${shadowColor}60`,
        }}
      >
        {isSingleAction ? (
          // Single action: always show the action's icon, no rotation
          <MainIcon size={24} color="#fff" />
        ) : (
          // Multiple actions: Plus icon that rotates to X when open
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <Plus size={24} color="#fff" />
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}
