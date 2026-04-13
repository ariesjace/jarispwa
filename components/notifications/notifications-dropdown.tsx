"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Edit2,
  Trash2,
  Plus,
  Eye,
  ExternalLink,
  Inbox,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { toast } from "sonner";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";

import { useAuth } from "@/lib/useAuth";
import { canSeeNotifications, hasAccess } from "@/lib/rbac";
import {
  PendingRequest,
  approveRequest,
  rejectRequest,
} from "@/lib/requestService";
import { RequestPreviewModal } from "./request-preview-modal";
import {
  RemarksConfirmDialog,
  RemarksTarget,
  RemarksAction,
} from "./remarks-confirm-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return format(ts.toDate(), "MMM d");
  } catch {
    return "";
  }
}

function getRequestDisplayName(req: PendingRequest): string {
  const meta = req.meta ?? {};
  if (meta.productName) return String(meta.productName);
  const payload = req.payload ?? {};
  const d = payload.after ?? payload.productSnapshot ?? payload;
  return d?.itemDescription || d?.name || d?.itemCode || req.resourceId || "—";
}

function getRequestSubtitle(req: PendingRequest): string {
  const meta = req.meta ?? {};
  const parts: string[] = [];
  if (meta.litItemCode) parts.push(String(meta.litItemCode));
  else if (meta.ecoItemCode) parts.push(String(meta.ecoItemCode));
  if (meta.productFamily) parts.push(String(meta.productFamily));
  return parts.join(" · ");
}

function typeConfig(type: string): {
  Icon: React.ElementType;
  color: string;
  label: string;
} {
  if (type === "create")
    return { Icon: Plus, color: "#0891b2", label: "Create" };
  if (type === "delete")
    return { Icon: Trash2, color: TOKEN.danger, label: "Delete" };
  return { Icon: Edit2, color: TOKEN.secondary, label: "Update" };
}

function statusConfig(status: string): { color: string; label: string } {
  if (status === "approved") return { color: "#22c55e", label: "Approved" };
  if (status === "rejected") return { color: TOKEN.danger, label: "Rejected" };
  return { color: "#f59e0b", label: "Pending" };
}

// ─── Notification Item ────────────────────────────────────────────────────────

