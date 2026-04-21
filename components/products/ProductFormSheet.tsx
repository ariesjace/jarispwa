"use client";

import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Upload, X } from "lucide-react";
import { TOKEN } from "@/components/layout/tokens";
import { ItemCodesInput } from "@/components/ItemCodesDisplay";
import { hasAtLeastOneItemCode, type ItemCodes } from "@/types/product";
import type {
  AvailableSpecItem,
  ProductFormData,
  ValidationErrors,
} from "./types";

interface ProductFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProductFormData>) => void;
  onBack: () => void;
  formData: Partial<ProductFormData>;
  allSpecGroups: Array<{ id: string; name: string; items: { label: string }[] }>;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: TOKEN.textSec,
  textTransform: "uppercase",
  marginBottom: 7,
  letterSpacing: "0.03em",
};

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${hasError ? TOKEN.danger : TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 13.5,
  color: TOKEN.textPri,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
});

const outlineBtn: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: TOKEN.textPri,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 10,
  border: "none",
  background: TOKEN.primary,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const iconBtn = (): React.CSSProperties => ({
  background: "none",
  border: "none",
  padding: 8,
  cursor: "pointer",
  color: TOKEN.textSec,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
});

const sectionCardStyle: React.CSSProperties = {
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 14,
  overflow: "hidden",
  background: TOKEN.surface,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderBottom: `1px solid ${TOKEN.border}`,
  background: TOKEN.bg,
  fontSize: 11,
  fontWeight: 800,
  color: TOKEN.textPri,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

function dropzoneStyle(isDragActive: boolean): React.CSSProperties {
  return {
    border: `1.5px dashed ${isDragActive ? TOKEN.primary : TOKEN.border}`,
    borderRadius: 10,
    padding: "18px 16px",
    background: isDragActive ? `${TOKEN.primary}08` : TOKEN.bg,
    color: TOKEN.textSec,
    cursor: "pointer",
    transition: "all 0.15s",
  };
}

function groupSpecs(
  specs: AvailableSpecItem[],
  allSpecGroups: Array<{ id: string; name: string }>,
) {
  const map = new Map<string, { groupName: string; items: AvailableSpecItem[] }>();
  specs.forEach((spec) => {
    if (!map.has(spec.specGroupId)) {
      const fallbackName =
        allSpecGroups.find((g) => g.id === spec.specGroupId)?.name ?? spec.specGroupId;
      map.set(spec.specGroupId, {
        groupName: spec.specGroup || fallbackName,
        items: [],
      });
    }
    map.get(spec.specGroupId)?.items.push(spec);
  });
  return Array.from(map.entries()).map(([specGroupId, value]) => ({
    specGroupId,
    groupName: value.groupName,
    items: value.items,
  }));
}

export function ProductFormSheet({
  isOpen,
  onClose,
  onSubmit,
  onBack,
  formData,
  allSpecGroups,
}: ProductFormSheetProps) {
  const [itemDescription, setItemDescription] = useState(formData.itemDescription ?? "");
  const [itemCodes, setItemCodes] = useState<ItemCodes>(formData.itemCodes ?? {});
  const [specValues, setSpecValues] = useState<Record<string, string>>(formData.specValues ?? {});
  const [mainImageFile, setMainImageFile] = useState<File | null>(formData.mainImageFile ?? null);
  const [rawImageFile, setRawImageFile] = useState<File | null>(formData.rawImageFile ?? null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>(formData.images ?? []);
  const [showItemCodeError, setShowItemCodeError] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const specsByGroup = useMemo(
    () => groupSpecs(formData.availableSpecs ?? [], allSpecGroups),
    [formData.availableSpecs, allSpecGroups],
  );

  const mainDropzone = useDropzone({
    multiple: false,
    accept: { "image/*": [] },
    onDrop: (acceptedFiles) => {
      setMainImageFile(acceptedFiles[0] ?? null);
    },
  });

  const rawDropzone = useDropzone({
    multiple: false,
    accept: { "image/*": [] },
    onDrop: (acceptedFiles) => {
      setRawImageFile(acceptedFiles[0] ?? null);
    },
  });

  const galleryDropzone = useDropzone({
    multiple: true,
    accept: { "image/*": [] },
    onDrop: (acceptedFiles) => {
      setGalleryFiles((prev) => [...prev, ...acceptedFiles]);
    },
  });

  const handleSpecChange = (key: string, value: string) => {
    setSpecValues((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const errs: ValidationErrors = {};
    if (!itemDescription.trim()) {
      errs.itemDescription = "Item description is required";
    }
    if (!hasAtLeastOneItemCode(itemCodes)) {
      setShowItemCodeError(true);
      errs.itemCodes = "At least one item code is required";
    } else {
      setShowItemCodeError(false);
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      itemDescription: itemDescription.trim(),
      itemCodes,
      specValues,
      mainImageFile: mainImageFile ?? undefined,
      rawImageFile: rawImageFile ?? undefined,
      images: galleryFiles,
    });
  };

  if (!isOpen) return null;

  const sectionCard = (title: string, body: React.ReactNode, subtitle?: string) => (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        {title}
        {subtitle ? (
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "normal",
              textTransform: "none",
              color: TOKEN.textSec,
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      <div style={sectionBodyStyle}>{body}</div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: TOKEN.bg,
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: TOKEN.surface,
          borderBottom: `1px solid ${TOKEN.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={iconBtn()}>
              <ArrowLeft size={19} />
            </button>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: TOKEN.textPri,
                }}
              >
                New Product
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: TOKEN.textSec,
                  textTransform: "uppercase",
                }}
              >
                {formData.productFamilyTitle ?? "UNSPECIFIED FAMILY"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn()}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {sectionCard(
            "Product Description",
            <div>
              <label style={labelStyle}>
                Item Description <span style={{ color: TOKEN.danger }}>*</span>
              </label>
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={4}
                style={{
                  ...inputStyle(!!errors.itemDescription),
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
                placeholder="Enter product description"
              />
              {errors.itemDescription ? (
                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: 10,
                    fontWeight: 700,
                    color: TOKEN.danger,
                  }}
                >
                  {errors.itemDescription}
                </p>
              ) : null}
            </div>,
          )}

          {sectionCard(
            "Item Codes",
            <ItemCodesInput
              value={itemCodes}
              onChange={setItemCodes}
              showValidationError={showItemCodeError}
            />,
            "At least one required",
          )}

          {specsByGroup.map((group) =>
            sectionCard(
              group.groupName,
              <>
                {group.items.map((spec) => {
                  const fieldKey = `${spec.specGroupId}-${spec.label}`;
                  return (
                    <div key={spec.id}>
                      <label htmlFor={fieldKey} style={labelStyle}>
                        {spec.label}
                      </label>
                      <input
                        id={fieldKey}
                        value={specValues[fieldKey] ?? ""}
                        onChange={(e) => handleSpecChange(fieldKey, e.target.value)}
                        style={inputStyle()}
                        placeholder={`Enter ${spec.label.toLowerCase()}`}
                      />
                    </div>
                  );
                })}
              </>,
              `${group.items.length} specification${group.items.length !== 1 ? "s" : ""}`,
            ),
          )}

          {sectionCard(
            "Product Images",
            <>
              <div {...mainDropzone.getRootProps()} style={dropzoneStyle(mainDropzone.isDragActive)}>
                <input {...mainDropzone.getInputProps()} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Upload size={18} color={TOKEN.textSec} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TOKEN.textPri }}>
                      Main Image
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                      {mainImageFile ? mainImageFile.name : "Drop or click to upload"}
                    </p>
                  </div>
                </div>
              </div>

              <div {...rawDropzone.getRootProps()} style={dropzoneStyle(rawDropzone.isDragActive)}>
                <input {...rawDropzone.getInputProps()} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Upload size={18} color={TOKEN.textSec} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TOKEN.textPri }}>
                      Raw Image
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                      {rawImageFile ? rawImageFile.name : "Drop or click to upload"}
                    </p>
                  </div>
                </div>
              </div>

              <div {...galleryDropzone.getRootProps()} style={dropzoneStyle(galleryDropzone.isDragActive)}>
                <input {...galleryDropzone.getInputProps()} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Upload size={18} color={TOKEN.textSec} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: TOKEN.textPri }}>
                      Gallery Images
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                      Drop multiple files or click to upload
                    </p>
                  </div>
                </div>
              </div>

              {galleryFiles.length > 0 ? (
                <div
                  style={{
                    border: `1px solid ${TOKEN.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: TOKEN.bg,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: TOKEN.textPri }}>
                    {galleryFiles.length} file{galleryFiles.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              ) : null}
            </>,
          )}
        </div>
      </div>

      <div
        style={{
          background: TOKEN.surface,
          borderTop: `1px solid ${TOKEN.border}`,
          padding: "13px 24px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button style={outlineBtn} onClick={onBack}>
            Back
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={outlineBtn} onClick={onClose}>
              Cancel
            </button>
            <button style={primaryBtn} onClick={handleSubmit}>
              Preview TDS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
