"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TOKEN } from "@/components/layout/tokens";
import { ProductFamilyModal } from "./ProductFamilyModal";
import { ProductClassSelection } from "./ProductClassSelection";
import { ProductFormSheet } from "./ProductFormSheet";
import { TDSPreview } from "./TDSPreview";
import type { ItemCodes } from "@/types/product";
import type { AvailableSpecItem, FlowStep, ProductClass, ProductFormData } from "./types";

export interface ProductFamily {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  specs?: Array<{ specGroupId: string; specItems?: Array<{ name?: string; label?: string }> }>;
  productUsage?: string[];
}

interface AddProductFlowProps {
  productFamilies?: ProductFamily[];
  onSubmit: (data: ProductFormData) => Promise<void> | void;
  onCancel?: () => void;
}

interface SpecGroupDoc {
  id: string;
  name?: string;
  items?: Array<{ label?: string }>;
}

export function AddProductFlow({
  onSubmit,
  onCancel,
}: AddProductFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>("idle");
  const [rawFamilyDocs, setRawFamilyDocs] = useState<ProductFamily[]>([]);
  const [rawSpecGroupDocs, setRawSpecGroupDocs] = useState<SpecGroupDoc[]>([]);
  const [formData, setFormData] = useState<Partial<ProductFormData>>({
    itemCodes: {},
    selectedSpecGroupIds: [],
    availableSpecs: [],
    specValues: {},
    images: [],
    productUsage: [],
    productClass: "",
    productFamilyId: "",
    productFamilyTitle: "",
    itemDescription: "",
    regPrice: "",
    salePrice: "",
    brand: "",
  });

  useEffect(() => {
    const q = query(collection(db, "productfamilies"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setRawFamilyDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "specs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setRawSpecGroupDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const allSpecGroups = useMemo(
    () =>
      rawSpecGroupDocs.map((g) => ({
        id: g.id,
        name: g.name ?? g.id,
        items: (Array.isArray(g.items) ? g.items : [])
          .map((item) => ({ label: (item.label ?? "").trim() }))
          .filter((item) => item.label.length > 0),
      })),
    [rawSpecGroupDocs],
  );

  const handleFamilySelect = useCallback(
    (payload: {
      familyId: string;
      familyTitle: string;
      selectedSpecGroupIds: string[];
      availableSpecs: AvailableSpecItem[];
      productUsage: string[];
    }) => {
      setFormData((prev) => ({
        ...prev,
        productFamilyId: payload.familyId,
        productFamilyTitle: (payload.familyTitle ?? "").toUpperCase(),
        selectedSpecGroupIds: payload.selectedSpecGroupIds,
        availableSpecs: payload.availableSpecs,
        productUsage: payload.productUsage,
      }));
      setCurrentStep("class-selection");
    },
    [],
  );

  const handleClassSelect = useCallback((productClass: ProductClass) => {
    setFormData((prev) => ({
      ...prev,
      productClass,
    }));
    setCurrentStep("form");
  }, []);

  const handleFormSubmit = useCallback((data: Partial<ProductFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep("preview");
  }, []);

  const handlePreviewConfirm = useCallback(async () => {
    if (!formData.productFamilyId || !formData.productFamilyTitle) return;
    const completeData: ProductFormData = {
      productFamilyId: formData.productFamilyId,
      productFamilyTitle: formData.productFamilyTitle,
      productUsage: formData.productUsage ?? [],
      selectedSpecGroupIds: formData.selectedSpecGroupIds ?? [],
      availableSpecs: formData.availableSpecs ?? [],
      productClass: formData.productClass ?? "",
      itemDescription: formData.itemDescription ?? "",
      itemCodes: (formData.itemCodes ?? {}) as ItemCodes,
      specValues: formData.specValues ?? {},
      mainImageFile: formData.mainImageFile,
      rawImageFile: formData.rawImageFile,
      images: formData.images ?? [],
      dimensionalDrawingImageFile: formData.dimensionalDrawingImageFile,
      recommendedMountingHeightImageFile: formData.recommendedMountingHeightImageFile,
      driverCompatibilityImageFile: formData.driverCompatibilityImageFile,
      baseImageFile: formData.baseImageFile,
      illuminanceLevelImageFile: formData.illuminanceLevelImageFile,
      wiringDiagramImageFile: formData.wiringDiagramImageFile,
      installationImageFile: formData.installationImageFile,
      wiringLayoutImageFile: formData.wiringLayoutImageFile,
      terminalLayoutImageFile: formData.terminalLayoutImageFile,
      accessoriesImageFile: formData.accessoriesImageFile,
      regPrice: formData.regPrice ?? "",
      salePrice: formData.salePrice ?? "",
      brand: formData.brand ?? "",
    };

    try {
      await onSubmit(completeData);
      setCurrentStep("idle");
      setFormData({
        itemCodes: {},
        selectedSpecGroupIds: [],
        availableSpecs: [],
        specValues: {},
        images: [],
        productUsage: [],
        productClass: "",
        productFamilyId: "",
        productFamilyTitle: "",
        itemDescription: "",
        regPrice: "",
        salePrice: "",
        brand: "",
      });
    } catch {
      // Parent handles toast + keeping user on preview state.
    }
  }, [formData, onSubmit]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case "class-selection":
        setCurrentStep("family-selection");
        break;
      case "form":
        setCurrentStep("class-selection");
        break;
      case "preview":
        setCurrentStep("form");
        break;
      default:
        break;
    }
  }, [currentStep]);

  const handleReset = useCallback(() => {
    setFormData({
      itemCodes: {},
      selectedSpecGroupIds: [],
      availableSpecs: [],
      specValues: {},
      images: [],
      productUsage: [],
      productClass: "",
      productFamilyId: "",
      productFamilyTitle: "",
      itemDescription: "",
      regPrice: "",
      salePrice: "",
      brand: "",
    });
    setCurrentStep("idle");
    onCancel?.();
  }, [onCancel]);

  return (
    <>
      {currentStep === "idle" && (
        <button
          onClick={() => setCurrentStep("family-selection")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            background: TOKEN.primary,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add New Product
        </button>
      )}

      <ProductFamilyModal
        isOpen={currentStep === "family-selection"}
        onClose={handleReset}
        rawFamilyDocs={rawFamilyDocs}
        rawSpecGroupDocs={rawSpecGroupDocs}
        onSelect={handleFamilySelect}
      />

      {currentStep === "class-selection" && (
        <ProductClassSelection
          onSelect={handleClassSelect}
          onBack={handleBack}
          onCancel={handleReset}
        />
      )}

      {currentStep === "form" && (
        <ProductFormSheet
          isOpen={true}
          onClose={handleReset}
          onSubmit={handleFormSubmit}
          onBack={handleBack}
          formData={formData}
          allSpecGroups={allSpecGroups}
        />
      )}

      {currentStep === "preview" && (
        <TDSPreview
          isOpen={true}
          onClose={handleReset}
          onConfirm={handlePreviewConfirm}
          onBack={handleBack}
          formData={formData as ProductFormData}
        />
      )}
    </>
  );
}

export type { ProductClass, ProductFormData };
