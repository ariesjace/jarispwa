"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  startTransition,
} from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Package,
  X,
  ShieldOff,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { logAuditEvent } from "@/lib/logger";
import { useAuth } from "@/lib/useAuth";
import { hasAccess } from "@/lib/rbac";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOKEN } from "@/components/layout/tokens";

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_RESTORE_THRESHOLD = 90; // swipe right
const SWIPE_DELETE_THRESHOLD = 90; // swipe left

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDeletedAt(ts: any): string {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// ─── Inline styles (mirroring AllProducts exactly) ────────────────────────────

const tableContainerStyle: React.CSSProperties = {
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 16,
  overflow: "hidden",
  background: TOKEN.surface,
};
const stickyHeadStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: TOKEN.surface,
  zIndex: 10,
  borderBottom: `1px solid ${TOKEN.border}`,
  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
};
const thStyle: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: TOKEN.textSec,
};
const tdStyle: React.CSSProperties = {
  padding: "12px 12px",
  verticalAlign: "middle",
};
const imgThumbStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  background: TOKEN.bg,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  overflow: "hidden",
  filter: "grayscale(1)",
  opacity: 0.7,
};
const imgStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};
const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 6,
  cursor: "pointer",
  color: TOKEN.textSec,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const pageBtnStyle: React.CSSProperties = {
  padding: 6,
  borderRadius: 8,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const actionBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: TOKEN.surface,
  border: `1px solid ${TOKEN.border}`,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: TOKEN.textPri,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
const mobileImgStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  background: TOKEN.bg,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 6,
  flexShrink: 0,
  overflow: "hidden",
  filter: "grayscale(1)",
  opacity: 0.7,
};

// ─── Confirm Dialog (shared shape for restore + permanent delete) ──────────────

