# REFACTOR: Product Creation Flow — Claude Code Prompt

> **Scope:** Refactor `components/products/` to produce a Firestore payload that is
> 100 % identical to the legacy `add-new-product-form.tsx` output schema **and**
> the BulkUploader schema.  
> **Do NOT touch** any other file unless it is listed as a dependency below.  
> **Do NOT break** existing AllProducts page, BulkUploader, Families page, or any
> routing/auth logic.

---

## 0 · Prerequisites — read these files first

Before writing a single line, read and understand:

| File | Why |
|------|-----|
| `components/products/BulkUploader.tsx` | Canonical Firestore write schema (authoritative) |
| `components/layout/tokens.ts` | The ONLY source of truth for colors, spacing, radii, shadows |
| `types/product.ts` | `ItemCodes`, `ItemCodeBrand`, helper functions |
| `components/ItemCodesDisplay.tsx` | `ItemCodesInput` component — reuse, do not rewrite |
| `lib/tdsGenerator.ts` | `generateTdsPdf`, `uploadTdsPdf`, `normaliseBrand` |
| `lib/firebase.ts` | `db` singleton |
| `lib/logger.ts` | `logAuditEvent` |
| `lib/useProductWorkflow.ts` | `submitProductUpdate` for edit mode |
| `lib/useAuth.tsx` | `useAuth` |
| `hooks/useTabSpecsState.ts` | Tab-spec state — reuse as-is |

---

## 1 · Firestore Output Schema (MUST match exactly)

Every product written to Firestore's `products` collection **must** contain
exactly these fields. Field names, types, and nesting are non-negotiable.

```typescript
// products/{docId}
{
  // ── Identity ────────────────────────────────────────────────
  productClass:   "spf" | "standard" | "",      // from Step 2
  itemDescription: string,                       // required, trimmed
  shortDescription: "",                          // always empty string on create
  slug:           string,                        // kebab-case from itemDescription

  // ── Item codes (new multi-brand schema) ─────────────────────
  itemCodes: {                                   // ItemCodes object
    ECOSHIFT?: string,
    LIT?:      string,
    LUMERA?:   string,
    OKO?:      string,
    ZUMTOBEL?: string,
  },
  ecoItemCode: string,                           // itemCodes.ECOSHIFT ?? ""
  litItemCode: string,                           // itemCodes.LIT ?? ""

  // ── Pricing ─────────────────────────────────────────────────
  regularPrice: 0,
  salePrice:    0,

  // ── Technical specs ─────────────────────────────────────────
  technicalSpecs: Array<{
    specGroup: string,                           // UPPER_CASE group name
    specs: Array<{
      name:  string,                             // UPPER_CASE label
      value: string,                             // UPPER_CASE value
    }>,
  }>,

  // ── Images (all Cloudinary URLs or empty strings) ────────────
  mainImage:                     string,
  rawImage:                      string,
  qrCodeImage:                   "",
  galleryImages:                 string[],
  dimensionalDrawingImage:       "",
  recommendedMountingHeightImage:"",
  driverCompatibilityImage:      "",
  baseImage:                     "",
  illuminanceLevelImage:         "",
  wiringDiagramImage:            "",
  installationImage:             "",
  wiringLayoutImage:             "",
  terminalLayoutImage:           "",
  accessoriesImage:              "",
  typeOfPlugImage:               "",

  // ── Classification ───────────────────────────────────────────
  website:       string[],                       // [] on create
  websites:      string[],                       // [] on create
  productFamily: string,                         // UPPER_CASE family title
  brand:         string,                         // e.g. "LIT" or "ECOSHIFT"
  applications:  string[],                       // [] on create
  productUsage:  string[],                       // from selected family

  // ── Visibility ───────────────────────────────────────────────
  status: "draft",                               // always draft on create

  // ── SEO ─────────────────────────────────────────────────────
  seo: {
    itemDescription: string,
    description:     "",
    canonical:       "",
    ogImage:         string,                     // mainImage URL
    robots:          "index, follow",
    lastUpdated:     string,                     // new Date().toISOString()
  },

  // ── Timestamps ───────────────────────────────────────────────
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  importSource: "add-new-product-form",
}
```

> **Rule:** If the BulkUploader writes a field, so must the ProductFormSheet.
> If the legacy `handlePublish` writes a field, so must the ProductFormSheet.
> The union of both schemas is the target.

---

## 2 · Component Architecture (keep existing file names)

