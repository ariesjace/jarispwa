"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  LogoutModal — animated confirmation dialog
//  Usage: <LogoutModal isOpen={open} onClose={…} onLogout={…} />
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { TOKEN, SPRING_MED } from "./tokens";

export interface LogoutModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onLogout: () => void;
}

export function LogoutModal({ isOpen, onClose, onLogout }: LogoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="logout-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position:       "fixed",
              inset:          0,
              background:     "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex:         200,
            }}
          />

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

              <p style={{ fontSize: 16, fontWeight: 700, textAlign: "center", color: TOKEN.textPri, margin: "0 0 8px" }}>
                Sign out of JARIS CMS?
              </p>
              <p style={{ fontSize: 13.5, textAlign: "center", color: TOKEN.textSec, margin: "0 0 24px", lineHeight: 1.6 }}>
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
