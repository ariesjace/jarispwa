"use client";

import { useState } from "react";
import { TOKEN } from "@/components/layout/tokens";
import { ProductFamilyModal } from "./ProductFamilyModal";
import { ProductClassSelection } from "./ProductClassSelection";
import { ProductFormSheet } from "./ProductFormSheet";
import { TDSPreview } from "./TDSPreview";

export type ProductClass = "standard" | "nonstandard" | "spf" | "usl";

export interface SpecItem {
  id: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
}

export interface SpecGroup {
  id: string;
  label: string;
  items: SpecItem[];
}

export interface ProductFamily {
  id: string;
  name: string;
  description?: string;
  availableSpecGroups: SpecGroup[];
}

export interface ProductFormData {
  productFamilyId: string;
  productClass: ProductClass;
  itemDescription: string;
  itemCodes: Record<string, string>; // { LIT: "", ECO: "", ZUM: "", LUM: "" }
  selectedSpecGroups: string[];
  specValues: Record<string, any>;
  images: File[];
}

type FlowStep =
  | "idle"
  | "family-selection"
  | "class-selection"
  | "form"
  | "preview"
  | "complete";

interface AddProductFlowProps {
  productFamilies: ProductFamily[];
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel?: () => void;
}

export function AddProductFlow({
  productFamilies,
  onSubmit,
  onCancel,
}: AddProductFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>("idle");
  const [formData, setFormData] = useState<Partial<ProductFormData>>({
    itemCodes: {} as Record<string, string>,
    selectedSpecGroups: [],
    specValues: {},
    images: [],
  });

  // Get the selected product family
  const selectedFamily = productFamilies.find(
    (f) => f.id === formData.productFamilyId
  );

  // Get filtered spec groups based on selection
  const activeSpecGroups = selectedFamily?.availableSpecGroups.filter((group) =>
    formData.selectedSpecGroups?.includes(group.id)
  );

  const handleFamilySelect = (
    familyId: string,
    selectedGroups: string[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      productFamilyId: familyId,
      selectedSpecGroups: selectedGroups,
    }));
    setCurrentStep("class-selection");
  };

  const handleClassSelect = (productClass: ProductClass) => {
    setFormData((prev) => ({
      ...prev,
      productClass,
    }));
    setCurrentStep("form");
  };

  const handleFormSubmit = (data: Partial<ProductFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
    setCurrentStep("preview");
  };

  const handlePreviewConfirm = async () => {
    if (formData as ProductFormData) {
      await onSubmit(formData as ProductFormData);
      setCurrentStep("complete");
    }
  };

  const handleBack = () => {
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
  };

  const handleReset = () => {
    setFormData({
      itemCodes: {} as Record<string, string>,
      selectedSpecGroups: [],
      specValues: {},
      images: [],
    });
    setCurrentStep("idle");
    onCancel?.();
  };

  return (
    <>
      {/* Entry Point Button */}
      {currentStep === "idle" && (
        <button
          onClick={() => setCurrentStep("family-selection")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 12, border: "none",
            background: TOKEN.primary, color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Add New Product
        </button>
      )}

      {/* Step 1: Product Family Selection Modal */}
      <ProductFamilyModal
        isOpen={currentStep === "family-selection"}
        onClose={handleReset}
        productFamilies={productFamilies}
        onSelect={handleFamilySelect}
      />

      {/* Step 2: Product Class Selection */}
      {currentStep === "class-selection" && (
        <ProductClassSelection
          onSelect={handleClassSelect}
          onBack={handleBack}
          onCancel={handleReset}
        />
      )}

      {/* Step 3: Product Form (Fullscreen Sheet) */}
      {currentStep === "form" && selectedFamily && (
        <ProductFormSheet
          isOpen={true}
          onClose={handleReset}
          onSubmit={handleFormSubmit}
          onBack={handleBack}
          productFamily={selectedFamily}
          specGroups={activeSpecGroups || []}
          initialData={formData}
        />
      )}

      {/* Step 4: TDS Preview */}
      {currentStep === "preview" && selectedFamily && (
        <TDSPreview
          isOpen={true}
          onClose={handleReset}
          onConfirm={handlePreviewConfirm}
          onBack={handleBack}
          formData={formData as ProductFormData}
          productFamily={selectedFamily}
        />
      )}
    </>
  );
}
