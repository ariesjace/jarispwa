"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { TOKEN } from "@/components/layout/tokens";
import {
  Search, Filter,
  CheckCircle2, XCircle, Clock, Package, Eye, X, MoreHorizontal, Check,
  ChevronLeft, ChevronRight
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
  RowSelectionState
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FAB } from "@/components/layout/FAB";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

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
import { toast } from "sonner";

// --- Logic Helpers ---
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
  const payload = req.payload ?? {};
  const d = payload.after ?? payload.productSnapshot ?? payload;
  return d?.itemDescription || d?.name || d?.itemCode || req.resourceId || "—";
}

export default function ProductRequestsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const visible = canSeeNotifications(user);
  const isVerifier = hasAccess(user, "verify", "products");
  const reviewer = { uid: user?.uid ?? "", name: user?.name };

  // Table states
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowsPerPageInput, setRowsPerPageInput] = useState("10");

  const [previewReq, setPreviewReq] = useState<PendingRequest | null>(null);
  const [remarksTarget, setRemarksTarget] = useState<RemarksTarget | null>(null);

  // Mobile specific state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── FIREBASE FETCHING ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    // Always fetch everything for the table to manage locally
    const q = query(
      collection(db, "requests"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PendingRequest);
      setData(docs);
      setIsLoading(false);
    }, (error) => {
      console.error("Requests fetch error:", error);
      setIsLoading(false);
      toast.error("Failed to load requests.");
    });

    return unsub;
  }, [visible]);

  const handleRemarksConfirm = async (action: "approve" | "reject", requestId: string, remarks: string) => {
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
      toast.success(action === "approve" ? "Request approved and executed." : "Request rejected.", { id: t });
    } catch (err: any) {
      toast.error(err.message || `${action === "approve" ? "Approval" : "Rejection"} failed.`, { id: t });
      throw err;
    }
  };

  const handleBulkApprove = async () => {
    // Collect all selected IDs that are strictly pending
    const selectedIds = Object.keys(rowSelection).filter((idx) => {
      return data[Number(idx)]?.status === "pending";
    }).map((idx) => data[Number(idx)].id);
    
    if (selectedIds.length === 0) {
      toast.error("No pending requests selected.");
      return;
    }

    const t = toast.loading(`Approving ${selectedIds.length} requests...`);
    let fails = 0;
    for (const id of selectedIds) {
      try {
        await approveRequest(id, reviewer);
        await updateDoc(doc(db, "requests", id), { reviewRemarks: "Bulk approved" }).catch(() => {});
      } catch (e) {
        fails++;
      }
    }
    setRowSelection({});
    if (fails === 0) toast.success(`Approved ${selectedIds.length} requests successfully.`, { id: t });
    else toast.error(`Completed with ${fails} failures.`, { id: t });
  };

  const handleBulkReject = async () => {
    const selectedIds = Object.keys(rowSelection).filter((idx) => {
      return data[Number(idx)]?.status === "pending";
    }).map((idx) => data[Number(idx)].id);
    
    if (selectedIds.length === 0) {
      toast.error("No pending requests selected.");
      return;
    }

    const t = toast.loading(`Rejecting ${selectedIds.length} requests...`);
    let fails = 0;
    for (const id of selectedIds) {
      try {
        await rejectRequest(id, reviewer);
        await updateDoc(doc(db, "requests", id), { reviewRemarks: "Bulk rejected" }).catch(() => {});
      } catch (e) {
        fails++;
      }
    }
    setRowSelection({});
    if (fails === 0) toast.success(`Rejected ${selectedIds.length} requests successfully.`, { id: t });
    else toast.error(`Completed with ${fails} failures.`, { id: t });
  };

  // ─── DESKTOP COLUMNS ──────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<PendingRequest>[]>(() => {
    const cols: ColumnDef<PendingRequest>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center -ml-1">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Select all"
              className="border-neutral-300"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center -ml-1">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Select row"
              className="border-neutral-300"
            />
          </div>
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 90,
        cell: ({ row }) => {
          const type = row.original.type;
          const styles: Record<string, string> = {
            create: "bg-sky-100 text-sky-700 hover:bg-sky-100",
            update: "bg-violet-100 text-violet-700 hover:bg-violet-100",
            delete: "bg-rose-100 text-rose-700 hover:bg-rose-100",
          };
          return (
            <Badge className={`${styles[type] || "bg-muted text-muted-foreground"} shadow-none uppercase text-[9px] px-1.5 py-0`}>
              {type}
            </Badge>
          );
        }
      },
      {
        accessorKey: "resource",
        header: "Resource",
        size: 100,
        cell: ({ row }) => <span className="capitalize">{row.original.resource}</span>
      },
      {
        id: "identity",
        header: "Product",
        accessorFn: (req) => getRequestDisplayName(req),
        size: 320,
        cell: ({ row }) => {
          const name = getRequestDisplayName(row.original);
          return (
            <div className="font-semibold truncate max-w-[300px]" title={name}>
              {name}
            </div>
          );
        }
      },
      {
        accessorKey: "requestedByName",
        header: "Requested By",
        size: 150,
      },
      {
        accessorFn: (row) => row.createdAt?.toMillis?.() || 0,
        id: "createdAt",
        header: "Date",
        size: 120,
        cell: ({ row }) => <span className="text-muted-foreground">{formatTs(row.original.createdAt)}</span>
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-none shadow-none uppercase text-[9px]"><Clock className="w-2.5 h-2.5 mr-1" /> Pending</Badge>;
          if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-none shadow-none uppercase text-[9px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Approved</Badge>;
          return <Badge className="bg-rose-100 text-rose-700 border-none shadow-none uppercase text-[9px]"><XCircle className="w-2.5 h-2.5 mr-1" /> Rejected</Badge>;
        }
      },
      {
        id: "actions",
        size: 80,
        cell: ({ row }) => {
          const req = row.original;
          const isPending = req.status === "pending";
          return (
            <div className="flex items-center justify-end gap-1 px-2">
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewReq(req); }}
                className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors"
                title="Preview"
              >
                <Eye size={15} />
              </button>
              {isVerifier && isPending && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRemarksTarget({ request: req, action: "approve" }); }}
                    className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-md transition-colors"
                    title="Approve"
                  >
                    <CheckCircle2 size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRemarksTarget({ request: req, action: "reject" }); }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                    title="Reject"
                  >
                    <XCircle size={15} />
                  </button>
                </>
              )}
            </div>
          );
        }
      }
    ];
    return cols;
  }, [isVerifier]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handlePageSizeApply = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(rowsPerPageInput, 10);
      if (!isNaN(val) && val > 0) {
        table.setPageSize(val);
      } else {
        setRowsPerPageInput(table.getState().pagination.pageSize.toString());
      }
    }
  };

  const selectedCount = Object.keys(rowSelection).length;
  
  // Mobile long press logic
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const handleTouchStart = (rowIndex: number) => {
    pressTimer.current = setTimeout(() => {
      table.getRowModel().rows[rowIndex].toggleSelected(true);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };
  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  if (!visible) return (
    <div className="flex flex-col w-full h-full pb-16 lg:pb-0 items-center justify-center" style={{ background: TOKEN.bg }}>
      <Clock size={40} className="mb-4 text-neutral-300" />
      <p className="text-lg font-bold text-neutral-900 mb-1">Access Denied</p>
      <p className="text-[13px] text-neutral-400">You do not have permission to view requests.</p>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full pb-16 lg:pb-0" style={{ background: TOKEN.bg }}>
      {/* ── HEADER & TOOLBAR ── */}
      <div className="sticky top-[var(--sat,0px)] z-20 flex-shrink-0 bg-white/90 backdrop-blur-md border-b" style={{ borderColor: TOKEN.border }}>
        <div className="px-4 lg:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Clock className="text-orange-600" size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-none">
                Requests
              </h1>
              <Badge variant="secondary" className="ml-2 font-mono text-xs">{data.length}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative group/search flex-1 lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within/search:text-orange-600 transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 text-[13px] bg-neutral-100/70 hover:bg-neutral-100 focus:bg-white border-transparent focus:border-orange-500 rounded-lg outline-none transition-all shadow-sm"
                />
              </div>
              <button className="h-9 px-3 flex items-center gap-2 text-[13px] font-semibold text-neutral-600 bg-white border rounded-lg hover:bg-neutral-50 shadow-sm whitespace-nowrap transition-colors">
                <Filter size={15} className="lg:hidden" />
                <span className="hidden lg:inline">Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Banner */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between px-4 lg:px-6 py-3 bg-neutral-900 border-t border-neutral-800 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center bg-orange-500/20 text-orange-400 rounded-full font-mono text-xs font-bold">
                {selectedCount}
              </div>
              <span className="text-sm font-medium text-white">selected</span>
            </div>
            <div className="flex items-center gap-2">
              {isMobile ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors border border-neutral-700 shadow-sm">
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 p-1">
                    <DropdownMenuItem onClick={() => setRowSelection({})} className="text-xs py-2 px-3 focus:bg-neutral-100">
                      Clear selection
                    </DropdownMenuItem>
                    {isVerifier && (
                      <>
                        <DropdownMenuItem onClick={handleBulkApprove} className="text-xs py-2 px-3 text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 font-medium">
                          <CheckCircle2 size={14} className="mr-2" /> Bulk Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBulkReject} className="text-xs py-2 px-3 text-rose-600 focus:text-rose-700 focus:bg-rose-50 font-medium">
                          <XCircle size={14} className="mr-2" /> Bulk Reject
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <button onClick={() => setRowSelection({})} className="h-8 px-3 text-xs font-semibold text-neutral-300 hover:text-white transition-colors">Cancel</button>
                  {isVerifier && (
                    <>
                      <button onClick={handleBulkApprove} className="h-8 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-colors shadow-sm">
                        <CheckCircle2 size={14} /> Approve All
                      </button>
                      <button onClick={handleBulkReject} className="h-8 px-3 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-md transition-colors shadow-sm">
                        <XCircle size={14} /> Reject All
                      </button>
                    </>
                  )}
                </>
              )}
              {isMobile && (
                 <button onClick={() => setRowSelection({})} className="h-8 w-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors border border-neutral-700 shadow-sm ml-2">
                   <X size={16} />
                 </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-400">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide">Loading requests...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
          <Clock size={40} className="mb-4 text-neutral-300" />
          <p className="text-lg font-bold text-neutral-900 mb-1">No requests yet</p>
          <p className="text-[13px]">Any product additions/edits via forms will appear here.</p>
        </div>
      ) : isMobile ? (
        // ── MOBILE LAYOUT ──
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {table.getRowModel().rows.map(row => {
            const req = row.original;
            const isSelected = row.getIsSelected();
            const displayName = getRequestDisplayName(req);
            return (
              <div
                key={row.id}
                onTouchStart={() => handleTouchStart(row.index)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onClick={(e) => {
                  if (selectedCount > 0) {
                    row.toggleSelected();
                  } else {
                    setPreviewReq(req);
                  }
                }}
                className={`relative p-3.5 rounded-xl border bg-white shadow-sm transition-all ${
                  isSelected ? "border-orange-500 ring-1 ring-orange-500 bg-orange-50/10" : "border-neutral-200"
                }`}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between">
                     <div className="flex gap-2">
                       <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">{req.type}</span>
                       <span className="text-[10px] text-muted-foreground uppercase">{req.resource}</span>
                     </div>
                     <span className="text-[10px] text-muted-foreground">{formatTs(req.createdAt)}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg border bg-neutral-50 flex items-center justify-center shrink-0">
                       <Package className="text-neutral-400" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-900 leading-tight my-0.5">{displayName}</p>
                      <p className="text-xs text-neutral-500 truncate mb-1">By {req.requestedByName || "Unknown"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      {req.status === "pending" && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>}
                      {req.status === "approved" && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Approved</span>}
                      {req.status === "rejected" && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Rejected</span>}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-sm animate-in zoom-in fade-in">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ── DESKTOP LAYOUT ──
        <div className="flex-1 flex flex-col min-h-0 bg-white m-6 rounded-xl border border-neutral-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-neutral-50/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th
                        key={h.id}
                        style={{ width: h.column.getSize() }}
                        className="h-10 px-3 font-semibold text-neutral-500 select-none group border-b border-neutral-200"
                      >
                        <div
                          className={`flex items-center shrink-0 ${h.column.getCanSort() ? "cursor-pointer hover:text-neutral-900" : ""}`}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className={`h-12 border-b border-neutral-100 transition-colors group ${
                      row.getIsSelected() ? "bg-orange-50/40" : "hover:bg-neutral-50"
                    }`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="h-32 text-center text-neutral-400">
                      No matching requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-neutral-50 border-t">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">Rows</span>
              <input
                type="text"
                value={rowsPerPageInput}
                onChange={e => setRowsPerPageInput(e.target.value)}
                onKeyDown={handlePageSizeApply}
                onBlur={() => setRowsPerPageInput(table.getState().pagination.pageSize.toString())}
                className="w-12 h-7 px-2 text-center text-[13px] bg-white border rounded font-mono hover:bg-neutral-50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 flex items-center justify-center text-neutral-500 border rounded bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:bg-neutral-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-3 text-[13px] font-semibold text-neutral-600 bg-white border h-8 flex items-center rounded select-none">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
              </div>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 flex items-center justify-center text-neutral-500 border rounded bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:bg-neutral-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full preview modal */}
      <RequestPreviewModal
        request={previewReq}
        open={!!previewReq}
        onOpenChange={(v) => !v && setPreviewReq(null)}
        onActionComplete={() => setPreviewReq(null)}
      />

      {/* Remarks-gated approve/reject dialog */}
      <RemarksConfirmDialog
        target={remarksTarget}
        open={!!remarksTarget}
        onOpenChange={(v: boolean) => !v && setRemarksTarget(null)}
        onConfirm={handleRemarksConfirm}
      />
    </div>
  );
}
