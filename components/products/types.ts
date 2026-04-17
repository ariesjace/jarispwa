/**
 * Product Creation Flow - Type Definitions
 * 
 * Centralized type definitions for the new product creation flow.
 * These types ensure consistency across all components and preserve
 * the business logic from the legacy add-new-product-form component.
 */

/**
 * Product Classification Types
 * These are the four allowed product classes in the system
 */
export type ProductClass = "standard" | "nonstandard" | "spf" | "usl";

/**
 * Specification Item Type
 * Defines the type of input control for a specification field
 */
export type SpecItemType = "text" | "number" | "select";

/**
 * Individual Specification Item
 * Represents a single specification field within a spec group
 */
export interface SpecItem {
  /** Unique identifier for the spec item */
  id: string;
  
  /** Display label for the spec field */
  label: string;
  
  /** Type of input control (text, number, or select dropdown) */
  type: SpecItemType;
  
  /** Available options (required when type is "select") */
  options?: string[];
  
  /** Whether this field is required for submission */
  required?: boolean;
  
  /** Optional placeholder text */
  placeholder?: string;
  
  /** Optional help text or description */
  helpText?: string;
  
  /** Validation rules (e.g., min/max for numbers, regex for text) */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * Specification Group
 * Groups related specification items together
 */
export interface SpecGroup {
  /** Unique identifier for the spec group */
  id: string;
  
  /** Display label for the group */
  label: string;
  
  /** Optional description of the group */
  description?: string;
  
  /** Specification items within this group */
  items: SpecItem[];
  
  /** Whether this entire group is optional */
  optional?: boolean;
}

/**
 * Product Family
 * Represents a family of related products with shared specifications
 */
export interface ProductFamily {
  /** Unique identifier for the product family */
  id: string;
  
  /** Display name of the product family */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** Available specification groups for this family */
  availableSpecGroups: SpecGroup[];
  
  /** Optional metadata */
  metadata?: {
    /** Image URL for the family */
    imageUrl?: string;
    
    /** Category or department */
    category?: string;
    
    /** Number of products in this family */
    productCount?: number;
  };
}

/**
 * Complete Product Form Data
 * The final data structure submitted when creating a new product
 * 
 * CRITICAL: This structure must match the legacy component's output
 * to ensure backend compatibility
 */
export interface ProductFormData {
  /** Selected product family ID */
  productFamilyId: string;
  
  /** Selected product classification */
  productClass: ProductClass;
  
  /** REQUIRED: Detailed product description */
  itemDescription: string;
  
  /** REQUIRED: Array of product codes/identifiers */
  itemCodes: string[];
  
  /** IDs of selected specification groups */
  selectedSpecGroups: string[];
  
  /** Map of spec item ID to its value */
  specValues: Record<string, any>;
  
  /** Uploaded product images */
  images: File[];
  
  /** Optional additional metadata */
  metadata?: {
    /** Created by user ID */
    createdBy?: string;
    
    /** Creation timestamp */
    createdAt?: Date;
    
    /** Draft status */
    isDraft?: boolean;
  };
}

/**
 * Product Form Validation Errors
 * Map of field IDs to error messages
 */
export interface ValidationErrors {
  [fieldId: string]: string;
}

/**
 * Flow Step Type
 * Represents the current step in the product creation flow
 */
export type FlowStep =
  | "idle"
  | "family-selection"
  | "class-selection"
  | "form"
  | "preview"
  | "complete"
  | "error";

/**
 * Flow State
 * Tracks the complete state of the product creation flow
 */
export interface FlowState {
  /** Current step in the flow */
  currentStep: FlowStep;
  
  /** Accumulated form data */
  formData: Partial<ProductFormData>;
  
  /** Validation errors */
  errors: ValidationErrors;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error message (if any) */
  errorMessage?: string;
}

/**
 * TDS (Technical Data Sheet) Generation Options
 */
export interface TDSOptions {
  /** Include images in the TDS */
  includeImages?: boolean;
  
  /** Format of the output (html, pdf, etc.) */
  format?: "html" | "pdf";
  
  /** Template to use */
  template?: string;
  
  /** Company branding options */
  branding?: {
    logo?: string;
    companyName?: string;
    contactInfo?: string;
  };
}

/**
 * Product Submission Response
 * Expected response from the backend after product creation
 */
export interface ProductSubmissionResponse {
  /** Whether the submission was successful */
  success: boolean;
  
  /** Created product ID */
  productId?: string;
  
  /** Generated TDS URL */
  tdsUrl?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Validation errors (if failed) */
  validationErrors?: ValidationErrors;
}

/**
 * Component Props Types
 */
export interface AddProductFlowProps {
  /** Available product families */
  productFamilies: ProductFamily[];
  
  /** Submit handler */
  onSubmit: (data: ProductFormData) => Promise<void>;
  
  /** Cancel handler */
  onCancel?: () => void;
  
  /** Initial data (for editing) */
  initialData?: Partial<ProductFormData>;
}

export interface ProductFamilyModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  
  /** Close handler */
  onClose: () => void;
  
  /** Available product families */
  productFamilies: ProductFamily[];
  
  /** Selection handler */
  onSelect: (familyId: string, selectedSpecGroups: string[]) => void;
  
  /** Pre-selected family (for editing) */
  selectedFamilyId?: string;
}

export interface ProductClassSelectionProps {
  /** Selection handler */
  onSelect: (productClass: ProductClass) => void;
  
  /** Back navigation handler */
  onBack: () => void;
  
  /** Cancel handler */
  onCancel: () => void;
  
  /** Pre-selected class (for editing) */
  selectedClass?: ProductClass;
}

export interface ProductFormSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  
  /** Close handler */
  onClose: () => void;
  
  /** Form submission handler */
  onSubmit: (data: Partial<ProductFormData>) => void;
  
  /** Back navigation handler */
  onBack: () => void;
  
  /** Selected product family */
  productFamily: ProductFamily;
  
  /** Active specification groups */
  specGroups: SpecGroup[];
  
  /** Initial form data */
  initialData?: Partial<ProductFormData>;
}

export interface TDSPreviewProps {
  /** Whether the preview is open */
  isOpen: boolean;
  
  /** Close handler */
  onClose: () => void;
  
  /** Confirmation handler */
  onConfirm: () => Promise<void>;
  
  /** Back navigation handler */
  onBack: () => void;
  
  /** Complete form data */
  formData: ProductFormData;
  
  /** Product family */
  productFamily: ProductFamily;
  
  /** TDS generation options */
  options?: TDSOptions;
}

/**
 * Utility Types
 */

/** Extract the value type from a spec item based on its type */
export type SpecItemValue<T extends SpecItemType> = 
  T extends "number" ? number :
  T extends "text" ? string :
  T extends "select" ? string :
  never;

/** Type guard to check if a value is a valid ProductClass */
export function isProductClass(value: any): value is ProductClass {
  return ["standard", "nonstandard", "spf", "usl"].includes(value);
}

/** Type guard to check if a value is a valid SpecItemType */
export function isSpecItemType(value: any): value is SpecItemType {
  return ["text", "number", "select"].includes(value);
}

/** Helper type for partial form data during multi-step flow */
export type PartialProductFormData = Partial<ProductFormData>;

/** Helper type for required fields only */
export type RequiredProductFields = Pick<
  ProductFormData,
  "itemDescription" | "itemCodes" | "productFamilyId" | "productClass"
>;
