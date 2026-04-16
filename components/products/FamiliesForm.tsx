"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  query,
  writeBatch,
} from "firebase/firestore";
import {
  Check,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  X,
  Briefcase,
  Layers,
  ChevronDown,
  Search,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TOKEN } from "@/components/layout/tokens";
import { generateTdsTemplatePdf, uploadTdsPdf } from "@/lib/tdsGenerator";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOUDINARY_UPLOAD_PRESET = "taskflow_preset";
const CLOUDINARY_CLOUD_NAME    = "dvmpn8mjh";

const PRODUCT_USAGE_OPTIONS = ["INDOOR", "OUTDOOR", "SOLAR"] as const;
type ProductUsage = (typeof PRODUCT_USAGE_OPTIONS)[number];

const USAGE_COLORS: Record<ProductUsage, { bg: string; color: string; border: string }> = {
  INDOOR:  { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
  OUTDOOR: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  SOLAR:   { bg: "#fefce8", color: "#a16207", border: "#fde047" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpecItemRef       = { id: string; name: string };
export type ProductFamilySpecs= { specGroupId: string; specItems: SpecItemRef[] };
export type SpecGroupDoc      = { id: string; name: string; items?: { label: string }[]; isActive?: boolean };
export type ApplicationDoc    = { id: string; title?: string; name?: string; imageUrl?: string; websites?: string[] };

export type ProductFamilyDoc  = {
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FamiliesFormProps {
  editFamily?: ProductFamilyDoc | null;
  specGroups: SpecGroupDoc[];
  applications: ApplicationDoc[];
  onSuccess: () => void;
  onCancel?: () => void;
}

// ─── Shared inline-style constants ───────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display:       "block",
  fontSize:      11,
  fontWeight:    700,
  color:         TOKEN.textSec,
  textTransform: "uppercase",
  marginBottom:  7,
};

const inputStyle: React.CSSProperties = {
  width:       "100%",
  padding:     "10px 14px",
  borderRadius: 10,
  border:      `1px solid ${TOKEN.border}`,
  background:  TOKEN.surface,
  fontSize:    13.5,
  color:       TOKEN.textPri,
  outline:     "none",
  boxSizing:   "border-box" as const,
  fontFamily:  "inherit",
};

const outlineBtn: React.CSSProperties = {
  padding:      "7px 14px",
  borderRadius: 8,
  border:       `1px solid ${TOKEN.border}`,
  background:   TOKEN.surface,
  fontSize:     12,
  fontWeight:   600,
  cursor:       "pointer",
  color:        TOKEN.textPri,
  display:      "flex",
  alignItems:   "center",
  gap:          6,
};

const primaryBtn: React.CSSProperties = {
  display:       "flex",
  alignItems:    "center",
  justifyContent:"center",
  gap:           8,
  padding:       "12px 20px",
  borderRadius:  12,
  border:        "none",
  background:    TOKEN.primary,
  color:         "#fff",
  fontSize:      13,
  fontWeight:    700,
  cursor:        "pointer",
  width:         "100%",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        display:     "inline-flex",
        alignItems:  "center",
        gap:         4,
        padding:     "5px 12px",
        borderRadius: 999,
        border:      `1px solid ${active ? c.border : TOKEN.border}`,
        background:  active ? c.bg : TOKEN.surface,
        color:       active ? c.color : TOKEN.textSec,
        fontSize:    11,
        fontWeight:  700,
        cursor:      "pointer",
        transition:  "all 0.15s",
      }}
    >
      {active && <Check size={10} />}
      {label}
    </button>
  );
}