```
components/products/
├── AddProductFlow.tsx          ← orchestrator  (refactor)
├── ProductFamilyModal.tsx      ← Step 1        (refactor)
├── ProductClassSelection.tsx   ← Step 2        (keep UI, minor type fix)
├── ProductFormSheet.tsx        ← Step 3        (MAJOR refactor)
├── TDSPreview.tsx              ← Step 4        (refactor)
├── types.ts                    ← update types
└── utils.ts                    ← keep, add slugify helper
```

**Do NOT create new files.** Modify the six files above only.

---

## 3 · Detailed Refactor Instructions Per File

---

### 3A · `types.ts` — Update type definitions

Replace the current `ProductFormData` with:

```typescript
import type { ItemCodes } from "@/types/product";

export type ProductClass = "spf" | "standard" | "";

export interface ProductFormData {
  // Step 1
  productFamilyId:    string;
  productFamilyTitle: string;         // UPPER_CASE resolved family name
  productUsage:       string[];       // from selected family doc
  selectedSpecGroupIds: string[];     // IDs of linked spec groups
  availableSpecs: AvailableSpecItem[]; // flattened spec items from family

  // Step 2
  productClass: ProductClass;

  // Step 3 — form inputs
  itemDescription: string;
  itemCodes:       ItemCodes;
  specValues:      Record<string, string>; // key: `${specGroupId}-${label}`
  mainImageFile?:  File;
  rawImageFile?:   File;
  images:          File[];

  // Derived on save
  brand: string;
}

export interface AvailableSpecItem {
  specGroupId:   string;
  specGroup:     string;    // display name of the group
  label:         string;    // UPPER_CASE spec label
  id:            string;    // `${specGroupId}:${label}`
}

export interface ValidationErrors {
  [field: string]: string;
}
```

---

### 3B · `AddProductFlow.tsx` — Orchestrator

**Responsibilities:**
- Manages the 5-state flow: `idle → family-selection → class-selection → form → preview`
- Accumulates `formData: Partial<ProductFormData>` across steps
- Passes Firestore `productFamilies` and `specGroups` data DOWN to modal
- On final confirm, calls `handleAddProductSubmit` (defined in `AllProducts.tsx`)
- Renders the hidden trigger `<button>` that `AllProducts.tsx` clicks via ref

**Key implementation rules:**
1. Fetch `productfamilies` and `specs` from Firestore here using `onSnapshot`
2. Pass raw family docs to `ProductFamilyModal` — resolve display data inside the modal
3. Keep the `addFlowTriggerRef` pattern from `AllProducts.tsx` intact
4. The `onSubmit` prop receives the complete `ProductFormData`; the parent
   (`AllProducts.tsx`) is responsible for the actual Firestore write

**State to accumulate:**
```typescript
const [formData, setFormData] = useState<Partial<ProductFormData>>({
  itemCodes:            {},
  selectedSpecGroupIds: [],
  availableSpecs:       [],
  specValues:           {},
  images:               [],
  productUsage:         [],
});
```

---

### 3C · `ProductFamilyModal.tsx` — Step 1 (Family + Spec selection)

**What changes:**
1. Accept raw Firestore family docs and raw spec group docs as props
2. When a family is selected → read `family.specs` array → resolve
   `AvailableSpecItem[]` and pass up via `onSelect`
3. Also pass up `productUsage: string[]` from the family doc
4. The `onSelect` callback signature becomes:

```typescript
onSelect: (payload: {
  familyId:             string;
  familyTitle:          string;
  selectedSpecGroupIds: string[];
  availableSpecs:       AvailableSpecItem[];
  productUsage:         string[];
}) => void;
```

5. Spec group toggle renders the group name from `family.specs[i].specGroupId`
   resolved against the `specGroups` prop (lookup by id → name)

**UI rules (TOKEN only):**
- Family cards: `border: 1px solid TOKEN.border`, hover → `border: 1px solid TOKEN.primary`
- Active checkbox fill: `background: TOKEN.primary`
- Search input: `background: TOKEN.surface`, `border: 1px solid TOKEN.border`
- All text: `TOKEN.textPri` / `TOKEN.textSec`
- Spec group chips: `background: TOKEN.bg`, `border: 1px solid TOKEN.border`, `color: TOKEN.textSec`
- Continue button (active): `background: TOKEN.primary`, `color: #fff`

---

### 3D · `ProductClassSelection.tsx` — Step 2

