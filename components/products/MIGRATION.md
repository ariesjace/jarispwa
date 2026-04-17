# Migration Guide: Legacy add-new-product-form → New Flow

This guide provides step-by-step instructions for migrating from the legacy `add-new-product-form.tsx` component to the new multi-step product creation flow.

## 🎯 Migration Goals

- ✅ Preserve ALL business logic
- ✅ Maintain data structure compatibility
- ✅ Improve user experience
- ✅ Ensure backend API compatibility
- ✅ Zero data loss during transition

## 📋 Pre-Migration Checklist

Before starting the migration:

- [ ] Backup the legacy `add-new-product-form.tsx` file
- [ ] Document current API endpoints and payloads
- [ ] Identify all integration points (API calls, state management, routing)
- [ ] Test legacy form to understand current behavior
- [ ] Review existing product family and spec configurations
- [ ] Identify any custom validation logic
- [ ] Document image upload requirements
- [ ] Review TDS generation logic in `@lib/tdsGenerator.ts`

## 🔄 Step-by-Step Migration

### Step 1: Extract Product Family Configuration

**From Legacy Component:**
```tsx
// Example legacy structure
const productFamilyConfig = {
  "industrial-coatings": {
    name: "Industrial Coatings",
    specs: {
      viscosity: { type: "number", required: true },
      density: { type: "number", required: true },
      color: { type: "select", options: ["Clear", "White", "Black"] },
    },
  },
  // ... more families
};
```

**To New Format:**
```tsx
// New structure in your data source (API, database, or config)
const productFamilies: ProductFamily[] = [
  {
    id: "industrial-coatings",
    name: "Industrial Coatings",
    description: "High-performance coatings for industrial applications",
    availableSpecGroups: [
      {
        id: "physical-properties",
        label: "Physical Properties",
        items: [
          {
            id: "viscosity",
            label: "Viscosity (cP)",
            type: "number",
            required: true,
          },
          {
            id: "density",
            label: "Density (g/cm³)",
            type: "number",
            required: true,
          },
          {
            id: "color",
            label: "Color",
            type: "select",
            options: ["Clear", "White", "Black"],
            required: false,
          },
        ],
      },
    ],
  },
];
```

**Migration Script:**
```typescript
// scripts/migrate-product-families.ts
import { ProductFamily, SpecGroup, SpecItem } from "@/components/products/types";

function migrateLegacyFamily(legacyConfig: any): ProductFamily {
  // Group specs into logical groups
  const specGroups: SpecGroup[] = [
    {
      id: `${legacyConfig.id}-specs`,
      label: "Specifications",
      items: Object.entries(legacyConfig.specs).map(([key, spec]: any) => ({
        id: key,
        label: spec.label || formatLabel(key),
        type: spec.type,
        options: spec.options,
        required: spec.required || false,
      })),
    },
  ];

  return {
    id: legacyConfig.id,
    name: legacyConfig.name,
    description: legacyConfig.description || "",
    availableSpecGroups: specGroups,
  };
}

function formatLabel(key: string): string {
  return key
    .split(/(?=[A-Z])/)
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
```

### Step 2: Update API Integration

**Legacy API Call:**
```tsx
// Legacy submit handler
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const formData = {
    itemDescription,
    itemCodes,
    productFamilyId,
    productClass,
    specs: specValues,
    images: imageFiles,
  };

  const response = await fetch("/api/products", {
    method: "POST",
    body: JSON.stringify(formData),
  });
};
```

**New API Integration:**
```tsx
// New flow integration
import { AddProductFlow } from "@/components/products/AddProductFlow";
import { transformForSubmission } from "@/components/products/utils";

export default function AllProductsPage() {
  const handleProductSubmit = async (formData: ProductFormData) => {
    // Transform data if needed
    const transformedData = transformForSubmission(formData);

    // Same API endpoint as legacy
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemDescription: transformedData.itemDescription,
        itemCodes: transformedData.itemCodes,
        productFamilyId: transformedData.productFamilyId,
        productClass: transformedData.productClass,
        // Map new structure to legacy expected format if needed
        specs: transformedData.specValues,
        images: transformedData.images,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create product");
    }

    const product = await response.json();
    
    // Handle success (same as legacy)
    router.push(`/products/${product.id}`);
  };

  return (
    <AddProductFlow
      productFamilies={productFamilies}
      onSubmit={handleProductSubmit}
    />
  );
}
```