function MultiSelectDropdown<T extends { id: string }>({
  items,
  selectedIds,
  onToggle,
  getLabel,
  placeholder,
  icon: Icon,
  open,
  onOpenChange,
  disabled,
}: {
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  getLabel: (item: T) => string;
  placeholder: string;
  icon: React.ElementType;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onOpenChange]);

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((i) => getLabel(i).toLowerCase().includes(search.toLowerCase()));
  }, [items, search, getLabel]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && onOpenChange(!open)}
        style={{
          ...outlineBtn,
          width:          "100%",
          justifyContent: "space-between",
          padding:        "10px 14px",
          borderRadius:   10,
          background:     open ? `${TOKEN.primary}08` : TOKEN.surface,
          borderColor:    open ? TOKEN.primary : TOKEN.border,
          color:          disabled ? TOKEN.textSec : selectedIds.length > 0 ? TOKEN.textPri : TOKEN.textSec,
          opacity:        disabled ? 0.5 : 1,
          cursor:         disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={13} style={{ opacity: 0.5 }} />
          <ChevronDown size={13} style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            style={{
              position:   "absolute",
              top:        "calc(100% + 6px)",
              left:       0,
              right:      0,
              background: TOKEN.surface,
              border:     `1px solid ${TOKEN.border}`,
              borderRadius: 12,
              boxShadow:  "0 8px 24px -4px rgba(15,23,42,0.12)",
              zIndex:     50,
              overflow:   "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${TOKEN.border}`, position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)", color: TOKEN.textSec }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ ...inputStyle, paddingLeft: 32, padding: "7px 12px 7px 32px", borderRadius: 8, fontSize: 12 }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p style={{ padding: "16px 14px", fontSize: 12, color: TOKEN.textSec, textAlign: "center" }}>No results</p>
              ) : filtered.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggle(item.id)}
                    style={{
                      width:       "100%",
                      display:     "flex",
                      alignItems:  "center",
                      gap:         10,
                      padding:     "10px 14px",
                      border:      "none",
                      background:  selected ? `${TOKEN.primary}08` : "transparent",
                      cursor:      "pointer",
                      textAlign:   "left",
                      borderBottom:`1px solid ${TOKEN.border}`,
                    }}
                  >
                    <span style={{
                      width:          16,
                      height:         16,
                      borderRadius:   4,
                      border:         `1.5px solid ${selected ? TOKEN.primary : TOKEN.border}`,
                      background:     selected ? TOKEN.primary : "transparent",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      flexShrink:     0,
                    }}>
                      {selected && <Check size={10} color="#fff" />}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: TOKEN.textPri }}>
                      {getLabel(item).toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── FamiliesForm ─────────────────────────────────────────────────────────────

export function FamiliesForm({
  editFamily,
  specGroups,
  applications,
  onSuccess,
  onCancel,
}: FamiliesFormProps) {
  const isEdit = !!editFamily;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [title,           setTitle]           = useState(editFamily?.title ?? "");
  const [productUsage,    setProductUsage]    = useState<ProductUsage[]>(
    (editFamily?.productUsage as ProductUsage[]) ?? []
  );
  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(editFamily?.image ?? editFamily?.imageUrl ?? "");

  const [openSpecGroups,       setOpenSpecGroups]       = useState(false);
  const [selectedSpecGroupIds, setSelectedSpecGroupIds] = useState<string[]>(() => {
    if (!editFamily) return [];
    if (Array.isArray(editFamily.specs) && editFamily.specs.length > 0)
      return editFamily.specs.map((s) => s.specGroupId);
    if (Array.isArray(editFamily.specifications) && editFamily.specifications.length > 0)
      return editFamily.specifications;
    return [];
  });
  const [specItemSelections, setSpecItemSelections] = useState<Record<string, string[]>>(() => {
    if (!editFamily || !Array.isArray(editFamily.specs)) return {};
    const out: Record<string, string[]> = {};
    for (const s of editFamily.specs) {
      out[s.specGroupId] = (s.specItems ?? []).map((it) => it.id);
    }
    return out;
  });
  const [specItemSearch, setSpecItemSearch] = useState<Record<string, string>>({});

  const [openApplications,      setOpenApplications]      = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>(
    editFamily?.applications ?? []
  );

  // ── Dropzone ────────────────────────────────────────────────────────────────
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

  // ── Derived ─────────────────────────────────────────────────────────────────
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
    return selectedSpecGroupIds.map((specGroupId) => {
      const group = specGroupById.get(specGroupId);
      const labels = (group?.items ?? [])
        .map((i) => i.label).filter(Boolean)
        .map((l) => l.toUpperCase().trim());
      const chosenItemIds = new Set(specItemSelections[specGroupId] ?? []);
      const chosenItems: SpecItemRef[] = labels
        .map((label) => ({ id: buildSpecItemId(specGroupId, label), name: label }))
        .filter((item) => chosenItemIds.has(item.id));
      return { specGroupId, specItems: chosenItems };
    }).filter((g) => g.specItems.length > 0);
  }, [selectedSpecGroupIds, specItemSelections, specGroupById]);

  const selectedSummary = useMemo(() => {
    return selectedSpecsForSave
      .map((g) => ({
        specGroupId: g.specGroupId,
        groupName:   specGroupById.get(g.specGroupId)?.name ?? g.specGroupId,
        specItems:   g.specItems,
      }))
      .filter((g) => g.specItems.length > 0);
  }, [selectedSpecsForSave, specGroupById]);

  const canPickSpecs = title.trim().length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleToggleSpecGroup = useCallback((specGroupId: string) => {
    setSelectedSpecGroupIds((prev) => {
      if (prev.includes(specGroupId)) {
        setSpecItemSelections((sel) => { const c = { ...sel }; delete c[specGroupId]; return c; });
        return prev.filter((id) => id !== specGroupId);
      }
      return [...prev, specGroupId];
    });
  }, []);

  const handleToggleApplication = useCallback((applicationId: string) => {
    setSelectedApplicationIds((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId]
    );
  }, []);

  const toggleSpecItem = useCallback((specGroupId: string, itemId: string) => {
    setSpecItemSelections((prev) => {
      const cur = new Set(prev[specGroupId] ?? []);
      if (cur.has(itemId)) cur.delete(itemId); else cur.add(itemId);
      return { ...prev, [specGroupId]: Array.from(cur) };
    });
  }, []);

  const setAllItemsInGroup = useCallback((specGroupId: string, on: boolean) => {
    const group  = specGroupById.get(specGroupId);
    const labels = (group?.items ?? []).map((i) => i.label).filter(Boolean).map((l) => l.toUpperCase().trim());
    const ids    = labels.map((label) => buildSpecItemId(specGroupId, label));
    setSpecItemSelections((prev) => ({ ...prev, [specGroupId]: on ? ids : [] }));
  }, [specGroupById]);

  const validate = (): { ok: boolean; message?: string } => {
    if (!title.trim())                    return { ok: false, message: "Title is required" };
    if (selectedSpecGroupIds.length === 0) return { ok: false, message: "Select at least one spec group" };
    for (const gid of selectedSpecGroupIds) {
      const chosen = specItemSelections[gid] ?? [];
      if (chosen.length === 0) {
        const name = specGroupById.get(gid)?.name ?? "Spec Group";
        return { ok: false, message: `Select at least one spec item for "${name}"` };
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
        const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
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

      let familyDocId: string = editFamily?.id ?? "";
      if (isEdit && editFamily) {
        await updateDoc(doc(db, "productfamilies", editFamily.id), payload);
      } else {
        const ref = await addDoc(collection(db, "productfamilies"), {
          ...payload,
          isActive:  true,
          createdAt: serverTimestamp(),
        });
        familyDocId = ref.id;
      }

      // Propagate applications to matching products
      if (selectedApplicationIds.length > 0 && normalisedTitle) {
        try {
          const productsSnap = await getDocs(
            query(collection(db, "products"), where("productFamily", "==", normalisedTitle))
          );
          if (!productsSnap.empty) {
            const batch = writeBatch(db);
            productsSnap.docs.forEach((productDoc) => {
              batch.update(productDoc.ref, { applications: selectedApplicationIds, updatedAt: serverTimestamp() });
            });
            await batch.commit();
          }
        } catch (err) {
          console.warn("Failed to propagate applications to products:", err);
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

        if (specGroupsForTemplate.length > 0 && familyDocId) {
          toast.loading("Generating TDS template…", { id: "tds-template" });
          const blob   = await generateTdsTemplatePdf({ specGroups: specGroupsForTemplate, includeBrandAssets: false });
          const tplUrl = await uploadTdsPdf(blob, `${normalisedTitle}_TEMPLATE.pdf`, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET);
          await updateDoc(doc(db, "productfamilies", familyDocId), { tdsTemplate: tplUrl, updatedAt: serverTimestamp() });
          toast.dismiss("tds-template");
        }
      } catch (tplErr: any) {
        toast.dismiss("tds-template");
        console.warn("TDS template generation failed:", tplErr);
      }

      toast.success(isEdit ? "Product family updated" : "Product family created");
      onSuccess();
    } catch {
      toast.error("Error processing request");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Two-column top section for title + usage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="form-top-grid">
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Title <span style={{ color: TOKEN.danger }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.toUpperCase())}
            placeholder="E.G. RECESSED LIGHTS"
            style={{
              ...inputStyle,
              borderColor: !title.trim() ? `${TOKEN.danger}60` : TOKEN.border,
            }}
          />
          {!title.trim() && (
            <p style={{ margin: "5px 0 0", fontSize: 10, color: TOKEN.danger, fontWeight: 700 }}>
              Title is required
            </p>
          )}
        </div>

        {/* Product Usage */}
        <div>
          <label style={labelStyle}>
            Product Usage <span style={{ opacity: 0.5 }}>(optional)</span>
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2 }}>
            {PRODUCT_USAGE_OPTIONS.map((u) => (
              <UsagePill
                key={u}
                label={u}
                active={productUsage.includes(u)}
                onClick={() =>
                  setProductUsage((p) =>
                    p.includes(u) ? p.filter((v) => v !== u) : [...p, u]
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Image dropzone */}
      <div>
        <label style={labelStyle}>
          Image <span style={{ opacity: 0.5 }}>(optional)</span>
        </label>
        <div
          {...getRootProps()}
          style={{
            border:        `2px dashed ${isDragActive ? TOKEN.primary : TOKEN.border}`,
            borderRadius:  10,
            background:    isDragActive ? `${TOKEN.primary}08` : TOKEN.bg,
            padding:       previewUrl ? 0 : 32,
            cursor:        "pointer",
            overflow:      "hidden",
            minHeight:     previewUrl ? "auto" : 110,
            display:       "flex",
            alignItems:    "center",
            justifyContent:"center",
            transition:    "all 0.15s",
          }}
        >
          <input {...getInputProps()} />
          {previewUrl ? (
            <div style={{ position: "relative", width: "100%" }}>
              <img
                src={previewUrl}
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                alt="Preview"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewUrl(""); setImageFile(null); }}
                style={{
                  position:       "absolute",
                  top:            8,
                  right:          8,
                  width:          26,
                  height:         26,
                  borderRadius:   8,
                  border:         "none",
                  background:     TOKEN.danger,
                  color:          "#fff",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  cursor:         "pointer",
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <ImageIcon size={22} style={{ color: TOKEN.textSec, opacity: 0.4, margin: "0 auto 10px" }} />
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TOKEN.textSec }}>
                Drop image here
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: TOKEN.textSec, opacity: 0.6 }}>
                or click to browse
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Two-column for applications + spec groups */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="form-mid-grid">
        {/* Applications */}
        <div>
          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {selectedApplicationIds.map((appId) => {
                const app  = applicationById.get(appId);
                const name = app?.title ?? app?.name ?? appId;
                return (
                  <span
                    key={appId}
                    style={{
                      display:     "inline-flex",
                      alignItems:  "center",
                      gap:         5,
                      fontSize:    10,
                      fontWeight:  700,
                      padding:     "3px 8px 3px 10px",
                      borderRadius: 6,
                      background:  TOKEN.bg,
                      border:      `1px solid ${TOKEN.border}`,
                      color:       TOKEN.textPri,
                    }}
                  >
                    {name.toUpperCase()}
                    <button
                      type="button"
                      onClick={() => handleToggleApplication(appId)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: TOKEN.textSec, padding: 0, display: "flex", lineHeight: 1 }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
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
            placeholder={canPickSpecs ? "Select spec groups…" : "Enter title first"}
            icon={Layers}
            open={openSpecGroups && canPickSpecs}
            onOpenChange={(v) => canPickSpecs && setOpenSpecGroups(v)}
            disabled={!canPickSpecs}
          />
          {!canPickSpecs && (
            <p style={{ margin: "5px 0 0", fontSize: 10, color: TOKEN.textSec, fontWeight: 600 }}>
              Unlock by entering a title first
            </p>
          )}
        </div>
      </div>

      {/* Spec items per group */}
      {selectedSpecGroupIds.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              {selectedSummary.reduce((sum, g) => sum + g.specItems.length, 0)} selected
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {selectedSpecGroupIds.map((gid) => {
              const group     = specGroupById.get(gid);
              const groupName = (group?.name ?? gid).toUpperCase();
              const labels    = Array.from(
                new Set(
                  (group?.items ?? []).map((i) => i.label).filter(Boolean).map((l) => l.toUpperCase().trim())
                )
              );
              const search    = (specItemSearch[gid] ?? "").toUpperCase();
              const filtered  = search ? labels.filter((l) => l.includes(search)) : labels;
              const selectedSet = new Set(specItemSelections[gid] ?? []);

              return (
                <div
                  key={gid}
                  style={{ border: `1px solid ${TOKEN.border}`, borderRadius: 10, overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding:      "10px 14px",
                      borderBottom: `1px solid ${TOKEN.border}`,
                      background:   TOKEN.bg,
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "space-between",
                      gap:          8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: TOKEN.textPri, textTransform: "uppercase" }}>
                        {groupName}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 9, color: TOKEN.textSec, fontWeight: 600 }}>
                        {selectedSet.size} / {labels.length} SELECTED
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setAllItemsInGroup(gid, true)}
                        style={{ ...outlineBtn, fontSize: 10, padding: "4px 9px" }}
                        disabled={labels.length === 0}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllItemsInGroup(gid, false)}
                        style={{ ...outlineBtn, fontSize: 10, padding: "4px 9px" }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      value={specItemSearch[gid] ?? ""}
                      onChange={(e) =>
                        setSpecItemSearch((prev) => ({ ...prev, [gid]: e.target.value.toUpperCase() }))
                      }
                      placeholder="Filter items…"
                      style={{ ...inputStyle, fontSize: 11.5, padding: "7px 11px" }}
                    />
                    {filtered.length === 0 ? (
                      <p style={{ fontSize: 11, color: TOKEN.textSec, textAlign: "center", padding: "10px 0", background: TOKEN.bg, borderRadius: 8 }}>
                        No items found
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 180, overflowY: "auto" }}>
                        {filtered.map((label) => {
                          const itemId  = buildSpecItemId(gid, label);
                          const checked = selectedSet.has(itemId);
                          return (
                            <button
                              type="button"
                              key={itemId}
                              onClick={() => toggleSpecItem(gid, itemId)}
                              style={{
                                display:     "flex",
                                alignItems:  "center",
                                gap:         8,
                                padding:     "7px 10px",
                                border:      `1px solid ${checked ? `${TOKEN.primary}40` : TOKEN.border}`,
                                borderRadius: 7,
                                background:  checked ? `${TOKEN.primary}06` : TOKEN.surface,
                                cursor:      "pointer",
                                textAlign:   "left",
                              }}
                            >
                              <span
                                style={{
                                  width:          14,
                                  height:         14,
                                  borderRadius:   4,
                                  border:         `1.5px solid ${checked ? TOKEN.primary : TOKEN.border}`,
                                  background:     checked ? TOKEN.primary : "transparent",
                                  display:        "flex",
                                  alignItems:     "center",
                                  justifyContent: "center",
                                  flexShrink:     0,
                                }}
                              >
                                {checked && <Check size={9} color="#fff" />}
                              </span>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: TOKEN.textSec, textTransform: "uppercase" }}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(specItemSelections[gid] ?? []).length === 0 && (
                      <p style={{ margin: 0, fontSize: 10, color: TOKEN.danger, fontWeight: 700 }}>
                        Select at least one item
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary strip */}
      {selectedSummary.length > 0 && (
        <div
          style={{
            background:   TOKEN.bg,
            border:       `1px solid ${TOKEN.border}`,
            borderRadius: 10,
            padding:      "12px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: TOKEN.textSec, textTransform: "uppercase" }}>
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
              {selectedSummary.length} Group{selectedSummary.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                    background:   TOKEN.surface,
                    border:       `1px solid ${TOKEN.border}`,
                    borderRadius: 8,
                    padding:      "8px 12px",
                    flex:         "1 1 200px",
                  }}
                >
                  <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 800, color: TOKEN.textPri, textTransform: "uppercase" }}>
                    {(g.groupName ?? "").toUpperCase()}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {uniqueItems.map((it) => (
                      <span
                        key={it.id}
                        style={{
                          fontSize:    9,
                          fontWeight:  700,
                          padding:     "2px 6px",
                          borderRadius: 4,
                          background:  TOKEN.bg,
                          border:      `1px solid ${TOKEN.border}`,
                          color:       TOKEN.textSec,
                          textTransform:"uppercase",
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

      {/* Footer actions */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitLoading}
            style={{
              flex:         1,
              padding:      "12px 0",
              borderRadius: 12,
              border:       `1px solid ${TOKEN.border}`,
              background:   TOKEN.surface,
              color:        TOKEN.textSec,
              fontSize:     13.5,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitLoading}
          style={{ ...primaryBtn, flex: 2, opacity: isSubmitLoading ? 0.7 : 1, borderRadius: 12, padding: "12px 0" }}
        >
          {isSubmitLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving…
            </>
          ) : isEdit ? (
            <>
              <Check size={15} /> Push Update
            </>
          ) : (
            <>
              <Plus size={15} /> Create Product Family
            </>
          )}
        </button>
      </div>

      {/* Responsive grid override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .form-top-grid { grid-template-columns: 1fr !important; }
          .form-mid-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </form>
  );
}