Only change needed: update `ProductClass` type import from local `types.ts`.
UI stays exactly as is. No other changes.

---

### 3E · `ProductFormSheet.tsx` — Step 3 (MAJOR REFACTOR)

This is the most important file. Replicate the logic from `add-new-product-form.tsx`
stripped down to create-only (no edit mode in the new flow).

#### 3E-1 · Props

```typescript
interface ProductFormSheetProps {
  isOpen:           boolean;
  onClose:          () => void;
  onSubmit:         (data: Partial<ProductFormData>) => void;
  onBack:           () => void;
  formData:         Partial<ProductFormData>;       // accumulated from steps 1+2
  allSpecGroups:    Array<{ id: string; name: string; items: {label:string}[] }>;
}
```

#### 3E-2 · Internal state

```typescript
const [itemDescription, setItemDescription] = useState("");
const [itemCodes,       setItemCodes]        = useState<ItemCodes>({});
const [specValues,      setSpecValues]        = useState<Record<string,string>>({});
const [mainImageFile,   setMainImageFile]     = useState<File | null>(null);
const [rawImageFile,    setRawImageFile]      = useState<File | null>(null);
const [galleryFiles,    setGalleryFiles]      = useState<File[]>([]);
const [showItemCodeError, setShowItemCodeError] = useState(false);
const [errors, setErrors] = useState<ValidationErrors>({});
```

#### 3E-3 · Spec rendering

The `formData.availableSpecs` array is the flat list of spec items.
Group them by `specGroupId` for display:

```typescript
const specsByGroup = useMemo(() => {
  const map = new Map<string, { groupName: string; items: AvailableSpecItem[] }>();
  (formData.availableSpecs ?? []).forEach(spec => {
    if (!map.has(spec.specGroupId)) {
      map.set(spec.specGroupId, { groupName: spec.specGroup, items: [] });
    }
    map.get(spec.specGroupId)!.items.push(spec);
  });
  return Array.from(map.values());
}, [formData.availableSpecs]);
```

Render each group as a section card with its group name as header.
Each spec item renders as a labelled text input.
Spec input key: `${spec.specGroupId}-${spec.label}` (matches legacy).

#### 3E-4 · Image upload — use `useDropzone`

- **Main image**: single drop zone, stores `File` object
- **Raw image**: single drop zone, stores `File` object  
- **Gallery**: multi-file drop zone, stores `File[]`
- All technical drawing image slots (dimensional drawing, wiring diagram, etc.)
  are **NOT** present in the new create flow — they can be added via edit later

#### 3E-5 · Validation (called on "Preview TDS" button)

```typescript
const validate = (): boolean => {
  const errs: ValidationErrors = {};
  if (!itemDescription.trim())
    errs.itemDescription = "Item description is required";
  if (!hasAtLeastOneItemCode(itemCodes)) {
    setShowItemCodeError(true);
    errs.itemCodes = "At least one item code is required";
  }
  setErrors(errs);
  return Object.keys(errs).length === 0;
};
```

#### 3E-6 · onSubmit payload

When validation passes:

```typescript
onSubmit({
  itemDescription: itemDescription.trim(),
  itemCodes,
  specValues,
  mainImageFile:  mainImageFile  ?? undefined,
  rawImageFile:   rawImageFile   ?? undefined,
  images:         galleryFiles,
});
```

#### 3E-7 · Item codes field

Use `<ItemCodesInput>` from `components/ItemCodesDisplay.tsx`:

```tsx
<ItemCodesInput
  value={itemCodes}
  onChange={setItemCodes}
  showValidationError={showItemCodeError}
/>
```

#### 3E-8 · Layout structure (use TOKEN throughout, no Tailwind classes)

```
┌─ Fullscreen fixed overlay (TOKEN.bg background) ──────────────────────┐
│ Header bar (TOKEN.surface, border-bottom TOKEN.border)                 │
│  [← Back]  "New Product"  /  Family name subtitle        [✕ Close]    │
├────────────────────────────────────────────────────────────────────────┤
│ Scrollable body (max-width 860px, centered)                           │
│                                                                        │
│  ┌─ Item Description card ─────────────────────────────────────────┐  │
│  │ <textarea> rows=4                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ Item Codes card ───────────────────────────────────────────────┐  │
│  │ <ItemCodesInput />                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ [Spec Group Name] card (one per group) ────────────────────────┐  │
│  │ per-item: label + text input                                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ Images card ───────────────────────────────────────────────────┐  │
│  │ Main Image dropzone (single)                                     │  │
│  │ Raw Image dropzone  (single)                                     │  │
│  │ Gallery dropzone    (multi)                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│ Footer bar (TOKEN.surface, border-top)                                 │
│  [Back]                              [Cancel] [Preview TDS →]          │
└────────────────────────────────────────────────────────────────────────┘
```

