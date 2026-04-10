"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Filter,
  Download,
  Trash2,
  MoreVertical,
  ChevronDown,
  Plus,
  CheckSquare,
  Square,
  Eye,
  Upload,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DeleteToRecycleBinDialog } from "@/components/deletedialog";
import { ItemCodesDisplay } from "@/components/ItemCodesDisplay";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  itemDescription: string;
  itemCodes?: any;
  productFamily?: string;
  productClass?: "spf" | "standard" | "";
  productUsage?: string[];
  mainImage?: string;
  tdsFileUrl?: string;
  categories?: string;
  createdAt?: any;
};

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    itemDescription: "Celestial Series Watch",
    itemCodes: { LIT: "WA-99201" },
    productFamily: "ACCESSORIES",
    productClass: "standard",
    productUsage: ["OUTDOOR"],
    mainImage: "https://via.placeholder.com/100",
    tdsFileUrl: "https://example.com/tds1.pdf",
    categories: "ACCESSORIES",
  },
  {
    id: "2",
    itemDescription: "SonicPro Wireless Headphones",
    itemCodes: { LIT: "EL-44021" },
    productFamily: "ELECTRONICS",
    productClass: "standard",
    productUsage: ["OUTDOOR"],
    mainImage: "https://via.placeholder.com/100",
    categories: "ELECTRONICS",
  },
  {
    id: "3",
    itemDescription: "Aero Shades - Limited Edition",
    itemCodes: { LIT: "WA-11082" },
    productFamily: "ACCESSORIES",
    productClass: "spf",
    productUsage: ["OUTDOOR"],
    mainImage: "https://via.placeholder.com/100",
    categories: "ACCESSORIES",
  },
  {
    id: "4",
    itemDescription: "Velocity Ultra Run Shoes",
    itemCodes: { LIT: "FT-88390" },
    productFamily: "FOOTWEAR",
    productClass: "standard",
    productUsage: ["OUTDOOR"],
    mainImage: "https://via.placeholder.com/100",
    categories: "FOOTWEAR",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

// Product class badge
function ProductClassBadge({ value }: { value?: "spf" | "standard" | "" }) {
  if (!value || value === "") return <span className="text-xs text-muted-foreground/50">—</span>;
  if (value === "spf")
    return <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200">SPF</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Standard</Badge>;
}

// Product usage badge
function ProductUsageBadge({ value }: { value?: string[] }) {
  if (!value || value.length === 0) return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((u) => (
        <Badge key={u} variant="outline" className="text-[10px]">
          {u}
        </Badge>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAB COMPONENT
// ────────────────────────────────────────────────────────────────────────────

function FABMenu({
  onAddProduct,
  onBulkImport,
  onBulkDownloadTDS,
}: {
  onAddProduct: () => void;
  onBulkImport: () => void;
  onBulkDownloadTDS: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: "Add Product",
      icon: Plus,
      color: "#2563EB",
      onClick: () => {
        onAddProduct();
        setIsOpen(false);
      },
    },
    {
      label: "Bulk Import",
      icon: Upload,
      color: "#06B6D4",
      onClick: () => {
        onBulkImport();
        setIsOpen(false);
      },
    },
    {
      label: "Download TDS",
      icon: Download,
      color: "#F59E0B",
      onClick: () => {
        onBulkDownloadTDS();
        setIsOpen(false);
      },
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Menu items */}
      {isOpen && (
        <div className="flex flex-col gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white border border-border shadow-lg hover:shadow-xl hover:bg-muted transition"
              >
                <span className="text-sm font-medium text-foreground">
                  {action.label}
                </span>
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: action.color }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB button */}
      <Button
        size="lg"
        className="rounded-full w-14 h-14 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className={`w-6 h-6 transition-transform ${isOpen ? "rotate-45" : ""}`} />
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────────────────

export default function AllProductsPage() {
  const [products] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; single?: boolean } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.itemDescription.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // Pagination
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredProducts.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredProducts, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);

  // Select all in current page
  const selectAllOnPage = useCallback(() => {
    const newSelected = new Set(selectedIds);
    paginatedProducts.forEach((p) => newSelected.add(p.id));
    setSelectedIds(newSelected);
  }, [selectedIds, paginatedProducts]);

  const deselectAllOnPage = useCallback(() => {
    const newSelected = new Set(selectedIds);
    paginatedProducts.forEach((p) => newSelected.delete(p.id));
    setSelectedIds(newSelected);
  }, [selectedIds, paginatedProducts]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isAllSelectedOnPage = paginatedProducts.length > 0 && 
    paginatedProducts.every((p) => selectedIds.has(p.id));

  // Long press handler for mobile delete
  const handleLongPressStart = useCallback((id: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedId(id);
      setSelectedIds(new Set([id]));
      toast.success("Long press detected - delete option available");
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  // Delete handlers
  const handleDeleteSingle = useCallback((id: string) => {
    setDeleteTarget({ ids: [id], single: true });
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteBulk = useCallback(() => {
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 0) {
      toast.error("No products selected");
      return;
    }
    setDeleteTarget({ ids: selectedArray, single: selectedArray.length === 1 });
    setDeleteDialogOpen(true);
  }, [selectedIds]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    toast.success(`Deleted ${deleteTarget.ids.length} product(s)`);
    setSelectedIds(new Set());
    setLongPressedId(null);
  }, [deleteTarget]);

  // Get item name for delete confirmation
  const getDeleteItemName = useCallback(() => {
    if (!deleteTarget) return "";
    if (deleteTarget.ids.length === 1) {
      const product = products.find((p) => p.id === deleteTarget.ids[0]);
      return product?.itemDescription || "Unknown Product";
    }
    return `${deleteTarget.ids.length} Products`;
  }, [deleteTarget, products]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">All Products</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredProducts.length.toLocaleString()} items
              </p>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {selectedIds.size} selected
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <MoreVertical className="w-4 h-4" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.info("Assign website")}>
                      Assign Website
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("Generate TDS")}>
                      Generate TDS
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("Set status")}>
                      Set Product Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDeleteBulk}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 whitespace-nowrap"
              onClick={() => toast.info("Bulk download TDS")}
            >
              <Download className="w-4 h-4" />
              Bulk Download TDS
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 py-6">
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={isAllSelectedOnPage}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllOnPage();
                        else deselectAllOnPage();
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                  <th className="px-4 py-3 text-left font-semibold">Family</th>
                  <th className="px-4 py-3 text-left font-semibold">Class</th>
                  <th className="px-4 py-3 text-left font-semibold">Usage</th>
                  <th className="px-4 py-3 text-left font-semibold">TDS</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleSelection(product.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{product.itemDescription}</p>
                      <p className="text-xs text-muted-foreground">{product.productFamily}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ItemCodesDisplay
                        itemCodes={product.itemCodes}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {product.productFamily || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ProductClassBadge value={product.productClass} />
                    </td>
                    <td className="px-4 py-3">
                      <ProductUsageBadge value={product.productUsage} />
                    </td>
                    <td className="px-4 py-3">
                      {product.tdsFileUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toast.info("View TDS")}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteSingle(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • {filteredProducts.length} total
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-border rounded text-sm"
            >
              <option value="10">10 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Long Press Indicator */}
      {longPressedId && (
        <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-blue-50 border-b border-blue-200 px-4 py-2 text-center text-sm font-medium text-blue-700">
          Long press detected. Tap the delete button to remove, or long press again to cancel.
        </div>
      )}

      {/* Mobile Card View */}
      <div className={`lg:hidden max-w-7xl mx-auto px-4 py-6 pb-24 ${longPressedId ? "pt-20" : ""}`}>
        <div className="space-y-3">
          {paginatedProducts.map((product) => (
            <div
              key={product.id}
              className={`border rounded-lg p-4 transition ${
                selectedIds.has(product.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
              onTouchStart={() => handleLongPressStart(product.id)}
              onTouchEnd={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
              onMouseDown={() => handleLongPressStart(product.id)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
            >
              <div className="flex gap-3">
                {/* Left: Image */}
                <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                  <img
                    src={product.mainImage || "https://via.placeholder.com/80"}
                    alt={product.itemDescription}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Middle: Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground truncate">
                    {product.itemDescription}
                  </h3>
                  <div className="mt-2 space-y-1">
                    <ItemCodesDisplay
                      itemCodes={product.itemCodes}
                      size="sm"
                      maxVisible={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      {product.productFamily}
                    </p>
                  </div>
                </div>

                {/* Right: Class & Usage */}
                <div className="flex flex-col items-end gap-2">
                  <ProductClassBadge value={product.productClass} />
                  <ProductUsageBadge value={product.productUsage} />
                </div>
              </div>

              {/* View TDS Button */}
              {product.tdsFileUrl && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => toast.info("View TDS")}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View TDS
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile Pagination */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-3 py-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <DeleteToRecycleBinDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemName={getDeleteItemName()}
        count={deleteTarget?.ids.length || 1}
        onConfirm={confirmDelete}
      />

      {/* FAB - Floating Action Menu */}
      <FABMenu
        onAddProduct={() => toast.info("Add new product")}
        onBulkImport={() => toast.info("Bulk import products")}
        onBulkDownloadTDS={() => toast.info("Bulk download TDS")}
      />
    </div>
  );
}
