"use client";

import * as React from "react";
import { Check, Globe, Loader2, ShoppingBag } from "lucide-react";
import { TOKEN } from "@/components/layout/tokens";

type WebsiteOption = {
  id: string;
  label: string;
  value: string;
  accent: string;
  transformNote: string | null;
};

interface AssignToWebsiteModalProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  selectedCount: number;
  onConfirm: (websites: string[]) => Promise<void>;
}

const SCHEMA_TRANSFORM_WEBSITES = new Set(["Taskflow", "Shopify"]);

const WEBSITE_OPTIONS: WebsiteOption[] = [
  {
    id: "disruptive",
    label: "Disruptive Solutions Inc",
    value: "Disruptive Solutions Inc",
    accent: "#2563eb",
    transformNote: null,
  },
  {
    id: "ecoshift",
    label: "Ecoshift Corporation",
    value: "Ecoshift Corporation",
    accent: "#16a34a",
    transformNote: null,
  },
  {
    id: "vah",
    label: "Value Acquisitions Holdings",
    value: "Value Acquisitions Holdings",
    accent: "#ca8a04",
    transformNote: null,
  },
  {
    id: "taskflow",
    label: "Taskflow",
    value: "Taskflow",
    accent: "#7c3aed",
    transformNote: "Schema transform",
  },
  {
    id: "shopify",
    label: "Shopify",
    value: "Shopify",
    accent: "#16a34a",
    transformNote: "Schema transform",
  },
];

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
  padding: "9px 18px",
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

export function AssignToWebsiteModal({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: AssignToWebsiteModalProps) {
  const [selectedWebsites, setSelectedWebsites] = React.useState<string[]>([]);
  const [isAssigning, setIsAssigning] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedWebsites([]);
    setIsAssigning(false);
  }, [open]);

  const toggleWebsite = (value: string) => {
    setSelectedWebsites((prev) =>
      prev.includes(value) ? prev.filter((w) => w !== value) : [...prev, value],
    );
  };

  const selectedTransformSites = React.useMemo(
    () =>
      selectedWebsites.filter((website) =>
        SCHEMA_TRANSFORM_WEBSITES.has(website),
      ),
    [selectedWebsites],
  );

  const handleConfirm = async () => {
    if (selectedWebsites.length === 0 || isAssigning) return;
    setIsAssigning(true);
    try {
      await onConfirm(selectedWebsites);
      onOpenChange(false);
    } finally {
      setIsAssigning(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => !isAssigning && onOpenChange(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 520,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 521,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          pointerEvents: "none",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Assign to website"
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 560,
            maxHeight: "88vh",
            overflowY: "auto",
            background: TOKEN.surface,
            border: `1px solid ${TOKEN.border}`,
            borderRadius: 16,
            boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: `1px solid ${TOKEN.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${TOKEN.primary}14`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Globe size={16} color={TOKEN.primary} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: TOKEN.textPri,
                }}
              >
                Assign to Website
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: TOKEN.textSec }}>
                {selectedCount} product{selectedCount !== 1 ? "s" : ""} will be
                assigned to selected websites.
              </p>
            </div>
          </div>

          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: TOKEN.textSec,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Select Websites
            </p>
            {WEBSITE_OPTIONS.map((site) => {
              const isSelected = selectedWebsites.includes(site.value);
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => toggleWebsite(site.value)}
                  disabled={isAssigning}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? site.accent : TOKEN.border}`,
                    background: isSelected ? `${site.accent}12` : TOKEN.surface,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: isAssigning ? "not-allowed" : "pointer",
                    opacity: isAssigning ? 0.7 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: isSelected ? site.accent : TOKEN.border,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: TOKEN.textPri,
                    }}
                  >
                    {site.label}
                  </span>
                  {site.transformNote ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: site.accent,
                      }}
                    >
                      {site.transformNote}
                    </span>
                  ) : null}
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: `1px solid ${isSelected ? site.accent : TOKEN.border}`,
                      background: isSelected ? site.accent : TOKEN.surface,
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: isSelected ? 1 : 0.15,
                      flexShrink: 0,
                    }}
                  >
                    <Check size={12} />
                  </span>
                </button>
              );
            })}

            {selectedTransformSites.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedTransformSites.includes("Taskflow") ? (
                  <div
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: 10,
                      padding: "11px 14px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#6d28d9",
                      }}
                    >
                      Taskflow schema transformation
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 11.5,
                        color: "#7c3aed",
                        lineHeight: 1.45,
                      }}
                    >
                      Products will keep actual item codes and apply the schema
                      transform for slug, SEO, pricing, and status defaults.
                    </p>
                  </div>
                ) : null}
                {selectedTransformSites.includes("Shopify") ? (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "11px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#166534",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <ShoppingBag size={13} /> Shopify schema transformation
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11.5,
                        color: "#15803d",
                        lineHeight: 1.45,
                      }}
                    >
                      Products tagged Shopify will have the same schema transform
                      applied.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedWebsites.length > 0 ? (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${TOKEN.border}`,
                  background: TOKEN.bg,
                  padding: "10px 14px",
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: TOKEN.textSec }}>
                  <span style={{ fontWeight: 700, color: TOKEN.textPri }}>
                    {selectedCount} product{selectedCount !== 1 ? "s" : ""}
                  </span>{" "}
                  will be added to{" "}
                  <span style={{ fontWeight: 700, color: TOKEN.textPri }}>
                    {selectedWebsites.length} website
                    {selectedWebsites.length !== 1 ? "s" : ""}
                  </span>
                  . Existing assignments are preserved.
                </p>
              </div>
            ) : null}
          </div>

          <div
            style={{
              padding: "14px 22px",
              borderTop: `1px solid ${TOKEN.border}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isAssigning}
              style={outlineBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedWebsites.length === 0 || isAssigning}
              style={{
                ...primaryBtn,
                opacity: selectedWebsites.length === 0 || isAssigning ? 0.6 : 1,
                cursor:
                  selectedWebsites.length === 0 || isAssigning
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isAssigning ? (
                <>
                  <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                  Assigning...
                </>
              ) : (
                <>
                  <Globe size={14} />
                  Assign to{" "}
                  {selectedWebsites.length > 0
                    ? `${selectedWebsites.length} Website${selectedWebsites.length !== 1 ? "s" : ""}`
                    : "Website"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin { to { transform: rotate(360deg); } }
          `,
        }}
      />
    </>
  );
}