**Section card style:**
```typescript
const sectionCard: React.CSSProperties = {
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 14,
  overflow: "hidden",
  background: TOKEN.surface,
};
const sectionHeader: React.CSSProperties = {
  padding: "12px 18px",
  borderBottom: `1px solid ${TOKEN.border}`,
  background: TOKEN.bg,
  fontSize: 11,
  fontWeight: 800,
  color: TOKEN.textPri,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const sectionBody: React.CSSProperties = {
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
```

---

### 3F · `TDSPreview.tsx` — Step 4

**What changes:**

1. The `formData` type updates to the new `ProductFormData`
2. The `generateBlankTDS` function must read `itemCodes` as `ItemCodes` object:

```typescript
// Replace the old itemCodes array rendering with:
const codeRows = Object.entries(formData.itemCodes || {})
  .filter(([, v]) => v && v.trim())
  .map(([brand, code]) => `<li><strong>${brand}</strong>: ${code}</li>`)
  .join("");
```

3. Spec preview renders from `formData.specValues` keyed as
   `${specGroupId}-${label}`, resolved against `formData.availableSpecs`
4. No other logic changes — keep the download + confirm flow as-is

---

## 4 · AllProducts.tsx — `handleAddProductSubmit` (THE ACTUAL FIRESTORE WRITE)

In `AllProducts.tsx`, replace the existing `handleAddProductSubmit` with the
following logic. This is where the actual write happens.