### Step 3: Integrate TDS Generator

**Connect Your Existing TDS Logic:**
```tsx
// In TDSPreview.tsx, replace the mock generator

// Before:
const generateTDSPreview = async () => {
  const html = generateBlankTDS(formData, productFamily);
  setTdsHtml(html);
};

// After:
import { generateTDS } from "@/lib/tdsGenerator";

const generateTDSPreview = async () => {
  try {
    // Use your actual TDS generator
    const html = await generateTDS({
      itemDescription: formData.itemDescription,
      itemCodes: formData.itemCodes,
      productFamily: productFamily,
      productClass: formData.productClass,
      specifications: formData.specValues,
      // Pass any other required parameters
    });
    
    setTdsHtml(html);
  } catch (error) {
    console.error("TDS generation failed:", error);
    // Handle error
  }
};
```

### Step 4: Update Image Upload

If your legacy component has specific image upload logic:

```tsx
// In ProductFormSheet.tsx, update image handling

const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;

  const files = Array.from(e.target.files);
  
  // Add your legacy image processing logic
  const processedImages = await Promise.all(
    files.map(async (file) => {
      // Your existing image processing (resize, compress, etc.)
      return await processImage(file);
    })
  );

  setImages([...images, ...processedImages]);
};

// Your existing image processing function
async function processImage(file: File): Promise<File> {
  // Implement your existing logic here
  return file;
}
```

### Step 5: Preserve Custom Validation

If you have custom validation in the legacy component:

```tsx
// In utils.ts, add your custom validation

export function validateProductForm(
  formData: Partial<ProductFormData>,
  specGroups: SpecGroup[]
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {
    ...validateRequiredFields(formData),
    ...validateSpecifications(specGroups, formData.specValues || {}),
  };

  // Add your legacy custom validation here
  
  // Example: Item codes must follow specific format
  formData.itemCodes?.forEach((code, index) => {
    if (!/^[A-Z]{3}-\d{4}$/.test(code)) {
      errors[`itemCode-${index}`] = "Item code must be in format ABC-1234";
    }
  });

  // Example: Description must include certain keywords
  if (formData.itemDescription) {
    const requiredKeywords = ["coating", "finish"];
    const hasKeyword = requiredKeywords.some((keyword) =>
      formData.itemDescription!.toLowerCase().includes(keyword)
    );
    if (!hasKeyword) {
      errors.itemDescription = "Description must include coating or finish";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
```

### Step 6: Update Routing and State Management

**If using Next.js App Router:**
```tsx
// app/products/page.tsx
import { AddProductFlow } from "@/components/products/AddProductFlow";

export default function ProductsPage() {
  const router = useRouter();

  const handleSubmit = async (formData: ProductFormData) => {
    await createProduct(formData);
    router.push("/products");
    router.refresh(); // Refresh server components
  };

  return <AddProductFlow productFamilies={families} onSubmit={handleSubmit} />;
}
```

**If using Redux/Zustand:**
```tsx
// With state management
import { useProductStore } from "@/store/products";

export default function ProductsPage() {
  const { createProduct } = useProductStore();

  const handleSubmit = async (formData: ProductFormData) => {
    await createProduct(formData);
    // State updates handled by store
  };

  return <AddProductFlow productFamilies={families} onSubmit={handleSubmit} />;
}
```

## 🧪 Testing Migration

### Test Checklist

- [ ] **Product family data loads correctly**
  - All families appear in selection modal
  - Spec groups are accurate
  - Spec items have correct types and options

- [ ] **Form validation matches legacy behavior**
  - Required fields enforce validation
  - Custom validation rules still apply
  - Error messages are appropriate

- [ ] **Data submission format matches API expectations**
  - Test with actual API endpoint
  - Verify payload structure
  - Check response handling

- [ ] **TDS generation works correctly**
  - Preview displays properly
  - Generated TDS matches legacy format
  - All spec values appear correctly

- [ ] **Image upload functionality**
  - Images upload successfully
  - Image processing works (if any)
  - Multiple images supported

- [ ] **Navigation and routing**
  - Success redirects work
  - Cancel returns to correct page
  - Browser back button works

### Test Cases

