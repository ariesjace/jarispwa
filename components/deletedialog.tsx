"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, AlertTriangle, Clock, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";

interface DeleteToRecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The display name of the item(s) to delete
  itemName: string;
  // The exact string the user must type to confirm (single-item only)
  confirmText?: string;
  // Called when the user has confirmed and wants to proceed
  onConfirm: () => Promise<void> | void;
  // Show how many items are being deleted
  count?: number;
  // requestMode — true when the current user is restricted (e.g. pd_engineer)
  requestMode?: boolean;
}

const LONG_PRESS_MS = 2000;

export function DeleteToRecycleBinDialog({
  open,
  onOpenChange,
  itemName,
  confirmText,
  onConfirm,
  count = 1,
  requestMode = false,
}: DeleteToRecycleBinDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);

  const pressStart = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const required = confirmText ?? itemName;
  const isMatch = inputValue === required;
  const isBulk = count > 1;

  useEffect(() => {
    if (!open) {
      setInputValue("");
      setIsLoading(false);
      setPressProgress(0);
      setIsPressing(false);
      firedRef.current = false;
      pressStart.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [open]);

  const executeConfirm = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onConfirmRef.current();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onOpenChange]);

  const executeConfirmRef = useRef(executeConfirm);
  useEffect(() => {
    executeConfirmRef.current = executeConfirm;
  }, [executeConfirm]);

  const tick = useCallback(() => {
    if (!pressStart.current) return;
    const elapsed = Date.now() - pressStart.current;
    const progress = Math.min((elapsed / LONG_PRESS_MS) * 100, 100);
    setPressProgress(progress);
    if (progress >= 100 && !firedRef.current) {
      firedRef.current = true;
      executeConfirmRef.current();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startPress = useCallback(() => {
    if (isLoading || firedRef.current) return;
    pressStart.current = Date.now();
    firedRef.current = false;
    setPressProgress(0);
    setIsPressing(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [isLoading, tick]);

  const cancelPress = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pressStart.current = null;
    setIsPressing(false);
    if (!firedRef.current) setPressProgress(0);
  }, []);

  const handleConfirmSingle = useCallback(() => {
    if (!isMatch) return;
    executeConfirm();
  }, [isMatch, executeConfirm]);

  const dialogTitle = requestMode
    ? isBulk
      ? `Submit Delete Request for ${count} Products`
      : "Submit Delete Request"
    : isBulk
      ? `Move ${count} Products to Recycle Bin`
      : "Move to Recycle Bin";

  const dialogDescription = requestMode
    ? "Your delete request will be sent to a PD Manager or Admin for approval."
    : "This item will be moved to the recycle bin where it can be restored or permanently deleted.";

  const confirmButtonLabel = requestMode
    ? isBulk
      ? "Submit Delete Request"
      : "Submit Request"
    : isBulk
      ? "Move to Recycle Bin"
      : "Move to Recycle Bin";

  const PrimaryIcon = requestMode ? Clock : Trash2;
  const primaryColor = requestMode ? "#ca8a04" : TOKEN.danger; // Amber-600 vs Danger
  const primaryBg = requestMode ? "#fefce8" : TOKEN.dangerBg; // Amber-50 vs DangerBg

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="delete-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 200,
            }}
          />

          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 201,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="delete-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={SPRING_MED}
              role="alertdialog"
              aria-modal="true"
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 420,
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                padding: 28,
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: primaryBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PrimaryIcon size={24} color={primaryColor} />
                </div>
              </div>

              <p style={{ fontSize: 18, fontWeight: 800, textAlign: "center", color: TOKEN.textPri, margin: "0 0 8px" }}>
                {dialogTitle}
              </p>
              <p style={{ fontSize: 13.5, textAlign: "center", color: TOKEN.textSec, margin: "0 0 24px", lineHeight: 1.6 }}>
                {dialogDescription}
              </p>

              {!isBulk && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: TOKEN.textSec, textTransform: "uppercase" }}>Item to Delete</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TOKEN.textPri, wordBreak: "break-word" }}>{itemName}</p>
                  </div>
                  
                  <label style={{ display: "block", fontSize: 13, color: TOKEN.textSec, marginBottom: 8 }}>
                    Type <strong style={{ color: TOKEN.textPri, fontFamily: "monospace" }}>{required}</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={required}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isMatch) handleConfirmSingle();
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${inputValue.length > 0 ? (isMatch ? '#22c55e' : TOKEN.danger) : TOKEN.border}`,
                      background: TOKEN.surface,
                      fontSize: 14,
                      fontFamily: "monospace",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                  {inputValue.length > 0 && !isMatch && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: TOKEN.danger }}>Doesn't match. Type exactly as shown.</p>
                  )}
                </div>
              )}

              {isBulk && (
                <div style={{ background: TOKEN.bg, border: `1px dashed ${TOKEN.border}`, borderRadius: 12, padding: 16, marginBottom: 24, textAlign: "center" }}>
                   <p style={{ margin: 0, fontSize: 12.5, color: TOKEN.textSec, lineHeight: 1.5 }}>
                     Hold the button below for <strong>2 seconds</strong> to confirm.
                   </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: `1px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    color: TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  Cancel
                </motion.button>
                
                {isBulk ? (
                  <div style={{ flex: 2, position: "relative", borderRadius: 12, overflow: "hidden" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(255,255,255,0.2)",
                        transformOrigin: "left",
                        transform: `scaleX(${pressProgress / 100})`,
                        pointerEvents: "none",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onMouseDown={startPress}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={(e) => { e.preventDefault(); startPress(); }}
                      onTouchEnd={cancelPress}
                      onTouchCancel={cancelPress}
                      disabled={isLoading}
                      style={{
                        width: "100%",
                        padding: "11px 0",
                        borderRadius: 12,
                        border: "none",
                        background: primaryColor,
                        color: "#fff",
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        userSelect: "none"
                      }}
                    >
                      {isLoading ? (
                        <span>Processing...</span>
                      ) : isPressing ? (
                        `Hold... ${Math.round(pressProgress)}%`
                      ) : (
                        <>
                          <PrimaryIcon size={16} />
                          {confirmButtonLabel}
                        </>
                      )}
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: isMatch ? 1.02 : 1 }}
                    whileTap={{ scale: isMatch ? 0.97 : 1 }}
                    onClick={handleConfirmSingle}
                    disabled={!isMatch || isLoading}
                    style={{
                      flex: 2,
                      padding: "11px 0",
                      borderRadius: 12,
                      border: "none",
                      background: isMatch ? primaryColor : `${TOKEN.border}`,
                      opacity: isMatch ? 1 : 0.6,
                      color: isMatch ? "#fff" : TOKEN.textSec,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: isMatch ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8
                    }}
                  >
                    {isLoading ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <PrimaryIcon size={16} />
                        {confirmButtonLabel}
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
