"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  AlertCircle,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { cn } from "@/lib/utils";
import { PendingRequest } from "@/lib/requestService";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RemarksAction = "approve" | "reject";

export interface RemarksTarget {
  request: PendingRequest;
  action: RemarksAction;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(req: PendingRequest): string {
  const meta = req.meta ?? {};
  if (meta.productName) return String(meta.productName);
  const d = req.payload?.after ?? req.payload?.productSnapshot ?? req.payload;
  return d?.itemDescription || d?.name || d?.itemCode || req.resourceId || "—";
}

function getItemCode(req: PendingRequest): string | null {
  const meta = req.meta ?? {};
  return (meta.litItemCode as string) || (meta.ecoItemCode as string) || null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface RemarksConfirmDialogProps {
  target: RemarksTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (
    action: RemarksAction,
    requestId: string,
    remarks: string,
  ) => Promise<void>;
}

export function RemarksConfirmDialog({
  target,
  open,
  onOpenChange,
  onConfirm,
}: RemarksConfirmDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setRemarks("");
      setError(false);
    }
  }, [open, target?.request.id]);

  if (!target) return null;

  const { request, action } = target;
  const isApprove = action === "approve";
  const displayName = getDisplayName(request);
  const itemCode = getItemCode(request);
  const remarksOk = remarks.trim().length > 0;

  const primaryColor = isApprove ? "#10b981" : TOKEN.danger; // emerald-500 vs danger
  const primaryBg = isApprove ? "#d1fae5" : TOKEN.dangerBg; // emerald-100 vs dangerBg
  const PrimaryIcon = isApprove ? CheckCircle2 : XCircle;

  const handleConfirm = async () => {
    if (!remarksOk) {
      setError(true);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(action, request.id, remarks.trim());
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="remarks-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!loading) {
                setRemarks("");
                setError(false);
                onOpenChange(false);
              }
            }}
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
              key="remarks-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={SPRING_MED}
              role="alertdialog"
              aria-modal="true"
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 460,
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                padding: 28,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
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

              <p
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "center",
                  color: TOKEN.textPri,
                  margin: "0 0 8px",
                }}
              >
                {isApprove ? "Approve Request" : "Reject Request"}
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
                {isApprove
                  ? "The request will be executed immediately after approval."
                  : "The request will be discarded and no changes will be applied."}
              </p>

              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    background: TOKEN.bg,
                    border: `1px solid ${TOKEN.border}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: TOKEN.surface,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Package size={16} color={TOKEN.textSec} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 600,
                          color: TOKEN.textPri,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {displayName}
                      </p>
                      {itemCode && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            fontFamily: "monospace",
                            color: TOKEN.textSec,
                          }}
                        >
                          {itemCode}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                        request.type === "create" &&
                          "bg-sky-50 text-sky-700 border-sky-200",
                        request.type === "update" &&
                          "bg-violet-50 text-violet-700 border-violet-200",
                        request.type === "delete" &&
                          "bg-rose-50 text-rose-700 border-rose-200",
                      )}
                    >
                      {request.type}
                    </span>
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: TOKEN.textSec,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  <MessageSquare size={12} />
                  Remarks
                  <span style={{ color: TOKEN.danger }}>*</span>
                </label>
                <textarea
                  autoFocus
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    if (e.target.value.trim()) setError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  placeholder={
                    isApprove
                      ? "Explain why you are approving this request..."
                      : "Explain why you are rejecting this request..."
                  }
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${error ? TOKEN.danger : TOKEN.border}`,
                    background: TOKEN.surface,
                    fontSize: 14,
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                  disabled={loading}
                />
                {error && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: TOKEN.danger,
                    }}
                  >
                    <AlertCircle size={14} /> Remarks are required.
                  </p>
                )}
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 10,
                    color: TOKEN.textSec,
                  }}
                >
                  Tip: Press Ctrl+Enter / ⌘+Enter to confirm.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
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
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: remarksOk ? 1.02 : 1 }}
                  whileTap={{ scale: remarksOk ? 0.97 : 1 }}
                  onClick={handleConfirm}
                  disabled={loading || !remarksOk}
                  style={{
                    flex: 2,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "none",
                    background: remarksOk ? primaryColor : TOKEN.border,
                    opacity: remarksOk ? 1 : 0.6,
                    color: remarksOk ? "#fff" : TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: remarksOk ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <PrimaryIcon size={16} />
                      {isApprove ? "Approve & Execute" : "Reject"}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
