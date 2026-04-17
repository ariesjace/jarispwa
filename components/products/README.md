# New Product Creation Flow

A modern, multi-step product creation experience that preserves all business logic from the legacy `add-new-product-form` component while providing a superior UX.

## 📋 Overview

This implementation refactors the product creation flow into a guided, multi-step process that is fully responsive and provides a native-feeling mobile experience while remaining fully functional on desktop.

### Flow Steps

1. **Product Family Selection** - Modal with selectable cards
2. **Product Class Selection** - Choose from: standard, nonstandard, spf, usl
3. **Product Form** - Fullscreen form with dynamic spec rendering
4. **TDS Preview** - Review blank TDS template before publishing
5. **Finalization** - Confirm and publish

## 🏗️ Architecture

### Component Structure

```
AddProductFlow.tsx (Orchestrator)
├── ProductFamilyModal.tsx
│   └── Handles family selection + spec group configuration
├── ProductClassSelection.tsx
│   └── Product class selection interface
├── ProductFormSheet.tsx
│   └── Fullscreen form with dynamic spec rendering
└── TDSPreview.tsx
    └── TDS generation and preview
```

### Data Flow

```
User Action → State Update → Next Step
     ↓
formData accumulates across steps
     ↓
Final submission with complete data
```

## 🔑 Key Features

### Business Logic Preservation

✅ **Required Fields**: `itemDescription` and `itemCodes` are enforced with validation
✅ **Product Family Relationships**: Spec groups dynamically render based on selected family
✅ **Dynamic Spec Rendering**: Specs appear based on user's spec group selections
✅ **Product Class Support**: All four classes (standard, nonstandard, spf, usl) supported

### UX Improvements

- **Progressive Disclosure**: Information revealed step-by-step
- **Validation Feedback**: Real-time error messages
- **Mobile-First**: Fully responsive, touch-friendly
- **Reversible Steps**: Users can go back and edit at any point
- **Visual Preview**: See TDS before committing

## 🚀 Integration

### 1. Install Dependencies

```bash
npm install lucide-react
# or
yarn add lucide-react
```

### 2. Required shadcn/ui Components

Ensure these components are installed in your project:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add scroll-area
```

### 3. Add Components to Your Project

```
src/components/products/
├── AddProductFlow.tsx
├── ProductFamilyModal.tsx
├── ProductClassSelection.tsx
├── ProductFormSheet.tsx
└── TDSPreview.tsx
```

### 4. Update Your AllProducts Page

```tsx
import { AddProductFlow } from "@/components/products/AddProductFlow";

export default function AllProductsPage() {
  const handleProductSubmit = async (formData: ProductFormData) => {
    // Your API call here
    await createProduct(formData);
  };

  return (
    <div>
      <h1>All Products</h1>
      
      <AddProductFlow
        productFamilies={productFamilies}
        onSubmit={handleProductSubmit}
        onCancel={() => console.log("Cancelled")}
      />
      
      {/* Your existing products table */}
    </div>
  );
}
```

## 📊 Data Types

### ProductFamily

```typescript
interface ProductFamily {
  id: string;
  name: string;
  description?: string;
  availableSpecGroups: SpecGroup[];
}
```

### SpecGroup

```typescript
interface SpecGroup {
  id: string;
  label: string;
  items: SpecItem[];
}
```

### SpecItem

```typescript
interface SpecItem {
  id: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[]; // Required for type: "select"
  required?: boolean;
}
```

### ProductFormData (Output)

```typescript
interface ProductFormData {
  productFamilyId: string;
  productClass: "standard" | "nonstandard" | "spf" | "usl";
  itemDescription: string;
  itemCodes: string[];
  selectedSpecGroups: string[];
  specValues: Record<string, any>;
  images: File[];
}
```

## 🔄 Migration from Legacy Component

### Step 1: Extract Product Family Data

From your legacy component, extract the product family definitions and their associated spec groups. The structure should map to:

```typescript
// Legacy structure (example)
const familyConfig = {
  "family-1": {
    name: "Industrial Coatings",
    specs: [...],
  },
};

