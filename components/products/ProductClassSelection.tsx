"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import type { ProductClass } from "./types";

interface ProductClassSelectionProps {
  onSelect: (productClass: ProductClass) => void;
  onBack: () => void;
  onCancel: () => void;
}

interface ClassOption {
  value: ProductClass;
  label: string;
  description: string;
  icon: string;
}

const productClasses: ClassOption[] = [
  { value: "standard", label: "Standard", description: "Regular production items with standard specifications and pricing", icon: "📦" },
  { value: "spf", label: "SPF", description: "Special Purpose Formulation items for specific applications", icon: "⚗️" },
  { value: "nonstandard", label: "Non-Standard", description: "Tailored products with unique formulations and pricing", icon: "🛠️" },
  { value: "UCL", label: "UCL", description: "Fully customized products designed to meet specific customer requirements", icon: "🎨" },
];

const outlineBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface, fontSize: 13, fontWeight: 600,
  cursor: "pointer", color: TOKEN.textPri,
  display: "inline-flex", alignItems: "center", gap: 6,
};

export function ProductClassSelection({ onSelect, onBack, onCancel }: ProductClassSelectionProps) {
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          key="class-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 500,
          }}
        />

        {/* Centered dialog wrapper */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 501,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, pointerEvents: "none",
        }}>
          <motion.div
            key="class-dialog"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={SPRING_MED}
            style={{
              pointerEvents: "auto",
              width: "100%", maxWidth: 820,
              background: TOKEN.surface,
              borderRadius: 20,
              border: `1px solid ${TOKEN.border}`,
              boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "22px 28px", borderBottom: `1px solid ${TOKEN.border}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <button
                onClick={onBack}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: TOKEN.textSec, padding: 6, borderRadius: 8,
                  display: "flex", alignItems: "center",
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TOKEN.textPri }}>
                  Select Product Class
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: TOKEN.textSec }}>
                  Choose the classification that best describes this product
                </p>
              </div>
            </div>

            {/* Class grid */}
            <div style={{ padding: "22px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {productClasses.map((cls) => (
                  <div
                    key={cls.value}
                    onClick={() => onSelect(cls.value)}
                    onMouseEnter={() => setHoveredClass(cls.value)}
                    onMouseLeave={() => setHoveredClass(null)}
                    style={{
                      border: `1px solid ${hoveredClass === cls.value ? TOKEN.primary : TOKEN.border}`,
                      borderRadius: 12, padding: "18px 20px", cursor: "pointer",
                      background: TOKEN.surface,
                      boxShadow: hoveredClass === cls.value ? `0 4px 16px ${TOKEN.primary}15` : "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      display: "flex", alignItems: "flex-start", gap: 14,
                    }}
                  >
                    <div style={{ fontSize: 32, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>{cls.icon}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: TOKEN.textPri }}>{cls.label}</p>
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: TOKEN.textSec, lineHeight: 1.55 }}>
                        {cls.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 28px", borderTop: `1px solid ${TOKEN.border}`,
              display: "flex", justifyContent: "space-between",
            }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} style={outlineBtn} onClick={onCancel}>
                Cancel
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} style={{ ...outlineBtn, color: TOKEN.textSec }} onClick={onBack}>
                Back to Family Selection
              </motion.button>
            </div>
          </motion.div>
        </div>
      </>
    </AnimatePresence>
  );
}
