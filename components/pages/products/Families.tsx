"use client";

/**
 * components/pages/products/Families.tsx
 *
 * Changes from previous version:
 *  - Filter status buttons moved directly below the search bar
 *  - "Add New Family" injected into the mobile FAB via usePageFAB()
 *  - Title input exposed via ref so FAB action can focus it
 */

import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import {
  Check,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  Briefcase,
  Layers,
  ChevronDown,
  Search,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { RouteProtection } from "@/components/route-protection";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { usePageFAB } from "@/components/layout/FABContext";

import { generateTdsTemplatePdf, uploadTdsPdf } from "@/lib/tdsGenerator";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOUDINARY_UPLOAD_PRESET = "taskflow_preset";
const CLOUDINARY_CLOUD_NAME = "dvmpn8mjh";

const PRODUCT_USAGE_OPTIONS = ["INDOOR", "OUTDOOR", "SOLAR"] as const;
type ProductUsage = (typeof PRODUCT_USAGE_OPTIONS)[number];

const USAGE_COLORS: Record<
  ProductUsage,
  { bg: string; color: string; border: string }
> = {
  INDOOR: { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
  OUTDOOR: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  SOLAR: { bg: "#fefce8", color: "#a16207", border: "#fde047" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SpecItemRef = { id: string; name: string };
type ProductFamilySpecs = { specGroupId: string; specItems: SpecItemRef[] };
type SpecGroupDoc = {
  id: string;
  name: string;
  items?: { label: string }[];
  isActive?: boolean;
};
type ApplicationDoc = {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  websites?: string[];
};

type ProductFamilyDoc = {
  id: string;
  title?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  specs?: ProductFamilySpecs[];
  specifications?: string[];
  productUsage?: ProductUsage[];
  applications?: string[];
  isActive?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function buildSpecItemId(specGroupId: string, label: string) {
  return `${specGroupId}:${label.toUpperCase().trim()}`;
}

// ─── Shared inline-style constants ───────────────────────────────────────────

const sectionCard: React.CSSProperties = {
  background: TOKEN.surface,
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 16,
  overflow: "hidden",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: TOKEN.textSec,
  textTransform: "uppercase",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 13.5,
  color: TOKEN.textPri,
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
};

const primaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 20px",
  borderRadius: 12,
  border: "none",
  background: TOKEN.primary,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const outlineBtn: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 8,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: TOKEN.textPri,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const iconBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "none",
  background: TOKEN.bg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: TOKEN.textSec,
  flexShrink: 0,
};

// ─── Usage pill ───────────────────────────────────────────────────────────────

function UsagePill({
  label,
  active,
  onClick,
}: {
  label: ProductUsage;
  active: boolean;
  onClick: () => void;
}) {
  const c = USAGE_COLORS[label];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? c.border : TOKEN.border}`,
        background: active ? c.bg : TOKEN.surface,
        color: active ? c.color : TOKEN.textSec,
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {active && <Check size={10} />}
      {label}
    </button>
  );
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelectDropdown<T extends { id: string }>({
  items,
  selectedIds,
  onToggle,
  getLabel,
  placeholder,
  icon: Icon,
  open,
  onOpenChange,
}: {
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  getLabel: (item: T) => string;
  placeholder: string;
  icon: React.ElementType;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        onOpenChange(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onOpenChange]);

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((i) =>
      getLabel(i).toLowerCase().includes(search.toLowerCase()),
    );
  }, [items, search, getLabel]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        style={{
          ...outlineBtn,
          width: "100%",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: 10,
          background: open ? `${TOKEN.primary}08` : TOKEN.surface,
          borderColor: open ? TOKEN.primary : TOKEN.border,
          color: selectedIds.length > 0 ? TOKEN.textPri : TOKEN.textSec,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={13} style={{ opacity: 0.5 }} />
          <ChevronDown
            size={13}
            style={{
              opacity: 0.5,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: TOKEN.surface,
              border: `1px solid ${TOKEN.border}`,
              borderRadius: 12,
              boxShadow: "0 8px 24px -4px rgba(15,23,42,0.12)",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: `1px solid ${TOKEN.border}`,
                position: "relative",
              }}
            >
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 24,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: TOKEN.textSec,
                }}
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                style={{
                  ...inputStyle,
                  paddingLeft: 32,
                  padding: "7px 12px 7px 32px",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p
                  style={{
                    padding: "16px 14px",
                    fontSize: 12,
                    color: TOKEN.textSec,
                    textAlign: "center",
                  }}
                >
                  No results
                </p>
              ) : (
                filtered.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        border: "none",
                        background: selected
                          ? `${TOKEN.primary}08`
                          : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        borderBottom: `1px solid ${TOKEN.border}`,
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1.5px solid ${selected ? TOKEN.primary : TOKEN.border}`,
                          background: selected ? TOKEN.primary : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected && <Check size={10} color="#fff" />}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: TOKEN.textPri,
                        }}
                      >
                        {getLabel(item).toUpperCase()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confirm-delete modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="del-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 400,
            }}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 401,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="del-dialog"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={SPRING_MED}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 380,
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
                  <Trash2 size={22} color={TOKEN.danger} />
                </div>
              </div>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: "center",
                  color: TOKEN.textPri,
                  margin: "0 0 8px",
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontSize: 13,
                  textAlign: "center",
                  color: TOKEN.textSec,
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {description}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    ...outlineBtn,
                    flex: 1,
                    justifyContent: "center",
                    padding: "11px 0",
                    borderRadius: 12,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  style={{
                    flex: 2,
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
                  }}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={15} /> Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Family card ──────────────────────────────────────────────────────────────

