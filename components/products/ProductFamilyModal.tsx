"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check, X, Search } from "lucide-react";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import type { AvailableSpecItem } from "./types";

interface RawSpecItem {
  id?: string;
  name?: string;
  label?: string;
}

interface RawFamilySpecGroup {
  specGroupId: string;
  specItems?: RawSpecItem[];
}

interface RawFamilyDoc {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  specs?: RawFamilySpecGroup[];
  productUsage?: string[];
}

interface RawSpecGroupDoc {
  id: string;
  name?: string;
}

interface ProductFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawFamilyDocs: RawFamilyDoc[];
  rawSpecGroupDocs: RawSpecGroupDoc[];
  onSelect: (payload: {
    familyId: string;
    familyTitle: string;
    selectedSpecGroupIds: string[];
    availableSpecs: AvailableSpecItem[];
    productUsage: string[];
  }) => void;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: TOKEN.textSec,
  textTransform: "uppercase",
  marginBottom: 7,
};

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

export function ProductFamilyModal({
  isOpen,
  onClose,
  rawFamilyDocs,
  rawSpecGroupDocs,
  onSelect,
}: ProductFamilyModalProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedSpecGroups, setSelectedSpecGroups] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState("");

  const selectedFamily = rawFamilyDocs.find((f) => f.id === selectedFamilyId);

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return rawFamilyDocs;
    return rawFamilyDocs.filter(
      (f) =>
        (f.title ?? f.name ?? "").toLowerCase().includes(familySearch.toLowerCase()) ||
        f.description?.toLowerCase().includes(familySearch.toLowerCase()),
    );
  }, [rawFamilyDocs, familySearch]);

  const resolveGroupName = (specGroupId: string): string => {
    const group = rawSpecGroupDocs.find((g) => g.id === specGroupId);
    return group?.name ?? specGroupId;
  };

  const resolveAvailableSpecs = (
    family: RawFamilyDoc,
    specGroupDocs: RawSpecGroupDoc[],
    selectedGroupIds?: Set<string>,
  ): AvailableSpecItem[] => {
    const specs: AvailableSpecItem[] = [];
    const seenSpecIds = new Map<string, number>();
    const familySpecs = Array.isArray(family.specs) ? family.specs : [];

    for (const groupRef of familySpecs) {
      if (selectedGroupIds && !selectedGroupIds.has(groupRef.specGroupId)) {
        continue;
      }
      const groupDoc = specGroupDocs.find((g) => g.id === groupRef.specGroupId);
      const groupName = groupDoc?.name ?? groupRef.specGroupId;
      const specItems = Array.isArray(groupRef.specItems) ? groupRef.specItems : [];

      for (const item of specItems) {
        const label = (item.name ?? item.label ?? "").toUpperCase().trim();
        if (!label) continue;
        const baseId = `${groupRef.specGroupId}:${label}`;
        const seenCount = seenSpecIds.get(baseId) ?? 0;
        seenSpecIds.set(baseId, seenCount + 1);
        specs.push({
          specGroupId: groupRef.specGroupId,
          specGroup: groupName,
          label,
          id: seenCount === 0 ? baseId : `${baseId}#${seenCount}`,
        });
      }
    }
    return specs;
  };

  const handleFamilySelect = (familyId: string) => {
    setSelectedFamilyId(familyId);
    setFamilySearch("");
    const family = rawFamilyDocs.find((f) => f.id === familyId);
    const familySpecs = Array.isArray(family?.specs) ? family.specs : [];
    setSelectedSpecGroups(
      new Set(
        familySpecs
          .map((g) => g?.specGroupId)
          .filter((id: string | undefined) => !!id),
      ),
    );
  };

  const toggleSpecGroup = (groupId: string) => {
    setSelectedSpecGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (selectedFamily && selectedSpecGroups.size > 0) {
      onSelect({
        familyId: selectedFamily.id,
        familyTitle: selectedFamily.title ?? selectedFamily.name ?? "",
        selectedSpecGroupIds: Array.from(selectedSpecGroups),
        availableSpecs: resolveAvailableSpecs(
          selectedFamily,
          rawSpecGroupDocs,
          selectedSpecGroups,
        ),
        productUsage: Array.isArray(selectedFamily.productUsage)
          ? selectedFamily.productUsage
          : [],
      });
      setSelectedFamilyId(null);
      setSelectedSpecGroups(new Set());
      setFamilySearch("");
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
          <motion.div
            key="family-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBack}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 500,
            }}
          />

          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 501,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="family-dialog"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={SPRING_MED}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 860,
                maxHeight: "88vh",
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "22px 28px 18px",
                  borderBottom: `1px solid ${TOKEN.border}`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: TOKEN.textPri,
                    }}
                  >
                    {selectedFamilyId ? "Configure Specifications" : "Select Product Family"}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12.5,
                      color: TOKEN.textSec,
                    }}
                  >
                    {selectedFamilyId ? "Choose which specification groups to include" : "Select a product family to get started"}
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                    padding: 6,
                    borderRadius: 8,
                    display: "flex",
                    marginLeft: 16,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>
                {!selectedFamilyId ? (
                  <>
                    <div style={{ position: "relative", marginBottom: 18 }}>
                      <Search
                        size={15}
                        color={TOKEN.textSec}
                        style={{
                          position: "absolute",
                          left: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search product families…"
                        value={familySearch}
                        onChange={(e) => setFamilySearch(e.target.value)}
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "10px 36px 10px 40px",
                          fontSize: 13,
                          background: TOKEN.bg,
                          border: `1px solid ${TOKEN.border}`,
                          borderRadius: 12,
                          color: TOKEN.textPri,
                          outline: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                          transition: "border-color 0.15s",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = TOKEN.primary)
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor = TOKEN.border)
                        }
                      />
                      {familySearch && (
                        <button
                          onClick={() => setFamilySearch("")}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: TOKEN.textSec,
                            display: "flex",
                            padding: 4,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <label style={labelStyle}>
                      {filteredFamilies.length} famil{filteredFamilies.length !== 1 ? "ies" : "y"}
                      {familySearch && ` matching "${familySearch}"`}
                    </label>

                    {rawFamilyDocs.length === 0 ? (
                      <p
                        style={{
                          textAlign: "center",
                          color: TOKEN.textSec,
                          fontSize: 13,
                          padding: "32px 0",
                        }}
                      >
                        No product families available. Create one in the
                        Families page first.
                      </p>
                    ) : filteredFamilies.length === 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 10,
                          padding: "48px 0",
                          color: TOKEN.textSec,
                        }}
                      >
                        <Search size={28} style={{ opacity: 0.2 }} />
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: TOKEN.textPri,
                            margin: 0,
                          }}
                        >
                          No families match your search
                        </p>
                        <button
                          onClick={() => setFamilySearch("")}
                          style={{
                            ...outlineBtn,
                            fontSize: 11,
                            padding: "5px 12px",
                          }}
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
                          gap: 12,
                          justifyItems: "stretch",
                        }}
                      >
                        {filteredFamilies.map((family) => (
                          <div
                            key={family.id}
                            onClick={() => handleFamilySelect(family.id)}
                            onMouseEnter={() => setHoveredCard(family.id)}
                            onMouseLeave={() => setHoveredCard(null)}
                            style={{
                              border: `1px solid ${hoveredCard === family.id ? TOKEN.primary : TOKEN.border}`,
                              borderRadius: 12,
                              padding: "16px 18px",
                              cursor: "pointer",
                              background: TOKEN.surface,
                              boxShadow:
                                hoveredCard === family.id
                                  ? `0 4px 16px ${TOKEN.primary}15`
                                  : "none",
                              transition:
                                "border-color 0.15s, box-shadow 0.15s",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: TOKEN.textPri,
                                  }}
                                >
                                  {family.title ?? family.name ?? ""}
                                </p>
                                {family.description && (
                                  <p
                                    style={{
                                      margin: "4px 0 0",
                                      fontSize: 11.5,
                                      color: TOKEN.textSec,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {family.description}
                                  </p>
                                )}
                              </div>
                              <ChevronRight
                                size={16}
                                color={TOKEN.textSec}
                                style={{ flexShrink: 0, marginTop: 3 }}
                              />
                            </div>
                            {(family.specs ?? []).length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 5,
                                  marginTop: 10,
                                }}
                              >
                                {(family.specs ?? [])
                                  .slice(0, 4)
                                  .map((g, idx) => (
                                    <span
                                      key={`${g.specGroupId}-${idx}`}
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: "2px 7px",
                                        borderRadius: 5,
                                        background: TOKEN.bg,
                                        border: `1px solid ${TOKEN.border}`,
                                        color: TOKEN.textSec,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {resolveGroupName(g.specGroupId)}
                                    </span>
                                  ))}
                                {(family.specs ?? []).length > 4 && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: "2px 7px",
                                      borderRadius: 5,
                                      background: `${TOKEN.primary}10`,
                                      border: `1px solid ${TOKEN.primary}30`,
                                      color: TOKEN.primary,
                                    }}
                                  >
                                    +{(family.specs ?? []).length - 4} more
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: TOKEN.bg,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 10,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 700,
                            color: TOKEN.textPri,
                          }}
                        >
                          {selectedFamily?.title ?? selectedFamily?.name ?? ""}
                        </p>
                        {selectedFamily?.description && (
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: 11,
                              color: TOKEN.textSec,
                            }}
                          >
                            {selectedFamily.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFamilyId(null);
                          setSelectedSpecGroups(new Set());
                        }}
                        style={{
                          ...outlineBtn,
                          padding: "5px 12px",
                          fontSize: 11,
                          borderRadius: 7,
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <label style={labelStyle}>Specification groups</label>

                    {(Array.isArray(selectedFamily?.specs) ? selectedFamily?.specs : []).map(
                      (group, groupIdx) => {
                      const groupId = group.specGroupId;
                      const isSelected = selectedSpecGroups.has(groupId);
                      const items = Array.isArray(group.specItems) ? group.specItems : [];
                      return (
                        <div
                          key={`${groupId}-${groupIdx}`}
                          onClick={() => toggleSpecGroup(groupId)}
                          style={{
                            border: `1px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                            background: isSelected
                              ? `${TOKEN.primary}05`
                              : TOKEN.surface,
                            borderRadius: 10,
                            padding: "13px 16px",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 17,
                                height: 17,
                                borderRadius: 4,
                                flexShrink: 0,
                                marginTop: 2,
                                border: `1.5px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                                background: isSelected
                                  ? TOKEN.primary
                                  : TOKEN.surface,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s",
                              }}
                            >
                              {isSelected && <Check size={10} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: TOKEN.textPri,
                                }}
                              >
                                {resolveGroupName(groupId)}
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  fontSize: 11,
                                  color: TOKEN.textSec,
                                }}
                              >
                                {items.length} specification{items.length !== 1 ? "s" : ""}
                              </p>
                              {items.length > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 5,
                                    marginTop: 8,
                                  }}
                                >
                                  {items.map((item, itemIdx) => {
                                    const label = (
                                      item.name ??
                                      item.label ??
                                      ""
                                    )
                                      .toUpperCase()
                                      .trim();
                                    if (!label) return null;
                                    return (
                                    <span
                                      key={`${groupId}-${item.id ?? label}-${itemIdx}`}
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: "2px 7px",
                                        borderRadius: 5,
                                        background: TOKEN.bg,
                                        border: `1px solid ${TOKEN.border}`,
                                        color: TOKEN.textSec,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {label}
                                    </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {selectedSpecGroups.size === 0 && (
                      <div
                        style={{
                          background: TOKEN.dangerBg,
                          border: `1px solid ${TOKEN.danger}30`,
                          borderRadius: 10,
                          padding: "11px 16px",
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: TOKEN.dangerText,
                          }}
                        >
                          Select at least one specification group to continue
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "16px 28px",
                  borderTop: `1px solid ${TOKEN.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={outlineBtn}
                  onClick={handleBack}
                >
                  {selectedFamilyId ? "Back" : "Cancel"}
                </motion.button>
                {selectedFamilyId && (
                  <motion.button
                    whileHover={{
                      scale: selectedSpecGroups.size > 0 ? 1.02 : 1,
                    }}
                    whileTap={{ scale: selectedSpecGroups.size > 0 ? 0.97 : 1 }}
                    onClick={handleContinue}
                    disabled={selectedSpecGroups.size === 0}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 10,
                      border: "none",
                      background:
                        selectedSpecGroups.size > 0
                          ? TOKEN.primary
                          : TOKEN.border,
                      color:
                        selectedSpecGroups.size > 0 ? "#fff" : TOKEN.textSec,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor:
                        selectedSpecGroups.size > 0 ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: selectedSpecGroups.size === 0 ? 0.5 : 1,
                    }}
                  >
                    Continue
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
