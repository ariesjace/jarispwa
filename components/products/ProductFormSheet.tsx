"use client";

import { useState, useEffect } from "react";
import { X, Upload, ArrowLeft, Trash2 } from "lucide-react";
import { TOKEN } from "@/components/layout/tokens";
import type { ProductFamily, SpecGroup, ProductFormData } from "./AddProductFlow";

interface ProductFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductFormData>) => void;
  onBack: () => void;
  productFamily: ProductFamily;
  specGroups: SpecGroup[];
  initialData?: Partial<ProductFormData>;
}

// ── Item code labels ──────────────────────────────────────────────────────────

const ITEM_CODE_LABELS = ["LIT", "ECO", "ZUM", "LUM"] as const;

// ── Shared styles (matching FamiliesForm pattern) ─────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: TOKEN.textSec, textTransform: "uppercase",
  marginBottom: 7, letterSpacing: "0.03em",
};

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1px solid ${hasError ? TOKEN.danger : TOKEN.border}`,
  background: TOKEN.surface, fontSize: 13.5, color: TOKEN.textPri,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
});

const outlineBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface, fontSize: 13, fontWeight: 600,
  cursor: "pointer", color: TOKEN.textPri,
  display: "inline-flex", alignItems: "center", gap: 6,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 22px", borderRadius: 10, border: "none",
  background: TOKEN.primary, color: "#fff",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const iconBtn = (danger?: boolean): React.CSSProperties => ({
  background: "none", border: "none", padding: 8,
  cursor: "pointer", color: danger ? TOKEN.danger : TOKEN.textSec,
  borderRadius: 8, display: "flex", alignItems: "center",
});

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductFormSheet({
  isOpen, onClose, onSubmit, onBack,
  productFamily, specGroups, initialData,
}: ProductFormSheetProps) {
  const initCodes = (): Record<string, string> =>
    initialData?.itemCodes
      ? (initialData.itemCodes as Record<string, string>)
      : Object.fromEntries(ITEM_CODE_LABELS.map((l) => [l, ""]));

  const [itemDescription, setItemDescription] = useState(initialData?.itemDescription || "");
  const [itemCodes, setItemCodes] = useState<Record<string, string>>(initCodes);
  const [specValues, setSpecValues] = useState<Record<string, any>>(initialData?.specValues || {});
  const [images, setImages] = useState<File[]>(initialData?.images || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData?.itemDescription) setItemDescription(initialData.itemDescription);
    if (initialData?.itemCodes) setItemCodes(initialData.itemCodes as Record<string, string>);
    if (initialData?.specValues) setSpecValues(initialData.specValues);
    if (initialData?.images) setImages(initialData.images);
  }, [initialData]);

  const handleSpecChange = (id: string, value: any) =>
    setSpecValues((prev) => ({ ...prev, [id]: value }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages([...images, ...Array.from(e.target.files)]);
  };

  const removeImage = (i: number) => setImages(images.filter((_, idx) => idx !== i));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!itemDescription.trim()) errs.itemDescription = "Item description is required";
    const filled = Object.values(itemCodes).filter((v) => v.trim());
    if (filled.length === 0) errs.itemCodes = "At least one item code is required";
    specGroups.forEach((g) =>
      g.items.forEach((item) => {
        if (item.required && !specValues[item.id]) errs[item.id] = `${item.label} is required`;
      })
    );
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({
        itemDescription,
        itemCodes: Object.fromEntries(Object.entries(itemCodes).filter(([, v]) => v.trim())),
        specValues,
        images,
      });
    }
  };

  if (!isOpen) return null;

  // ── Section card helper ────────────────────────────────────────────────────

  const sectionCard = (children: React.ReactNode, title: string, subtitle?: string) => (
    <div style={{ border: `1px solid ${TOKEN.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${TOKEN.border}`, background: TOKEN.bg }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: TOKEN.textPri, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </p>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>{subtitle}</p>}
      </div>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: TOKEN.bg, zIndex: 500, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: TOKEN.surface, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{
          maxWidth: 860, margin: "0 auto", padding: "0 24px",
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={iconBtn()}>
              <ArrowLeft size={19} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TOKEN.textPri }}>New Product</p>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: TOKEN.textSec, textTransform: "uppercase" }}>
                {productFamily.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn()}><X size={18} /></button>
        </div>
      </div>

      {/* Scrollable form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Description */}
          {sectionCard(
            <div>
              <label style={labelStyle}>
                Item Description <span style={{ color: TOKEN.danger }}>*</span>
              </label>
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Enter a detailed description of the product..."
                rows={4}
                style={{ ...inputStyle(!!errors.itemDescription), resize: "vertical", lineHeight: 1.6 }}
              />
              {errors.itemDescription && (
                <p style={{ margin: "5px 0 0", fontSize: 10, fontWeight: 700, color: TOKEN.danger }}>
                  {errors.itemDescription}
                </p>
              )}
            </div>,
            "Product Description",
            "Provide a clear, detailed description"
          )}

          {/* Item Codes — fixed LIT / ECO / ZUM / LUM */}
          {sectionCard(
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {ITEM_CODE_LABELS.map((label) => (
                  <div key={label}>
                    <label htmlFor={`code-${label}`} style={labelStyle}>
                      {label} Code
                    </label>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                        fontSize: 10, fontWeight: 800, color: TOKEN.primary,
                        background: `${TOKEN.primary}10`, padding: "2px 7px",
                        borderRadius: 4, border: `1px solid ${TOKEN.primary}20`,
                        pointerEvents: "none",
                      }}>
                        {label}
                      </div>
                      <input
                        id={`code-${label}`}
                        value={itemCodes[label] || ""}
                        onChange={(e) => setItemCodes((prev) => ({ ...prev, [label]: e.target.value }))}
                        placeholder={`${label} item code`}
                        style={{ ...inputStyle(!!(errors.itemCodes && !itemCodes[label]?.trim())), paddingLeft: 64 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {errors.itemCodes && (
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: TOKEN.danger }}>{errors.itemCodes}</p>
              )}
            </>,
            "Item Codes",
            "Enter the code for each system (at least one required)"
          )}

          {/* Dynamic spec groups */}
          {specGroups.map((group) =>
            sectionCard(
              <>
                {group.items.map((item) => (
                  <div key={item.id}>
                    <label htmlFor={item.id} style={labelStyle}>
                      {item.label}
                      {item.required && <span style={{ color: TOKEN.danger, marginLeft: 3 }}>*</span>}
                    </label>

                    {(item.type === "text" || item.type === "number") && (
                      <input
                        id={item.id}
                        type={item.type}
                        value={specValues[item.id] || ""}
                        onChange={(e) => handleSpecChange(item.id, e.target.value)}
                        style={inputStyle(!!errors[item.id])}
                      />
                    )}

                    {item.type === "select" && item.options && (
                      <select
                        id={item.id}
                        value={specValues[item.id] || ""}
                        onChange={(e) => handleSpecChange(item.id, e.target.value)}
                        style={{
                          ...inputStyle(!!errors[item.id]),
                          appearance: "none", WebkitAppearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center",
                          paddingRight: 36,
                        }}
                      >
                        <option value="">Select an option</option>
                        {item.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}

                    {errors[item.id] && (
                      <p style={{ margin: "5px 0 0", fontSize: 10, fontWeight: 700, color: TOKEN.danger }}>{errors[item.id]}</p>
                    )}
                  </div>
                ))}
              </>,
              group.label,
              `${group.items.length} specification${group.items.length !== 1 ? "s" : ""}`
            )
          )}

          {/* Image upload */}
          {sectionCard(
            <>
              {images.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{
                      position: "relative", aspectRatio: "1",
                      border: `1px solid ${TOKEN.border}`, borderRadius: 10, overflow: "hidden",
                    }}>
                      <img
                        src={URL.createObjectURL(img)}
                        alt={`Product ${i + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <button
                        onClick={() => removeImage(i)}
                        style={{
                          position: "absolute", top: 4, right: 4,
                          background: TOKEN.danger, border: "none", borderRadius: 5,
                          width: 22, height: 22, display: "flex",
                          alignItems: "center", justifyContent: "center", cursor: "pointer",
                        }}
                      >
                        <X size={11} color="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{
                border: `2px dashed ${TOKEN.border}`, borderRadius: 10,
                padding: "28px 16px", textAlign: "center", background: TOKEN.bg,
              }}>
                <input
                  type="file" id="image-upload"
                  style={{ display: "none" }} accept="image/*" multiple
                  onChange={handleImageUpload}
                />
                <label htmlFor="image-upload" style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Upload size={24} color={TOKEN.textSec} style={{ opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TOKEN.textSec }}>Upload images</p>
                    <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec, opacity: 0.7 }}>Click to browse or drag and drop</p>
                  </div>
                </label>
              </div>
            </>,
            "Product Images",
            "Upload product images (optional)"
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: TOKEN.surface, borderTop: `1px solid ${TOKEN.border}`, padding: "13px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={outlineBtn} onClick={onBack}>Back</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={outlineBtn} onClick={onClose}>Cancel</button>
            <button style={primaryBtn} onClick={handleSubmit}>Preview TDS</button>
          </div>
        </div>
      </div>
    </div>
  );
}
