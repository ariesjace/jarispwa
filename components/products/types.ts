import type { ItemCodes } from "@/types/product";

export type ProductClass = "spf" | "standard" | "";

export interface ProductFormData {
  productFamilyId: string;
  productFamilyTitle: string;
  productUsage: string[];
  selectedSpecGroupIds: string[];
  availableSpecs: AvailableSpecItem[];
  productClass: ProductClass;
  itemDescription: string;
  itemCodes: ItemCodes;
  specValues: Record<string, string>;
  mainImageFile?: File;
  rawImageFile?: File;
  images: File[];
  brand: string;
}

export interface AvailableSpecItem {
  specGroupId: string;
  specGroup: string;
  label: string;
  id: string;
}

export interface ValidationErrors {
  [field: string]: string;
}

export type FlowStep =
  | "idle"
  | "family-selection"
  | "class-selection"
  | "form"
  | "preview";
