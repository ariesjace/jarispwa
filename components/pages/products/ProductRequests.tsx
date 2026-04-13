"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TOKEN } from "@/components/layout/tokens";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { toast } from "sonner";

import { useAuth } from "@/lib/useAuth";
import { canSeeNotifications, hasAccess } from "@/lib/rbac";
import {
  PendingRequest,
  approveRequest,
  rejectRequest,
} from "@/lib/requestService";
import { RequestPreviewModal } from "@/components/notifications/request-preview-modal";
import {
  RemarksConfirmDialog,
  RemarksTarget,
} from "@/components/notifications/remarks-confirm-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: any): string {
  if (!ts) return "—";
  try {
    return format(ts.toDate(), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function getRequestDisplayName(req: PendingRequest): string {
  const meta = req.meta ?? {};
  if (meta.productName) return String(meta.productName);
  const d = req.payload?.after ?? req.payload?.productSnapshot ?? req.payload;
  return d?.itemDescription || d?.name || d?.itemCode || req.resourceId || "—";
}

// ─── Inline styles (matching AllProducts) ─────────────────────────────────────

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

// ─── Type / Status badge styles ────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductRequestsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const visible = canSeeNotifications(user);
  const isVerifier = hasAccess(user, "verify", "products");
  const reviewer = { uid: user?.uid ?? "", name: user?.name };

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // Modals
  const [previewReq, setPreviewReq] = useState<PendingRequest | null>(null);
  const [remarksTarget, setRemarksTarget] = useState<RemarksTarget | null>(
    null,
  );

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Firestore subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PendingRequest),
        );
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [visible]);

  // ── Approve / Reject handlers ───────────────────────────────────────────────
  const handleRemarksConfirm = useCallback(
    async (
      action: "approve" | "reject",
      requestId: string,
      remarks: string,
    ) => {
      const t = toast.loading(
        action === "approve" ? "Approving…" : "Rejecting…",
      );
      try {
        if (action === "approve") await approveRequest(requestId, reviewer);
        else await rejectRequest(requestId, reviewer);
        await updateDoc(doc(db, "requests", requestId), {
          reviewRemarks: remarks,
        }).catch(() => {});
        toast.success(action === "approve" ? "Approved." : "Rejected.", {
          id: t,
        });
      } catch (err: any) {
        toast.error(err.message || "Action failed.", { id: t });
        throw err;
      }
    },
    [reviewer],
  );

  const handleBulkApprove = async () => {
    const ids = Object.keys(rowSelection)
      .map((idx) => data[Number(idx)])
      .filter((r) => r?.status === "pending")
      .map((r) => r.id);
    if (!ids.length) {
      toast.error("No pending requests selected.");
      return;
    }
    const t = toast.loading(`Approving ${ids.length}…`);
    let fails = 0;
    for (const id of ids) {
      try {
        await approveRequest(id, reviewer);
        await updateDoc(doc(db, "requests", id), {
          reviewRemarks: "Bulk approved",
        }).catch(() => {});
      } catch {
        fails++;
      }
    }
    setRowSelection({});
    if (!fails) toast.success(`Approved ${ids.length}.`, { id: t });
    else toast.error(`Completed with ${fails} failures.`, { id: t });
  };

  const handleBulkReject = async () => {
    const ids = Object.keys(rowSelection)
      .map((idx) => data[Number(idx)])
      .filter((r) => r?.status === "pending")
      .map((r) => r.id);
    if (!ids.length) {
      toast.error("No pending requests selected.");
      return;
    }
    const t = toast.loading(`Rejecting ${ids.length}…`);
    let fails = 0;
    for (const id of ids) {
      try {
        await rejectRequest(id, reviewer);
        await updateDoc(doc(db, "requests", id), {
          reviewRemarks: "Bulk rejected",
        }).catch(() => {});
      } catch {
        fails++;
      }
    }
    setRowSelection({});
    if (!fails) toast.success(`Rejected ${ids.length}.`, { id: t });
    else toast.error(`Completed with ${fails} failures.`, { id: t });
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<PendingRequest>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
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
        ),
        cell: ({ row }) => (
          <div style={{ marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <TypeBadge type={row.original.type} />,
      },
      {
        id: "identity",
        header: "Product",
        accessorFn: (req) => getRequestDisplayName(req),
        cell: ({ row }) => {
          const name = getRequestDisplayName(row.original);
          const meta = row.original.meta ?? {};
          const subCode = (meta.litItemCode || meta.ecoItemCode) as
            | string
            | undefined;
          return (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: TOKEN.textPri,
                }}
              >
                {name}
              </p>
              {subCode && (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 10,
                    color: TOKEN.textSec,
                    fontFamily: "monospace",
                  }}
                >
                  {subCode}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "resource",
        header: "Resource",
        cell: ({ row }) => (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 4,
              background: TOKEN.bg,
              border: `1px solid ${TOKEN.border}`,
              color: TOKEN.textSec,
            }}
          >
            {row.original.resource}
          </span>
        ),
      },
      {
        accessorKey: "requestedByName",
        header: "Requested By",
        cell: ({ row }) => (
          <span style={{ fontSize: 12.5, color: TOKEN.textPri }}>
            {row.original.requestedByName || "—"}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.createdAt?.toMillis?.() ?? 0,
        id: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: TOKEN.textSec }}>
            {formatTs(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => (
          <div style={{ textAlign: "right", paddingRight: 8 }}>Actions</div>
        ),
        cell: ({ row }) => {
          const req = row.original;
          const isPending = req.status === "pending";
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                paddingRight: 8,
              }}
            >
              <button
                style={iconBtnStyle}
                title="Preview"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewReq(req);
                }}
              >
                <Eye size={15} />
              </button>
              {isVerifier && isPending && (
                <>
                  <button
                    style={{ ...iconBtnStyle, color: "#16a34a" }}
                    title="Approve"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemarksTarget({ request: req, action: "approve" });
                    }}
                  >
                    <CheckCircle2 size={15} />
                  </button>
                  <button
                    style={{ ...iconBtnStyle, color: TOKEN.danger }}
                    title="Reject"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemarksTarget({ request: req, action: "reject" });
                    }}
                  >
                    <XCircle size={15} />
                  </button>
                </>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [isVerifier],
  );

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
  const isBulk = selectedRows.length > 0;

  // ── Mobile long-press logic ─────────────────────────────────────────────────
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPress = (rowId: string) => {
    pressTimer.current = setTimeout(() => {
      const row = table.getRowModel().rows.find((r) => r.id === rowId);
      row?.toggleSelected(true);
    }, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // ── Loading / access denied ─────────────────────────────────────────────────
  if (!visible)
    return (
      <div
        style={{ padding: "80px 0", textAlign: "center", color: TOKEN.textSec }}
      >
        <Clock size={40} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>
          You don't have permission to view requests.
        </p>
      </div>
    );

  if (isLoading)
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
            __html: `
        .spinner { width:24px;height:24px;border:2px solid ${TOKEN.border};border-top-color:${TOKEN.primary};
          border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `,
          }}
        />
      </div>
    );

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
        }}
      >
        {/* Page title */}
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
              Requests
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
              {data.length}
            </span>
          </div>
        </div>

        {/* Bulk banner — desktop */}
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
              marginBottom: 12,
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
                onClick={() => setRowSelection({})}
              >
                Cancel
              </button>
              {isVerifier && (
                <>
                  <button
                    style={{
                      ...actionBtnStyle,
                      background: "#dcfce7",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                    }}
                    onClick={handleBulkApprove}
                  >
                    <CheckCircle2 size={13} /> Approve All
                  </button>
                  <button
                    style={{
                      ...actionBtnStyle,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                    }}
                    onClick={handleBulkReject}
                  >
                    <XCircle size={13} /> Reject All
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bulk banner — mobile */}
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
              marginBottom: 12,
            }}
          >
            <span
              style={{ fontSize: 15, fontWeight: 800, color: TOKEN.primary }}
            >
              {selectedRows.length} selected
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {isVerifier && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button style={iconBtnStyle}>
                      <MoreHorizontal size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleBulkApprove}>
                      Bulk Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBulkReject}
                      className="text-red-600"
                    >
                      Bulk Reject
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button style={iconBtnStyle} onClick={() => setRowSelection({})}>
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Search bar */}
        {!isBulk && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
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
                placeholder="Search requests..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
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
          </div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="desktop-view" style={tableContainerStyle}>
        <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
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
                      padding: "48px 0",
                      textAlign: "center",
                      color: TOKEN.textSec,
                    }}
                  >
                    <Clock
                      size={32}
                      style={{ margin: "0 auto 10px", opacity: 0.2 }}
                    />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      No requests found
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
                      cursor: "pointer",
                    }}
                    onClick={() => setPreviewReq(row.original)}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={pageBtnStyle}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: TOKEN.textSec,
                alignSelf: "center",
              }}
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
          paddingBottom: 80,
        }}
      >
        {table.getFilteredRowModel().rows.map((row) => {
          const req = row.original;
          const isSelected = row.getIsSelected();
          const name = getRequestDisplayName(req);
          const isPending = req.status === "pending";

          return (
            <div
              key={row.id}
              style={{
                borderRadius: 16,
                padding: "14px",
                background: isSelected ? `${TOKEN.primary}05` : TOKEN.surface,
                border: `1px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                position: "relative",
                userSelect: "none",
                transition: "all 0.2s ease",
              }}
              onMouseDown={() => startPress(row.id)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              onTouchStart={() => startPress(row.id)}
              onTouchEnd={cancelPress}
              onTouchCancel={cancelPress}
              onClick={() =>
                isBulk ? row.toggleSelected() : setPreviewReq(req)
              }
            >
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    background: TOKEN.primary,
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  <Check size={14} color="#fff" />
                </div>
              )}

              <div
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: TOKEN.bg,
                    border: `1px solid ${TOKEN.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Package size={18} color={TOKEN.textSec} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: TOKEN.textPri,
                      lineHeight: 1.3,
                    }}
                  >
                    {name}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 11,
                      color: TOKEN.textSec,
                    }}
                  >
                    By {req.requestedByName || "Unknown"} ·{" "}
                    {formatTs(req.createdAt)}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <TypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                  </div>
                </div>

                {/* Mobile actions */}
                {isVerifier && isPending && !isBulk && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemarksTarget({ request: req, action: "approve" });
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRemarksTarget({ request: req, action: "reject" });
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Dialogs ── */}
      <RequestPreviewModal
        request={previewReq}
        open={!!previewReq}
        onOpenChange={(v) => !v && setPreviewReq(null)}
        onActionComplete={() => setPreviewReq(null)}
      />
      <RemarksConfirmDialog
        target={remarksTarget}
        open={!!remarksTarget}
        onOpenChange={(v) => !v && setRemarksTarget(null)}
        onConfirm={handleRemarksConfirm}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .desktop-view { display: none !important; }
        .mobile-view { display: flex; }
        @media (min-width: 1024px) {
          .desktop-view { display: flex !important; flex-direction: column; }
          .mobile-view { display: none !important; }
        }
      `,
        }}
      />
    </div>
  );
}

// ── Shared inline styles ───────────────────────────────────────────────────────

const actionBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
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