function NotificationItem({
  req,
  isVerifier,
  onPreview,
  onAction,
}: {
  req: PendingRequest;
  isVerifier: boolean;
  onPreview: (r: PendingRequest) => void;
  onAction: (target: RemarksTarget) => void;
}) {
  const displayName = getRequestDisplayName(req);
  const subtitle = getRequestSubtitle(req);
  const { Icon, color } = typeConfig(req.type);
  const status = statusConfig(req.status);
  const isPending = req.status === "pending";

  return (
    <motion.div
      whileHover={{ background: TOKEN.bg }}
      onClick={() => onPreview(req)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        borderBottom: `1px solid ${TOKEN.border}`,
        cursor: "pointer",
        background: isPending ? `${TOKEN.primary}05` : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Type icon */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={15} color={color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: name + unread dot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              fontWeight: isPending ? 700 : 600,
              color: TOKEN.textPri,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {displayName}
          </p>
          {isPending && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: TOKEN.primary,
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* Subtitle / item codes */}
        {subtitle && (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11,
              color: TOKEN.textSec,
              fontFamily: "monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Type chip */}
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "1px 5px",
                borderRadius: 4,
                background: `${color}18`,
                color,
              }}
            >
              {req.type}
            </span>

            {/* Status chip (for submitters or resolved) */}
            {(!isVerifier || !isPending) && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: `${status.color}18`,
                  color: status.color,
                }}
              >
                {status.label}
              </span>
            )}

            <span style={{ fontSize: 11, color: TOKEN.textSec, opacity: 0.7 }}>
              {isVerifier
                ? req.requestedByName
                  ? `${req.requestedByName} · `
                  : ""
                : ""}
              {relativeTime(req.createdAt)}
            </span>
          </div>

          {/* Action buttons — verifier + pending only */}
          {isVerifier && isPending && (
            <div
              style={{ display: "flex", gap: 4, flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onAction({ request: req, action: "approve" })}
                title="Approve"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: "none",
                  background: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <CheckCircle2 size={13} color="#16a34a" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onAction({ request: req, action: "reject" })}
                title="Reject"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: "none",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <XCircle size={13} color="#dc2626" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onPreview(req)}
                title="Preview"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: "none",
                  background: TOKEN.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Eye size={13} color={TOKEN.textSec} />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Dropdown ────────────────────────────────────────────────────────────

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [preview, setPreview] = useState<PendingRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [remarksTarget, setRemarksTarget] = useState<RemarksTarget | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

  const visible = canSeeNotifications(user);
  const isVerifier = hasAccess(user, "verify", "products");
  const isSubmitter = !isVerifier && hasAccess(user, "write", "products");
  const reviewer = { uid: user?.uid ?? "", name: user?.name };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Firebase subscription
  useEffect(() => {
    if (!visible || !user) return;

    const q = isVerifier
      ? query(
          collection(db, "requests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        )
      : query(collection(db, "requests"), where("requestedBy", "==", user.uid));

    const unsub = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as PendingRequest,
      );
      if (isSubmitter) {
        docs = docs.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
        );
      }
      setRequests(docs);
    });

    return unsub;
  }, [visible, isVerifier, isSubmitter, user]);

  if (!visible) return null;

  const pendingCount = isVerifier
    ? requests.length
    : requests.filter((r) => r.status === "pending").length;

  const handleRemarksConfirm = async (
    action: RemarksAction,
    requestId: string,
    remarks: string,
  ) => {
    const t = toast.loading(action === "approve" ? "Approving…" : "Rejecting…");
    try {
      if (action === "approve") {
        await approveRequest(requestId, reviewer);
      } else {
        await rejectRequest(requestId, reviewer);
      }
      await updateDoc(doc(db, "requests", requestId), {
        reviewRemarks: remarks,
      }).catch(() => {});
      toast.success(
        action === "approve"
          ? "Request approved and executed."
          : "Request rejected.",
        { id: t },
      );
    } catch (err: any) {
      toast.error(
        err.message ||
          `${action === "approve" ? "Approval" : "Rejection"} failed.`,
        { id: t },
      );
      throw err;
    }
  };

  return (
    <>
      <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
        {/* ── Trigger ── */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen((v) => !v)}
          aria-label={`Notifications${pendingCount ? ` (${pendingCount} pending)` : ""}`}
          aria-expanded={open}
          style={{
            position: "relative",
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${TOKEN.border}`,
            background: open ? `${TOKEN.primary}10` : TOKEN.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: open ? TOKEN.primary : TOKEN.textSec,
            transition: "background 0.15s, color 0.15s",
          }}
        >
          <Bell size={16} />
          {pendingCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: TOKEN.danger,
                border: `2px solid ${TOKEN.surface}`,
              }}
            />
          )}
        </motion.button>

        {/* ── Dropdown panel ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="notif-panel"
              initial={{ opacity: 0, scale: 0.93, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: -6 }}
              transition={SPRING_MED}
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: 360,
                background: TOKEN.surface,
                borderRadius: 18,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 16px 48px -8px rgba(15,23,42,0.16)",
                overflow: "hidden",
                transformOrigin: "top right",
                zIndex: 200,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px 12px",
                  borderBottom: `1px solid ${TOKEN.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: TOKEN.textPri,
                    }}
                  >
                    {isVerifier ? "Pending Approvals" : "My Requests"}
                  </p>
                  {pendingCount > 0 && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#fff",
                        background: TOKEN.danger,
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </div>
                {isVerifier && (
                  <a
                    href="/products/requests"
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: TOKEN.primary,
                      textDecoration: "none",
                    }}
                  >
                    View all <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Items list */}
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {requests.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: "36px 16px",
                      color: TOKEN.textSec,
                    }}
                  >
                    <Inbox size={32} style={{ opacity: 0.25 }} />
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>
                      {isVerifier
                        ? "No pending requests"
                        : "No requests submitted yet"}
                    </p>
                  </div>
                ) : (
                  requests.map((req) => (
                    <NotificationItem
                      key={req.id}
                      req={req}
                      isVerifier={isVerifier}
                      onPreview={(r) => {
                        setPreview(r);
                        setOpen(false);
                      }}
                      onAction={(target) => {
                        setOpen(false);
                        setRemarksTarget(target);
                      }}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              {requests.length > 0 && (
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: `1px solid ${TOKEN.border}`,
                  }}
                >
                  {isSubmitter && (
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: 11.5,
                        color: TOKEN.textSec,
                        textAlign: "center",
                      }}
                    >
                      {requests.filter((r) => r.status === "pending").length > 0
                        ? "Your requests are awaiting review."
                        : "All requests have been reviewed."}
                    </p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setOpen(false)}
                    style={{
                      width: "100%",
                      padding: "9px 0",
                      borderRadius: 10,
                      border: `1px solid ${TOKEN.border}`,
                      background: TOKEN.bg,
                      color: TOKEN.textSec,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full preview modal */}
      <RequestPreviewModal
        request={preview}
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
        onActionComplete={() => setPreview(null)}
      />

      {/* Remarks dialog */}
      <RemarksConfirmDialog
        target={remarksTarget}
        open={!!remarksTarget}
        onOpenChange={(v) => !v && setRemarksTarget(null)}
        onConfirm={handleRemarksConfirm}
      />
    </>
  );
}
