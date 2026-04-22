"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { TOKEN } from "@/components/layout/tokens";
import { generateTdsPdf, normaliseBrand } from "@/lib/tdsGenerator";
import { getPrimaryItemCode } from "@/types/product";
import type { ProductFormData } from "./types";

interface TDSPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  formData: ProductFormData;
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "10px 22px", borderRadius: 12, border: "none",
  background: TOKEN.primary, color: "#fff",
  fontSize: 13.5, fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const btnOutline = (disabled?: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "10px 22px", borderRadius: 12,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface, color: TOKEN.textPri,
  fontSize: 13.5, fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const iconBtn = (disabled?: boolean): React.CSSProperties => ({
  background: "none", border: "none", padding: 8,
  cursor: disabled ? "not-allowed" : "pointer",
  color: TOKEN.textSec, borderRadius: 8,
  display: "flex", alignItems: "center",
  opacity: disabled ? 0.5 : 1,
});

export function TDSPreview({
  isOpen,
  onClose,
  onConfirm,
  onBack,
  formData,
}: TDSPreviewProps) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const primaryCode = useMemo(() => {
    const fromItemCodes = getPrimaryItemCode(formData.itemCodes ?? {})?.code;
    if (fromItemCodes) return fromItemCodes;
    const fallback = Object.values(formData.itemCodes ?? {}).find((v) =>
      String(v ?? "").trim(),
    );
    return String(fallback ?? "preview");
  }, [formData.itemCodes]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewPdfUrl("");
      return;
    }

    let cancelled = false;
    const tempUrls: string[] = [];

    const toObjectUrl = (file?: File) => {
      if (!file) return "";
      const url = URL.createObjectURL(file);
      tempUrls.push(url);
      return url;
    };

    const technicalSpecsMap = new Map<
      string,
      { specGroup: string; specs: Array<{ name: string; value: string }> }
    >();

    (formData.availableSpecs ?? []).forEach((spec) => {
      const key = `${spec.specGroupId}-${spec.label}`;
      const value = String(formData.specValues?.[key] ?? "").trim();
      if (!value) return;
      if (!technicalSpecsMap.has(spec.specGroupId)) {
        technicalSpecsMap.set(spec.specGroupId, {
          specGroup: spec.specGroup,
          specs: [],
        });
      }
      technicalSpecsMap.get(spec.specGroupId)?.specs.push({
        name: spec.label,
        value,
      });
    });

    const technicalSpecs = Array.from(technicalSpecsMap.values()).filter(
      (group) => group.specs.length > 0,
    );

    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        const selectedBrand =
          String(formData.brand ?? "").trim() ||
          Object.entries(formData.itemCodes ?? {}).find(([, code]) =>
            String(code ?? "").trim(),
          )?.[0] ||
          "LIT";

        const pdfBlob = await generateTdsPdf({
          itemDescription: formData.itemDescription ?? "",
          itemCodes: formData.itemCodes ?? {},
          technicalSpecs,
          brand: normaliseBrand(selectedBrand),
          includeBrandAssets: false,
          mainImageUrl: toObjectUrl(formData.mainImageFile),
          rawImageUrl: toObjectUrl(formData.rawImageFile),
          dimensionalDrawingUrl: toObjectUrl(formData.dimensionalDrawingImageFile),
          recommendedMountingHeightUrl: toObjectUrl(
            formData.recommendedMountingHeightImageFile,
          ),
          driverCompatibilityUrl: toObjectUrl(
            formData.driverCompatibilityImageFile,
          ),
          baseImageUrl: toObjectUrl(formData.baseImageFile),
          illuminanceLevelUrl: toObjectUrl(formData.illuminanceLevelImageFile),
          wiringDiagramUrl: toObjectUrl(formData.wiringDiagramImageFile),
          installationUrl: toObjectUrl(formData.installationImageFile),
          wiringLayoutUrl: toObjectUrl(formData.wiringLayoutImageFile),
          terminalLayoutUrl: toObjectUrl(formData.terminalLayoutImageFile),
          accessoriesImageUrl: toObjectUrl(formData.accessoriesImageFile),
        });

        if (cancelled) return;
        const nextPreviewUrl = URL.createObjectURL(pdfBlob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = nextPreviewUrl;
        setPreviewPdfUrl(nextPreviewUrl);
      } catch (err) {
        console.error("Error generating TDS preview PDF:", err);
        if (!cancelled) {
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          setPreviewPdfUrl("");
        }
      } finally {
        tempUrls.forEach((url) => URL.revokeObjectURL(url));
        if (!cancelled) setIsGenerating(false);
      }
    };

    void generatePreview();
    return () => {
      cancelled = true;
      tempUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isOpen, formData]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error("Error submitting product:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!previewPdfUrl) return;
    const a = document.createElement("a");
    a.href = previewPdfUrl;
    a.download = `${primaryCode}_TDS_Preview.pdf`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: TOKEN.bg, zIndex: 600, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: TOKEN.surface, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{
          maxWidth: 980, margin: "0 auto", padding: "0 24px",
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={onBack} disabled={isSubmitting} style={iconBtn(isSubmitting)}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TOKEN.textPri }}>Preview TDS</h1>
              <p style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}>
                Review the Technical Data Sheet before publishing
              </p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={isGenerating || !previewPdfUrl}
            style={btnOutline(isGenerating || !previewPdfUrl)}
          >
            <Download size={15} /> Download Preview PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", background: TOKEN.bg, padding: "24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          {isGenerating ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
              <div style={{ textAlign: "center" }}>
                <div className="tds-spinner" />
                <p style={{ marginTop: 12, fontSize: 13, color: TOKEN.textSec }}>Generating TDS preview…</p>
              </div>
            </div>
          ) : (
            <div style={{
              background: TOKEN.surface,
              border: `1px solid ${TOKEN.border}`,
              borderRadius: 16,
              height: "calc(100vh - 250px)",
              minHeight: 520,
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}>
              {previewPdfUrl ? (
                <iframe
                  src={`${previewPdfUrl}#toolbar=1&navpanes=0`}
                  title={`${primaryCode} TDS Preview`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: TOKEN.textSec,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Unable to generate preview. Please check required fields.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: TOKEN.surface, borderTop: `1px solid ${TOKEN.border}`, padding: "14px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={btnOutline(isSubmitting)} onClick={onBack} disabled={isSubmitting}>
            Back to Edit
          </button>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={btnOutline(isSubmitting)} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              style={btnPrimary(isGenerating || isSubmitting)}
              onClick={handleConfirm}
              disabled={isGenerating || isSubmitting}
            >
              {isSubmitting
                ? <><Loader2 size={15} className="tds-spin-icon" /> Publishing…</>
                : "Publish Product"}
            </button>
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tds-spinner {
          width: 36px; height: 36px; margin: 0 auto;
          border: 3px solid ${TOKEN.border};
          border-top-color: ${TOKEN.primary};
          border-radius: 50%;
          animation: tds-spin 0.75s linear infinite;
        }
        .tds-spin-icon { animation: tds-spin 0.75s linear infinite; }
        @keyframes tds-spin { to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