function ConfirmDialog({
  open,
  onOpenChange,
  item,
  mode,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: any | null;
  mode: "restore" | "delete";
  onConfirm: (item: any) => Promise<void>;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const required = item?.itemDescription || item?.name || "";
  const isMatch = inputValue === required;
  const isRestore = mode === "restore";

  useEffect(() => {
    if (!open) setInputValue("");
  }, [open]);

  const handleConfirm = async () => {
    if (!isMatch || !item) return;
    setIsLoading(true);
    try {
      await onConfirm(item);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const primaryColor = isRestore ? "#10b981" : TOKEN.danger;
  const primaryBg = isRestore ? "#d1fae5" : TOKEN.dangerBg;
  const Icon = isRestore ? RotateCcw : Trash2;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isLoading && onOpenChange(false)}
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
              key="confirm-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
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
              {/* Icon */}
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
                  <Icon size={24} color={primaryColor} />
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
                {isRestore ? "Restore Product" : "Delete Forever"}
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
                {isRestore
                  ? "This item will be moved back to the products collection."
                  : "This item will be permanently removed. This cannot be undone."}
              </p>

              {/* Item preview */}
              <div
                style={{
                  background: TOKEN.bg,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: TOKEN.textSec,
                    textTransform: "uppercase",
                  }}
                >
                  Item
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: TOKEN.textPri,
                    wordBreak: "break-word",
                  }}
                >
                  {item?.itemDescription || item?.name || "Unnamed"}
                </p>
                {(item?.litItemCode || item?.ecoItemCode || item?.itemCode) && (
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: TOKEN.textSec,
                    }}
                  >
                    {item?.litItemCode || item?.ecoItemCode || item?.itemCode}
                  </p>
                )}
              </div>

              {/* Confirm input */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: TOKEN.textSec,
                  marginBottom: 8,
                }}
              >
                Type{" "}
                <strong
                  style={{ color: TOKEN.textPri, fontFamily: "monospace" }}
                >
                  {required}
                </strong>{" "}
                to confirm
              </label>
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={required}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isMatch) handleConfirm();
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${inputValue.length > 0 ? (isMatch ? "#22c55e" : TOKEN.danger) : TOKEN.border}`,
                  background: TOKEN.surface,
                  fontSize: 14,
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {inputValue.length > 0 && !isMatch && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 11,
                    color: TOKEN.danger,
                  }}
                >
                  Doesn't match. Type exactly as shown.
                </p>
              )}
              {!isRestore && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: 12,
                    background: `${TOKEN.danger}08`,
                    border: `1px solid ${TOKEN.danger}22`,
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <AlertTriangle
                    size={13}
                    color={TOKEN.danger}
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: TOKEN.danger,
                      lineHeight: 1.5,
                    }}
                  >
                    Permanent deletion cannot be reversed.
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
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
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: isMatch ? 1.02 : 1 }}
                  whileTap={{ scale: isMatch ? 0.97 : 1 }}
                  onClick={handleConfirm}
                  disabled={!isMatch || isLoading}
                  style={{
                    flex: 2,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "none",
                    background: isMatch ? primaryColor : TOKEN.border,
                    opacity: isMatch ? 1 : 0.6,
                    color: isMatch ? "#fff" : TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: isMatch ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {isLoading ? (
                    <Loader2
                      size={16}
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                  ) : (
                    <>
                      <Icon size={16} />
                      {isRestore ? "Restore" : "Delete Forever"}
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

// ─── Bulk Delete Dialog (long-press) ─────────────────────────────────────────

const LONG_PRESS_MS = 2000;

function BulkPermanentDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onConfirm: () => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);

  const pressStart = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPressProgress(0);
      setIsPressing(false);
      firedRef.current = false;
      pressStart.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [open]);

  const executeConfirm = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onConfirm, onOpenChange]);

  const tick = useCallback(() => {
    if (!pressStart.current) return;
    const elapsed = Date.now() - pressStart.current;
    const progress = Math.min((elapsed / LONG_PRESS_MS) * 100, 100);
    setPressProgress(progress);
    if (progress >= 100 && !firedRef.current) {
      firedRef.current = true;
      executeConfirm();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [executeConfirm]);

  const startPress = useCallback(() => {
    if (isLoading || firedRef.current) return;
    pressStart.current = Date.now();
    firedRef.current = false;
    setPressProgress(0);
    setIsPressing(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [isLoading, tick]);

  const cancelPress = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pressStart.current = null;
    setIsPressing(false);
    if (!firedRef.current) setPressProgress(0);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bulk-del-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isLoading && onOpenChange(false)}
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
              key="bulk-del-dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
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
                    background: TOKEN.dangerBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={24} color={TOKEN.danger} />
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
                Delete {count} Items Forever
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
                These items will be permanently removed and cannot be recovered.
              </p>
              <div
                style={{
                  background: TOKEN.bg,
                  border: `1px dashed ${TOKEN.border}`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: TOKEN.textSec,
                    lineHeight: 1.5,
                  }}
                >
                  Hold the button below for <strong>2 seconds</strong> to
                  confirm.
                </p>
              </div>
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
                  }}
                >
                  Cancel
                </motion.button>
                <div
                  style={{
                    flex: 2,
                    position: "relative",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
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
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      userSelect: "none",
                    }}
                  >
                    {isLoading ? (
                      <span>Deleting...</span>
                    ) : isPressing ? (
                      `Hold… ${Math.round(pressProgress)}%`
                    ) : (
                      <>
                        <Trash2 size={16} /> Hold to Delete {count} Forever
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecycleBin() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<any>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);

  // ── RBAC ───────────────────────────────────────────────────────────────────
  const { user } = useAuth();
  const canManageRecycleBin = hasAccess(user, "verify", "products");

  // ── Table state ────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>([
    { id: "deletedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Optimised search — split input from filter (same pattern as AllProducts)
  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => setGlobalFilter(value));
    }, 300);
  }, []);

  // ── Swipe state (mobile) ───────────────────────────────────────────────────
  const [swipingCardId, setSwipingCardId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeOffsetRef = useRef(0);
  const swipeCardIdRef = useRef<string | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeDirectionRef = useRef<"h" | "v" | null>(null);

  // ── Responsive ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Firestore ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "recycle_bin"),
      orderBy("deletedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Failed to load recycle bin.");
        setIsLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── Mutation handlers ──────────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (item: any) => {
      if (!canManageRecycleBin) {
        toast.error("You don't have permission to restore products.");
        return;
      }
      const targetCollection = item.originalCollection || "products";
      const batch = writeBatch(db);
      const {
        id,
        deletedAt,
        deletedBy,
        originalCollection,
        originPage,
        ...originalData
      } = item;
      batch.set(doc(db, targetCollection, id), originalData);
      batch.delete(doc(db, "recycle_bin", id));
      await batch.commit();
      await logAuditEvent({
        action: "restore",
        entityType: targetCollection,
        entityId: id,
        entityName: item.name || item.itemDescription,
        context: {
          page: "/admin/deleted-products",
          source: "recycle-bin:restore",
          collection: targetCollection,
        },
      });
      toast.success(
        `"${item.itemDescription || item.name}" restored successfully.`,
      );
    },
    [canManageRecycleBin],
  );

  const handlePermanentDelete = useCallback(
    async (item: any) => {
      if (!canManageRecycleBin) {
        toast.error(
          "You don't have permission to permanently delete products.",
        );
        return;
      }
      await deleteDoc(doc(db, "recycle_bin", item.id));
      await logAuditEvent({
        action: "delete",
        entityType: item.originalCollection || "products",
        entityId: item.id,
        entityName: item.name || item.itemDescription,
        context: {
          page: "/admin/deleted-products",
          source: "recycle-bin:permanent-delete",
          collection: "recycle_bin",
        },
      });
      toast.success(
        `"${item.itemDescription || item.name}" permanently deleted.`,
      );
    },
    [canManageRecycleBin],
  );

  const handleBulkRestore = useCallback(async () => {
    if (!canManageRecycleBin) {
      toast.error("You don't have permission to restore products.");
      return;
    }
    const selectedItems = data.filter((item) => {
      const row = table
        .getRowModel()
        .rows.find((r) => r.original.id === item.id);
      return row?.getIsSelected();
    });
    if (!selectedItems.length) return;
    setIsBulkRestoring(true);
    try {
      const CHUNK_SIZE = 200;
      for (let i = 0; i < selectedItems.length; i += CHUNK_SIZE) {
        const chunk = selectedItems.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const targetCollection = item.originalCollection || "products";
          const {
            id,
            deletedAt,
            deletedBy,
            originalCollection,
            originPage,
            ...originalData
          } = item;
          batch.set(doc(db, targetCollection, id), originalData);
          batch.delete(doc(db, "recycle_bin", id));
        });
        await batch.commit();
      }
      await logAuditEvent({
        action: "restore",
        entityType: "products",
        entityId: null,
        entityName: `${selectedItems.length} items`,
        context: {
          page: "/admin/deleted-products",
          source: "recycle-bin:bulk-restore",
          collection: "recycle_bin",
          bulk: true,
        },
        metadata: { ids: selectedItems.map((i: any) => i.id) },
      });
      toast.success(
        `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""} restored successfully.`,
      );
      table.resetRowSelection();
    } catch {
      toast.error("Failed to restore selected items.");
    } finally {
      setIsBulkRestoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageRecycleBin, data]);

  const handleBulkPermanentDelete = useCallback(async () => {
    if (!canManageRecycleBin) {
      toast.error("You don't have permission to permanently delete products.");
      return;
    }
    const selectedItems = data.filter((item) => {
      const row = table
        .getRowModel()
        .rows.find((r) => r.original.id === item.id);
      return row?.getIsSelected();
    });
    const batch = writeBatch(db);
    const ids: string[] = [];
    selectedItems.forEach((item: any) => {
      ids.push(item.id);
      batch.delete(doc(db, "recycle_bin", item.id));
    });
    await batch.commit();
    await logAuditEvent({
      action: "delete",
      entityType: "products",
      entityId: null,
      entityName: `${ids.length} items`,
      context: {
        page: "/admin/deleted-products",
        source: "recycle-bin:bulk-permanent-delete",
        collection: "recycle_bin",
        bulk: true,
      },
      metadata: { ids },
    });
    toast.success(`${ids.length} item(s) permanently deleted.`);
    table.resetRowSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageRecycleBin, data]);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) =>
          canManageRecycleBin ? (
            <div style={{ marginLeft: 8 }}>
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                aria-label="Select all"
              />
            </div>
          ) : null,
        cell: ({ row }) =>
          canManageRecycleBin ? (
            <div style={{ marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(v) => row.toggleSelected(!!v)}
                aria-label="Select row"
              />
            </div>
          ) : null,
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "image",
        header: "Image",
        cell: ({ row }) => {
          const url = row.original.mainImage || row.original.imageUrl;
          return (
            <div style={imgThumbStyle}>
              {url ? (
                <img src={url} style={imgStyle} alt="" loading="lazy" />
              ) : (
                <Package size={18} color={TOKEN.textSec} />
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "productDetails",
        header: "Product Info",
        accessorFn: (row) => `${row.name || ""} ${row.itemDescription || ""}`,
        cell: ({ row }) => (
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 600,
                color: TOKEN.textPri,
              }}
            >
              {row.original.itemDescription || row.original.name || "Unnamed"}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: TOKEN.bg,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 4,
                  color: TOKEN.textSec,
                }}
              >
                {Array.isArray(row.original.brands)
                  ? row.original.brands.join(", ")
                  : row.original.brand || "Generic"}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: `${TOKEN.textSec}10`,
                  borderRadius: 4,
                  color: TOKEN.textSec,
                  opacity: 0.7,
                }}
              >
                {row.original.originalCollection || "products"}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "itemCode",
        header: "Item Code",
        accessorFn: (row) =>
          row.litItemCode || row.ecoItemCode || row.itemCode || "",
        cell: ({ row }) => (
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: TOKEN.textSec,
            }}
          >
            {row.original.litItemCode ||
              row.original.ecoItemCode ||
              row.original.itemCode ||
              "—"}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        accessorFn: (row) => row.originPage || "",
        cell: ({ row }) => (
          <span style={{ fontSize: 11, color: TOKEN.textSec }}>
            {row.original.originPage || "—"}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.deletedAt?.toMillis?.() ?? 0,
        id: "deletedAt",
        header: "Deleted",
        cell: ({ row }) => (
          <span style={{ fontSize: 11, color: TOKEN.textSec }}>
            {formatDeletedAt(row.original.deletedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div style={{ textAlign: "right", paddingRight: 8 }}>Actions</div>
        ),
        cell: ({ row }) =>
          canManageRecycleBin ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                paddingRight: 8,
              }}
            >
              <button
                style={{ ...iconBtnStyle, color: "#10b981" }}
                title="Restore"
                onClick={(e) => {
                  e.stopPropagation();
                  setRestoreTarget(row.original);
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                style={{ ...iconBtnStyle, color: TOKEN.danger }}
                title="Delete forever"
                onClick={(e) => {
                  e.stopPropagation();
                  setPermanentDeleteTarget(row.original);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "right", paddingRight: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  color: TOKEN.textSec,
                  fontStyle: "italic",
                }}
              >
                read only
              </span>
            </div>
          ),
        enableSorting: false,
      },
    ],
    [canManageRecycleBin],
  );

  // ── Table instance ─────────────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const isBulk = selectedRows.length > 0 && canManageRecycleBin;

  // ── Long-press to select (mobile) ──────────────────────────────────────────
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);

  const handleCardPressStart = useCallback(
    (id: string) => {
      if (isBulk) return;
      longPressActiveRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        if (!canManageRecycleBin) return;
        longPressActiveRef.current = true;
        const row = table.getFilteredRowModel().rows.find((r) => r.id === id);
        if (row) {
          navigator.vibrate?.(60);
          row.toggleSelected(true);
        }
      }, 500);
    },
    [isBulk, table, canManageRecycleBin],
  );

  const handleCardPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCardTap = useCallback(
    (id: string, product: any) => {
      if (longPressActiveRef.current) {
        longPressActiveRef.current = false;
        return;
      }
      if (isBulk) {
        const row = table.getFilteredRowModel().rows.find((r) => r.id === id);
        if (row) {
          navigator.vibrate?.(50);
          row.toggleSelected();
        }
      }
    },
    [isBulk, table],
  );

  // ── Swipe handlers (mobile) ────────────────────────────────────────────────
  const handleSwipeTouchStart = useCallback(
    (e: React.TouchEvent, rowId: string) => {
      if (isBulk) return;
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      swipeDirectionRef.current = null;
      swipeCardIdRef.current = rowId;
      swipeOffsetRef.current = 0;
      setSwipingCardId(rowId);
      setSwipeOffset(0);
      handleCardPressStart(rowId);
    },
    [isBulk, handleCardPressStart],
  );

  const handleSwipeTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeCardIdRef.current) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (
        swipeDirectionRef.current === null &&
        (Math.abs(dx) > 6 || Math.abs(dy) > 6)
      ) {
        swipeDirectionRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      if (swipeDirectionRef.current !== "h") return;
      handleCardPressEnd();
      // Clamp: right = positive (restore), left = negative (delete)
      const clamped = Math.max(Math.min(dx, 150), -150);
      swipeOffsetRef.current = clamped;
      setSwipeOffset(clamped);
    },
    [handleCardPressEnd],
  );

  const handleSwipeTouchEnd = useCallback(
    (product: any) => {
      handleCardPressEnd();
      if (!canManageRecycleBin) {
        setSwipingCardId(null);
        setSwipeOffset(0);
        swipeOffsetRef.current = 0;
        swipeCardIdRef.current = null;
        swipeDirectionRef.current = null;
        return;
      }
      const offset = swipeOffsetRef.current;
      if (swipeDirectionRef.current === "h") {
        if (offset >= SWIPE_RESTORE_THRESHOLD) {
          setRestoreTarget(product);
        } else if (offset <= -SWIPE_DELETE_THRESHOLD) {
          setPermanentDeleteTarget(product);
        }
      }
      setSwipingCardId(null);
      setSwipeOffset(0);
      swipeOffsetRef.current = 0;
      swipeCardIdRef.current = null;
      swipeDirectionRef.current = null;
    },
    [handleCardPressEnd, canManageRecycleBin],
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        style={{
          padding: "100px 0",
          textAlign: "center",
          color: TOKEN.textSec,
        }}
      >
        <div className="spinner" />
        <p
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.3em",
            marginTop: 12,
          }}
        >
          LOADING DATA
        </p>
        <style
          dangerouslySetInnerHTML={{
            __html: `.spinner{width:24px;height:24px;border:2px solid ${TOKEN.border};border-top-color:${TOKEN.primary};border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;}@keyframes spin{to{transform:rotate(360deg);}}`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
      }}
    >
      {/* ── Sticky toolbar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: TOKEN.bg,
          paddingTop: 16,
          paddingBottom: 16,
          marginLeft: isMobile ? -16 : -24,
          marginRight: isMobile ? -16 : -24,
          paddingLeft: isMobile ? 16 : 24,
          paddingRight: isMobile ? 16 : 24,
          boxShadow: `0 8px 0 0 ${TOKEN.bg}, 0 9px 0 0 ${TOKEN.border}22`,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                color: TOKEN.textPri,
              }}
            >
              Recycle Bin
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: TOKEN.bg,
                border: `1px solid ${TOKEN.border}`,
                borderRadius: 6,
                padding: "2px 8px",
                color: TOKEN.textSec,
                fontFamily: "monospace",
              }}
            >
              {table.getFilteredRowModel().rows.length}
            </span>
          </div>
        </div>

        {/* Read-only banner */}
        {!canManageRecycleBin && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 14,
            }}
          >
            <ShieldOff
              size={15}
              color="#d97706"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              You have <strong>read-only</strong> access to the recycle bin.
              Restoring or permanently deleting items requires{" "}
              <code
                style={{
                  background: "#fef3c7",
                  padding: "1px 4px",
                  borderRadius: 3,
                }}
              >
                verify:products
              </code>{" "}
              permission.
            </p>
          </div>
        )}

        {/* Desktop bulk banner */}
        {!isMobile && isBulk && (
          <div
            style={{
              background: `${TOKEN.primary}10`,
              border: `1px solid ${TOKEN.primary}30`,
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}
            >
              {selectedRows.length} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={actionBtnStyle}
                onClick={() => table.resetRowSelection()}
              >
                Cancel
              </button>
              <button
                style={{
                  ...actionBtnStyle,
                  background: "#d1fae5",
                  color: "#065f46",
                  border: "1px solid #6ee7b7",
                }}
                onClick={handleBulkRestore}
                disabled={isBulkRestoring}
              >
                {isBulkRestoring ? (
                  <Loader2
                    size={13}
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                ) : (
                  <RotateCcw size={13} />
                )}
                Restore All
              </button>
              <button
                style={{
                  ...actionBtnStyle,
                  background: TOKEN.dangerBg,
                  color: TOKEN.dangerText,
                  border: `1px solid ${TOKEN.danger}33`,
                }}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 size={13} /> Delete Forever
              </button>
            </div>
          </div>
        )}

        {/* Mobile bulk banner */}
        {isMobile && isBulk && (
          <div
            style={{
              background: TOKEN.surface,
              border: `1px solid ${TOKEN.primary}`,
              borderRadius: 12,
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{ fontSize: 15, fontWeight: 800, color: TOKEN.primary }}
              >
                {selectedRows.length} selected
              </span>
              <label
                style={{
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: TOKEN.textSec,
                  fontWeight: 600,
                }}
              >
                <Checkbox
                  checked={
                    table.getIsAllRowsSelected() ||
                    (table.getIsSomeRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
                />
                All ({table.getFilteredRowModel().rows.length})
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: 6,
                  cursor: "pointer",
                  color: TOKEN.textSec,
                  display: "flex",
                }}
                onClick={() => table.resetRowSelection()}
              >
                <X size={20} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      padding: 6,
                      cursor: "pointer",
                      color: TOKEN.textPri,
                      display: "flex",
                    }}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={handleBulkRestore}
                    disabled={isBulkRestoring}
                  >
                    <RotateCcw size={13} className="mr-2 text-emerald-600" />
                    {isBulkRestoring ? "Restoring…" : "Bulk Restore"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setBulkDeleteOpen(true)}
                    style={{ color: TOKEN.danger, fontWeight: 700 }}
                  >
                    <Trash2 size={13} className="mr-2" />
                    Delete Forever
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Info banner + Search */}
        {!isBulk && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 12,
              }}
            >
              <Clock
                size={14}
                color="#d97706"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  color: "#92400e",
                  lineHeight: 1.5,
                }}
              >
                Items in the recycle bin are soft-deleted and can be restored.
                {canManageRecycleBin
                  ? " Swipe right to restore, swipe left to delete. Or use the action buttons."
                  : " Contact a PD Manager or Admin to restore or remove items."}
              </p>
            </div>
            <div
              style={{
                position: "relative",
                flex: 1,
                maxWidth: isMobile ? "none" : 360,
              }}
            >
              <Search
                size={16}
                color={TOKEN.textSec}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder="Search by name or item code..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 16px 10px 40px",
                  fontSize: 13.5,
                  background: TOKEN.surface,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 12,
                  color: TOKEN.textPri,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="desktop-view" style={tableContainerStyle}>
        <div style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead style={stickyHeadStyle}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={thStyle}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: "64px 0",
                      textAlign: "center",
                      color: TOKEN.textSec,
                    }}
                  >
                    <Trash2
                      size={32}
                      style={{ margin: "0 auto 10px", opacity: 0.2 }}
                    />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      Recycle bin is empty
                    </p>
                    <p style={{ fontSize: 11, opacity: 0.6 }}>
                      Deleted items will appear here
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: `1px solid ${TOKEN.border}`,
                      background: row.getIsSelected()
                        ? `${TOKEN.primary}05`
                        : "transparent",
                      opacity: 0.85,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.85")
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={tdStyle}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: TOKEN.surface,
            borderTop: `1px solid ${TOKEN.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: TOKEN.textSec }}>
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: TOKEN.textSec }}>Rows:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: `1px solid ${TOKEN.border}`,
                  fontSize: 13,
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={pageBtnStyle}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: TOKEN.textSec }}
            >
              {table.getState().pagination.pageIndex + 1} /{" "}
              {table.getPageCount() || 1}
            </span>
            <button
              style={pageBtnStyle}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div
        className="mobile-view"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingTop: 8,
          paddingBottom: 100,
        }}
      >
        {table.getFilteredRowModel().rows.length === 0 ? (
          <div
            style={{
              padding: "80px 0",
              textAlign: "center",
              color: TOKEN.textSec,
            }}
          >
            <Trash2 size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: TOKEN.textPri,
                marginBottom: 6,
              }}
            >
              Recycle bin is empty
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Deleted items will appear here
            </p>
          </div>
        ) : (
          table.getFilteredRowModel().rows.map((row) => {
            const product = row.original;
            const isSelected = row.getIsSelected();
            const isThisSwiping = swipingCardId === row.id;
            const currentOffset = isThisSwiping ? swipeOffset : 0;

            // Restore zone (right) and delete zone (left)
            const restoreZoneW = Math.max(currentOffset, 0);
            const deleteZoneW = Math.max(-currentOffset, 0);
            const pastRestoreThreshold =
              restoreZoneW >= SWIPE_RESTORE_THRESHOLD;
            const pastDeleteThreshold = deleteZoneW >= SWIPE_DELETE_THRESHOLD;

            return (
              <div
                key={row.id}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 16,
                  flexShrink: 0,
                }}
              >
                {/* ── Restore zone (right swipe, left side) ── */}
                {canManageRecycleBin && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: restoreZoneW,
                      background: pastRestoreThreshold ? "#059669" : "#10b981",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: isThisSwiping
                        ? "none"
                        : "width 0.3s ease, background 0.15s",
                      borderRadius: "16px 0 0 16px",
                    }}
                  >
                    {restoreZoneW > 40 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <RotateCcw
                          size={22}
                          color="#fff"
                          style={{ opacity: pastRestoreThreshold ? 1 : 0.85 }}
                        />
                        {pastRestoreThreshold && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#fff",
                              textTransform: "uppercase",
                            }}
                          >
                            Release
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Delete zone (left swipe, right side) ── */}
                {canManageRecycleBin && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: deleteZoneW,
                      background: pastDeleteThreshold
                        ? "#b91c1c"
                        : TOKEN.danger,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: isThisSwiping
                        ? "none"
                        : "width 0.3s ease, background 0.15s",
                      borderRadius: "0 16px 16px 0",
                    }}
                  >
                    {deleteZoneW > 40 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Trash2
                          size={22}
                          color="#fff"
                          style={{ opacity: pastDeleteThreshold ? 1 : 0.85 }}
                        />
                        {pastDeleteThreshold && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#fff",
                              textTransform: "uppercase",
                            }}
                          >
                            Release
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Card ── */}
                <div
                  style={{
                    borderRadius: 16,
                    padding: "16px 14px",
                    border: isSelected
                      ? `2px solid ${TOKEN.primary}`
                      : `1px solid ${TOKEN.border}`,
                    background: isSelected
                      ? `${TOKEN.primary}08`
                      : TOKEN.surface,
                    position: "relative",
                    WebkitUserSelect: "none",
                    opacity: 0.88,
                    transform: `translateX(${Math.max(Math.min(currentOffset, 150), -150)}px)`,
                    transition: isThisSwiping
                      ? "none"
                      : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                    borderTopLeftRadius: restoreZoneW > 8 ? 0 : 16,
                    borderBottomLeftRadius: restoreZoneW > 8 ? 0 : 16,
                    borderTopRightRadius: deleteZoneW > 8 ? 0 : 16,
                    borderBottomRightRadius: deleteZoneW > 8 ? 0 : 16,
                  }}
                  onTouchStart={(e) => handleSwipeTouchStart(e, row.id)}
                  onTouchMove={handleSwipeTouchMove}
                  onTouchEnd={() => handleSwipeTouchEnd(product)}
                  onTouchCancel={() => {
                    setSwipingCardId(null);
                    setSwipeOffset(0);
                    swipeOffsetRef.current = 0;
                    swipeCardIdRef.current = null;
                    swipeDirectionRef.current = null;
                    handleCardPressEnd();
                  }}
                  onClick={() => handleCardTap(row.id, product)}
                >
                  <div style={{ display: "flex", gap: 16 }}>
                    {/* Image */}
                    <div style={mobileImgStyle}>
                      {product.mainImage || product.imageUrl ? (
                        <img
                          src={product.mainImage || product.imageUrl}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                          }}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <Package size={24} color={TOKEN.textSec} />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color: TOKEN.textPri,
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {product.itemDescription || product.name || "Untitled"}
                      </h4>
                      {(product.litItemCode ||
                        product.ecoItemCode ||
                        product.itemCode) && (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: TOKEN.textSec,
                          }}
                        >
                          {product.litItemCode ||
                            product.ecoItemCode ||
                            product.itemCode}
                        </p>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                          marginTop: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 6px",
                            background: TOKEN.bg,
                            border: `1px solid ${TOKEN.border}`,
                            borderRadius: 4,
                            color: TOKEN.textSec,
                          }}
                        >
                          {Array.isArray(product.brands)
                            ? product.brands.join(", ")
                            : product.brand || "Generic"}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 6px",
                            background: `${TOKEN.textSec}10`,
                            borderRadius: 4,
                            color: TOKEN.textSec,
                          }}
                        >
                          {product.originalCollection || "products"}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 10,
                          color: TOKEN.textSec,
                        }}
                      >
                        {formatDeletedAt(product.deletedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Swipe hint */}
                  {canManageRecycleBin && !isBulk && !isThisSwiping && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: `1px solid ${TOKEN.border}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: TOKEN.textSec,
                          opacity: 0.5,
                        }}
                      >
                        ← delete
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: TOKEN.textSec,
                          opacity: 0.5,
                        }}
                      >
                        restore →
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(v) => !v && setRestoreTarget(null)}
        item={restoreTarget}
        mode="restore"
        onConfirm={handleRestore}
      />
      <ConfirmDialog
        open={!!permanentDeleteTarget}
        onOpenChange={(v) => !v && setPermanentDeleteTarget(null)}
        item={permanentDeleteTarget}
        mode="delete"
        onConfirm={handlePermanentDelete}
      />
      <BulkPermanentDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedRows.length}
        onConfirm={handleBulkPermanentDelete}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .desktop-view { display: none !important; }
        .mobile-view { display: flex; }
        @media (min-width: 1024px) {
          .desktop-view { display: flex !important; flex-direction: column; gap: 16px; }
          .mobile-view { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `,
        }}
      />
    </div>
  );
}