```typescript
// Example test for validation
describe("Product Form Validation", () => {
  it("should require item description", () => {
    const formData = {
      itemCodes: ["ABC-123"],
      // Missing itemDescription
    };
    
    const { isValid, errors } = validateProductForm(formData, []);
    
    expect(isValid).toBe(false);
    expect(errors.itemDescription).toBeDefined();
  });

  it("should validate item codes format", () => {
    const formData = {
      itemDescription: "Test product",
      itemCodes: ["invalid-format"],
    };
    
    const { isValid, errors } = validateProductForm(formData, []);
    
    expect(isValid).toBe(false);
    expect(errors["itemCode-0"]).toBeDefined();
  });
});
```

## 📦 Deployment Strategy

### Option 1: Feature Flag (Recommended)

```tsx
// Gradual rollout with feature flag
import { useFeatureFlag } from "@/lib/feature-flags";
import LegacyAddProductForm from "./legacy/add-new-product-form";
import { AddProductFlow } from "./AddProductFlow";

export default function ProductCreation() {
  const useNewFlow = useFeatureFlag("new-product-flow");

  if (useNewFlow) {
    return <AddProductFlow productFamilies={families} onSubmit={handleSubmit} />;
  }

  return <LegacyAddProductForm />;
}
```

### Option 2: A/B Test

```tsx
// A/B test to compare conversion rates
import { useABTest } from "@/lib/ab-testing";

export default function ProductCreation() {
  const variant = useABTest("product-flow-test");

  if (variant === "new") {
    return <AddProductFlow productFamilies={families} onSubmit={handleSubmit} />;
  }

  return <LegacyAddProductForm />;
}
```

### Option 3: Direct Replacement

```tsx
// Full replacement (after thorough testing)
// Simply replace legacy component imports with new flow
- import LegacyAddProductForm from "./legacy/add-new-product-form";
+ import { AddProductFlow } from "@/components/products/AddProductFlow";
```

## 🐛 Troubleshooting

### Common Issues

**Issue: Spec values not saving**
```typescript
// Check that spec IDs match between family config and form submission
console.log("Expected spec IDs:", 
  productFamily.availableSpecGroups.flatMap(g => g.items.map(i => i.id))
);
console.log("Submitted spec IDs:", Object.keys(formData.specValues));
```

**Issue: Images not uploading**
```typescript
// Verify image transformation
console.log("Image files:", images);
console.log("Image types:", images.map(img => img.type));
console.log("Image sizes:", images.map(img => formatFileSize(img.size)));
```

**Issue: TDS preview blank**
```typescript
// Debug TDS generation
console.log("Form data for TDS:", formData);
console.log("Product family:", productFamily);
const html = generateBlankTDS(formData, productFamily);
console.log("Generated HTML length:", html.length);
```

## 📊 Monitoring

Add monitoring to track migration success:

```typescript
// Track migration metrics
export function trackProductCreation(data: {
  formType: "legacy" | "new";
  success: boolean;
  duration: number;
  errors?: string[];
}) {
  // Your analytics service
  analytics.track("Product Created", data);
}

// Use in both components
const startTime = Date.now();
try {
  await createProduct(formData);
  trackProductCreation({
    formType: "new",
    success: true,
    duration: Date.now() - startTime,
  });
} catch (error) {
  trackProductCreation({
    formType: "new",
    success: false,
    duration: Date.now() - startTime,
    errors: [error.message],
  });
}
```

## ✅ Post-Migration

After successful deployment:

- [ ] Monitor error rates
- [ ] Compare conversion rates (new vs legacy)
- [ ] Collect user feedback
- [ ] Monitor API performance
- [ ] Update documentation
- [ ] Train support team on new flow
- [ ] Archive legacy component (don't delete yet)
- [ ] Schedule legacy code removal (3-6 months)

## 🔗 Additional Resources

- [New Flow README](./README.md)
- [Type Definitions](./types.ts)
- [Utilities Documentation](./utils.ts)
- [Component API Reference](./API.md)

## 📝 Migration Checklist

Print this checklist and check off each item:

- [ ] Backed up legacy component
- [ ] Extracted product family configuration
- [ ] Converted specs to new format
- [ ] Updated API integration
- [ ] Integrated TDS generator
- [ ] Preserved custom validation
- [ ] Updated image upload logic
- [ ] Added error handling
- [ ] Created comprehensive tests
- [ ] Tested all user flows
- [ ] Implemented feature flag/A/B test
- [ ] Set up monitoring
- [ ] Deployed to staging
- [ ] User acceptance testing
- [ ] Deployed to production
- [ ] Monitored for 1 week
- [ ] Collected feedback
- [ ] Made necessary adjustments
- [ ] Archived legacy code