```typescript
const handleAddProductSubmit = useCallback(
  async (formData: AddFlowFormData) => {
    const CLOUD_NAME   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   ?? "";
    const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

    const uploadToCloud = async (file: File): Promise<string> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: fd },
      );
      const json = await res.json();
      if (!json?.secure_url) throw new Error("Cloudinary upload failed");
      return json.secure_url as string;
    };

    try {
      // ── 1. Upload images ──────────────────────────────────────────────────
      const mainUrl    = formData.mainImageFile ? await uploadToCloud(formData.mainImageFile) : "";
      const rawUrl     = formData.rawImageFile  ? await uploadToCloud(formData.rawImageFile)  : mainUrl;
      const galleryUrls: string[] = await Promise.all(
        (formData.images ?? []).map(uploadToCloud)
      );

      // ── 2. Resolve item codes ─────────────────────────────────────────────
      const itemCodesObj = formData.itemCodes ?? {};
      const resolvedEco  = (itemCodesObj as any).ECOSHIFT ?? "";
      const resolvedLit  = (itemCodesObj as any).LIT      ?? "";
      const resolvedBrand = resolvedLit ? "LIT" : resolvedEco ? "ECOSHIFT" : "";
      const primary = getPrimaryItemCode(itemCodesObj as ItemCodes);

      // ── 3. Build technicalSpecs array (matches legacy + BulkUploader) ─────
      const specsGrouped: Record<string, { name: string; value: string }[]> = {};
      Object.entries(formData.specValues ?? {}).forEach(([key, rawValue]) => {
        const value = (rawValue ?? "").toString().trim();
        if (!value) return;
        const spec = (formData.availableSpecs ?? []).find(
          (s) => `${s.specGroupId}-${s.label}` === key
        );
        if (!spec) return;
        if (!specsGrouped[spec.specGroup]) specsGrouped[spec.specGroup] = [];
        specsGrouped[spec.specGroup].push({
          name:  spec.label.toUpperCase().trim(),
          value: value.toUpperCase().trim(),
        });
      });
      const technicalSpecs = Object.entries(specsGrouped)
        .map(([specGroup, specs]) => ({
          specGroup: specGroup.toUpperCase().trim(),
          specs,
        }))
        .filter((g) => g.specs.length > 0);

      // ── 4. Slug ───────────────────────────────────────────────────────────
      const slug = formData.itemDescription
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // ── 5. Build final payload (matches BOTH BulkUploader + legacy schema) ─
      const payload = {
        productClass:                  formData.productClass    ?? "",
        itemDescription:               formData.itemDescription ?? "",
        shortDescription:              "",
        slug,
        itemCodes:                     itemCodesObj,
        ecoItemCode:                   resolvedEco,
        litItemCode:                   resolvedLit,
        regularPrice:                  0,
        salePrice:                     0,
        technicalSpecs,
        mainImage:                     mainUrl,
        rawImage:                      rawUrl,
        qrCodeImage:                   "",
        galleryImages:                 galleryUrls,
        dimensionalDrawingImage:       "",
        recommendedMountingHeightImage: "",
        driverCompatibilityImage:      "",
        baseImage:                     "",
        illuminanceLevelImage:         "",
        wiringDiagramImage:            "",
        installationImage:             "",
        wiringLayoutImage:             "",
        terminalLayoutImage:           "",
        accessoriesImage:              "",
        typeOfPlugImage:               "",
        website:                       [],
        websites:                      [],
        productFamily:                 (formData.productFamilyTitle ?? "").toUpperCase(),
        brand:                         resolvedBrand,
        applications:                  [],
        productUsage:                  formData.productUsage ?? [],
        status:                        "draft" as const,
        seo: {
          itemDescription: formData.itemDescription ?? "",
          description:     "",
          canonical:       "",
          ogImage:         mainUrl,
          robots:          "index, follow",
          lastUpdated:     new Date().toISOString(),
        },
        importSource: "add-new-product-form",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // ── 6. Write to Firestore ─────────────────────────────────────────────
      const docRef = await addDoc(collection(db, "products"), payload);

      // ── 7. Generate TDS (fire-and-forget) ────────────────────────────────
      if (technicalSpecs.length > 0) {
        try {
          const { generateTdsPdf, uploadTdsPdf, normaliseBrand } = await import("@/lib/tdsGenerator");
          const tdsBlob = await generateTdsPdf({
            itemDescription: formData.itemDescription ?? "",
            itemCodes:       itemCodesObj as any,
            technicalSpecs,
            brand:           normaliseBrand(resolvedBrand),
            includeBrandAssets: false,
            mainImageUrl:    mainUrl || undefined,
          });
          const primaryCode = primary?.code ?? formData.itemDescription ?? docRef.id;
          const tdsUrl = await uploadTdsPdf(
            tdsBlob,
            `${primaryCode}_TDS.pdf`,
            CLOUD_NAME,
            UPLOAD_PRESET,
          );
          if (tdsUrl.startsWith("http")) {
            await updateDoc(doc(db, "products", docRef.id), { tdsFileUrl: tdsUrl, updatedAt: serverTimestamp() });
          }
        } catch (tdsErr: any) {
          console.warn("[AddProduct] TDS generation failed:", tdsErr.message);
          // Non-fatal — product was already saved
        }
      }

      // ── 8. Audit log ──────────────────────────────────────────────────────
      await logAuditEvent({
        action:     "create",
        entityType: "product",
        entityId:   docRef.id,
        entityName: formData.itemDescription ?? "",
        context: {
          page:       "/products/all-products",
          source:     "add-new-product-form",
          collection: "products",
        },
      });

      toast.success("Product created successfully");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create product");
      throw err;
    }
  },
  [rawFamilyDocs],
);
```

---

## 5 · Firestore Reads in `AddProductFlow.tsx`

`AddProductFlow` must subscribe to two collections:

```typescript
// productfamilies — for Step 1
useEffect(() => {
  const q = query(collection(db, "productfamilies"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    setRawFamilyDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}, []);

// specs — to resolve group names from IDs
useEffect(() => {
  const q = query(collection(db, "specs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    setRawSpecGroupDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}, []);
```

Pass both as props to `ProductFamilyModal`:

```tsx
<ProductFamilyModal
  isOpen={currentStep === "family-selection"}
  onClose={handleReset}
  rawFamilyDocs={rawFamilyDocs}
  rawSpecGroupDocs={rawSpecGroupDocs}
  onSelect={handleFamilySelect}
/>
```

---

## 6 · `ProductFamilyModal.tsx` — Spec resolution logic

When user selects a family, resolve `AvailableSpecItem[]` like this:

