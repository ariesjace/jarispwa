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
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TOKEN } from "@/components/layout/tokens";
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Edit2,
  Trash2,
  FileText,
  Package,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Check,
  ChevronDown,
  MoreHorizontal,
  X,
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
import { DeleteToRecycleBinDialog } from "@/components/deletedialog";
import { FAB } from "@/components/layout/FAB";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useProductWorkflow } from "@/lib/useProductWorkflow";
import { toast } from "sonner";

// --- Logic Helpers ---
const resolveItemCodes = (p: any) => p.itemCodes || {};
const getFilledItemCodes = (codes: any) =>
  Object.entries(codes)
    .filter(([_, v]) => !!v)
    .map(([k, v]) => ({ label: k, code: v as string }));

export default function AllProductsPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // RBAC workflow
  const { submitProductDelete, submitProductAssignWebsite, canVerifyProducts, canWriteProducts } =
    useProductWorkflow();

  // Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [rowsPerPageInput, setRowsPerPageInput] = useState("10");

  // Mobile specific state
  const [isMobile, setIsMobile] = useState(false);

  // Filter drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"family" | "class" | "usage" | null>(null);

  // ── Swipe-to-delete state ──────────────────────────────────────────────────
  const [swipingCardId, setSwipingCardId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeOffsetRef = useRef(0);
  const swipeCardIdRef = useRef<string | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeDirectionRef = useRef<"h" | "v" | null>(null);
  const SWIPE_DELETE_THRESHOLD = 90;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── FIREBASE FETCHING ─────────────────────────────────────────────────────
  useEffect(() => {
    let assignedData: any[] = [];
    let unassignedData: any[] = [];
    let assignedReady = false;
    let unassignedReady = false;

    const flush = () => {
      if (assignedReady && unassignedReady) {
        const merged = [...assignedData, ...unassignedData];
        const unique = Array.from(
          new Map(merged.map((item) => [item.id, item])).values(),
        );
        unique.sort((a, b) => {
          const dateA = a.createdAt?.toMillis?.() || 0;
          const dateB = b.createdAt?.toMillis?.() || 0;
          return dateB - dateA;
        });
        setData(unique);
        setIsLoading(false);
      }
    };

    const qAssigned = query(
      collection(db, "products"),
      where("websites", "array-contains-any", [
        "Disruptive Solutions Inc",
        "Ecoshift Corporation",
        "Value Acquisitions Holdings",
        "Taskflow",
        "Shopify",
      ]),
      orderBy("createdAt", "desc"),
    );

    const qUnassigned = query(
      collection(db, "products"),
      where("websites", "==", []),
      orderBy("createdAt", "desc"),
    );

    const unsubA = onSnapshot(qAssigned, (snap) => {
      assignedData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      assignedReady = true;
      flush();
    });

    const unsubU = onSnapshot(
      qUnassigned,
      (snap) => {
        unassignedData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        unassignedReady = true;
        flush();
      },
      () => {
        unassignedReady = true;
        flush();
      },
    );

    return () => {
      unsubA();
      unsubU();
    };
  }, []);

  // ─── COLUMNS ─────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div style={{ marginLeft: 8 }}>
            <Checkbox
              checked={
                table.getIsAllRowsSelected() ||
                (table.getIsSomeRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div style={{ marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
            <Checkbox
              // @ts-ignore
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "imageUrl",
        header: "Image",
        cell: ({ row }) => {
          const url =
            row.original.mainImage ||
            row.original.imageUrl ||
            (Array.isArray(row.original.rawImage)
              ? row.original.rawImage[0]
              : null);
          return (
            <div style={imgThumbStyle}>
              {url ? (
                <img src={url} style={imgStyle} alt="" />
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
        header: "Product Details",
        accessorFn: (row) => `${row.name || ""} ${row.itemDescription || ""}`,
        cell: ({ row }) => {
          return (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: TOKEN.textPri,
                }}
              >
                {row.original.name || row.original.itemDescription || "—"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: TOKEN.textSec,
                }}
              >
                {row.original.id.slice(0, 8).toUpperCase()}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                {getFilledItemCodes(resolveItemCodes(row.original))
                  .slice(0, 3)
                  .map((codeObj: any, i: number) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        background: `${TOKEN.primary}15`,
                        color: TOKEN.primary,
                        borderRadius: 4,
                        fontFamily: "monospace",
                      }}
                    >
                      {codeObj.code}
                    </span>
                  ))}
              </div>
            </>
          );
        },
      },
      {
        accessorKey: "productFamily",
        header: "Family",
        cell: ({ row }) => {
          const fam =
            row.original.productFamily || row.original.categories || "—";
          return <span style={badgeStyle}>{fam}</span>;
        },
      },
      {
        accessorKey: "websites",
        header: "Websites",
        cell: ({ row }) => {
          const sites = row.original.websites || [];
          if (!sites.length)
            return (
              <span style={{ fontSize: 11, color: TOKEN.textSec }}>
                Unassigned
              </span>
            );
          return (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {sites.map((site: string) => (
                <span key={site} style={siteTagStyle}>
                  {site}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div style={{ textAlign: "right", paddingRight: 8 }}>Actions</div>
        ),
        cell: ({ row }) => (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 4,
              paddingRight: 8,
            }}
          >
            <button style={iconBtnStyle} title="Edit">
              <Edit2 size={15} />
            </button>
            {row.original.tdsFileUrl && (
              <button style={iconBtnStyle} title="View TDS">
                <FileText size={15} color={TOKEN.danger} />
              </button>
            )}
            <button
              style={{ ...iconBtnStyle, color: TOKEN.danger }}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
        enableSorting: false,
      },
      // ─── Hidden filter-only columns ───────────────────────────────────────
      {
        id: "productClass",
        accessorKey: "productClass",
        enableHiding: true,
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue) return true;
          const cls = (row.original.productClass || "").toLowerCase();
          return cls === (filterValue as string).toLowerCase();
        },
        header: () => null,
        cell: () => null,
      },
      {
        id: "productUsage",
        accessorFn: (row) => {
          const u = row.productUsage;
          return Array.isArray(u) ? u.join(",") : (u || "");
        },
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue) return true;
          const u = row.original.productUsage;
          const usages: string[] = Array.isArray(u) ? u : u ? [u] : [];
          return usages.some(
            (v) => v.toUpperCase() === (filterValue as string).toUpperCase(),
          );
        },
        header: () => null,
        cell: () => null,
      },
    ],
    [],
  );

  // ─── TABLE INSTANCE ──────────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      columnVisibility: { productClass: false, productUsage: false },
    },
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

  // Derive unique values for filters
  const uniqueFamilies = useMemo(
    () =>
      Array.from(
        new Set(
          data.map((p) => p.productFamily || p.categories).filter(Boolean),
        ),
      ).sort(),
    [data],
  );
  const uniqueClasses = useMemo(
    () =>
      Array.from(new Set(data.map((p) => p.productClass).filter(Boolean))).sort(),
    [data],
  );
  const uniqueUsages = useMemo(
    () =>
      Array.from(
        new Set(
          data.flatMap((p) => {
            const u = p.productUsage;
            return Array.isArray(u) ? u : u ? [u] : [];
          }).filter(Boolean),
        ),
      ).sort(),
    [data],
  );
  const activeFamilyFilter =
    (table.getColumn("productFamily")?.getFilterValue() as string) ?? "";

  // ─── RBAC-wired delete handlers ───────────────────────────────────────────

  const handleExecuteDelete = async (product: any) => {
    try {
      const result = await submitProductDelete({
        product,
        originPage: "/products/all-products",
        source: "all-products:delete",
      });
      if (result.mode === "direct") {
        toast.success(result.message);
      } else {
        toast.success(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Delete failed.");
    }
  };

  const handleExecuteBulkDelete = async () => {
    const products = selectedRows.map((r) => r.original);
    let succeeded = 0;
    let failed = 0;
    for (const product of products) {
      try {
        await submitProductDelete({
          product,
          originPage: "/products/all-products",
          source: "all-products:bulk-delete",
        });
        succeeded++;
      } catch {
        failed++;
      }
    }
    table.resetRowSelection();
    if (failed === 0) {
      toast.success(`${succeeded} product${succeeded !== 1 ? "s" : ""} deleted.`);
    } else {
      toast.error(`${succeeded} deleted, ${failed} failed.`);
    }
  };

  const handleBulkDelete = () => setBulkDeleteOpen(true);

  // ─── Long-press for bulk select ───────────────────────────────────────────
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);

  const handleCardPressStart = useCallback((id: string) => {
    if (isBulk) return;
    longPressActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      const row = table.getFilteredRowModel().rows.find((r) => r.id === id);
      if (row) {
        navigator.vibrate?.(60);
        row.toggleSelected(true);
      }
    }, 500);
  }, [isBulk, table]);

  const handleCardPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCardTap = useCallback((id: string) => {
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
  }, [isBulk, table]);

  // ─── Swipe-to-delete handlers ─────────────────────────────────────────────

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
      // Start long press in parallel
      handleCardPressStart(rowId);
    },
    [isBulk, handleCardPressStart],
  );

  const handleSwipeTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeCardIdRef.current) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;

      // Determine direction once we have enough movement
      if (
        swipeDirectionRef.current === null &&
        (Math.abs(dx) > 6 || Math.abs(dy) > 6)
      ) {
        swipeDirectionRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }

      // Vertical scroll — let it pass through
      if (swipeDirectionRef.current !== "h") return;

      // Confirmed horizontal — cancel long-press timer so it doesn't fire
      handleCardPressEnd();

      // Only allow left swipe (negative dx)
      if (dx < 0) {
        const clamped = Math.max(dx, -150);
        swipeOffsetRef.current = clamped;
        setSwipeOffset(clamped);
      }
    },
    [handleCardPressEnd],
  );

  const handleSwipeTouchEnd = useCallback(
    (product: any) => {
      handleCardPressEnd();

      if (
        swipeDirectionRef.current === "h" &&
        swipeOffsetRef.current <= -SWIPE_DELETE_THRESHOLD
      ) {
        // Trigger delete dialog
        setDeleteTarget(product);
      }

      // Snap back
      setSwipingCardId(null);
      setSwipeOffset(0);
      swipeOffsetRef.current = 0;
      swipeCardIdRef.current = null;
      swipeDirectionRef.current = null;
    },
    [handleCardPressEnd],
  );

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
            __html: `
        .spinner {
          width: 24px; height: 24px; border: 2px solid ${TOKEN.border}; border-top-color: ${TOKEN.primary};
          border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        `,
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
      {/* STICKY TOP CONTROLS */}
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
        {/* PAGE HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: TOKEN.textPri,
            }}
          >
            All Products
          </h1>
        </div>

        {/* DESKTOP BULK ACTIONS */}
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
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{ fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}
              >
                {selectedRows.length} selected
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={actionBtnStyle}
                onClick={() => table.resetRowSelection()}
              >
                Cancel
              </button>
              <button style={actionBtnStyle}>Assign Website</button>
              <button style={actionBtnStyle}>Generate TDS</button>
              <button
                style={{
                  ...actionBtnStyle,
                  background: TOKEN.dangerBg,
                  color: TOKEN.dangerText,
                }}
                onClick={handleBulkDelete}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* MOBILE BULK ACTIONS */}
        {isMobile && isBulk && (
          <div
            style={{
              background: TOKEN.surface,
              border: `1px solid ${TOKEN.primary}`,
              borderRadius: 12,
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: `0 4px 12px ${TOKEN.primary}15`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: TOKEN.primary,
                  }}
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
                    onCheckedChange={(value) =>
                      table.toggleAllRowsSelected(!!value)
                    }
                  />
                  Select All ({table.getFilteredRowModel().rows.length})
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
                    alignItems: "center",
                    justifyContent: "center",
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
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>Assign Website</DropdownMenuItem>
                    <DropdownMenuItem>Generate TDS</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      style={{ fontWeight: 700, color: TOKEN.danger }}
                      onClick={handleBulkDelete}
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH AND FILTERS */}
        {!isBulk && (
          <div
            style={{
              display: "flex",
              flexWrap: isMobile ? "nowrap" : "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
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
                placeholder="Search products..."
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

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                style={{
                  ...filterBtnStyle,
                  position: "relative",
                  padding: isMobile ? "10px 12px" : "10px 16px",
                  background: (activeFamilyFilter || columnFilters.some(f => f.id === "productClass" || f.id === "productUsage")) ? `${TOKEN.primary}10` : TOKEN.surface,
                  borderColor: (activeFamilyFilter || columnFilters.some(f => f.id === "productClass" || f.id === "productUsage")) ? TOKEN.primary : TOKEN.border,
                }}
                onClick={() => setFilterDrawerOpen(true)}
              >
                <ListFilter size={16} />
                {!isMobile && <>Filter</>}
                {(activeFamilyFilter || columnFilters.some(f => f.id === "productClass" || f.id === "productUsage")) && (
                  <span
                    style={{
                      position: isMobile ? "absolute" : "static",
                      top: isMobile ? 8 : "auto",
                      right: isMobile ? 8 : "auto",
                      marginLeft: isMobile ? 0 : 4,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: TOKEN.primary,
                      border: isMobile ? `2px solid ${TOKEN.surface}` : "none",
                    }}
                  />
                )}
              </button>

              {!isMobile && (
                <>
                  <button style={outlineBtnStyle}>
                    <Download size={15} /> Bulk Download TDS
                  </button>
                  <button style={outlineBtnStyle}>
                    <Upload size={15} /> Bulk Upload
                  </button>
                  <button style={primaryBtnStyle}>
                    <Plus size={15} /> Add Product
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE FILTER CHIPS */}
      {(activeFamilyFilter || (table.getColumn("productClass")?.getFilterValue() as string) || (table.getColumn("productUsage")?.getFilterValue() as string)) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 12 }}>
          {activeFamilyFilter && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, padding: "5px 10px",
              background: `${TOKEN.primary}12`, border: `1px solid ${TOKEN.primary}30`,
              color: TOKEN.primary, borderRadius: 20,
            }}>
              Family: {activeFamilyFilter}
              <button
                onClick={() => table.getColumn("productFamily")?.setFilterValue("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: TOKEN.primary, padding: 0, display: "flex", lineHeight: 1 }}
              ><X size={12} /></button>
            </span>
          )}
          {(table.getColumn("productClass")?.getFilterValue() as string) && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, padding: "5px 10px",
              background: `${TOKEN.primary}12`, border: `1px solid ${TOKEN.primary}30`,
              color: TOKEN.primary, borderRadius: 20,
            }}>
              Class: {table.getColumn("productClass")?.getFilterValue() as string}
              <button
                onClick={() => table.getColumn("productClass")?.setFilterValue("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: TOKEN.primary, padding: 0, display: "flex", lineHeight: 1 }}
              ><X size={12} /></button>
            </span>
          )}
          {(table.getColumn("productUsage")?.getFilterValue() as string) && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, padding: "5px 10px",
              background: `${TOKEN.primary}12`, border: `1px solid ${TOKEN.primary}30`,
              color: TOKEN.primary, borderRadius: 20,
            }}>
              Usage: {table.getColumn("productUsage")?.getFilterValue() as string}
              <button
                onClick={() => table.getColumn("productUsage")?.setFilterValue("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: TOKEN.primary, padding: 0, display: "flex", lineHeight: 1 }}
              ><X size={12} /></button>
            </span>
          )}
        </div>
      )}

      {/* DESKTOP TABLE */}
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
                  {hg.headers.map((header) => (
                    <th key={header.id} style={thStyle}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: `1px solid ${TOKEN.border}`,
                    background: row.getIsSelected()
                      ? `${TOKEN.primary}05`
                      : "transparent",
                  }}
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
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
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
                {[10, 20, 50, 100].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
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

      {/* ─── MOBILE CARDS with swipe-to-delete ─────────────────────────────── */}
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
        {table.getFilteredRowModel().rows.map((row) => {
          const product = row.original;
          const isSelected = row.getIsSelected();
          const codes = getFilledItemCodes(resolveItemCodes(product));
          const isThisSwiping = swipingCardId === row.id;
          const currentOffset = isThisSwiping ? swipeOffset : 0;
          // How far the delete zone is revealed (positive = visible width)
          const deleteZoneWidth = Math.max(-currentOffset, 0);
          const showDeleteIcon = deleteZoneWidth > 40;
          const pastThreshold = deleteZoneWidth >= SWIPE_DELETE_THRESHOLD;

          return (
            // Outer wrapper: clips the sliding card so the delete zone
            // appears from behind on the right edge
            <div
              key={row.id}
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                // Reserve height so nothing jumps when the card slides
                flexShrink: 0,
              }}
            >
              {/* ── Delete zone (red strip behind the card) ── */}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: deleteZoneWidth,
                  background: pastThreshold
                    ? "#b91c1c"   // darker red once threshold passed
                    : TOKEN.danger,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: isThisSwiping ? "none" : "width 0.3s ease, background 0.15s",
                  borderRadius: "0 16px 16px 0",
                }}
              >
                {showDeleteIcon && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <Trash2 size={22} color="#fff" style={{ opacity: pastThreshold ? 1 : 0.85 }} />
                    {pastThreshold && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Release
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Card content (slides left on swipe) ── */}
              <div
                style={{
                  ...mobileCardStyle,
                  border: isSelected
                    ? `2px solid ${TOKEN.primary}`
                    : `1px solid ${TOKEN.border}`,
                  background: isSelected ? `${TOKEN.primary}08` : TOKEN.surface,
                  position: "relative",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  // Slide transform — clamped at 150px so it doesn't go too far
                  transform: `translateX(${Math.max(currentOffset, -150)}px)`,
                  transition: isThisSwiping ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  borderRadius: 16,
                  // Remove left border radius when delete zone is fully revealed
                  borderTopRightRadius: deleteZoneWidth > 8 ? 0 : 16,
                  borderBottomRightRadius: deleteZoneWidth > 8 ? 0 : 16,
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
                onClick={() => handleCardTap(row.id)}
              >
                <div style={{ display: "flex", gap: 16 }}>
                  {/* Image */}
                  <div style={mobileImgStyle}>
                    {product.mainImage || product.imageUrl ? (
                      <img
                        src={product.mainImage || product.imageUrl}
                        style={imgStyle}
                        alt=""
                      />
                    ) : (
                      <Package size={24} color={TOKEN.textSec} />
                    )}
                  </div>

                  {/* Info */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
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
                        {product.name || product.itemDescription || "Untitled"}
                      </h4>
                      {codes.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                            marginTop: 6,
                          }}
                        >
                          {codes.slice(0, 3).map((cObj: any, i: number) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                padding: "2px 6px",
                                background: `${TOKEN.primary}15`,
                                color: TOKEN.primary,
                                borderRadius: 4,
                                fontFamily: "monospace",
                              }}
                            >
                              {cObj.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 10,
                        color: TOKEN.textSec,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {product.productFamily || "Standard"}
                    </p>
                  </div>

                  {/* Right meta */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: "flex-start",
                      gap: 6,
                      minWidth: 60,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: TOKEN.textPri,
                        background: TOKEN.border,
                        padding: "4px 8px",
                        borderRadius: 4,
                        textTransform: "capitalize",
                      }}
                    >
                      {product.productClass || "Standard"}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: TOKEN.textSec,
                        background: TOKEN.bg,
                        padding: "4px 8px",
                        borderRadius: 4,
                        textTransform: "capitalize",
                      }}
                    >
                      {product.productUsage || "Indoor"}
                    </span>
                    {product.tdsFileUrl && (
                      <button
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: TOKEN.danger,
                          background: TOKEN.dangerBg,
                          padding: "6px 8px",
                          borderRadius: 6,
                          marginTop: "auto",
                          border: "none",
                        }}
                      >
                        VIEW TDS
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isMobile && !isBulk && (
        <FAB
          actions={[
            { label: "New Product", Icon: Plus, color: TOKEN.primary },
            { label: "Bulk Import", Icon: Upload, color: TOKEN.secondary },
            { label: "Bulk Download TDS", Icon: Download, color: TOKEN.accent },
          ]}
        />
      )}

      {/* ── FILTER DRAWER
            z-index 300 so it covers the bottom nav (110) and the FAB (110)
      ─── */}
      {filterDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 300,
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
            onClick={() => { setFilterDrawerOpen(false); setFilterCategory(null); }}
          />

          {/* Panel */}
          <div
            style={isMobile ? {
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "80vh",
              background: TOKEN.surface,
              borderTop: `1px solid ${TOKEN.border}`,
              borderRadius: "24px 24px 0 0",
              zIndex: 301,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
            } : {
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 340,
              background: TOKEN.surface,
              borderLeft: `1px solid ${TOKEN.border}`,
              zIndex: 301,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
            }}
          >
            {/* Drag handle (mobile only) */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: TOKEN.border }} />
              </div>
            )}

            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 20px 16px",
                borderBottom: `1px solid ${TOKEN.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {filterCategory && (
                  <button
                    onClick={() => setFilterCategory(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: TOKEN.textSec,
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <span style={{ fontSize: 15, fontWeight: 800, color: TOKEN.textPri }}>
                  {filterCategory === "family" ? "Product Family"
                    : filterCategory === "class" ? "Product Class"
                    : filterCategory === "usage" ? "Product Usage"
                    : "Filters"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!filterCategory && (
                  <button
                    onClick={() => {
                      table.getColumn("productFamily")?.setFilterValue("");
                      table.getColumn("productClass")?.setFilterValue("");
                      table.getColumn("productUsage")?.setFilterValue("");
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: TOKEN.primary,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => { setFilterDrawerOpen(false); setFilterCategory(null); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Root category list */}
              {!filterCategory && (
                <div style={{ padding: "12px 0" }}>
                  {[
                    {
                      key: "family" as const,
                      label: "Family",
                      subtitle: `${uniqueFamilies.length} options`,
                      activeValue: activeFamilyFilter,
                    },
                    {
                      key: "class" as const,
                      label: "Class",
                      subtitle: `${uniqueClasses.length} options`,
                      activeValue: (table.getColumn("productClass")?.getFilterValue() as string) ?? "",
                    },
                    {
                      key: "usage" as const,
                      label: "Usage",
                      subtitle: `${uniqueUsages.length} options`,
                      activeValue: (table.getColumn("productUsage")?.getFilterValue() as string) ?? "",
                    },
                  ].map(({ key, label, subtitle, activeValue }) => (
                    <button
                      key={key}
                      onClick={() => setFilterCategory(key)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        borderBottom: `1px solid ${TOKEN.border}`,
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}>{label}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: activeValue ? TOKEN.primary : TOKEN.textSec, fontWeight: 600 }}>
                          {activeValue || subtitle}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {activeValue && (
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: TOKEN.primary, flexShrink: 0,
                          }} />
                        )}
                        <ChevronRight size={16} color={TOKEN.textSec} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Family values */}
              {filterCategory === "family" && (
                <div style={{ padding: "8px 0" }}>
                  {["", ...uniqueFamilies].map((fam, i) => {
                    const label = fam || "All Families";
                    const isActive = activeFamilyFilter === fam;
                    const count = fam
                      ? data.filter((p) => (p.productFamily || p.categories) === fam).length
                      : data.length;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          table.getColumn("productFamily")?.setFilterValue(fam);
                          setFilterCategory(null);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 20px",
                          background: isActive ? `${TOKEN.primary}08` : "none",
                          border: "none",
                          borderBottom: `1px solid ${TOKEN.border}`,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? TOKEN.primary : TOKEN.textPri, flex: 1, textAlign: "left" }}>
                          {label as string}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isActive ? TOKEN.primary : TOKEN.textSec,
                          background: isActive ? `${TOKEN.primary}12` : TOKEN.bg,
                          padding: "2px 8px", borderRadius: 6, marginRight: 8,
                        }}>
                          {count}
                        </span>
                        {isActive && <Check size={15} color={TOKEN.primary} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Class values */}
              {filterCategory === "class" && (
                <div style={{ padding: "8px 0" }}>
                  {["", ...uniqueClasses].map((cls, i) => {
                    const label = cls || "All Classes";
                    const activeClassFilter = (table.getColumn("productClass")?.getFilterValue() as string) ?? "";
                    const isActive = activeClassFilter === cls;
                    const count = cls
                      ? data.filter((p) => (p.productClass || "").toLowerCase() === cls.toLowerCase()).length
                      : data.length;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          table.getColumn("productClass")?.setFilterValue(cls);
                          setFilterCategory(null);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 20px",
                          background: isActive ? `${TOKEN.primary}08` : "none",
                          border: "none",
                          borderBottom: `1px solid ${TOKEN.border}`,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? TOKEN.primary : TOKEN.textPri, flex: 1, textAlign: "left" }}>
                          {label as string}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isActive ? TOKEN.primary : TOKEN.textSec,
                          background: isActive ? `${TOKEN.primary}12` : TOKEN.bg,
                          padding: "2px 8px", borderRadius: 6, marginRight: 8,
                        }}>
                          {count}
                        </span>
                        {isActive && <Check size={15} color={TOKEN.primary} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Usage values */}
              {filterCategory === "usage" && (
                <div style={{ padding: "8px 0" }}>
                  {["", ...uniqueUsages].map((usage, i) => {
                    const label = usage || "All Usages";
                    const activeUsageFilter = (table.getColumn("productUsage")?.getFilterValue() as string) ?? "";
                    const isActive = activeUsageFilter === usage;
                    const count = usage
                      ? data.filter((p) => {
                          const u = p.productUsage;
                          const arr: string[] = Array.isArray(u) ? u : u ? [u] : [];
                          return arr.some((v) => v.toUpperCase() === usage.toUpperCase());
                        }).length
                      : data.length;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          table.getColumn("productUsage")?.setFilterValue(usage);
                          setFilterCategory(null);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 20px",
                          background: isActive ? `${TOKEN.primary}08` : "none",
                          border: "none",
                          borderBottom: `1px solid ${TOKEN.border}`,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? TOKEN.primary : TOKEN.textPri, flex: 1, textAlign: "left" }}>
                          {label as string}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isActive ? TOKEN.primary : TOKEN.textSec,
                          background: isActive ? `${TOKEN.primary}12` : TOKEN.bg,
                          padding: "2px 8px", borderRadius: 6, marginRight: 8,
                        }}>
                          {count}
                        </span>
                        {isActive && <Check size={15} color={TOKEN.primary} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{
              padding: "16px 20px",
              // Ensure footer sits above iOS home indicator
              paddingBottom: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 16,
              borderTop: `1px solid ${TOKEN.border}`,
            }}>
              <button
                onClick={() => { setFilterDrawerOpen(false); setFilterCategory(null); }}
                style={{ ...primaryBtnStyle, width: "100%", justifyContent: "center" }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete dialogs ─────────────────────────────────────────────────── */}
      <DeleteToRecycleBinDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        itemName={deleteTarget?.itemDescription || deleteTarget?.name || ""}
        onConfirm={() => handleExecuteDelete(deleteTarget)}
        // Writers without verify go through request flow
        requestMode={!canVerifyProducts()}
      />

      <DeleteToRecycleBinDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        itemName={`${selectedRows.length} products`}
        count={selectedRows.length}
        onConfirm={handleExecuteBulkDelete}
        requestMode={!canVerifyProducts()}
      />

      {/* CSS View Toggle */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
  .desktop-view { display: none !important; }
  .mobile-view { display: flex; }
  @media (min-width: 1024px) {
    .desktop-view { display: flex !important; flex-direction: column; gap: 16px; }
    .mobile-view { display: none !important; }
  }
  `,
        }}
      />
    </div>
  );
}

// --- Inline Styles ---
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
};
const imgStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};
const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
  background: TOKEN.bg,
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 6,
  color: TOKEN.textSec,
  textTransform: "uppercase",
};
const siteTagStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  padding: "2px 6px",
  background: `${TOKEN.secondary}15`,
  color: TOKEN.secondary,
  borderRadius: 4,
};
const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 6,
  cursor: "pointer",
  color: TOKEN.textSec,
  borderRadius: 6,
};
const mobileCardStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: "16px 14px",
  userSelect: "none",
  transition: "all 0.2s ease",
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
};
const filterBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 12,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  color: TOKEN.textPri,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};
const outlineBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 12,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  color: TOKEN.textPri,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};
const primaryBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 12,
  border: "none",
  background: TOKEN.primary,
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
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
  transition: "background 0.2s",
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