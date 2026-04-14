"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition,
} from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TOKEN } from "@/components/layout/tokens";
import {
  Search,
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
import { DeleteToRecycleBinDialog } from "@/components/deletedialog";
import { FAB } from "@/components/layout/FAB";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProductWorkflow } from "@/lib/useProductWorkflow";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveItemCodes = (p: any) => p.itemCodes || {};
const getFilledItemCodes = (codes: any) =>
  Object.entries(codes)
    .filter(([, v]) => !!v)
    .map(([k, v]) => ({ label: k, code: v as string }));

// ─── Inline styles ────────────────────────────────────────────────────────────

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

// ─── Constant: swipe threshold ────────────────────────────────────────────────

const SWIPE_DELETE_THRESHOLD = 90;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllProductsPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // ── RBAC ────────────────────────────────────────────────────────────────────
  const { submitProductDelete, canVerifyProducts } = useProductWorkflow();

  // ── Table state ─────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ── OPTIMIZED: split input state from table filter state ─────────────────
  // searchInput updates immediately (what the user sees in the box).
  // globalFilter is debounced 300 ms and drives the actual TanStack filter.
  // This keeps the input snappy while avoiding re-filtering on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      // startTransition marks the filter update as non-urgent so React can
      // batch it with any other pending work rather than blocking the input.
      startTransition(() => setGlobalFilter(value));
    }, 300);
  }, []);

  // ── Delete / bulk state ─────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── Filter drawer state ─────────────────────────────────────────────────────
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<
    "family" | "class" | "usage" | null
  >(null);

  // ── Swipe-to-delete ─────────────────────────────────────────────────────────
  const [swipingCardId, setSwipingCardId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeOffsetRef = useRef(0);
  const swipeCardIdRef = useRef<string | null>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeDirectionRef = useRef<"h" | "v" | null>(null);

  // ── Responsive ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Firestore — SIMPLIFIED: one query instead of two ───────────────────────
  // Previously used two parallel queries (websites array-contains-any + websites==[])
  // and merged them client-side. For a CMS with hundreds/low-thousands of products
  // this single ordered query is simpler, faster to write, and easier to maintain.
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return unsub;
  }, []);

  // ── Derived filter values (memoised) ─────────────────────────────────────
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
      Array.from(
        new Set(data.map((p) => p.productClass).filter(Boolean)),
      ).sort(),
    [data],
  );
  const uniqueUsages = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .flatMap((p) =>
              Array.isArray(p.productUsage)
                ? p.productUsage
                : p.productUsage
                  ? [p.productUsage]
                  : [],
            )
            .filter(Boolean),
        ),
      ).sort(),
    [data],
  );

  // ── Columns (stable reference — no deps that change on every render) ───────
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
              onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
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
        id: "image",
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
        header: "Product Details",
        accessorFn: (row) => `${row.name || ""} ${row.itemDescription || ""}`,
        cell: ({ row }) => (
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
              style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}
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
                .map((c: any, i: number) => (
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
                    {c.code}
                  </span>
                ))}
            </div>
          </>
        ),
      },
      {
        accessorKey: "productFamily",
        header: "Family",
        cell: ({ row }) => (
          <span style={badgeStyle}>
            {row.original.productFamily || row.original.categories || "—"}
          </span>
        ),
      },
      {
        accessorKey: "websites",
        header: "Websites",
        cell: ({ row }) => {
          const sites: string[] = row.original.websites || [];
          if (!sites.length)
            return (
              <span style={{ fontSize: 11, color: TOKEN.textSec }}>
                Unassigned
              </span>
            );
          return (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {sites.map((site) => (
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
      // Hidden filter-only columns
      {
        id: "productClass",
        accessorKey: "productClass",
        enableHiding: true,
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          return (
            (row.original.productClass || "").toLowerCase() ===
            (filterValue as string).toLowerCase()
          );
        },
        header: () => null,
        cell: () => null,
      },
      {
        id: "productUsage",
        accessorFn: (row) => {
          const u = row.productUsage;
          return Array.isArray(u) ? u.join(",") : u || "";
        },
        filterFn: (row, _, filterValue) => {
          if (!filterValue) return true;
          const u = row.original.productUsage;
          const arr: string[] = Array.isArray(u) ? u : u ? [u] : [];
          return arr.some(
            (v) => v.toUpperCase() === (filterValue as string).toUpperCase(),
          );
        },
        header: () => null,
        cell: () => null,
      },
    ],
    [],
  );

  // ── Table instance ──────────────────────────────────────────────────────────
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
  const activeFamilyFilter =
    (table.getColumn("productFamily")?.getFilterValue() as string) ?? "";
  const activeClassFilter =
    (table.getColumn("productClass")?.getFilterValue() as string) ?? "";
  const activeUsageFilter =
    (table.getColumn("productUsage")?.getFilterValue() as string) ?? "";
  const hasActiveFilters = !!(
    activeFamilyFilter ||
    activeClassFilter ||
    activeUsageFilter
  );

  // ── Delete handlers ─────────────────────────────────────────────────────────
  const handleExecuteDelete = useCallback(
    async (product: any) => {
      try {
        const result = await submitProductDelete({
          product,
          originPage: "/products/all-products",
          source: "all-products:delete",
        });
        toast.success(result.message);
      } catch (err: any) {
        toast.error(err?.message || "Delete failed.");
      }
    },
    [submitProductDelete],
  );

  const handleExecuteBulkDelete = useCallback(async () => {
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
    if (failed === 0)
      toast.success(
        `${succeeded} product${succeeded !== 1 ? "s" : ""} deleted.`,
      );
    else toast.error(`${succeeded} deleted, ${failed} failed.`);
  }, [selectedRows, submitProductDelete, table]);

  // ── Long-press to select (mobile) ───────────────────────────────────────────
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);

  const handleCardPressStart = useCallback(
    (id: string) => {
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
    },
    [isBulk, table],
  );

  const handleCardPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCardTap = useCallback(
    (id: string) => {
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

  // ── Swipe-to-delete handlers (mobile) ──────────────────────────────────────
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
        setDeleteTarget(product);
      }
      setSwipingCardId(null);
      setSwipeOffset(0);
      swipeOffsetRef.current = 0;
      swipeCardIdRef.current = null;
      swipeDirectionRef.current = null;
    },
    [handleCardPressEnd],
  );

  const closeFilterDrawer = useCallback(() => {
    setFilterDrawerOpen(false);
    setFilterCategory(null);
  }, []);

  // ── Loading state ───────────────────────────────────────────────────────────
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
          .spinner { width:24px;height:24px;border:2px solid ${TOKEN.border};border-top-color:${TOKEN.primary};
            border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto; }
          @keyframes spin { to { transform:rotate(360deg); } }
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

        {/* Desktop bulk actions */}
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
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}
            >
              {selectedRows.length} selected
            </span>
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
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Mobile bulk actions */}
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
                    onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
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
                    <DropdownMenuItem>Assign Website</DropdownMenuItem>
                    <DropdownMenuItem>Generate TDS</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      style={{ fontWeight: 700, color: TOKEN.danger }}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* Search + filters */}
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
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                style={{
                  ...filterBtnStyle,
                  position: "relative",
                  padding: isMobile ? "10px 12px" : "10px 16px",
                  background: hasActiveFilters
                    ? `${TOKEN.primary}10`
                    : TOKEN.surface,
                  borderColor: hasActiveFilters ? TOKEN.primary : TOKEN.border,
                }}
                onClick={() => setFilterDrawerOpen(true)}
              >
                <ListFilter size={16} />
                {!isMobile && "Filter"}
                {hasActiveFilters && (
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

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 12,
          }}
        >
          {activeFamilyFilter && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                background: `${TOKEN.primary}12`,
                border: `1px solid ${TOKEN.primary}30`,
                color: TOKEN.primary,
                borderRadius: 20,
              }}
            >
              Family: {activeFamilyFilter}
              <button
                onClick={() =>
                  table.getColumn("productFamily")?.setFilterValue("")
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: TOKEN.primary,
                  padding: 0,
                  display: "flex",
                  lineHeight: 1,
                }}
              >
                <X size={12} />
              </button>
            </span>
          )}
          {activeClassFilter && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                background: `${TOKEN.primary}12`,
                border: `1px solid ${TOKEN.primary}30`,
                color: TOKEN.primary,
                borderRadius: 20,
              }}
            >
              Class: {activeClassFilter}
              <button
                onClick={() =>
                  table.getColumn("productClass")?.setFilterValue("")
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: TOKEN.primary,
                  padding: 0,
                  display: "flex",
                  lineHeight: 1,
                }}
              >
                <X size={12} />
              </button>
            </span>
          )}
          {activeUsageFilter && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                background: `${TOKEN.primary}12`,
                border: `1px solid ${TOKEN.primary}30`,
                color: TOKEN.primary,
                borderRadius: 20,
              }}
            >
              Usage: {activeUsageFilter}
              <button
                onClick={() =>
                  table.getColumn("productUsage")?.setFilterValue("")
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: TOKEN.primary,
                  padding: 0,
                  display: "flex",
                  lineHeight: 1,
                }}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

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
                    <Package
                      size={32}
                      style={{ margin: "0 auto 10px", opacity: 0.2 }}
                    />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      No products found
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
        {table.getFilteredRowModel().rows.map((row) => {
          const product = row.original;
          const isSelected = row.getIsSelected();
          const codes = getFilledItemCodes(resolveItemCodes(product));
          const isThisSwiping = swipingCardId === row.id;
          const currentOffset = isThisSwiping ? swipeOffset : 0;
          const deleteZoneWidth = Math.max(-currentOffset, 0);
          const showDeleteIcon = deleteZoneWidth > 40;
          const pastThreshold = deleteZoneWidth >= SWIPE_DELETE_THRESHOLD;

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
              {/* Delete zone */}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: deleteZoneWidth,
                  background: pastThreshold ? "#b91c1c" : TOKEN.danger,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: isThisSwiping
                    ? "none"
                    : "width 0.3s ease, background 0.15s",
                  borderRadius: "0 16px 16px 0",
                }}
              >
                {showDeleteIcon && (
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
                      style={{ opacity: pastThreshold ? 1 : 0.85 }}
                    />
                    {pastThreshold && (
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

              {/* Card */}
              <div
                style={{
                  ...mobileCardStyle,
                  border: isSelected
                    ? `2px solid ${TOKEN.primary}`
                    : `1px solid ${TOKEN.border}`,
                  background: isSelected ? `${TOKEN.primary}08` : TOKEN.surface,
                  position: "relative",
                  WebkitUserSelect: "none",
                  transform: `translateX(${Math.max(currentOffset, -150)}px)`,
                  transition: isThisSwiping
                    ? "none"
                    : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
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
                  <div style={mobileImgStyle}>
                    {product.mainImage || product.imageUrl ? (
                      <img
                        src={product.mainImage || product.imageUrl}
                        style={imgStyle}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <Package size={24} color={TOKEN.textSec} />
                    )}
                  </div>
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
                          {codes.slice(0, 3).map((c: any, i: number) => (
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
                              {c.code}
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

      {/* ── Filter drawer ── */}
      {filterDrawerOpen && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 300,
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
            onClick={closeFilterDrawer}
          />
          <div
            style={
              isMobile
                ? {
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
                  }
                : {
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
                  }
            }
          >
            {isMobile && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: 12,
                  paddingBottom: 4,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    background: TOKEN.border,
                  }}
                />
              </div>
            )}
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
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: TOKEN.textPri,
                  }}
                >
                  {filterCategory === "family"
                    ? "Product Family"
                    : filterCategory === "class"
                      ? "Product Class"
                      : filterCategory === "usage"
                        ? "Product Usage"
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
                  onClick={closeFilterDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                    padding: 4,
                    display: "flex",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {!filterCategory && (
                <div style={{ padding: "12px 0" }}>
                  {(
                    [
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
                        activeValue: activeClassFilter,
                      },
                      {
                        key: "usage" as const,
                        label: "Usage",
                        subtitle: `${uniqueUsages.length} options`,
                        activeValue: activeUsageFilter,
                      },
                    ] as const
                  ).map(({ key, label, subtitle, activeValue }) => (
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
                        borderBottom: `1px solid ${TOKEN.border}`,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 700,
                            color: TOKEN.textPri,
                          }}
                        >
                          {label}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: activeValue ? TOKEN.primary : TOKEN.textSec,
                            fontWeight: 600,
                          }}
                        >
                          {activeValue || subtitle}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {activeValue && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: TOKEN.primary,
                            }}
                          />
                        )}
                        <ChevronRight size={16} color={TOKEN.textSec} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Family / Class / Usage value lists */}
              {(["family", "class", "usage"] as const).map((cat) => {
                if (filterCategory !== cat) return null;
                const options =
                  cat === "family"
                    ? uniqueFamilies
                    : cat === "class"
                      ? uniqueClasses
                      : uniqueUsages;
                const colId =
                  cat === "family"
                    ? "productFamily"
                    : cat === "class"
                      ? "productClass"
                      : "productUsage";
                const currentVal =
                  (table.getColumn(colId)?.getFilterValue() as string) ?? "";
                return (
                  <div key={cat} style={{ padding: "8px 0" }}>
                    {(["", ...options] as string[]).map((opt, i) => {
                      const label =
                        opt ||
                        `All ${cat === "family" ? "Families" : cat === "class" ? "Classes" : "Usages"}`;
                      const isActive = currentVal === opt;
                      const count = opt
                        ? data.filter((p) => {
                            if (cat === "usage") {
                              const u = p.productUsage;
                              const arr: string[] = Array.isArray(u)
                                ? u
                                : u
                                  ? [u]
                                  : [];
                              return arr.some(
                                (v) => v.toUpperCase() === opt.toUpperCase(),
                              );
                            }
                            if (cat === "class")
                              return (
                                (p.productClass || "").toLowerCase() ===
                                opt.toLowerCase()
                              );
                            return (p.productFamily || p.categories) === opt;
                          }).length
                        : data.length;
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            table.getColumn(colId)?.setFilterValue(opt);
                            setFilterCategory(null);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 20px",
                            background: isActive
                              ? `${TOKEN.primary}08`
                              : "none",
                            border: "none",
                            borderBottom: `1px solid ${TOKEN.border}`,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: isActive ? 700 : 500,
                              color: isActive ? TOKEN.primary : TOKEN.textPri,
                              flex: 1,
                              textAlign: "left",
                            }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isActive ? TOKEN.primary : TOKEN.textSec,
                              background: isActive
                                ? `${TOKEN.primary}12`
                                : TOKEN.bg,
                              padding: "2px 8px",
                              borderRadius: 6,
                              marginRight: 8,
                            }}
                          >
                            {count}
                          </span>
                          {isActive && (
                            <Check size={15} color={TOKEN.primary} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                padding: "16px 20px",
                paddingBottom: isMobile
                  ? "calc(16px + env(safe-area-inset-bottom, 0px))"
                  : 16,
                borderTop: `1px solid ${TOKEN.border}`,
              }}
            >
              <button
                onClick={closeFilterDrawer}
                style={{
                  ...primaryBtnStyle,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete dialogs ── */}
      <DeleteToRecycleBinDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        itemName={deleteTarget?.itemDescription || deleteTarget?.name || ""}
        onConfirm={() => handleExecuteDelete(deleteTarget)}
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