function FamilyCard({
  family,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  family: ProductFamilyDoc;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const img = family.image || family.imageUrl || null;
  const groupCount = Array.isArray(family.specs)
    ? family.specs.length
    : Array.isArray(family.specifications)
      ? family.specifications.length
      : 0;
  const itemCount = Array.isArray(family.specs)
    ? family.specs.reduce((sum, g) => sum + (g.specItems?.length ?? 0), 0)
    : 0;
  const appCount = Array.isArray(family.applications)
    ? family.applications.length
    : 0;

  return (
    <div
      style={{
        ...sectionCard,
        border: `1px solid ${selected ? TOKEN.primary : TOKEN.border}`,
        boxShadow: selected ? `0 0 0 2px ${TOKEN.primary}30` : "none",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Image area */}
      <div
        style={{
          position: "relative",
          aspectRatio: "4/3",
          background: TOKEN.bg,
          overflow: "hidden",
        }}
      >
        {img ? (
          <img
            src={img}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            alt={family.title ?? ""}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FolderPlus
              size={32}
              style={{ opacity: 0.2, color: TOKEN.textSec }}
            />
          </div>
        )}
        {/* Checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1.5px solid ${selected ? TOKEN.primary : "rgba(255,255,255,0.7)"}`,
            background: selected ? TOKEN.primary : "rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
          }}
        >
          {selected && <Check size={12} color="#fff" />}
        </div>
        {/* Action buttons */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 6,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              ...iconBtnStyle,
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(4px)",
              width: 28,
              height: 28,
              borderRadius: 8,
            }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              ...iconBtnStyle,
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(4px)",
              width: 28,
              height: 28,
              borderRadius: 8,
              color: TOKEN.danger,
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 800,
              color: TOKEN.textPri,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {(family.title || "UNTITLED").toUpperCase()}
          </h3>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 4,
              background: family.isActive ? "#dcfce7" : TOKEN.bg,
              color: family.isActive ? "#15803d" : TOKEN.textSec,
              border: `1px solid ${family.isActive ? "#bbf7d0" : TOKEN.border}`,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            {family.isActive ? "Live" : "Hidden"}
          </span>
        </div>

        {family.description && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: TOKEN.textSec,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontStyle: "italic",
            }}
          >
            {family.description}
          </p>
        )}

        {family.productUsage && family.productUsage.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {family.productUsage.map((u) => {
              const c = USAGE_COLORS[u];
              return (
                <span
                  key={u}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    border: `1px solid ${c.border}`,
                    background: c.bg,
                    color: c.color,
                    textTransform: "uppercase",
                  }}
                >
                  {u}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {appCount > 0 && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                color: TOKEN.textSec,
                textTransform: "uppercase",
              }}
            >
              <Briefcase size={10} />
              {appCount} App{appCount !== 1 ? "s" : ""}
            </span>
          )}
          {groupCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: TOKEN.textSec,
                textTransform: "uppercase",
              }}
            >
              {groupCount} Group{groupCount !== 1 ? "s" : ""}
              {itemCount > 0
                ? ` · ${itemCount} Item${itemCount !== 1 ? "s" : ""}`
                : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function ProductFamiliesContent() {
  // ── Data ───────────────────────────────────────────────────────────────────
  const [families, setFamilies] = useState<ProductFamilyDoc[]>([]);
  const [specGroups, setSpecGroups] = useState<SpecGroupDoc[]>([]);
  const [applications, setApplications] = useState<ApplicationDoc[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);

  // ── List state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ProductFamilyDoc | null>(
    null,
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productUsage, setProductUsage] = useState<ProductUsage[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [openSpecGroups, setOpenSpecGroups] = useState(false);
  const [selectedSpecGroupIds, setSelectedSpecGroupIds] = useState<string[]>(
    [],
  );
  const [specItemSelections, setSpecItemSelections] = useState<
    Record<string, string[]>
  >({});
  const [specItemSearch, setSpecItemSearch] = useState<Record<string, string>>(
    {},
  );
  const [openApplications, setOpenApplications] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<
    string[]
  >([]);

  // ── Ref for FAB focus action ───────────────────────────────────────────────
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  // ── Firestore ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = query(
      collection(db, "productfamilies"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setFamilies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoadingFamilies(false);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "specs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setSpecGroups(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "applications"), orderBy("title", "asc"));
    return onSnapshot(q, (snap) => {
      setApplications(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
      );
    });
  }, []);

  // ── Dropzone ──────────────────────────────────────────────────────────────

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (files) => {
      const f = files[0];
      if (!f) return;
      setImageFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const specGroupById = useMemo(() => {
    const m = new Map<string, SpecGroupDoc>();
    for (const g of specGroups) m.set(g.id, g);
    return m;
  }, [specGroups]);

  const applicationById = useMemo(() => {
    const m = new Map<string, ApplicationDoc>();
    for (const a of applications) m.set(a.id, a);
    return m;
  }, [applications]);

  const selectedSpecsForSave: ProductFamilySpecs[] = useMemo(() => {
    return selectedSpecGroupIds
      .map((specGroupId) => {
        const group = specGroupById.get(specGroupId);
        const labels = (group?.items ?? [])
          .map((i) => i.label)
          .filter(Boolean)
          .map((l) => l.toUpperCase().trim());
        const chosenItemIds = new Set(specItemSelections[specGroupId] ?? []);
        const chosenItems: SpecItemRef[] = labels
          .map((label) => ({
            id: buildSpecItemId(specGroupId, label),
            name: label,
          }))
          .filter((item) => chosenItemIds.has(item.id));
        return { specGroupId, specItems: chosenItems };
      })
      .filter((g) => g.specItems.length > 0);
  }, [selectedSpecGroupIds, specItemSelections, specGroupById]);

  const filteredFamilies = useMemo(() => {
    return families.filter((f) => {
      const name = (f.title ?? "").toLowerCase();
      if (searchTerm && !name.includes(searchTerm.toLowerCase())) return false;
      if (filterStatus === "active" && !f.isActive) return false;
      if (filterStatus === "inactive" && f.isActive) return false;
      return true;
    });
  }, [families, searchTerm, filterStatus]);

  const selectedSummary = useMemo(() => {
    return selectedSpecsForSave
      .map((g) => ({
        specGroupId: g.specGroupId,
        groupName: specGroupById.get(g.specGroupId)?.name ?? g.specGroupId,
        specItems: g.specItems,
      }))
      .filter((g) => g.specItems.length > 0);
  }, [selectedSpecsForSave, specGroupById]);

  const canPickSpecs = title.trim().length > 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setProductUsage([]);
    setImageFile(null);
    setPreviewUrl("");
    setSelectedSpecGroupIds([]);
    setSpecItemSelections({});
    setSpecItemSearch({});
    setSelectedApplicationIds([]);
  }, []);

  /** FAB "Add New Family" — scrolls to form top and focuses title input */
  const handleFABAddNew = useCallback(() => {
    resetForm();
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Short delay to let scroll settle before focusing
    setTimeout(() => titleInputRef.current?.focus(), 350);
  }, [resetForm]);

  // Register mobile FAB
  const fabActions = useMemo(
    () => [
      {
        label: "New Family",
        Icon: FolderPlus,
        color: TOKEN.primary,
        onClick: handleFABAddNew,
      },
    ],
    [handleFABAddNew],
  );

  usePageFAB(fabActions);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSpecGroup = (specGroupId: string) => {
    setSelectedSpecGroupIds((prev) => {
      if (prev.includes(specGroupId)) {
        setSpecItemSelections((sel) => {
          const c = { ...sel };
          delete c[specGroupId];
          return c;
        });
        return prev.filter((id) => id !== specGroupId);
      }
      return [...prev, specGroupId];
    });
  };

  const handleToggleApplication = (applicationId: string) => {
    setSelectedApplicationIds((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId],
    );
  };

  const toggleSpecItem = (specGroupId: string, itemId: string) => {
    setSpecItemSelections((prev) => {
      const cur = new Set(prev[specGroupId] ?? []);
      if (cur.has(itemId)) cur.delete(itemId);
      else cur.add(itemId);
      return { ...prev, [specGroupId]: Array.from(cur) };
    });
  };

  const setAllItemsInGroup = (specGroupId: string, on: boolean) => {
    const group = specGroupById.get(specGroupId);
    const labels = (group?.items ?? [])
      .map((i) => i.label)
      .filter(Boolean)
      .map((l) => l.toUpperCase().trim());
    const ids = labels.map((label) => buildSpecItemId(specGroupId, label));
    setSpecItemSelections((prev) => ({
      ...prev,
      [specGroupId]: on ? ids : [],
    }));
  };

  const validate = (): { ok: boolean; message?: string } => {
    if (!title.trim()) return { ok: false, message: "Title is required" };
    if (selectedSpecGroupIds.length === 0)
      return { ok: false, message: "Select at least one spec group" };
    for (const gid of selectedSpecGroupIds) {
      const chosen = specItemSelections[gid] ?? [];
      if (chosen.length === 0) {
        const name = specGroupById.get(gid)?.name ?? "Spec Group";
        return {
          ok: false,
          message: `Select at least one spec item for "${name}"`,
        };
      }
    }
    return { ok: true };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = validate();
    if (!v.ok) return toast.error(v.message);
    setIsSubmitLoading(true);
    try {
      let finalImageUrl = previewUrl;
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: fd },
        );
        const json = await res.json();
        finalImageUrl = json?.secure_url ?? "";
      }
      const normalisedTitle = title.trim().toUpperCase();
      const payload: any = {
        title: normalisedTitle,
        specs: selectedSpecsForSave,
        productUsage,
        applications: selectedApplicationIds,
        updatedAt: serverTimestamp(),
      };
      if (finalImageUrl) payload.image = finalImageUrl;

      let familyDocId: string = editId ?? "";
      if (editId) {
        await updateDoc(doc(db, "productfamilies", editId), payload);
      } else {
        const ref = await addDoc(collection(db, "productfamilies"), {
          ...payload,
          isActive: true,
          createdAt: serverTimestamp(),
        });
        familyDocId = ref.id;
      }

      // Propagate application changes to matching products
      if (selectedApplicationIds.length > 0 && normalisedTitle) {
        try {
          const productsSnap = await getDocs(
            query(
              collection(db, "products"),
              where("productFamily", "==", normalisedTitle),
            ),
          );
          if (!productsSnap.empty) {
            const batch = writeBatch(db);
            productsSnap.docs.forEach((productDoc) => {
              batch.update(productDoc.ref, {
                applications: selectedApplicationIds,
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit();
          }
        } catch (err) {
          console.warn("Failed to propagate applications:", err);
        }
      }

      // Generate TDS template
      try {
        const specGroupsForTemplate = selectedSpecGroupIds
          .map((gid) => {
            const group = specGroupById.get(gid);
            const selectedItemIds = new Set(specItemSelections[gid] ?? []);
            const items = (group?.items ?? [])
              .map((i) => ({ label: (i.label ?? "").toUpperCase().trim() }))
              .filter((i) => {
                if (!i.label) return false;
                return selectedItemIds.has(buildSpecItemId(gid, i.label));
              });
            return { name: (group?.name ?? "").toUpperCase().trim(), items };
          })
          .filter((g) => g.items.length > 0);

        if (specGroupsForTemplate.length > 0) {
          toast.loading("Generating TDS template…", { id: "tds-template" });
          const blob = await generateTdsTemplatePdf({
            specGroups: specGroupsForTemplate,
            includeBrandAssets: false,
          });
          const tplUrl = await uploadTdsPdf(
            blob,
            `${normalisedTitle}_TEMPLATE.pdf`,
            CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_UPLOAD_PRESET,
          );
          await updateDoc(doc(db, "productfamilies", familyDocId), {
            tdsTemplate: tplUrl,
            updatedAt: serverTimestamp(),
          });
          toast.dismiss("tds-template");
        }
      } catch (tplErr: any) {
        toast.dismiss("tds-template");
        console.warn("TDS template generation failed:", tplErr);
      }

      toast.success(
        editId ? "Product family updated" : "Product family created",
      );
      resetForm();
    } catch {
      toast.error("Error processing request");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteDoc(doc(db, "productfamilies", deleteTarget.id));
      toast.success("Product family deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          deleteDoc(doc(db, "productfamilies", id)),
        ),
      );
      toast.success(`Deleted ${selectedIds.size} product families`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch {
      toast.error("Error deleting product families");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Page header ── */}
      <div style={{ paddingTop: 20, paddingBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: TOKEN.textPri,
          }}
        >
          Product Families
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: TOKEN.textSec }}>
          Create and manage product families, specs, and application
          assignments. A blank TDS template is auto-generated on each save.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)",
          gap: 24,
          alignItems: "start",
        }}
        className="families-grid"
      >
        {/* ════ FORM COLUMN ════ */}
        <div
          ref={formTopRef}
          style={{
            position: "sticky",
            top: 80,
            zIndex: 10,
            maxHeight: "calc(100vh - 100px)",
            overflowY: "auto",
          }}
        >
          <div style={sectionCard}>
            {/* Form header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${TOKEN.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  color: TOKEN.textPri,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {editId ? "Edit Family" : "New Family"}
              </p>
              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ ...outlineBtn, fontSize: 11 }}
                >
                  <RotateCcw size={12} /> Cancel
                </button>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Title */}
              <div>
                <label style={labelStyle}>
                  Title <span style={{ color: TOKEN.danger }}>*</span>
                </label>
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value.toUpperCase())}
                  placeholder="E.G. RECESSED LIGHTS"
                  style={{
                    ...inputStyle,
                    borderColor: !title.trim()
                      ? `${TOKEN.danger}60`
                      : TOKEN.border,
                  }}
                />
                {!title.trim() && (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 10,
                      color: TOKEN.danger,
                      fontWeight: 700,
                    }}
                  >
                    Title is required
                  </p>
                )}
              </div>

              {/* Product Usage */}
              <div>
                <label style={labelStyle}>
                  Product Usage <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PRODUCT_USAGE_OPTIONS.map((u) => (
                    <UsagePill
                      key={u}
                      label={u}
                      active={productUsage.includes(u)}
                      onClick={() =>
                        setProductUsage((p) =>
                          p.includes(u) ? p.filter((v) => v !== u) : [...p, u],
                        )
                      }
                    />
                  ))}
                </div>
                {productUsage.length === 0 && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 10,
                      color: TOKEN.textSec,
                      fontWeight: 600,
                    }}
                  >
                    Tagging usage helps filter families in the product form
                  </p>
                )}
              </div>

              {/* Image dropzone */}
              <div>
                <label style={labelStyle}>
                  Image <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <div
                  {...getRootProps()}
                  style={{
                    border: `2px dashed ${isDragActive ? TOKEN.primary : TOKEN.border}`,
                    borderRadius: 10,
                    background: isDragActive ? `${TOKEN.primary}08` : TOKEN.bg,
                    padding: previewUrl ? 0 : 24,
                    cursor: "pointer",
                    overflow: "hidden",
                    minHeight: previewUrl ? "auto" : 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <input {...getInputProps()} />
                  {previewUrl ? (
                    <div style={{ position: "relative", width: "100%" }}>
                      <img
                        src={previewUrl}
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          objectFit: "cover",
                          display: "block",
                        }}
                        alt="Preview"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewUrl("");
                          setImageFile(null);
                        }}
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: "none",
                          background: TOKEN.danger,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <ImageIcon
                        size={20}
                        style={{
                          color: TOKEN.textSec,
                          opacity: 0.4,
                          margin: "0 auto 8px",
                        }}
                      />
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          color: TOKEN.textSec,
                        }}
                      >
                        Drop image here
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 10,
                          color: TOKEN.textSec,
                          opacity: 0.6,
                        }}
                      >
                        or click to browse
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Applications */}
              <div>
                <label
                  style={{
                    ...labelStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Briefcase size={10} />
                  Applications <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <MultiSelectDropdown
                  items={applications}
                  selectedIds={selectedApplicationIds}
                  onToggle={handleToggleApplication}
                  getLabel={(a) => a.title ?? a.name ?? ""}
                  placeholder="Select applications…"
                  icon={Briefcase}
                  open={openApplications}
                  onOpenChange={setOpenApplications}
                />
                {selectedApplicationIds.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {selectedApplicationIds.map((appId) => {
                      const app = applicationById.get(appId);
                      const name = app?.title ?? app?.name ?? appId;
                      return (
                        <span
                          key={appId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 8px 3px 10px",
                            borderRadius: 6,
                            background: TOKEN.bg,
                            border: `1px solid ${TOKEN.border}`,
                            color: TOKEN.textPri,
                          }}
                        >
                          {name.toUpperCase()}
                          <button
                            type="button"
                            onClick={() => handleToggleApplication(appId)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: TOKEN.textSec,
                              padding: 0,
                              display: "flex",
                              lineHeight: 1,
                            }}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {selectedApplicationIds.length > 0 && (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 10,
                      color: TOKEN.textSec,
                      fontWeight: 600,
                    }}
                  >
                    Products in this family will be tagged with the selected
                    applications
                  </p>
                )}
              </div>

              {/* Spec Groups */}
              <div>
                <label style={labelStyle}>
                  Spec Groups <span style={{ color: TOKEN.danger }}>*</span>
                </label>
                <MultiSelectDropdown
                  items={specGroups}
                  selectedIds={selectedSpecGroupIds}
                  onToggle={canPickSpecs ? handleToggleSpecGroup : () => {}}
                  getLabel={(g) => g.name ?? ""}
                  placeholder={
                    canPickSpecs ? "Select spec groups…" : "Enter a title first"
                  }
                  icon={Layers}
                  open={openSpecGroups && canPickSpecs}
                  onOpenChange={(v) => canPickSpecs && setOpenSpecGroups(v)}
                />
                {!canPickSpecs && (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 10,
                      color: TOKEN.textSec,
                      fontWeight: 600,
                    }}
                  >
                    Spec selection unlocks after title is set
                  </p>
                )}
              </div>

              {/* Spec items per group */}
              {selectedSpecGroupIds.length > 0 && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Spec Items <span style={{ color: TOKEN.danger }}>*</span>
                    </label>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: TOKEN.textSec,
                        background: TOKEN.bg,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 6,
                        padding: "2px 8px",
                      }}
                    >
                      {selectedSummary.reduce(
                        (sum, g) => sum + g.specItems.length,
                        0,
                      )}{" "}
                      selected
                    </span>
                  </div>

                  {selectedSpecGroupIds.map((gid) => {
                    const group = specGroupById.get(gid);
                    const groupName = (group?.name ?? gid).toUpperCase();
                    const labels = Array.from(
                      new Set(
                        (group?.items ?? [])
                          .map((i) => i.label)
                          .filter(Boolean)
                          .map((l) => l.toUpperCase().trim()),
                      ),
                    );
                    const search = (specItemSearch[gid] ?? "").toUpperCase();
                    const filtered = search
                      ? labels.filter((l) => l.includes(search))
                      : labels;
                    const selectedSet = new Set(specItemSelections[gid] ?? []);

                    return (
                      <div
                        key={gid}
                        style={{
                          border: `1px solid ${TOKEN.border}`,
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 14px",
                            borderBottom: `1px solid ${TOKEN.border}`,
                            background: TOKEN.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                fontWeight: 800,
                                color: TOKEN.textPri,
                                textTransform: "uppercase",
                              }}
                            >
                              {groupName}
                            </p>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 10,
                                color: TOKEN.textSec,
                                fontWeight: 600,
                              }}
                            >
                              {selectedSet.size} SELECTED · {labels.length}{" "}
                              AVAILABLE
                            </p>
                          </div>
                          <div
                            style={{ display: "flex", gap: 6, flexShrink: 0 }}
                          >
                            <button
                              type="button"
                              onClick={() => setAllItemsInGroup(gid, true)}
                              style={{
                                ...outlineBtn,
                                fontSize: 10,
                                padding: "5px 10px",
                              }}
                              disabled={labels.length === 0}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setAllItemsInGroup(gid, false)}
                              style={{
                                ...outlineBtn,
                                fontSize: 10,
                                padding: "5px 10px",
                              }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <input
                            value={specItemSearch[gid] ?? ""}
                            onChange={(e) =>
                              setSpecItemSearch((prev) => ({
                                ...prev,
                                [gid]: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="Filter items…"
                            style={{
                              ...inputStyle,
                              fontSize: 12,
                              padding: "8px 12px",
                            }}
                          />
                          {filtered.length === 0 ? (
                            <p
                              style={{
                                fontSize: 11,
                                color: TOKEN.textSec,
                                textAlign: "center",
                                padding: "12px 0",
                                background: TOKEN.bg,
                                borderRadius: 8,
                              }}
                            >
                              No items found
                            </p>
                          ) : (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 4,
                                maxHeight: 200,
                                overflowY: "auto",
                              }}
                            >
                              {filtered.map((label) => {
                                const itemId = buildSpecItemId(gid, label);
                                const checked = selectedSet.has(itemId);
                                return (
                                  <button
                                    type="button"
                                    key={itemId}
                                    onClick={() => toggleSpecItem(gid, itemId)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      padding: "8px 10px",
                                      border: `1px solid ${checked ? `${TOKEN.primary}40` : TOKEN.border}`,
                                      borderRadius: 8,
                                      background: checked
                                        ? `${TOKEN.primary}06`
                                        : TOKEN.surface,
                                      cursor: "pointer",
                                      textAlign: "left",
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 4,
                                        border: `1.5px solid ${checked ? TOKEN.primary : TOKEN.border}`,
                                        background: checked
                                          ? TOKEN.primary
                                          : "transparent",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {checked && (
                                        <Check size={10} color="#fff" />
                                      )}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: TOKEN.textSec,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {(specItemSelections[gid] ?? []).length === 0 && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: 10,
                                color: TOKEN.danger,
                                fontWeight: 700,
                              }}
                            >
                              Select at least one item for this group
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selection summary */}
              {selectedSummary.length > 0 && (
                <div
                  style={{
                    background: TOKEN.bg,
                    border: `1px solid ${TOKEN.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 800,
                        color: TOKEN.textSec,
                        textTransform: "uppercase",
                      }}
                    >
                      Selection Summary
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: TOKEN.textSec,
                        background: TOKEN.surface,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 6,
                        padding: "2px 8px",
                      }}
                    >
                      {selectedSummary.length} Group
                      {selectedSummary.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {selectedSummary.map((g) => {
                      const seen = new Set<string>();
                      const uniqueItems = g.specItems.filter((it) => {
                        if (seen.has(it.id)) return false;
                        seen.add(it.id);
                        return true;
                      });
                      return (
                        <div
                          key={g.specGroupId}
                          style={{
                            background: TOKEN.surface,
                            border: `1px solid ${TOKEN.border}`,
                            borderRadius: 8,
                            padding: "10px 12px",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: 11,
                              fontWeight: 800,
                              color: TOKEN.textPri,
                              textTransform: "uppercase",
                            }}
                          >
                            {(g.groupName ?? "").toUpperCase()}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {uniqueItems.map((it) => (
                              <span
                                key={it.id}
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  background: TOKEN.bg,
                                  border: `1px solid ${TOKEN.border}`,
                                  color: TOKEN.textSec,
                                  textTransform: "uppercase",
                                }}
                              >
                                {it.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitLoading}
                style={{ ...primaryBtn, opacity: isSubmitLoading ? 0.7 : 1 }}
              >
                {isSubmitLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving…
                  </>
                ) : editId ? (
                  "Push Update"
                ) : (
                  <>
                    <Plus size={15} /> Create Product Family
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ════ LIST COLUMN ════ */}
        <div>
          {/* ── Search + filters toolbar ── */}
          {!loadingFamilies && families.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {/* 1. Search */}
              <div style={{ position: "relative" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: TOKEN.textSec,
                  }}
                />
                <input
                  type="text"
                  placeholder="Search product families…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 40 }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: TOKEN.textSec,
                      display: "flex",
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 2. Status filter buttons — below search */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["all", "active", "inactive"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: `1px solid ${filterStatus === s ? TOKEN.primary : TOKEN.border}`,
                      background:
                        filterStatus === s ? TOKEN.primary : TOKEN.surface,
                      color: filterStatus === s ? "#fff" : TOKEN.textSec,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.15s",
                    }}
                  >
                    {s === "all"
                      ? "All"
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* 3. Count + bulk actions on the same row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  minHeight: 32,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: TOKEN.textSec }}>
                  Showing{" "}
                  <strong style={{ color: TOKEN.textPri }}>
                    {filteredFamilies.length}
                  </strong>{" "}
                  of {families.length} product families
                </p>

                {selectedIds.size > 0 && (
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <button
                      onClick={() => setBulkDeleteOpen(true)}
                      style={{
                        ...outlineBtn,
                        color: TOKEN.dangerText,
                        borderColor: `${TOKEN.danger}40`,
                        background: TOKEN.dangerBg,
                      }}
                    >
                      <Trash2 size={13} /> Delete {selectedIds.size}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      style={outlineBtn}
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Family grid ── */}
          {loadingFamilies ? (
            <div
              style={{
                padding: "80px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                color: TOKEN.textSec,
              }}
            >
              <Loader2
                size={28}
                className="animate-spin"
                style={{ color: TOKEN.primary }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                Loading…
              </p>
            </div>
          ) : filteredFamilies.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 320,
                border: `2px dashed ${TOKEN.border}`,
                borderRadius: 16,
                background: TOKEN.bg,
                padding: 32,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: TOKEN.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <FolderPlus
                  size={28}
                  style={{ color: TOKEN.textSec, opacity: 0.3 }}
                />
              </div>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 14,
                  fontWeight: 800,
                  color: TOKEN.textPri,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {families.length === 0 ? "No Product Families" : "No Results"}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: TOKEN.textSec,
                  maxWidth: 280,
                  lineHeight: 1.6,
                }}
              >
                {families.length === 0
                  ? "Create a new product family using the panel on the left."
                  : "No product families match your search or filter criteria."}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {filteredFamilies.map((f) => (
                <FamilyCard
                  key={f.id}
                  family={f}
                  selected={selectedIds.has(f.id)}
                  onSelect={() => toggleSelect(f.id)}
                  onDelete={() => setDeleteTarget(f)}
                  onEdit={() => {
                    setEditId(f.id);
                    setTitle(f.title ?? "");
                    setDescription("");
                    setProductUsage((f.productUsage as ProductUsage[]) ?? []);
                    setPreviewUrl(f.image ?? f.imageUrl ?? "");
                    setImageFile(null);
                    setSelectedApplicationIds(f.applications ?? []);
                    if (Array.isArray(f.specs) && f.specs.length > 0) {
                      setSelectedSpecGroupIds(
                        f.specs.map((s) => s.specGroupId),
                      );
                      const nextSel: Record<string, string[]> = {};
                      for (const s of f.specs) {
                        nextSel[s.specGroupId] = (s.specItems ?? []).map(
                          (it) => it.id,
                        );
                      }
                      setSpecItemSelections(nextSel);
                    } else if (
                      Array.isArray(f.specifications) &&
                      f.specifications.length > 0
                    ) {
                      setSelectedSpecGroupIds(f.specifications);
                      setSpecItemSelections({});
                    } else {
                      setSelectedSpecGroupIds([]);
                      setSpecItemSelections({});
                    }
                    // Scroll to form on mobile
                    formTopRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete modals ── */}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteOne}
        loading={!!deletingId}
        title="Delete Product Family"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />
      <ConfirmDeleteModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        loading={isBulkDeleting}
        title={`Delete ${selectedIds.size} Product Families`}
        description="This will permanently remove all selected product families. This cannot be undone."
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .families-grid { grid-template-columns: 1fr 2fr; }
        @media (max-width: 1024px) { .families-grid { grid-template-columns: 1fr !important; } }
      `,
        }}
      />
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function FamiliesPage() {
  return (
    <RouteProtection requiredRoutes={["/products"]}>
      <ProductFamiliesContent />
    </RouteProtection>
  );
}
