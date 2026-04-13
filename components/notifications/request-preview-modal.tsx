"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  User,
  Calendar,
  Tag,
  Database,
  Loader2,
  Package,
  Hash,
  Layers,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  approveRequest,
  rejectRequest,
  PendingRequest,
  resolveProductName,
  resolveProductMeta,
} from "@/lib/requestService";
import { useAuth } from "@/lib/useAuth";
import { hasAccess } from "@/lib/rbac";
import { Timestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types, Utilities, Components ──────────────────────────────────────────────

function computeDiff(before: any, after: any): { field: string; before: any; after: any }[] {
  const changes: { field: string; before: any; after: any }[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of allKeys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: key, before: b, after: a });
    }
  }
  return changes;
}

function BeforeAfterPanel({ payload }: { payload: any }) {
  const changes = computeDiff(payload?.before, payload?.after);
  if (!changes.length) return <p className="text-sm text-muted-foreground">No changes detected.</p>;

  return (
    <div className="space-y-3">
      {changes.map(({ field, before, after }) => (
        <div key={field} className="grid grid-cols-3 gap-4 p-3 bg-muted/20 rounded-lg border">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">Field</p>
            <p className="text-sm font-medium">{field}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">Before</p>
            <p className="text-sm break-words">{JSON.stringify(before) || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">After</p>
            <p className="text-sm break-words">{JSON.stringify(after) || "—"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<
    string,
    { bg: string; color: string; Icon: React.ElementType; label: string }
  > = {
    pending: { bg: "#fef9c3", color: "#a16207", Icon: Clock, label: "Pending" },
    approved: {
      bg: "#dcfce7",
      color: "#15803d",
      Icon: CheckCircle2,
      label: "Approved",
    },
    rejected: {
      bg: "#fee2e2",
      color: "#b91c1c",
      Icon: XCircle,
      label: "Rejected",
    },
  };
  const cfg = configs[status] ?? configs.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase" as const,
        padding: "2px 7px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      <cfg.Icon size={10} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, React.CSSProperties> = {
    create: { background: "#e0f2fe", color: "#0369a1" },
    update: { background: "#ede9fe", color: "#6d28d9" },
    delete: { background: "#fee2e2", color: "#b91c1c" },
  };
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase" as const,
        padding: "2px 7px",
        borderRadius: 4,
        ...(styles[type] ?? { background: TOKEN.bg, color: TOKEN.textSec }),
      }}
    >
      {type}
    </span>
  );
}

function ProductIdentityPanel({ request }: { request: PendingRequest }) {
  const productName = resolveProductName(request.payload?.after || request.payload);
  const litCode = request.payload?.after?.litItemCode || request.payload?.litItemCode;
  const ecoCode = request.payload?.after?.ecoItemCode || request.payload?.ecoItemCode;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Package className="w-5 h-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{productName || "Unnamed Product"}</p>
          <div className="flex gap-2 mt-1">
            {litCode && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                LIT: {litCode}
              </span>
            )}
            {ecoCode && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                ECO: {ecoCode}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ... [Keep Types, Utilities, computeDiff, BeforeAfterPanel, StatusBadge, TypeBadge, and ProductIdentityPanel exactly as they were in your original code] ...

interface RequestPreviewModalProps {
  request: PendingRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onActionComplete?: () => void;
}

export function RequestPreviewModal({
  request,
  open,
  onOpenChange,
  onActionComplete,
}: RequestPreviewModalProps) {
  const { user } = useAuth();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState(false);

  const canApprove =
    !!user &&
    (hasAccess(user, "verify", request?.resource ?? "") ||
      hasAccess(user, "verify", "*"));

  const reviewer = { uid: user?.uid ?? "", name: user?.name };

  function validateRemarks(): boolean {
    if (!remarks.trim()) {
      setRemarksError(true);
      toast.error("Remarks are required before approving or rejecting.");
      document
        .getElementById("review-remarks")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    setRemarksError(false);
    return true;
  }

  const handleApprove = async () => {
    if (!request || !validateRemarks()) return;
    setApproving(true);
    const t = toast.loading("Approving request…");
    try {
      await approveRequest(request.id, reviewer);
      await updateDoc(doc(db, "requests", request.id), {
        reviewRemarks: remarks.trim(),
      }).catch(() => {});
      toast.success("Request approved and executed.", { id: t });
      setRemarks("");
      setRemarksError(false);
      onActionComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Approval failed.", { id: t });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!request || !validateRemarks()) return;
    setRejecting(true);
    const t = toast.loading("Rejecting request…");
    try {
      await rejectRequest(request.id, reviewer);
      await updateDoc(doc(db, "requests", request.id), {
        reviewRemarks: remarks.trim(),
      }).catch(() => {});
      toast.success("Request rejected.", { id: t });
      setRemarks("");
      setRemarksError(false);
      onActionComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Rejection failed.", { id: t });
    } finally {
      setRejecting(false);
    }
  };

  const busy = approving || rejecting;
  const isPending = request?.status === "pending";
  const isUpdateRequest = request?.type === "update";
  const remarksOk = remarks.trim().length > 0;

  if (!request) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!busy) {
                setRemarks("");
                setRemarksError(false);
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
              key="preview-dialog"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={SPRING_MED}
              role="dialog"
              aria-modal="true"
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 760,
                height: "84vh",
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* ── Header ── */}
              <div
                style={{
                  padding: "24px 28px 16px",
                  borderBottom: `1px solid ${TOKEN.border}`,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: TOKEN.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={22} color={TOKEN.textSec} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: TOKEN.textPri,
                          margin: 0,
                          textTransform: "uppercase",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Request Details
                      </p>
                      <StatusBadge status={request.status} />
                      <TypeBadge type={request.type} />
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: TOKEN.textSec,
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      ID: {request.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                <div className="space-y-6">
                  <ProductIdentityPanel request={request} />

                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <Database className="w-3 h-3" /> Resource
                      </p>
                      <p className="text-sm font-medium capitalize text-foreground">
                        {request.resource}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Action
                      </p>
                      <TypeBadge type={request.type} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3" /> Requested By
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {request.requestedByName || request.requestedBy}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Submitted
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {format(request.createdAt.toDate(), 'PP')}
                      </p>
                    </div>
                  </div>

                  {request.resourceId && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                        Target Document ID
                      </p>
                      <p className="text-xs font-mono text-muted-foreground break-all bg-muted/50 border rounded-lg px-3 py-2">
                        {request.resourceId}
                      </p>
                    </div>
                  )}

                  {isUpdateRequest && request.payload && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold uppercase text-foreground tracking-wider">
                          Changes — Before vs After
                        </p>
                        <BeforeAfterPanel payload={request.payload} />
                      </div>
                    </>
                  )}

                  {request.status !== "pending" && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            Reviewed By
                          </p>
                          <p className="text-sm font-medium">
                            {request.reviewedByName ||
                              request.reviewedBy ||
                              "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            Reviewed At
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {request.reviewedAt ? format(request.reviewedAt.toDate(), 'PP') : '—'}
                          </p>
                        </div>
                      </div>
                      {(request as any).reviewRemarks && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Remarks
                          </p>
                          <p className="text-sm bg-muted/40 border rounded-lg px-3 py-2.5 italic text-foreground">
                            "{(request as any).reviewRemarks}"
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {isPending && canApprove && (
                    <div
                      style={{
                        background: TOKEN.bg,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <label
                        htmlFor="review-remarks"
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
                        <MessageSquare size={12} /> Remarks
                        <span style={{ color: TOKEN.danger }}>*</span>
                        <span
                          style={{
                            fontWeight: 400,
                            textTransform: "none",
                            opacity: 0.6,
                            marginLeft: 4,
                          }}
                        >
                          required before approve/reject
                        </span>
                      </label>
                      <textarea
                        id="review-remarks"
                        value={remarks}
                        onChange={(e) => {
                          setRemarks(e.target.value);
                          if (e.target.value.trim()) setRemarksError(false);
                        }}
                        placeholder="Explain your decision before approving or rejecting…"
                        style={{
                          width: "100%",
                          minHeight: 80,
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: `1px solid ${remarksError ? TOKEN.danger : TOKEN.border}`,
                          background: TOKEN.surface,
                          fontSize: 14,
                          outline: "none",
                          resize: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                        disabled={busy}
                      />
                      {remarksError && (
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
                          <AlertCircle size={14} /> Remarks are required. Please
                          explain your decision.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              {isPending && canApprove ? (
                <div
                  style={{
                    padding: "16px 28px",
                    borderTop: `1px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                  }}
                >
                  {!remarksOk ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: TOKEN.textSec,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <AlertCircle size={14} color="#f59e0b" /> Add remarks
                      above to enable actions.
                    </p>
                  ) : (
                    <div /> // empty spacer
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <motion.button
                      whileHover={{ scale: remarksOk ? 1.02 : 1 }}
                      whileTap={{ scale: remarksOk ? 0.97 : 1 }}
                      onClick={handleReject}
                      disabled={busy || !remarksOk}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: `1px solid ${remarksOk ? "#fecdd3" : TOKEN.border}`, // rose-200
                        background: remarksOk ? "#fff1f2" : TOKEN.surface, // rose-50
                        color: remarksOk ? "#e11d48" : TOKEN.textSec, // rose-600
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: remarksOk ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: remarksOk ? 1 : 0.6,
                      }}
                    >
                      {rejecting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <XCircle size={16} />
                      )}
                      Reject
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: remarksOk ? 1.02 : 1 }}
                      whileTap={{ scale: remarksOk ? 0.97 : 1 }}
                      onClick={handleApprove}
                      disabled={busy || !remarksOk}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: "none",
                        background: remarksOk ? "#10b981" : TOKEN.border, // emerald-500
                        color: remarksOk ? "#fff" : TOKEN.textSec,
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: remarksOk ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: remarksOk ? 1 : 0.6,
                      }}
                    >
                      {approving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Approve & Execute
                    </motion.button>
                  </div>
                </div>
              ) : isPending && !canApprove ? (
                <div
                  style={{
                    padding: "16px 28px",
                    borderTop: `1px solid ${TOKEN.border}`,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: TOKEN.textSec }}>
                    Awaiting review by a PD Manager or Admin.
                  </p>
                </div>
              ) : null}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