// Maps to new structure
const productFamilies: ProductFamily[] = [
  {
    id: "family-1",
    name: "Industrial Coatings",
    availableSpecGroups: [
      {
        id: "sg-1",
        label: "Physical Properties",
        items: [...],
      },
    ],
  },
];
```

### Step 2: Update Spec Field Definitions

If your legacy component has hardcoded spec fields, convert them to the `SpecItem` format:

```typescript
// Legacy (example)
<Input name="viscosity" required />

// New format
{
  id: "viscosity",
  label: "Viscosity (cP)",
  type: "number",
  required: true,
}
```

### Step 3: Integrate TDS Generator

The `TDSPreview` component includes a reference implementation. Replace the `generateBlankTDS` function with your actual logic from `@lib/tdsGenerator.ts`:

```typescript
// In TDSPreview.tsx
import { generateTDS } from "@/lib/tdsGenerator";

const generateTDSPreview = async () => {
  const html = await generateTDS(formData, productFamily);
  setTdsHtml(html);
};
```

### Step 4: Update API Integration

Replace the example API call with your actual backend integration:

```typescript
const handleProductSubmit = async (formData: ProductFormData) => {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!response.ok) throw new Error("Failed to create product");
  
  const product = await response.json();
  // Handle success (redirect, refresh, etc.)
};
```

## 🎨 Styling

### Fullscreen Sheet Behavior

The `ProductFormSheet` component is designed to be fullscreen on ALL breakpoints (mobile and desktop). This matches the reference `FamiliesForm.tsx` pattern.

Key styling classes:
```css
.fixed.inset-0  /* Fullscreen coverage */
.z-50          /* Above other content */
```

### Theme Variables

The components use your existing design system's CSS variables:
- `--background`
- `--foreground`
- `--primary`
- `--destructive`
- `--muted`
- `--border`

## 🧪 Testing

### Manual Testing Checklist

- [ ] Can select product family
- [ ] Can add/remove spec groups
- [ ] Can select product class
- [ ] Required fields are enforced
- [ ] Can add/remove item codes
- [ ] Dynamic specs render correctly
- [ ] Image upload works
- [ ] Can navigate back through steps
- [ ] TDS preview generates correctly
- [ ] Final submission works
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Responsive on desktop

## 🔧 Customization

### Adding Custom Validation

Extend validation in `ProductFormSheet.tsx`:

```typescript
const validate = (): boolean => {
  // ... existing validation
  
  // Custom validation
  if (itemCodes.some(code => code.includes(' '))) {
    newErrors.itemCodes = "Item codes cannot contain spaces";
  }
  
  return Object.keys(newErrors).length === 0;
};
```

### Custom TDS Styling

Modify the TDS template in `TDSPreview.tsx` or integrate your existing `tdsGenerator.ts` logic.

### Adding Steps

To add a new step:

1. Update `FlowStep` type
2. Add new component
3. Update state management in `AddProductFlow.tsx`
4. Add navigation logic

## 📝 Notes

- **State Persistence**: Form data persists as users navigate back/forward
- **Validation**: Real-time validation with error messages
- **Accessibility**: Keyboard navigation and screen reader support
- **Performance**: Lazy loading of images, optimized re-renders

## 🐛 Troubleshooting

### Issue: Specs not appearing
**Solution**: Verify `selectedSpecGroups` IDs match spec group IDs in `productFamily.availableSpecGroups`

### Issue: Images not uploading
**Solution**: Check file input accept types and file size limits

### Issue: TDS preview blank
**Solution**: Verify `generateBlankTDS` function has access to all required data

## 📚 Additional Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [React Hook Form](https://react-hook-form.com) - Consider for advanced form management
- [Zod](https://zod.dev) - For schema validation

## 🤝 Contributing

When extending this flow:

1. **Preserve business logic** - Never modify core validation or data structure
2. **Maintain responsiveness** - Test on all breakpoints
3. **Keep it accessible** - Follow ARIA guidelines
4. **Document changes** - Update this README

## 📄 License

[Your License Here]
