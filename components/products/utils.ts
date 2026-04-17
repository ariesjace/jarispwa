/**
 * Product Creation Flow - Utilities
 * 
 * Helper functions for validation, data transformation, and common operations
 * across the product creation flow components.
 */

import type {
  ProductFormData,
  ValidationErrors,
  SpecGroup,
  SpecItem,
  ProductFamily,
} from "./types";

/**
 * Validation Utilities
 */

/**
 * Validate required fields in the product form
 */
export function validateRequiredFields(
  formData: Partial<ProductFormData>
): ValidationErrors {
  const errors: ValidationErrors = {};

  // Required: itemDescription
  if (!formData.itemDescription?.trim()) {
    errors.itemDescription = "Item description is required";
  }

  // Required: at least one non-empty itemCode
  const validCodes = formData.itemCodes?.filter((code) => code.trim()) || [];
  if (validCodes.length === 0) {
    errors.itemCodes = "At least one item code is required";
  }

  // Required: productFamilyId
  if (!formData.productFamilyId) {
    errors.productFamilyId = "Product family must be selected";
  }

  // Required: productClass
  if (!formData.productClass) {
    errors.productClass = "Product class must be selected";
  }

  return errors;
}

/**
 * Validate specification values based on their definitions
 */
export function validateSpecifications(
  specGroups: SpecGroup[],
  specValues: Record<string, any>
): ValidationErrors {
  const errors: ValidationErrors = {};

  specGroups.forEach((group) => {
    group.items.forEach((item) => {
      const value = specValues[item.id];

      // Check required fields
      if (item.required && !value) {
        errors[item.id] = `${item.label} is required`;
        return;
      }

      // Skip validation for empty optional fields
      if (!value) return;

      // Type-specific validation
      if (item.type === "number") {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors[item.id] = `${item.label} must be a valid number`;
        } else if (item.validation) {
          if (
            item.validation.min !== undefined &&
            numValue < item.validation.min
          ) {
            errors[item.id] = `${item.label} must be at least ${item.validation.min}`;
          }
          if (
            item.validation.max !== undefined &&
            numValue > item.validation.max
          ) {
            errors[item.id] = `${item.label} must be at most ${item.validation.max}`;
          }
        }
      }

      // Text pattern validation
      if (item.type === "text" && item.validation?.pattern) {
        const regex = new RegExp(item.validation.pattern);
        if (!regex.test(value)) {
          errors[item.id] =
            item.validation.message || `${item.label} format is invalid`;
        }
      }

      // Select validation
      if (item.type === "select" && item.options) {
        if (!item.options.includes(value)) {
          errors[item.id] = `${item.label} must be one of the available options`;
        }
      }
    });
  });

  return errors;
}

/**
 * Validate the complete form data
 */
export function validateProductForm(
  formData: Partial<ProductFormData>,
  specGroups: SpecGroup[]
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {
    ...validateRequiredFields(formData),
    ...validateSpecifications(specGroups, formData.specValues || {}),
  };

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Data Transformation Utilities
 */

/**
 * Transform form data for API submission
 * Cleans up and formats the data structure
 */
export function transformForSubmission(
  formData: ProductFormData
): ProductFormData {
  return {
    ...formData,
    // Trim and filter item codes
    itemCodes: formData.itemCodes
      .map((code) => code.trim())
      .filter((code) => code.length > 0),
    // Trim description
    itemDescription: formData.itemDescription.trim(),
    // Remove empty spec values
    specValues: Object.fromEntries(
      Object.entries(formData.specValues).filter(([_, value]) => value !== "")
    ),
  };
}

/**
 * Extract spec items from selected spec groups
 */
export function getActiveSpecItems(
  productFamily: ProductFamily,
  selectedGroupIds: string[]
): SpecItem[] {
  return productFamily.availableSpecGroups
    .filter((group) => selectedGroupIds.includes(group.id))
    .flatMap((group) => group.items);
}

/**
 * Get all required spec items from selected groups
 */
export function getRequiredSpecItems(
  productFamily: ProductFamily,
  selectedGroupIds: string[]
): SpecItem[] {
  return getActiveSpecItems(productFamily, selectedGroupIds).filter(
    (item) => item.required
  );
}

/**
 * Check if all required specs are filled
 */
export function areRequiredSpecsFilled(
  requiredItems: SpecItem[],
  specValues: Record<string, any>
): boolean {
  return requiredItems.every((item) => {
    const value = specValues[item.id];
    return value !== undefined && value !== null && value !== "";
  });
}

/**
 * File Handling Utilities
 */

/**
 * Validate image file
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, GIF, and WebP images are allowed",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "Image size must be less than 10MB",
    };
  }

  return { valid: true };
}

/**
 * Convert File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Display Utilities
 */

/**
 * Get display label for product class
 */
export function getProductClassLabel(
  productClass: ProductFormData["productClass"]
): string {
  const labels = {
    standard: "Standard",
    nonstandard: "Non-Standard",
    spf: "SPF (Special Purpose Formulation)",
    usl: "USL (Universal Service Line)",
  };
  return labels[productClass];
}

/**
 * Format spec value for display
 */
export function formatSpecValue(item: SpecItem, value: any): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  if (item.type === "number") {
    return typeof value === "number" ? value.toLocaleString() : value.toString();
  }

  return value.toString();
}

/**
 * Get completion percentage of the form
 */
export function getFormCompletionPercentage(
  formData: Partial<ProductFormData>,
  requiredSpecItems: SpecItem[]
): number {
  let completed = 0;
  let total = 4; // Base required fields: family, class, description, codes

  // Check base fields
  if (formData.productFamilyId) completed++;
  if (formData.productClass) completed++;
  if (formData.itemDescription?.trim()) completed++;
  if (formData.itemCodes?.some((code) => code.trim())) completed++;

  // Check required specs
  total += requiredSpecItems.length;
  requiredSpecItems.forEach((item) => {
    if (formData.specValues?.[item.id]) completed++;
  });

  return Math.round((completed / total) * 100);
}

/**
 * Storage Utilities
 */

const STORAGE_KEY = "product-form-draft";

/**
 * Save form data as draft to localStorage
 */
export function saveDraft(formData: Partial<ProductFormData>): void {
  try {
    // Don't save images to localStorage (they're too large)
    const dataToSave = {
      ...formData,
      images: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraft(): Partial<ProductFormData> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load draft:", error);
  }
  return null;
}

/**
 * Clear saved draft
 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear draft:", error);
  }
}

/**
 * Check if there's a saved draft
 */
export function hasDraft(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Debounce Utility
 */

/**
 * Debounce function for auto-save and other delayed operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * URL Utilities
 */

/**
 * Generate a URL-safe slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Export Utilities
 */

/**
 * Download data as JSON file
 */
export function downloadAsJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Analytics/Tracking Utilities
 */

/**
 * Track form step changes (integrate with your analytics)
 */
export function trackStepChange(
  step: string,
  additionalData?: Record<string, any>
): void {
  // Implement your analytics tracking here
  console.log("Step changed:", step, additionalData);
  
  // Example integrations:
  // window.gtag?.('event', 'product_form_step', { step, ...additionalData });
  // window.analytics?.track('Product Form Step', { step, ...additionalData });
}

/**
 * Track form errors (for monitoring and improvement)
 */
export function trackFormErrors(errors: ValidationErrors): void {
  const errorCount = Object.keys(errors).length;
  if (errorCount > 0) {
    console.log("Form errors:", errors);
    // Implement your error tracking here
    // window.analytics?.track('Form Validation Error', { errorCount, errors });
  }
}
