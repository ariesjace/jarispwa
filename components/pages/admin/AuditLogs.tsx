"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
} from "firebase/firestore";
import {
  Shield,
  Search,
  Activity,
  Clock,
  FileText,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  Package,
  X,
  Eye,
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
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN } from "@/components/layout/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditAction = "create" | "update" | "delete" | "restore";

interface AuditActor {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  accessLevel?: string | null;
}

interface AuditContext {
  page?: string;
  source?: string;
  collection?: string;
  bulk?: boolean;
  [key: string]: unknown;
}

interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  metadata?: Record<string, unknown> | null;
  context?: AuditContext | null;
  actor?: AuditActor | null;
  timestamp?: Timestamp | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; color: string; bg: string; dot: string }
> = {
  create:  { label: "Created",  color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  update:  { label: "Updated",  color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  delete:  { label: "Deleted",  color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
  restore: { label: "Restored", color: "#5b21b6", bg: "#ede9fe", dot: "#8b5cf6" },
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  product:     <Package  size={13} />,
  brand:       <Layers   size={13} />,
  application: <Globe    size={13} />,
  category:    <FileText size={13} />,
  products:    <Package  size={13} />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Manila",
  }).format(ts.toDate());
}

function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_GRADIENTS = [
  ["#2563eb","#1d4ed8"], ["#7c3aed","#6d28d9"], ["#059669","#047857"],
  ["#d97706","#b45309"], ["#dc2626","#b91c1c"], ["#0891b2","#0e7490"],
  ["#db2777","#be185d"], ["#0d9488","#0f766e"],
];

function avatarGradient(str: string | null | undefined): string[] {
  if (!str) return AVATAR_GRADIENTS[0];
  const hash = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const tableContainerStyle: React.CSSProperties = {
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 16,
  overflow: "hidden",
  background: TOKEN.surface,
};
const stickyHeadStyle: React.CSSProperties = {
  position: "sticky", top: 0, background: TOKEN.surface, zIndex: 10,
  borderBottom: `1px solid ${TOKEN.border}`, boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
};
const thStyle: React.CSSProperties = {
  padding: "14px 12px", fontSize: 12, fontWeight: 600, color: TOKEN.textSec,
};
const tdStyle: React.CSSProperties = { padding: "12px 12px", verticalAlign: "middle" };
const pageBtnStyle: React.CSSProperties = {
  padding: 6, borderRadius: 8, border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
};

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: AuditAction }) {
  const cfg = ACTION_CONFIG[action] ?? ACTION_CONFIG.update;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 800, textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 5,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  const [a, b] = avatarGradient(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${a}, ${b})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.3, fontWeight: 700, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  log,
  open,
  onClose,
}: {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!log) return null;
  const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.update;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="audit-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", zIndex: 200 }}
          />
          <div style={{ position: "fixed", inset: 0, zIndex: 201, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, pointerEvents: "none" }}>
            <motion.div
              key="audit-modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              role="dialog"
              aria-modal="true"
              style={{
                pointerEvents: "auto", width: "100%", maxWidth: 520,
                maxHeight: "84vh", background: TOKEN.surface, borderRadius: 20,
                border: `1px solid ${TOKEN.border}`, boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${TOKEN.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Shield size={16} color={cfg.color} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: TOKEN.textPri }}>Audit Log Detail</p>
                    <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: TOKEN.textSec }}>{log.id}</p>
                  </div>
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: TOKEN.textSec, padding: 4, display: "flex" }}>
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Action */}
                  <ActionBadge action={log.action} />

                  {/* Actor */}
                  <div style={{ background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: TOKEN.textSec, letterSpacing: "0.06em" }}>Actor</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={log.actor?.name || log.actor?.email} size={36} />
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TOKEN.textPri }}>{log.actor?.name || "Unknown User"}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>{log.actor?.email || "No email"}</p>
                        {log.actor?.role && (
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: TOKEN.textSec, textTransform: "capitalize" }}>
                            {log.actor.role}{log.actor.accessLevel ? ` · Level ${log.actor.accessLevel}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Entity */}
                  <div style={{ background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: TOKEN.textSec, letterSpacing: "0.06em" }}>Entity</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Type</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TOKEN.textPri, textTransform: "capitalize" }}>{log.entityType || "—"}</p>
                      </div>
                      <div>
                        <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>ID</p>
                        <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: TOKEN.textSec }}>{log.entityId || "—"}</p>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Name</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TOKEN.textPri }}>{log.entityName || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Context */}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div style={{ background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: TOKEN.textSec, letterSpacing: "0.06em" }}>Context</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {log.context.page && (
                          <div>
                            <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Page</p>
                            <p style={{ margin: 0, fontSize: 12, color: TOKEN.textPri }}>{log.context.page}</p>
                          </div>
                        )}
                        {log.context.source && (
                          <div>
                            <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Source</p>
                            <p style={{ margin: 0, fontSize: 12, color: TOKEN.textPri }}>{log.context.source}</p>
                          </div>
                        )}
                        {log.context.collection && (
                          <div>
                            <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Collection</p>
                            <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: TOKEN.textPri }}>{log.context.collection}</p>
                          </div>
                        )}
                        {log.context.bulk && (
                          <div>
                            <p style={{ margin: "0 0 2px", fontSize: 10, color: TOKEN.textSec }}>Bulk Action</p>
                            <p style={{ margin: 0, fontSize: 12, color: TOKEN.textPri }}>Yes</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={13} color={TOKEN.textSec} />
                    <span style={{ fontSize: 12, color: TOKEN.textSec }}>{formatTimestamp(log.timestamp)}</span>
                  </div>

                  {/* Raw metadata */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: TOKEN.textSec, userSelect: "none" }}>
                        Raw Metadata ▸
                      </summary>
                      <pre style={{ marginTop: 8, padding: "12px 14px", background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 10, fontSize: 10, overflowX: "auto", lineHeight: 1.6 }}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Filter Select ────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "9px 28px 9px 12px", fontSize: 12.5, borderRadius: 10,
          border: value !== "all" ? `1px solid ${TOKEN.primary}` : `1px solid ${TOKEN.border}`,
          background: value !== "all" ? `${TOKEN.primary}08` : TOKEN.surface,
          color: value !== "all" ? TOKEN.primary : TOKEN.textPri,
          fontWeight: value !== "all" ? 700 : 500,
          outline: "none", cursor: "pointer", appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: TOKEN.textSec }}>
        <ChevronLeft size={12} style={{ transform: "rotate(-90deg)" }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditLogs() {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isMobile, setIsMobile]     = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterDate,   setFilterDate]   = useState("all");

  // Search — split input/filter (same AllProducts pattern)
  const [searchInput, setSearchInput]   = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => setGlobalFilter(value));
    }, 300);
  }, []);

  // Table state
  const [sorting, setSorting]             = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Responsive
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Firestore — identical to original
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "cms_audit_logs"), orderBy("timestamp", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, "id">) })));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Date filter helper — identical to original
  const isWithinDateRange = useCallback((ts: Timestamp | null | undefined) => {
    if (filterDate === "all" || !ts) return true;
    const date = ts.toDate();
    const now = new Date();
    if (filterDate === "today") return date.toDateString() === now.toDateString();
    if (filterDate === "week")  return date >= new Date(now.getTime() - 7  * 86400000);
    if (filterDate === "month") return date >= new Date(now.getTime() - 30 * 86400000);
    return true;
  }, [filterDate]);

  // Client-side filtered data (action + entity + date + search)
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterAction !== "all" && log.action !== filterAction) return false;
      if (filterEntity !== "all" && log.entityType !== filterEntity) return false;
      if (!isWithinDateRange(log.timestamp)) return false;
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        return !!(
          log.entityName?.toLowerCase().includes(q) ||
          log.entityId?.toLowerCase().includes(q) ||
          log.actor?.name?.toLowerCase().includes(q) ||
          log.actor?.email?.toLowerCase().includes(q) ||
          log.actor?.role?.toLowerCase().includes(q) ||
          log.context?.page?.toLowerCase().includes(q) ||
          log.entityType?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, filterAction, filterEntity, globalFilter, isWithinDateRange]);

  // Stats — identical to original
  const stats = useMemo(() => {
    const s = { total: logs.length, creates: 0, updates: 0, deletes: 0, restores: 0 };
    logs.forEach((l) => {
      if (l.action === "create")  s.creates++;
      else if (l.action === "update")  s.updates++;
      else if (l.action === "delete")  s.deletes++;
      else if (l.action === "restore") s.restores++;
    });
    return s;
  }, [logs]);

  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entityType).filter(Boolean))], [logs]);

  const hasFilters = !!globalFilter || filterAction !== "all" || filterEntity !== "all" || filterDate !== "all";

  const clearFilters = () => {
    setSearchInput(""); setGlobalFilter("");
    setFilterAction("all"); setFilterEntity("all"); setFilterDate("all");
  };

  // Columns
  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      id: "actor",
      header: "User",
      accessorFn: (row) => `${row.actor?.name || ""} ${row.actor?.email || ""}`,
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={log.actor?.name || log.actor?.email} size={30} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: TOKEN.textPri, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                {log.actor?.name || "Unknown"}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 10, color: TOKEN.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                {log.actor?.email || log.actor?.role || "—"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <ActionBadge action={row.original.action} />,
    },
    {
      id: "entity",
      header: "Entity",
      accessorFn: (row) => `${row.entityName || ""} ${row.entityType || ""}`,
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: TOKEN.textSec, flexShrink: 0 }}>
              {ENTITY_ICONS[log.entityType] ?? <FileText size={13} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: TOKEN.textPri, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                {log.entityName || "—"}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 10, color: TOKEN.textSec, textTransform: "capitalize" }}>
                {log.entityType}
                {log.entityId && <span style={{ marginLeft: 4, fontFamily: "monospace", opacity: 0.5 }}>#{log.entityId.slice(-6)}</span>}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "source",
      header: "Source Page",
      accessorFn: (row) => row.context?.page || "",
      cell: ({ row }) => (
        <span style={{ fontSize: 11, color: TOKEN.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", maxWidth: 140 }}>
          {row.original.context?.page || "—"}
        </span>
      ),
    },
    {
      accessorFn: (row) => row.timestamp?.toMillis?.() ?? 0,
      id: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => (
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TOKEN.textPri }}>{timeAgo(row.original.timestamp)}</p>
          <p style={{ margin: "1px 0 0", fontSize: 10, color: TOKEN.textSec }}>{formatTimestamp(row.original.timestamp)}</p>
        </div>
      ),
    },
    {
      id: "detail",
      header: () => <div style={{ textAlign: "center" }}>Detail</div>,
      cell: ({ row }) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: TOKEN.textSec, borderRadius: 6, display: "flex" }}
            onClick={(e) => { e.stopPropagation(); setSelectedLog(row.original); }}
            title="View detail"
          >
            <Eye size={15} />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: "100px 0", textAlign: "center", color: TOKEN.textSec }}>
        <div className="spinner" />
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", marginTop: 12 }}>LOADING DATA</p>
        <style dangerouslySetInnerHTML={{ __html: `.spinner{width:24px;height:24px;border:2px solid ${TOKEN.border};border-top-color:${TOKEN.primary};border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;}@keyframes spin{to{transform:rotate(360deg);}}` }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* ── Sticky toolbar ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: TOKEN.bg, paddingTop: 16, paddingBottom: 16, marginLeft: isMobile ? -16 : -24, marginRight: isMobile ? -16 : -24, paddingLeft: isMobile ? 16 : 24, paddingRight: isMobile ? 16 : 24, boxShadow: `0 8px 0 0 ${TOKEN.bg}, 0 9px 0 0 ${TOKEN.border}22` }}>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TOKEN.textPri }}>Audit Logs</h1>
            <span style={{ fontSize: 11, fontWeight: 700, background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: 6, padding: "2px 8px", color: TOKEN.textSec, fontFamily: "monospace" }}>
              {filtered.length}
            </span>
          </div>
          <span style={{ fontSize: 11, color: TOKEN.textSec }}>Real-time activity trail</span>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Total", value: stats.total, dot: TOKEN.primary, bg: `${TOKEN.primary}10`, color: TOKEN.primary },
            { label: "Created",  value: stats.creates,  ...{ dot: ACTION_CONFIG.create.dot,  bg: ACTION_CONFIG.create.bg,  color: ACTION_CONFIG.create.color  } },
            { label: "Updated",  value: stats.updates,  ...{ dot: ACTION_CONFIG.update.dot,  bg: ACTION_CONFIG.update.bg,  color: ACTION_CONFIG.update.color  } },
            { label: "Deleted",  value: stats.deletes,  ...{ dot: ACTION_CONFIG.delete.dot,  bg: ACTION_CONFIG.delete.bg,  color: ACTION_CONFIG.delete.color  } },
            { label: "Restored", value: stats.restores, ...{ dot: ACTION_CONFIG.restore.dot, bg: ACTION_CONFIG.restore.bg, color: ACTION_CONFIG.restore.color } },
          ].map((stat) => (
            <div key={stat.label} style={{ background: stat.bg, borderRadius: 12, padding: isMobile ? "10px 12px" : "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stat.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: stat.color, whiteSpace: "nowrap" }}>{stat.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: isMobile ? "none" : 320 }}>
            <Search size={15} color={TOKEN.textSec} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search by name, user, page, entity…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: "100%", padding: "9px 32px 9px 36px", fontSize: 13, background: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: 10, color: TOKEN.textPri, outline: "none", boxSizing: "border-box" }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(""); startTransition(() => setGlobalFilter("")); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TOKEN.textSec, display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </div>

          <FilterSelect
            value={filterAction}
            onChange={setFilterAction}
            placeholder="Action"
            options={[
              { value: "all", label: "All Actions" },
              { value: "create",  label: "Created"  },
              { value: "update",  label: "Updated"  },
              { value: "delete",  label: "Deleted"  },
              { value: "restore", label: "Restored" },
            ]}
          />

          <FilterSelect
            value={filterEntity}
            onChange={setFilterEntity}
            placeholder="Entity"
            options={[
              { value: "all", label: "All Entities" },
              ...entityTypes.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) })),
            ]}
          />

          <FilterSelect
            value={filterDate}
            onChange={setFilterDate}
            placeholder="Date"
            options={[
              { value: "all",   label: "All Time"     },
              { value: "today", label: "Today"        },
              { value: "week",  label: "Last 7 Days"  },
              { value: "month", label: "Last 30 Days" },
            ]}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 10, border: `1px solid ${TOKEN.border}`, background: TOKEN.surface, fontSize: 12, fontWeight: 600, color: TOKEN.textSec, cursor: "pointer" }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="desktop-view" style={tableContainerStyle}>
        <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={stickyHeadStyle}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      style={{ ...thStyle, cursor: h.column.getCanSort() ? "pointer" : "default", userSelect: "none" }}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc"  && " ↑"}
                        {h.column.getIsSorted() === "desc" && " ↓"}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: "64px 0", textAlign: "center", color: TOKEN.textSec }}>
                    <Shield size={32} style={{ margin: "0 auto 10px", opacity: 0.2 }} />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>No audit logs found</p>
                    {hasFilters && (
                      <button onClick={clearFilters} style={{ marginTop: 8, fontSize: 12, color: TOKEN.primary, background: "none", border: `1px solid ${TOKEN.primary}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${TOKEN.border}`, cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => setSelectedLog(row.original)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TOKEN.bg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={tdStyle}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: TOKEN.surface, borderTop: `1px solid ${TOKEN.border}` }}>
          <span style={{ fontSize: 13, color: TOKEN.textSec }}>
            {filtered.length > 0
              ? `${(table.getState().pagination.pageIndex) * table.getState().pagination.pageSize + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} of ${filtered.length} events`
              : "0 events"}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={pageBtnStyle} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: TOKEN.textSec }}>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <button style={pageBtnStyle} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="mobile-view" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8, paddingBottom: 40 }}>
        {table.getRowModel().rows.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}>
            <Shield size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: TOKEN.textPri, marginBottom: 6 }}>No audit logs found</p>
            {hasFilters && (
              <button onClick={clearFilters} style={{ marginTop: 8, fontSize: 12, color: TOKEN.primary, background: "none", border: `1px solid ${TOKEN.primary}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Clear filters</button>
            )}
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const log = row.original;
            const cfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.update;
            return (
              <div
                key={row.id}
                style={{ borderRadius: 14, padding: "14px", border: `1px solid ${TOKEN.border}`, background: TOKEN.surface, cursor: "pointer" }}
                onClick={() => setSelectedLog(log)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Avatar name={log.actor?.name || log.actor?.email} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TOKEN.textPri, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.actor?.name || "Unknown"}
                      </p>
                      <ActionBadge action={log.action} />
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: 11, color: TOKEN.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {log.actor?.email || log.actor?.role || "—"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: TOKEN.textSec }}>{ENTITY_ICONS[log.entityType] ?? <FileText size={12} />}</span>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TOKEN.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.entityName || "—"}
                      </p>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: TOKEN.textSec }}>
                      {timeAgo(log.timestamp)} · {log.context?.page || log.entityType}
                    </p>
                  </div>
                  <Eye size={14} color={TOKEN.textSec} style={{ flexShrink: 0, marginTop: 2 }} />
                </div>
              </div>
            );
          })
        )}

        {/* Mobile pagination */}
        {table.getPageCount() > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "12px 0" }}>
            <button style={pageBtnStyle} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: TOKEN.textSec }}>
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button style={pageBtnStyle} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <DetailModal log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} />

      <style dangerouslySetInnerHTML={{ __html: `
        .desktop-view { display: none !important; }
        .mobile-view { display: flex; }
        @media (min-width: 1024px) {
          .desktop-view { display: flex !important; flex-direction: column; gap: 16px; }
          .mobile-view { display: none !important; }
        }
      ` }} />
    </div>
  );
}