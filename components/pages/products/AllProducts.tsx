"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition,
} from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
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
import BulkUploader from "@/components/products/BulkUploader";
import { AddProductFlow } from "@/components/products/AddProductFlow";
import { ProductFormSheet } from "@/components/products/ProductFormSheet";
import type {
  ProductFamily as AddFlowFamily,
  ProductFormData as AddFlowFormData,
} from "@/components/products/AddProductFlow";
import type {
  AvailableSpecItem,
  ProductFormData as ProductSheetData,
} from "@/components/products/types";
import { slugify } from "@/components/products/utils";
import { logAuditEvent } from "@/lib/logger";
import { getPrimaryItemCode, type ItemCodes } from "@/types/product";

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

const SWIPE_DELETE_THRESHOLD = 90;
const SWIPE_ACTION_THRESHOLD = 72;
const SWIPE_DELETE_MAX = -150;
const SWIPE_ACTION_MAX = 140;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllProductsPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // ── RBAC ────────────────────────────────────────────────────────────────────
  const { submitProductDelete, submitProductUpdate, canVerifyProducts } =
    useProductWorkflow();

  // ── Table state ─────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to the hidden AddProductFlow wrapper — clicked programmatically by the
  // desktop toolbar button and the mobile FAB.
  const addFlowTriggerRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => setGlobalFilter(value));
    }, 300);
  }, []);

  // ── Bulk Uploader state — controlled so both desktop button and mobile FAB
  //    can open the same dialog instance ──────────────────────────────────────
  const [bulkUploaderOpen, setBulkUploaderOpen] = useState(false);

  // ── Add Product Flow raw data ─────────────────────────────────────────────
  const [rawFamilyDocs, setRawFamilyDocs] = useState<any[]>([]);
  const [rawSpecGroupDocs, setRawSpecGroupDocs] = useState<any[]>([]);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productSheetMode, setProductSheetMode] = useState<"create" | "edit">(
    "create",
  );

  // ── Delete / bulk state ─────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── Filter drawer state ─────────────────────────────────────────────────────
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<
    "family" | "class" | "usage" | null
  >(null);

  // ── Swipe-to-actions (mobile) ──────────────────────────────────────────────
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

  // ── Firestore ───────────────────────────────────────────────────────────────
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

  // ── Product families & spec groups (for Add Product flow) ────────────────
  useEffect(() => {
    const q = query(
      collection(db, "productfamilies"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setRawFamilyDocs(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "specs"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setRawSpecGroupDocs(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
    });
  }, []);

  // ── Derived filter values ────────────────────────────────────────────────
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

  // ── Flow product families (Firestore → AddProductFlow format) ────────────
  const flowProductFamilies = useMemo<AddFlowFamily[]>(
    () =>
      rawFamilyDocs.map((family) => ({
        id: family.id,
        name: family.title ?? "",
        description: family.description ?? "",
        availableSpecGroups: (family.specs ?? [])
          .map((specRef: any) => {
            const group = rawSpecGroupDocs.find(
              (g: any) => g.id === specRef.specGroupId,
            );
            return {
              id: specRef.specGroupId,
              label: group?.name ?? specRef.specGroupId,
              items: (specRef.specItems ?? []).map((item: any) => ({
                id: item.id,
                label: item.name,
                type: "text" as const,
                required: false,
              })),
            };
          })
          .filter((g: any) => g.items.length > 0),
      })),
    [rawFamilyDocs, rawSpecGroupDocs],
  );

  const allSpecGroups = useMemo(
    () =>
      rawSpecGroupDocs.map((g) => ({
        id: g.id,
        name: g.name ?? g.id,
        items: (Array.isArray(g.items) ? g.items : [])
          .map((item: any) => ({ label: (item.label ?? "").trim() }))
          .filter((item: { label: string }) => item.label.length > 0),
      })),
    [rawSpecGroupDocs],
  );

  const getAvailableSpecsForProduct = useCallback(
    (product: any): AvailableSpecItem[] => {
      const normalize = (v: unknown) => String(v ?? "").toUpperCase().trim();
      const familyNeedle =
        normalize(product?.productFamilyId) ||
        normalize(product?.productFamily) ||
        normalize(product?.categories);
      if (!familyNeedle) return [];

      const family = rawFamilyDocs.find((f) => {
        const haystack = [f.id, f.title, f.name].map(normalize);
        return haystack.includes(familyNeedle);
      });
      if (!family) return [];

      return (family.specs ?? []).flatMap((specRef: any) => {
        const specGroupId = String(specRef?.specGroupId ?? "").trim();
        if (!specGroupId) return [];
        const group = rawSpecGroupDocs.find((g) => g.id === specGroupId);
        const groupName = group?.name ?? specGroupId;
        return (specRef.specItems ?? [])
          .map((item: any, index: number) => {
            const label = String(item?.name ?? item?.label ?? "").trim();
            if (!label) return null;
            return {
              specGroupId,
              specGroup: groupName,
              label,
              id:
                String(item?.id ?? "").trim() ||
                `${specGroupId}-${label}-${index}`,
            };
          })
          .filter(Boolean) as AvailableSpecItem[];
      });
    },
    [rawFamilyDocs, rawSpecGroupDocs],
  );

  const buildSpecValues = useCallback(
    (product: any, availableSpecs: AvailableSpecItem[]) => {
      const specValueMap = new Map<string, string>();
      const techSpecs = Array.isArray(product?.technicalSpecs)
        ? product.technicalSpecs
        : [];

      techSpecs.forEach((group: any) => {
        const groupName = String(group?.specGroup ?? "").toUpperCase().trim();
        (Array.isArray(group?.specs) ? group.specs : []).forEach((spec: any) => {
          const specName = String(spec?.name ?? "").toUpperCase().trim();
          const specValue = String(spec?.value ?? "").trim();
          if (!groupName || !specName || !specValue) return;
          specValueMap.set(`${groupName}::${specName}`, specValue);
        });
      });

      return availableSpecs.reduce<Record<string, string>>((acc, spec) => {
        const lookupKey = `${String(spec.specGroup).toUpperCase().trim()}::${String(spec.label).toUpperCase().trim()}`;
        const value = specValueMap.get(lookupKey);
        if (value) acc[`${spec.specGroupId}-${spec.label}`] = value;
        return acc;
      }, {});
    },
    [],
  );

  const selectedProductFormData = useMemo<Partial<ProductSheetData>>(() => {
    if (!selectedProduct) {
      return {
        itemCodes: {},
        selectedSpecGroupIds: [],
        availableSpecs: [],
        specValues: {},
        images: [],
        productUsage: [],
        productClass: "",
        productFamilyId: "",
        productFamilyTitle: "",
        itemDescription: "",
        regPrice: "",
        salePrice: "",
        brand: "",
      };
    }

    const availableSpecs = getAvailableSpecsForProduct(selectedProduct);
    const productClass = String(selectedProduct.productClass ?? "")
      .toLowerCase()
      .trim();
    const normalizedClass =
      productClass === "spf" || productClass === "standard" ? productClass : "";

    return {
      productFamilyId: selectedProduct.productFamilyId ?? "",
      productFamilyTitle:
        selectedProduct.productFamily ??
        selectedProduct.categories ??
        selectedProduct.productFamilyTitle ??
        "",
      productUsage: Array.isArray(selectedProduct.productUsage)
        ? selectedProduct.productUsage
        : selectedProduct.productUsage
          ? [selectedProduct.productUsage]
          : [],
      selectedSpecGroupIds: Array.from(
        new Set(availableSpecs.map((spec) => spec.specGroupId)),
      ),
      availableSpecs,
      productClass: normalizedClass as "spf" | "standard" | "",
      itemDescription:
        selectedProduct.itemDescription ?? selectedProduct.name ?? "",
      itemCodes: resolveItemCodes(selectedProduct),
      specValues: buildSpecValues(selectedProduct, availableSpecs),
      images: [],
      regPrice: String(
        selectedProduct.regularPrice ?? selectedProduct.regPrice ?? "",
      ),
      salePrice: String(selectedProduct.salePrice ?? ""),
      brand: selectedProduct.brand ?? "",
    };
  }, [buildSpecValues, getAvailableSpecsForProduct, selectedProduct]);

  const closeProductSheet = useCallback(() => {
    setProductSheetOpen(false);
    setProductSheetMode("create");
    setSelectedProduct(null);
  }, []);

  const handleEditProduct = useCallback((product: any) => {
    setSwipingCardId(null);
    setSwipeOffset(0);
    swipeOffsetRef.current = 0;
    swipeCardIdRef.current = null;
    swipeDirectionRef.current = null;
    setSelectedProduct(product);
    setProductSheetMode("edit");
    setProductSheetOpen(true);
  }, []);

  const handleEditProductSubmit = useCallback(
    async (formData: Partial<ProductSheetData>) => {
      if (!selectedProduct?.id) return;
      const beforeSnapshot =
        data.find((product) => product.id === selectedProduct.id) ??
        selectedProduct;
      const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
      const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

      const uploadToCloud = async (file: File): Promise<string> => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: fd },
        );
        const json = await res.json();
        if (!json?.secure_url) throw new Error("Cloudinary upload failed");
        return json.secure_url as string;
      };

      try {
        const itemCodesObj = Object.fromEntries(
          Object.entries(
            formData.itemCodes ?? resolveItemCodes(beforeSnapshot),
          ).filter(([, value]) => Boolean(String(value ?? "").trim())),
        ) as ItemCodes;
        const resolvedEco = itemCodesObj.ECOSHIFT ?? "";
        const resolvedLit = itemCodesObj.LIT ?? "";
        const resolvedBrand = resolvedLit ? "LIT" : resolvedEco ? "ECOSHIFT" : "";

        const specsGrouped: Record<string, { name: string; value: string }[]> =
          {};
        Object.entries(formData.specValues ?? {}).forEach(([key, rawValue]) => {
          const value = String(rawValue ?? "").trim();
          if (!value) return;
          const spec = (selectedProductFormData.availableSpecs ?? []).find(
            (s) => `${s.specGroupId}-${s.label}` === key,
          );
          if (!spec) return;
          if (!specsGrouped[spec.specGroup]) specsGrouped[spec.specGroup] = [];
          specsGrouped[spec.specGroup].push({
            name: spec.label.toUpperCase().trim(),
            value: value.toUpperCase().trim(),
          });
        });

        const nextTechnicalSpecs = Object.entries(specsGrouped)
          .map(([specGroup, specs]) => ({
            specGroup: specGroup.toUpperCase().trim(),
            specs,
          }))
          .filter((group) => group.specs.length > 0);
        const technicalSpecs =
          nextTechnicalSpecs.length > 0
            ? nextTechnicalSpecs
            : beforeSnapshot.technicalSpecs ?? [];

        const regularPrice = Number.parseFloat(
          formData.regPrice ?? String(beforeSnapshot.regularPrice ?? ""),
        );
        const salePrice = Number.parseFloat(
          formData.salePrice ?? String(beforeSnapshot.salePrice ?? ""),
        );

        const nextDescription = String(
          formData.itemDescription ??
            beforeSnapshot.itemDescription ??
            beforeSnapshot.name ??
            "",
        ).trim();

        const mainImage = formData.mainImageFile
          ? await uploadToCloud(formData.mainImageFile)
          : beforeSnapshot.mainImage ?? beforeSnapshot.imageUrl ?? "";
        const rawImage = formData.rawImageFile
          ? await uploadToCloud(formData.rawImageFile)
          : beforeSnapshot.rawImage ?? mainImage;
        const galleryImages =
          formData.images && formData.images.length > 0
            ? await Promise.all(formData.images.map(uploadToCloud))
            : Array.isArray(beforeSnapshot.galleryImages)
              ? beforeSnapshot.galleryImages
              : Array.isArray(beforeSnapshot.images)
                ? beforeSnapshot.images
                : [];

        const dimensionalDrawingImage = formData.dimensionalDrawingImageFile
          ? await uploadToCloud(formData.dimensionalDrawingImageFile)
          : beforeSnapshot.dimensionalDrawingImage ?? "";
        const recommendedMountingHeightImage =
          formData.recommendedMountingHeightImageFile
            ? await uploadToCloud(formData.recommendedMountingHeightImageFile)
            : beforeSnapshot.recommendedMountingHeightImage ?? "";
        const driverCompatibilityImage = formData.driverCompatibilityImageFile
          ? await uploadToCloud(formData.driverCompatibilityImageFile)
          : beforeSnapshot.driverCompatibilityImage ?? "";
        const baseImage = formData.baseImageFile
          ? await uploadToCloud(formData.baseImageFile)
          : beforeSnapshot.baseImage ?? "";
        const illuminanceLevelImage = formData.illuminanceLevelImageFile
          ? await uploadToCloud(formData.illuminanceLevelImageFile)
          : beforeSnapshot.illuminanceLevelImage ?? "";
        const wiringDiagramImage = formData.wiringDiagramImageFile
          ? await uploadToCloud(formData.wiringDiagramImageFile)
          : beforeSnapshot.wiringDiagramImage ?? "";
        const installationImage = formData.installationImageFile
          ? await uploadToCloud(formData.installationImageFile)
          : beforeSnapshot.installationImage ?? "";
        const wiringLayoutImage = formData.wiringLayoutImageFile
          ? await uploadToCloud(formData.wiringLayoutImageFile)
          : beforeSnapshot.wiringLayoutImage ?? "";
        const terminalLayoutImage = formData.terminalLayoutImageFile
          ? await uploadToCloud(formData.terminalLayoutImageFile)
          : beforeSnapshot.terminalLayoutImage ?? "";
        const accessoriesImage = formData.accessoriesImageFile
          ? await uploadToCloud(formData.accessoriesImageFile)
          : beforeSnapshot.accessoriesImage ?? "";

        const after = {
          ...beforeSnapshot,
          name: nextDescription,
          itemDescription: nextDescription,
          slug: slugify(nextDescription),
          itemCodes: itemCodesObj,
          ecoItemCode: resolvedEco,
          litItemCode: resolvedLit,
          brand: resolvedBrand || beforeSnapshot.brand || "",
          technicalSpecs,
          regularPrice: Number.isFinite(regularPrice)
            ? regularPrice
            : beforeSnapshot.regularPrice ?? 0,
          salePrice: Number.isFinite(salePrice)
            ? salePrice
            : beforeSnapshot.salePrice ?? 0,
          productClass: formData.productClass ?? beforeSnapshot.productClass ?? "",
          productFamily:
            formData.productFamilyTitle ??
            beforeSnapshot.productFamily ??
            beforeSnapshot.categories ??
            "",
          productUsage:
            formData.productUsage ??
            (Array.isArray(beforeSnapshot.productUsage)
              ? beforeSnapshot.productUsage
              : beforeSnapshot.productUsage
                ? [beforeSnapshot.productUsage]
                : []),
          mainImage,
          rawImage,
          galleryImages,
          dimensionalDrawingImage,
          recommendedMountingHeightImage,
          driverCompatibilityImage,
          baseImage,
          illuminanceLevelImage,
          wiringDiagramImage,
          installationImage,
          wiringLayoutImage,
          terminalLayoutImage,
          accessoriesImage,
          seo: {
            ...(beforeSnapshot.seo ?? {}),
            itemDescription: nextDescription,
            ogImage: mainImage || beforeSnapshot?.seo?.ogImage || "",
            lastUpdated: new Date().toISOString(),
          },
        };

        const result = await submitProductUpdate({
          productId: selectedProduct.id,
          before: beforeSnapshot,
          after,
          productName: nextDescription || beforeSnapshot.name,
          source: "all-products:edit",
          page: "/products/all-products",
        });
        toast.success(result.message);
        closeProductSheet();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update product";
        toast.error(message);
      }
    },
    [
      closeProductSheet,
      data,
      selectedProduct,
      selectedProductFormData.availableSpecs,
      submitProductUpdate,
    ],
  );

  // ── Columns ─────────────────────────────────────────────────────────────────
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
            <button
              style={iconBtnStyle}
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                handleEditProduct(row.original);
              }}
            >
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
    [handleEditProduct],
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

  // ── Add Product submit ───────────────────────────────────────────────────────
  const handleAddProductSubmit = useCallback(
    async (formData: AddFlowFormData) => {
      const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
      const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

      const uploadToCloud = async (file: File): Promise<string> => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: fd },
        );
        const json = await res.json();
        if (!json?.secure_url) throw new Error("Cloudinary upload failed");
        return json.secure_url as string;
      };

      try {
        const mainUrl = formData.mainImageFile
          ? await uploadToCloud(formData.mainImageFile)
          : "";
        const rawUrl = formData.rawImageFile
          ? await uploadToCloud(formData.rawImageFile)
          : mainUrl;
        const galleryUrls = await Promise.all(
          (formData.images ?? []).map(uploadToCloud),
        );
        const dimensionalDrawingImage = formData.dimensionalDrawingImageFile
          ? await uploadToCloud(formData.dimensionalDrawingImageFile)
          : "";
        const recommendedMountingHeightImage = formData.recommendedMountingHeightImageFile
          ? await uploadToCloud(formData.recommendedMountingHeightImageFile)
          : "";
        const driverCompatibilityImage = formData.driverCompatibilityImageFile
          ? await uploadToCloud(formData.driverCompatibilityImageFile)
          : "";
        const baseImage = formData.baseImageFile
          ? await uploadToCloud(formData.baseImageFile)
          : "";
        const illuminanceLevelImage = formData.illuminanceLevelImageFile
          ? await uploadToCloud(formData.illuminanceLevelImageFile)
          : "";
        const wiringDiagramImage = formData.wiringDiagramImageFile
          ? await uploadToCloud(formData.wiringDiagramImageFile)
          : "";
        const installationImage = formData.installationImageFile
          ? await uploadToCloud(formData.installationImageFile)
          : "";
        const wiringLayoutImage = formData.wiringLayoutImageFile
          ? await uploadToCloud(formData.wiringLayoutImageFile)
          : "";
        const terminalLayoutImage = formData.terminalLayoutImageFile
          ? await uploadToCloud(formData.terminalLayoutImageFile)
          : "";
        const accessoriesImage = formData.accessoriesImageFile
          ? await uploadToCloud(formData.accessoriesImageFile)
          : "";
        const regularPrice = Number.parseFloat(formData.regPrice ?? "");
        const salePrice = Number.parseFloat(formData.salePrice ?? "");

        const itemCodesObj = Object.fromEntries(
          Object.entries(formData.itemCodes ?? {}).filter(([, value]) =>
            Boolean(value?.trim()),
          ),
        );
        const itemCodesTyped = itemCodesObj as ItemCodes;
        const resolvedEco = itemCodesTyped.ECOSHIFT ?? "";
        const resolvedLit = itemCodesTyped.LIT ?? "";
        const resolvedBrand = resolvedLit ? "LIT" : resolvedEco ? "ECOSHIFT" : "";
        const primary = getPrimaryItemCode(itemCodesTyped);

        const specsGrouped: Record<string, { name: string; value: string }[]> = {};
        Object.entries(formData.specValues ?? {}).forEach(([key, rawValue]) => {
          const value = (rawValue ?? "").toString().trim();
          if (!value) return;
          const spec = (formData.availableSpecs ?? []).find(
            (s) => `${s.specGroupId}-${s.label}` === key,
          );
          if (!spec) return;
          if (!specsGrouped[spec.specGroup]) specsGrouped[spec.specGroup] = [];
          specsGrouped[spec.specGroup].push({
            name: spec.label.toUpperCase().trim(),
            value: value.toUpperCase().trim(),
          });
        });

        const technicalSpecs = Object.entries(specsGrouped)
          .map(([specGroup, specs]) => ({
            specGroup: specGroup.toUpperCase().trim(),
            specs,
          }))
          .filter((group) => group.specs.length > 0);

        const payload = {
          productClass: formData.productClass ?? "",
          itemDescription: formData.itemDescription ?? "",
          shortDescription: "",
          slug: slugify(formData.itemDescription ?? ""),
          itemCodes: itemCodesObj,
          ecoItemCode: resolvedEco,
          litItemCode: resolvedLit,
          regularPrice: Number.isFinite(regularPrice) ? regularPrice : 0,
          salePrice: Number.isFinite(salePrice) ? salePrice : 0,
          technicalSpecs,
          mainImage: mainUrl,
          rawImage: rawUrl,
          qrCodeImage: "",
          galleryImages: galleryUrls,
          dimensionalDrawingImage,
          recommendedMountingHeightImage,
          driverCompatibilityImage,
          baseImage,
          illuminanceLevelImage,
          wiringDiagramImage,
          installationImage,
          wiringLayoutImage,
          terminalLayoutImage,
          accessoriesImage,
          typeOfPlugImage: "",
          website: [] as string[],
          websites: [] as string[],
          productFamily: (formData.productFamilyTitle ?? "").toUpperCase(),
          brand: resolvedBrand,
          applications: [] as string[],
          productUsage: formData.productUsage ?? [],
          status: "draft" as const,
          seo: {
            itemDescription: formData.itemDescription ?? "",
            description: "",
            canonical: "",
            ogImage: mainUrl,
            robots: "index, follow",
            lastUpdated: new Date().toISOString(),
          },
          importSource: "add-new-product-form",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "products"), payload);

        if (technicalSpecs.length > 0) {
          try {
            const { generateTdsPdf, uploadTdsPdf, normaliseBrand } = await import(
              "@/lib/tdsGenerator"
            );
            const tdsBlob = await generateTdsPdf({
              itemDescription: formData.itemDescription ?? "",
              itemCodes: itemCodesTyped,
              technicalSpecs,
              brand: normaliseBrand(resolvedBrand),
              includeBrandAssets: false,
              mainImageUrl: mainUrl || undefined,
            });
            const primaryCode =
              primary?.code ?? formData.itemDescription ?? docRef.id;
            const tdsUrl = await uploadTdsPdf(
              tdsBlob,
              `${primaryCode}_TDS.pdf`,
              CLOUD_NAME,
              UPLOAD_PRESET,
            );
            if (tdsUrl.startsWith("http")) {
              await updateDoc(doc(db, "products", docRef.id), {
                tdsFileUrl: tdsUrl,
                updatedAt: serverTimestamp(),
              });
            }
          } catch (tdsErr) {
            const message =
              tdsErr instanceof Error ? tdsErr.message : "Unknown TDS error";
            console.warn("[AddProduct] TDS generation failed:", message);
          }
        }

        await logAuditEvent({
          action: "create",
          entityType: "product",
          entityId: docRef.id,
          entityName: formData.itemDescription ?? "",
          context: {
            page: "/products/all-products",
            source: "add-new-product-form",
            collection: "products",
          },
        });

        toast.success("Product created successfully");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create product";
        toast.error(message);
        throw err;
      }
    },
    [],
  );

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
      if (swipingCardId === id && swipeOffsetRef.current !== 0) {
        setSwipingCardId(null);
        setSwipeOffset(0);
        swipeOffsetRef.current = 0;
        swipeCardIdRef.current = null;
        swipeDirectionRef.current = null;
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
    [isBulk, swipingCardId, table],
  );

  // ── Swipe-to-actions handlers (mobile) ─────────────────────────────────────
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
      const clamped =
        dx < 0
          ? Math.max(dx, SWIPE_DELETE_MAX)
          : Math.min(dx, SWIPE_ACTION_MAX);
      swipeOffsetRef.current = clamped;
      setSwipeOffset(clamped);
    },
    [handleCardPressEnd],
  );

  const handleSwipeTouchEnd = useCallback(
    (product: any) => {
      handleCardPressEnd();
      if (swipeDirectionRef.current === "h") {
        if (swipeOffsetRef.current <= -SWIPE_DELETE_THRESHOLD) {
          setDeleteTarget(product);
        }
        if (swipeOffsetRef.current >= SWIPE_ACTION_THRESHOLD) {
          handleEditProduct(product);
          return;
        }
      }
      setSwipingCardId(null);
      setSwipeOffset(0);
      swipeOffsetRef.current = 0;
      swipeCardIdRef.current = null;
      swipeDirectionRef.current = null;
    },
    [handleCardPressEnd, handleEditProduct],
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

              {/* ── Desktop toolbar: Bulk Download TDS | Bulk Upload | Add Product ── */}
              {!isMobile && (
                <>
                  <button style={outlineBtnStyle}>
                    <Download size={15} /> Bulk Download TDS
                  </button>

                  {/* Bulk Upload — opens the shared BulkUploader dialog */}
                  <button
                    style={outlineBtnStyle}
                    onClick={() => setBulkUploaderOpen(true)}
                  >
                    <Upload size={15} /> Bulk Upload
                  </button>

                  <button
                    style={primaryBtnStyle}
                    onClick={() =>
                      addFlowTriggerRef.current
                        ?.querySelector("button")
                        ?.click()
                    }
                  >
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
          const actionZoneWidth = Math.max(currentOffset, 0);
          const deleteZoneWidth = Math.max(-currentOffset, 0);
          const showActionIcon = actionZoneWidth > 40;
          const pastActionThreshold = actionZoneWidth >= SWIPE_ACTION_THRESHOLD;
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
              {/* Action zone */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: actionZoneWidth,
                  background: pastActionThreshold ? "#166534" : TOKEN.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: isThisSwiping
                    ? "none"
                    : "width 0.3s ease, background 0.15s",
                  borderRadius: "16px 0 0 16px",
                }}
              >
                {showActionIcon && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Edit2
                      size={22}
                      color="#fff"
                      style={{ opacity: pastActionThreshold ? 1 : 0.85 }}
                    />
                    {pastActionThreshold && (
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
                  transform: `translateX(${Math.max(Math.min(currentOffset, SWIPE_ACTION_MAX), SWIPE_DELETE_MAX)}px)`,
                  transition: isThisSwiping
                    ? "none"
                    : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  borderTopLeftRadius: actionZoneWidth > 8 ? 0 : 16,
                  borderBottomLeftRadius: actionZoneWidth > 8 ? 0 : 16,
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

      {/* ── Mobile FAB — shown when not in bulk-select mode ──────────────────
           "Bulk Import" onClick opens the shared BulkUploader dialog         */}
      {isMobile && !isBulk && (
        <FAB
          actions={[
            {
              label: "New Product",
              Icon: Plus,
              color: TOKEN.primary,
              onClick: () =>
                addFlowTriggerRef.current?.querySelector("button")?.click(),
            },
            {
              label: "Bulk Import",
              Icon: Upload,
              color: TOKEN.secondary,
              onClick: () => setBulkUploaderOpen(true),
            },
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

      {/* ── Add Product Flow ── Hidden instance; triggered programmatically
           by the desktop toolbar button and mobile FAB via addFlowTriggerRef */}
      <div
        ref={addFlowTriggerRef}
        style={{ position: "fixed", top: -9999, left: -9999, zIndex: 9999 }}
        aria-hidden="true"
      >
        <AddProductFlow
          productFamilies={flowProductFamilies}
          onSubmit={handleAddProductSubmit}
          onCancel={() => {}}
        />
      </div>

      <ProductFormSheet
        isOpen={productSheetOpen}
        mode={productSheetMode}
        selectedProduct={selectedProduct}
        onClose={closeProductSheet}
        onBack={closeProductSheet}
        onSubmit={handleEditProductSubmit}
        formData={selectedProductFormData}
        allSpecGroups={allSpecGroups}
      />

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

      {/* ── BulkUploader — single instance, driven by bulkUploaderOpen state ──
           hideTrigger=true because we render our own buttons above.
           open / onOpenChange wire the desktop button + mobile FAB together.  */}
      <BulkUploader
        hideTrigger
        open={bulkUploaderOpen}
        onOpenChange={setBulkUploaderOpen}
        onUploadComplete={() => {
          /* Firestore real-time listener in this component auto-refreshes data */
        }}
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
