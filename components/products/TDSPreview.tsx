"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { TOKEN } from "@/components/layout/tokens";
import type { ProductFormData, ProductFamily } from "./AddProductFlow";

interface TDSPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  formData: ProductFormData;
  productFamily: ProductFamily;
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
  isOpen, onClose, onConfirm, onBack, formData, productFamily,
}: TDSPreviewProps) {
  const [tdsHtml, setTdsHtml] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsGenerating(true);
      try {
        setTdsHtml(generateBlankTDS(formData, productFamily));
      } catch (err) {
        console.error("Error generating TDS:", err);
      } finally {
        setIsGenerating(false);
      }
    }
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
    const blob = new Blob([tdsHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TDS-${Object.values(formData.itemCodes || {})[0] || "preview"}.html`;
    a.click();
    URL.revokeObjectURL(url);
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
            disabled={isGenerating}
            style={btnOutline(isGenerating)}
          >
            <Download size={15} /> Download Preview
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
              borderRadius: 16, padding: "40px 48px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}>
              <div dangerouslySetInnerHTML={{ __html: tdsHtml }} />
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

// ── TDS template generator ────────────────────────────────────────────────────

function generateBlankTDS(formData: ProductFormData, productFamily: ProductFamily): string {
  const specs = Object.entries(formData.specValues)
    .map(([key, value]) => {
      let label = key;
      productFamily.availableSpecGroups.forEach((group) => {
        const item = group.items.find((i) => i.id === key);
        if (item) label = item.label;
      });
      return `<tr><td class="spec-label">${label}</td><td class="spec-value">${value || "—"}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technical Data Sheet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .tds-container { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 1rem; margin-bottom: 2rem; }
    .header h1 { font-size: 1.75rem; color: #1e40af; margin-bottom: 0.5rem; }
    .header .subtitle { color: #64748b; font-size: 0.95rem; }
    .section { margin-bottom: 2rem; }
    .section-title { font-size: 1.25rem; font-weight: 600; color: #1e40af; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 0.75rem; }
    .info-label { font-weight: 600; color: #475569; }
    .info-value { color: #0f172a; }
    .specs-table { width: 100%; border-collapse: collapse; }
    .specs-table tr { border-bottom: 1px solid #e2e8f0; }
    .specs-table td { padding: 0.75rem 0; }
    .spec-label { font-weight: 500; color: #475569; width: 40%; }
    .spec-value { color: #0f172a; }
    .codes-list { list-style: none; }
    .codes-list li { padding: 0.5rem 0; color: #0f172a; font-family: 'Courier New', monospace; }
    .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="tds-container">
    <div class="header">
      <h1>Technical Data Sheet</h1>
      <div class="subtitle">${productFamily.name} • ${formData.productClass?.toUpperCase()}</div>
    </div>
    <div class="section">
      <h2 class="section-title">Product Information</h2>
      <div class="info-grid">
        <div class="info-label">Description:</div>
        <div class="info-value">${formData.itemDescription}</div>
        <div class="info-label">Product Family:</div>
        <div class="info-value">${productFamily.name}</div>
        <div class="info-label">Classification:</div>
        <div class="info-value">${formData.productClass?.toUpperCase()}</div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Item Codes</h2>
      <ul class="codes-list">
        ${Object.entries(formData.itemCodes || {}).filter(([, v]) => v).map(([k, v]) => `<li><strong>${k}</strong>: ${v}</li>`).join("")}
      </ul>
    </div>
    <div class="section">
      <h2 class="section-title">Technical Specifications</h2>
      <table class="specs-table"><tbody>${specs}</tbody></table>
    </div>
    <div class="footer">
      <p>This is a blank template preview. Actual TDS will be generated upon publication.</p>
      <p style="margin-top:0.5rem">Generated: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>`;
}