```typescript
const resolveAvailableSpecs = (
  family: any,
  rawSpecGroupDocs: any[]
): AvailableSpecItem[] => {
  const specs: AvailableSpecItem[] = [];
  const familySpecs: any[] = Array.isArray(family.specs) ? family.specs : [];

  for (const groupRef of familySpecs) {
    const groupDoc = rawSpecGroupDocs.find((g) => g.id === groupRef.specGroupId);
    const groupName = groupDoc?.name ?? groupRef.specGroupId;
    const specItems: any[] = Array.isArray(groupRef.specItems)
      ? groupRef.specItems
      : [];

    for (const item of specItems) {
      const label = (item.name ?? item.label ?? "").toUpperCase().trim();
      if (!label) continue;
      specs.push({
        specGroupId: groupRef.specGroupId,
        specGroup:   groupName,
        label,
        id:          `${groupRef.specGroupId}:${label}`,
      });
    }
  }
  return specs;
};
```

Call `onSelect` with:

```typescript
onSelect({
  familyId:             selectedFamily.id,
  familyTitle:          selectedFamily.title ?? selectedFamily.name ?? "",
  selectedSpecGroupIds: Array.from(selectedSpecGroups),
  availableSpecs:       resolveAvailableSpecs(selectedFamily, rawSpecGroupDocs),
  productUsage:         Array.isArray(selectedFamily.productUsage)
                          ? selectedFamily.productUsage
                          : [],
});
```

---

## 7 · TOKEN Styling Rules (non-negotiable)

All styles must be written as inline `style={}` objects using `TOKEN.*` values.
**No Tailwind classes.** No hardcoded hex values (except `#fff` for white text on
primary backgrounds, and the few transparent RGBA values shown in existing
components).

| Element | Token(s) |
|---------|----------|
| Page background | `TOKEN.bg` |
| Card / surface background | `TOKEN.surface` |
| Card header background | `TOKEN.bg` |
| All borders | `TOKEN.border` |
| Active / selected border | `TOKEN.primary` |
| Primary button bg | `TOKEN.primary` |
| Primary button text | `#fff` |
| Outline button bg | `TOKEN.surface` |
| Outline button border | `TOKEN.border` |
| Body text | `TOKEN.textPri` |
| Secondary text / labels | `TOKEN.textSec` |
| Error/destructive | `TOKEN.danger` |
| Error bg | `TOKEN.dangerBg` |
| Error text | `TOKEN.dangerText` |
| Border radius (cards) | `14px` |
| Border radius (buttons) | `10–12px` |
| Border radius (inputs) | `10px` |

---

## 8 · Constraints & Guardrails

1. **Do NOT modify** `BulkUploader.tsx`, `Families.tsx`, `AllProducts.tsx`
   (except the `handleAddProductSubmit` block and the `AddProductFlow` data
   fetching which already lives there).
2. **Do NOT change** the `addFlowTriggerRef` hidden button pattern.
3. **Preserve** the existing mobile FAB integration.
4. **Preserve** the existing `DeleteToRecycleBinDialog` and bulk-delete behavior.
5. **Preserve** the existing `BulkUploader` controlled open/close state.
6. Use `useDropzone` (already a project dependency) for all image upload zones.
7. All Cloudinary uploads go through the direct REST call pattern (same as
   BulkUploader — no helper abstraction needed).
8. TDS generation is **fire-and-forget** — a failed TDS must NOT abort the
   product save.
9. `logAuditEvent` must be called on every successful create.
10. `toast.success` / `toast.error` for user feedback (sonner).
11. The flow is **create-only** — edit mode is handled separately via the
    existing `submitProductUpdate` workflow; do not add edit logic here.

---

## 9 · Verification Checklist

After refactoring, verify:

- [ ] A product created through the new flow has **identical field names** to one
      created by BulkUploader when inspected in Firestore
- [ ] `itemCodes` is stored as `{ ECOSHIFT?: string, LIT?: string, … }`
- [ ] `technicalSpecs` is `[{ specGroup: "UPPER", specs: [{name, value}] }]`
- [ ] `ecoItemCode` and `litItemCode` are top-level strings (legacy compat)
- [ ] `productFamily` is the UPPER_CASE family title string (not the ID)
- [ ] `status` is always `"draft"` on create
- [ ] `importSource` is `"add-new-product-form"`
- [ ] No product is saved if `itemDescription` is empty
- [ ] No product is saved if zero item codes are filled
- [ ] TDS PDF is uploaded and `tdsFileUrl` is written if technicalSpecs exist
- [ ] Audit log entry is created in `cms_audit_logs`
- [ ] Firestore real-time listener in AllProducts auto-shows the new product
- [ ] Closing the flow at any step resets all state
- [ ] Mobile FAB still opens the flow on small viewports
- [ ] Desktop "Add Product" button still opens the flow on large viewports