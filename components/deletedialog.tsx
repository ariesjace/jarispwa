"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Clock, Send, AlertTriangle } from "lucide-react";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DeleteToRecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  count?: number;
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
      ? `Delete ${count} Products`
      : "Delete Item";

  const noteText = requestMode
    ? "This request will be reviewed before deletion. Track status on Requests page."
    : "Items can be restored from Recycle Bin.";

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
              aria-label="Confirm deletion"
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 400,
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                padding: 28,
              }}
            >
              {/* Icon */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: TOKEN.dangerBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={24} color={TOKEN.danger} />
                </div>
              </div>

              {/* Title & Description */}
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: "center",
                  color: TOKEN.textPri,
                  margin: "0 0 8px",
                }}
              >
                {dialogTitle}
              </p>
              <p
                style={{
                  fontSize: 13.5,
                  textAlign: "center",
                  color: TOKEN.textSec,
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {isBulk
                  ? `${count} products will be deleted. This action cannot be undone.`
                  : `Delete "${itemName}"? This action cannot be undone.`}
              </p>

              {/* Content */}
              <div style={{ marginBottom: 20 }}>
                {!isBulk && !isMatch ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: TOKEN.textSec,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Type to confirm:
                    </label>
                    <Input
                      autoFocus
                      placeholder={required}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isMatch) handleConfirmSingle();
                      }}
                      style={{
                        borderRadius: 10,
                        borderColor:
                          inputValue.length > 0 && !isMatch
                            ? TOKEN.danger
                            : TOKEN.border,
                        fontFamily: "monospace",
                        fontSize: 13,
                      }}
                    />
                    {inputValue.length > 0 && !isMatch && (
                      <p style={{ fontSize: 11, color: TOKEN.danger, margin: 0 }}>
                        Doesn&apos;t match. Type exactly: <strong>{required}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${TOKEN.border}`,
                      background: `${TOKEN.bg}`,
                      padding: 12,
                      fontSize: 12.5,
                      color: TOKEN.textSec,
                    }}
                  >
                    {isBulk
                      ? `Hold the Delete button for ${Math.round(LONG_PRESS_MS / 1000)} seconds to confirm bulk deletion.`
                      : "✓ Ready to delete. Click below to confirm."}
                  </div>
                )}
              </div>

              {/* Info note */}
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${TOKEN.border}`,
                  background: `${TOKEN.bg}`,
                  padding: 12,
                  marginBottom: 20,
                  fontSize: 11.5,
                  color: TOKEN.textSec,
                  lineHeight: 1.5,
                }}
              >
                {noteText}
              </div>

              {/* Buttons */}
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
                    background: TOKEN.bg,
                    color: TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  Cancel
                </motion.button>

                {isBulk ? (
                  <motion.div
                    style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 12 }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(255,255,255,0.2)",
                        pointerEvents: "none",
                        transformOrigin: "left",
                        transform: `scaleX(${pressProgress / 100})`,
                        transition: "none",
                      }}
                    />
                    <motion.button
                      whileHover={{ scale: isPressing ? 1 : 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onMouseDown={startPress}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        startPress();
                      }}
                      onTouchEnd={cancelPress}
                      onTouchCancel={cancelPress}
                      disabled={isLoading}
                      style={{
                        width: "100%",
                        padding: "11px 0",
                        borderRadius: 12,
                        border: "none",
                        background: TOKEN.danger,
                        color: "#fff",
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: isLoading ? "not-allowed" : "pointer",
                        position: "relative",
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      {isLoading
                        ? "Deleting…"
                        : isPressing
                          ? `Hold… ${Math.round(pressProgress)}%`
                          : "Delete"}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    whileHover={{ scale: isMatch && !isLoading ? 1.02 : 1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleConfirmSingle}
                    disabled={!isMatch || isLoading}
                    style={{
                      flex: 1,
                      padding: "11px 0",
                      borderRadius: 12,
                      border: "none",
                      background: isMatch ? TOKEN.danger : TOKEN.border,
                      color: "#fff",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: isMatch && !isLoading ? "pointer" : "not-allowed",
                      opacity: isMatch ? 1 : 0.5,
                    }}
                  >
                    {isLoading ? "Deleting…" : "Delete"}
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
