"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check, X } from "lucide-react";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import type { ProductFamily } from "./AddProductFlow";

interface ProductFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  productFamilies: ProductFamily[];
  onSelect: (familyId: string, selectedSpecGroups: string[]) => void;
}

// ── Shared styles (matching FamiliesForm / deletedialog) ──────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: TOKEN.textSec, textTransform: "uppercase", marginBottom: 7,
};

const outlineBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface, fontSize: 13, fontWeight: 600,
  cursor: "pointer", color: TOKEN.textPri,
  display: "inline-flex", alignItems: "center", gap: 6,
};

export function ProductFamilyModal({
  isOpen, onClose, productFamilies, onSelect,
}: ProductFamilyModalProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedSpecGroups, setSelectedSpecGroups] = useState<Set<string>>(new Set());
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const selectedFamily = productFamilies.find((f) => f.id === selectedFamilyId);

  const handleFamilySelect = (familyId: string) => {
    setSelectedFamilyId(familyId);
    const family = productFamilies.find((f) => f.id === familyId);
    if (family) setSelectedSpecGroups(new Set(family.availableSpecGroups.map((g) => g.id)));
  };

  const toggleSpecGroup = (groupId: string) => {
    setSelectedSpecGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const handleContinue = () => {
    if (selectedFamilyId && selectedSpecGroups.size > 0) {
      onSelect(selectedFamilyId, Array.from(selectedSpecGroups));
      setSelectedFamilyId(null);
      setSelectedSpecGroups(new Set());
    }
  };

  const handleBack = () => {
    if (selectedFamilyId) {
      setSelectedFamilyId(null);
      setSelectedSpecGroups(new Set());
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="family-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBack}
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
              key="family-dialog"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={SPRING_MED}
              style={{
                pointerEvents: "auto",
                width: "100%", maxWidth: 860,
                maxHeight: "88vh",
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "22px 28px 18px",
                borderBottom: `1px solid ${TOKEN.border}`,
                display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                flexShrink: 0,
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TOKEN.textPri }}>
                    {selectedFamilyId ? "Configure Specifications" : "Select Product Family"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: TOKEN.textSec }}>
                    {selectedFamilyId
                      ? "Choose which specification groups to include"
                      : "Select a product family to get started"}
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: TOKEN.textSec, padding: 6, borderRadius: 8,
                    display: "flex", marginLeft: 16,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>
                {!selectedFamilyId ? (
                  /* ── Family grid ── */
                  <>
                    <label style={labelStyle}>Choose a family</label>
                    {productFamilies.length === 0 ? (
                      <p style={{ textAlign: "center", color: TOKEN.textSec, fontSize: 13, padding: "32px 0" }}>
                        No product families available. Create one in the Families page first.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                        {productFamilies.map((family) => (
                          <div
                            key={family.id}
                            onClick={() => handleFamilySelect(family.id)}
                            onMouseEnter={() => setHoveredCard(family.id)}
                            onMouseLeave={() => setHoveredCard(null)}
                            style={{
                              border: `1px solid ${hoveredCard === family.id ? TOKEN.primary : TOKEN.border}`,
                              borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                              background: TOKEN.surface,
                              boxShadow: hoveredCard === family.id ? `0 4px 16px ${TOKEN.primary}15` : "none",
                              transition: "border-color 0.15s, box-shadow 0.15s",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: TOKEN.textPri }}>
                                  {family.name}
                                </p>
                                {family.description && (
                                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: TOKEN.textSec, lineHeight: 1.5 }}>
                                    {family.description}
                                  </p>
                                )}
                              </div>
                              <ChevronRight size={16} color={TOKEN.textSec} style={{ flexShrink: 0, marginTop: 3 }} />
                            </div>
                            {family.availableSpecGroups.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                                {family.availableSpecGroups.slice(0, 4).map((g) => (
                                  <span key={g.id} style={{
                                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                    background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, color: TOKEN.textSec,
                                    textTransform: "uppercase",
                                  }}>
                                    {g.label}
                                  </span>
                                ))}
                                {family.availableSpecGroups.length > 4 && (
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                    background: `${TOKEN.primary}10`, border: `1px solid ${TOKEN.primary}30`,
                                    color: TOKEN.primary,
                                  }}>
                                    +{family.availableSpecGroups.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Spec group config ── */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Selected family tag */}
                    <div style={{
                      background: TOKEN.bg, border: `1px solid ${TOKEN.border}`,
                      borderRadius: 10, padding: "12px 16px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TOKEN.textPri }}>{selectedFamily?.name}</p>
                        {selectedFamily?.description && (
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>{selectedFamily.description}</p>
                        )}
                      </div>
                      <button onClick={() => setSelectedFamilyId(null)} style={{ ...outlineBtn, padding: "5px 12px", fontSize: 11, borderRadius: 7 }}>
                        Change
                      </button>
                    </div>

                    <label style={labelStyle}>Specification groups</label>

                    {selectedFamily?.availableSpecGroups.map((group) => {
                      const isSelected = selectedSpecGroups.has(group.id);
                      return (
                        <div
                          key={group.id}
                          onClick={() => toggleSpecGroup(group.id)}
                          style={{
                            border: `1px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                            background: isSelected ? `${TOKEN.primary}05` : TOKEN.surface,
                            borderRadius: 10, padding: "13px 16px", cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            {/* Checkbox */}
                            <div style={{
                              width: 17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 2,
                              border: `1.5px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                              background: isSelected ? TOKEN.primary : TOKEN.surface,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s",
                            }}>
                              {isSelected && <Check size={10} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TOKEN.textPri }}>{group.label}</p>
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                                {group.items.length} specification{group.items.length !== 1 ? "s" : ""}
                              </p>
                              {group.items.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                                  {group.items.map((item) => (
                                    <span key={item.id} style={{
                                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                      background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, color: TOKEN.textSec,
                                      textTransform: "uppercase",
                                    }}>
                                      {item.label}
                                      {item.required && <span style={{ color: TOKEN.danger, marginLeft: 2 }}>*</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {selectedSpecGroups.size === 0 && (
                      <div style={{
                        background: TOKEN.dangerBg, border: `1px solid ${TOKEN.danger}30`,
                        borderRadius: 10, padding: "11px 16px", textAlign: "center",
                      }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TOKEN.dangerText }}>
                          Select at least one specification group to continue
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: "16px 28px", borderTop: `1px solid ${TOKEN.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
              }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} style={outlineBtn} onClick={handleBack}>
                  {selectedFamilyId ? "Back" : "Cancel"}
                </motion.button>
                {selectedFamilyId && (
                  <motion.button
                    whileHover={{ scale: selectedSpecGroups.size > 0 ? 1.02 : 1 }}
                    whileTap={{ scale: selectedSpecGroups.size > 0 ? 0.97 : 1 }}
                    onClick={handleContinue}
                    disabled={selectedSpecGroups.size === 0}
                    style={{
                      padding: "9px 20px", borderRadius: 10, border: "none",
                      background: selectedSpecGroups.size > 0 ? TOKEN.primary : TOKEN.border,
                      color: selectedSpecGroups.size > 0 ? "#fff" : TOKEN.textSec,
                      fontSize: 13, fontWeight: 700, cursor: selectedSpecGroups.size > 0 ? "pointer" : "not-allowed",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      opacity: selectedSpecGroups.size === 0 ? 0.5 : 1,
                    }}
                  >
                    Continue to Product Class
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
