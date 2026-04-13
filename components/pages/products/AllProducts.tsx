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
  CheckCircle2,
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

// --- Logic Helpers ---
const resolveItemCodes = (p: any) => p.itemCodes || {};
const getFilledItemCodes = (codes: any) =>
  Object.entries(codes)
    .filter(([_, v]) => !!v)
    .map(([k, v]) => ({ label: k, code: v as string }));

export default function AllProductsPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── FIREBASE FETCHING (REFERENCE COMPLIANT) ───────────────────────────────
  useEffect(() => {
    let assignedData: any[] = [];
    let unassignedData: any[] = [];
    let assignedReady = false;
    let unassignedReady = false;

    const flush = () => {
      if (assignedReady && unassignedReady) {
        const merged = [...assignedData, ...unassignedData];
        // Deduplicate
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
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
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
              {/* Show item code labels stacked */}
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
  const activeFamilyFilter =
    (table.getColumn("productFamily")?.getFilterValue() as string) ?? "";

  // Custom Filter Actions
  const handleBulkDelete = () => setBulkDeleteOpen(true);

  const handleExecuteDelete = async (product: any) => {
    // mock delete
    console.log("Deleted", product);
  };

  const handleExecuteBulkDelete = async () => {
    console.log(
      "Bulk Delete",
      selectedRows.map((r) => r.original),
    );
    table.resetRowSelection();
  };

  // MOBILE EVENT HANDLERS (DOUBLE TAP)
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const handleCardTap = (id: string) => {
    // If we are already in bulk selection mode, a single tap should toggle selection
    if (isBulk) {
      const row = table.getRowModel().rows.find((r) => r.id === id);
      row?.toggleSelected();
      return;
    }

    const now = Date.now();
    const lastTap = lastTapRef.current;

    // Check if the same card was tapped within 400ms
    if (lastTap && lastTap.id === id && now - lastTap.time < 400) {
      const row = table.getRowModel().rows.find((r) => r.id === id);
      if (row && !row.getIsSelected()) {
        row.toggleSelected(true);
      }
      lastTapRef.current = null; // Reset after a successful double tap
    } else {
      // Register the first tap
      lastTapRef.current = { id, time: now };
    }
  };

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
      {/* STICKY TOP CONTROLS (SEARCH, FILTERS, BULK ACTIONS) */}
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

        {/* MOBILE BULK ACTIONS (Improves layout, uses dropdown menu) */}
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
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) =>
                      table.toggleAllPageRowsSelected(!!value)
                    }
                  />
                  Select All
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
                  <DropdownMenuContent
                    align="end"
                    className="w-48"
                    style={{
                      background: TOKEN.surface,
                      border: `1px solid ${TOKEN.border}`,
                      borderRadius: 12,
                      padding: "6px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      zIndex: 100,
                    }}
                  >
                    <DropdownMenuItem
                      style={{
                        fontWeight: 600,
                        color: TOKEN.textPri,
                        cursor: "pointer",
                      }}
                    >
                      Assign Website
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      style={{
                        fontWeight: 600,
                        color: TOKEN.textPri,
                        cursor: "pointer",
                      }}
                    >
                      Generate TDS
                    </DropdownMenuItem>
                    <DropdownMenuSeparator
                      style={{ background: TOKEN.border, margin: "4px 0" }}
                    />
                    <DropdownMenuItem
                      style={{
                        fontWeight: 700,
                        color: TOKEN.danger,
                        cursor: "pointer",
                      }}
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

        {/* SEARCH AND FILTERS (Hidden when bulk selected for clean UI) */}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    style={{
                      ...filterBtnStyle,
                      position: "relative",
                      padding: isMobile ? "10px 12px" : "10px 16px",
                    }}
                  >
                    <ListFilter size={16} />
                    {!isMobile && (
                      <>
                        Filter <ChevronDown size={14} />
                      </>
                    )}
                    {activeFamilyFilter && (
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
                          border: isMobile
                            ? `2px solid ${TOKEN.surface}`
                            : "none",
                        }}
                      />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isMobile ? "end" : "end"}
                  className="w-56"
                >
                  <DropdownMenuLabel>Product Family</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      table.getColumn("productFamily")?.setFilterValue("")
                    }
                  >
                    All Families{" "}
                    {activeFamilyFilter === "" && (
                      <Check size={14} className="ml-auto" />
                    )}
                  </DropdownMenuItem>
                  {uniqueFamilies.map((fam) => (
                    <DropdownMenuItem
                      key={fam as string}
                      onClick={() =>
                        table.getColumn("productFamily")?.setFilterValue(fam)
                      }
                    >
                      {fam as string}
                      {activeFamilyFilter === fam && (
                        <Check size={14} className="ml-auto" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

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
        {/* Pagination Controls inside Table Container */}
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

      {/* MOBILE SCROLLABLE CONTENT (CARDS) - REMOVED PAGINATION LOGIC ON MOBILE */}
      <div
        className="mobile-view"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 100,
        }}
      >
        {table.getFilteredRowModel().rows.map((row) => {
          const product = row.original;
          const isSelected = row.getIsSelected();
          const codes = getFilledItemCodes(resolveItemCodes(product));

          return (
            <div
              key={row.id}
              style={{
                ...mobileCardStyle,
                border: isSelected
                  ? `1px solid ${TOKEN.primary}`
                  : `1px solid ${TOKEN.border}`,
                background: isSelected ? `${TOKEN.primary}05` : TOKEN.surface,
                position: "relative",
              }}
              onClick={() => handleCardTap(row.id)}
            >
              {/* Checkbox overlay if selected */}
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
                  <CheckCircle2 size={16} color="#fff" />
                </div>
              )}
              <div style={{ display: "flex", gap: 16 }}>
                {/* Img Left */}
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
                {/* Mid Info */}
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
                {/* Right Info */}
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
                      background: `${TOKEN.border}`,
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
                        background: `${TOKEN.dangerBg}`,
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

      {/* Delete Dialogs */}
      <DeleteToRecycleBinDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        itemName={deleteTarget?.itemDescription || deleteTarget?.name || ""}
        onConfirm={() => handleExecuteDelete(deleteTarget)}
      />

      <DeleteToRecycleBinDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        itemName={`${selectedRows.length} products`}
        count={selectedRows.length}
        onConfirm={handleExecuteBulkDelete}
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
