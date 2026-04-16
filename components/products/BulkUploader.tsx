"use client";

/**
 * components/product-forms/bulk-uploader.tsx
 *
 * Excel-only bulk product importer.
 *  - Column-header-based field detection (not fixed positions)
 *  - Supports new `itemCodes` schema ({ ECOSHIFT?, LIT?, LUMERA?, OKO?, ZUMTOBEL? })
 *  - Legacy litItemCode / ecoItemCode columns still recognised and migrated
 *  - Duplicate check uses itemCodes (new schema + legacy fields)
 *  - TDS generated as plain tabular output (includeBrandAssets = false)
 *  - All Firestore writes and audit trails preserved
 *  - Styled with TOKEN design tokens; terminal UI preserved
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import ExcelJS from "exceljs";

import {
  generateTdsPdf,
  uploadTdsPdf,
  normaliseBrand,
  type TdsBrand,
} from "@/lib/tdsGenerator";

import { toast } from "sonner";
import { logAuditEvent } from "@/lib/logger";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";

import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  PackagePlus,
  Terminal,
  FileUp,
  FileSpreadsheet,
  ChevronRight,
  RefreshCw,
  XCircle,
  FileText,
  Tag,
  Package,
  Info,
  X,
} from "lucide-react";

import type { ItemCodes, ItemCodeBrand } from "@/types/product";
import {
  ALL_BRANDS,
  ITEM_CODE_BRAND_CONFIG,
  getFilledItemCodes,
  hasAtLeastOneItemCode,
} from "@/types/product";
import { ItemCodesDisplay } from "@/components/ItemCodesDisplay";

// ─── Env ──────────────────────────────────────────────────────────────────────

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dvmpn8mjh";
const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "taskflow_preset";
const OWN_CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedProduct {
  itemDescription: string;
  itemCodes: ItemCodes;
  ecoItemCode: string;
  litItemCode: string;
  productFamily: string;
  productClass: string;
  productUsage: string[];
  brand: TdsBrand;
  mainImageUrl: string;
  rawImageUrl: string;
  galleryImageUrls: string[];
  dimensionalDrawingUrl: string;
  recommendedMountingHeightUrl: string;
  driverCompatibilityUrl: string;
  baseImageUrl: string;
  illuminanceLevelUrl: string;
  wiringDiagramUrl: string;
  installationUrl: string;
  wiringLayoutUrl: string;
  typeOfPlugUrl: string;
  terminalLayoutUrl: string;
  accessoriesImageUrl: string;
  specs: Record<string, { label: string; value: string }[]>;
}

interface ImportStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

type PreviewTab = "files" | "categories" | "products";
type Step = "idle" | "preview" | "importing" | "done" | "cancelled";
type LogType = "ok" | "err" | "skip" | "info" | "warn";

// ─── Column header maps ───────────────────────────────────────────────────────

const IMG_HEADER_TO_FIELD: Record<string, keyof ParsedProduct> = {
  "MAIN IMAGE": "mainImageUrl",
  "RAW IMAGE": "rawImageUrl",
  "GALLERY IMAGES": "galleryImageUrls",
  "DIMENSIONAL DRAWING": "dimensionalDrawingUrl",
  "RECOMMENDED MOUNTING HEIGHT": "recommendedMountingHeightUrl",
  "DRIVER COMPATIBILITY": "driverCompatibilityUrl",
  BASE: "baseImageUrl",
  "ILLUMINANCE LEVEL": "illuminanceLevelUrl",
  "WIRING DIAGRAM": "wiringDiagramUrl",
  INSTALLATION: "installationUrl",
  "WIRING LAYOUT": "wiringLayoutUrl",
  "TERMINAL LAYOUT": "terminalLayoutUrl",
  ACCESSORIES: "accessoriesImageUrl",
  "TYPE OF PLUG": "typeOfPlugUrl",
};

const ITEM_CODE_HEADER_MAP: Record<string, ItemCodeBrand> = {
  "ECOSHIFT ITEM CODE": "ECOSHIFT",
  "ECO ITEM CODE": "ECOSHIFT",
  "ECOITEMCODE": "ECOSHIFT",
  "LIT ITEM CODE": "LIT",
  "LITITEMCODE": "LIT",
  "LIT CODE": "LIT",
  "LUMERA ITEM CODE": "LUMERA",
  "LUMERAITEMCODE": "LUMERA",
  "OKO ITEM CODE": "OKO",
  "OKOITEMCODE": "OKO",
  "ZUMTOBEL ITEM CODE": "ZUMTOBEL",
  "ZUMTOBELITEMCODE": "ZUMTOBEL",
  "ECO CODE": "ECOSHIFT",
  "ECOSHIFT CODE": "ECOSHIFT",
  "LIT BRAND CODE": "LIT",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseProductClass(raw: string): "spf" | "standard" | "" {
  const s = raw.toLowerCase().trim();
  if (s === "spf" || s.includes("spf")) return "spf";
  if (s === "standard" || s.includes("standard")) return "standard";
  return "";
}

function parseProductUsage(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|/]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ["INDOOR", "OUTDOOR", "SOLAR"].includes(s));
}

function parseGalleryUrls(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as any))
    return String((v as any).text).trim();
  if (typeof v === "object" && "result" in (v as any))
    return String((v as any).result).trim();
  return String(v).replace(/[\r\n]+/g, " ").trim();
}

function buildGroupMap(groupRow: (string | null)[]): Record<number, string> {
  const map: Record<number, string> = {};
  let current = "";
  for (let i = 0; i < groupRow.length; i++) {
    const cell = groupRow[i];
    if (cell && cell.trim()) current = cell.trim();
    if (current) map[i] = current;
  }
  return map;
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

async function parseWorkbook(file: File): Promise<{
  sheetName: string;
  products: ParsedProduct[];
  warnings: string[];
  brandCounts: Record<ItemCodeBrand, number>;
}> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const candidates = wb.worksheets.filter(
    (s) => !/^all\s*products$/i.test(s.name.trim()),
  );
  const ws = candidates[0] ?? wb.worksheets[0];
  if (!ws) throw new Error(`No usable worksheet found in ${file.name}.`);

  const allRows: (string | null)[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: (string | null)[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const hyperlink =
        typeof (cell as any).hyperlink === "string"
          ? ((cell as any).hyperlink as string).trim()
          : null;
      cells[Number(cell.col) - 1] =
        hyperlink ?? (cell.value != null ? cellStr(cell.value) : null);
    });
    allRows.push(cells);
  });

  if (allRows.length < 2)
    throw new Error("Sheet must have at least a header row.");

  const headerRow = allRows[0];
  const groupRow = allRows[1];
  const dataRows = allRows.slice(2);

  let itemDescriptionCol = -1;
  let productUsageCol = -1;
  let productFamilyCol = -1;
  let productClassCol = -1;
  let brandCol = -1;

  const itemCodeCols: Record<ItemCodeBrand, number> = {
    ECOSHIFT: -1,
    LIT: -1,
    LUMERA: -1,
    OKO: -1,
    ZUMTOBEL: -1,
  };

  const imgColMap: Record<number, keyof ParsedProduct> = {};
  const imgColSet = new Set<number>();

  headerRow.forEach((h, i) => {
    if (!h) return;
    const upper = h.replace(/[\r\n\t]+/g, " ").trim().toUpperCase();

    const itemCodeBrand = ITEM_CODE_HEADER_MAP[upper];
    if (itemCodeBrand) {
      itemCodeCols[itemCodeBrand] = i;
      return;
    }

    const imgField = IMG_HEADER_TO_FIELD[upper];
    if (imgField) {
      imgColMap[i] = imgField;
      imgColSet.add(i);
      return;
    }

    if (upper === "ITEM DESCRIPTION" || upper === "ITEMDESCRIPTION" || upper === "DESCRIPTION") {
      itemDescriptionCol = i;
    } else if (upper === "PRODUCT USAGE" || upper === "USAGE" || upper === "PRODUCTUSAGE") {
      productUsageCol = i;
    } else if (
      upper === "PRODUCT FAMILY" ||
      upper === "PRODUCTFAMILY" ||
      upper === "FAMILY" ||
      upper === "CATEGORY"
    ) {
      productFamilyCol = i;
    } else if (upper === "PRODUCT CLASS" || upper === "PRODUCTCLASS" || upper === "CLASS") {
      productClassCol = i;
    } else if (upper === "BRAND") {
      brandCol = i;
    }
  });

  const groupMap = buildGroupMap(groupRow as string[]);

  const knownNonSpecCols = new Set<number>([
    itemDescriptionCol,
    productUsageCol,
    productFamilyCol,
    productClassCol,
    brandCol,
    ...Object.values(itemCodeCols).filter((c) => c >= 0),
    ...imgColSet,
  ]);

  const specLabelMap: Record<number, string> = {};
  headerRow.forEach((h, i) => {
    if (knownNonSpecCols.has(i)) return;
    if (imgColSet.has(i)) return;
    if (!h || !groupMap[i]) return;
    specLabelMap[i] = h.replace(/[\r\n\t]+/g, " ").trim();
  });

  const galleryCol = Object.entries(imgColMap).find(
    ([, f]) => f === "galleryImageUrls",
  )?.[0];

  const products: ParsedProduct[] = [];
  const warnings: string[] = [];
  const brandCounts: Record<ItemCodeBrand, number> = {
    ECOSHIFT: 0,
    LIT: 0,
    LUMERA: 0,
    OKO: 0,
    ZUMTOBEL: 0,
  };

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const g = (col: number) => (col >= 0 ? (row[col]?.trim() ?? "") : "");
    const itemDescription = itemDescriptionCol >= 0 ? g(itemDescriptionCol) : "";

    const itemCodes: ItemCodes = {};
    ALL_BRANDS.forEach((brand) => {
      const col = itemCodeCols[brand];
      if (col >= 0) {
        const val = g(col);
        if (val && val.toUpperCase() !== "N/A") {
          itemCodes[brand] = val.toUpperCase();
        }
      }
    });

    if (!itemDescription) {
      warnings.push(`Row ${rowIdx + 3}: skipped — missing Item Description`);
      continue;
    }

    if (!hasAtLeastOneItemCode(itemCodes)) {
      warnings.push(
        `Row ${rowIdx + 3} ("${itemDescription}"): skipped — no item codes found`,
      );
      continue;
    }

    getFilledItemCodes(itemCodes).forEach(({ brand }) => {
      brandCounts[brand] = (brandCounts[brand] ?? 0) + 1;
    });

    const ecoItemCode = itemCodes.ECOSHIFT ?? "";
    const litItemCode = itemCodes.LIT ?? "";

    const rowBrandRaw = brandCol >= 0 ? g(brandCol) : "";
    const brand = normaliseBrand(rowBrandRaw || (litItemCode ? "LIT" : "ECOSHIFT"));

    const specsByGroup: Record<string, { label: string; value: string }[]> = {};
    for (const [colStr, label] of Object.entries(specLabelMap)) {
      const col = Number(colStr);
      const val = row[col]?.trim();
      if (!val) continue;
      const group = groupMap[col];
      if (!group) continue;
      if (!specsByGroup[group]) specsByGroup[group] = [];
      specsByGroup[group].push({ label, value: val });
    }

    const imgVals: Partial<Record<keyof ParsedProduct, string>> = {};
    for (const [colStr, field] of Object.entries(imgColMap)) {
      if (field === "galleryImageUrls") continue;
      imgVals[field] = row[Number(colStr)]?.trim() ?? "";
    }

    products.push({
      itemDescription,
      itemCodes,
      ecoItemCode,
      litItemCode,
      productFamily:
        (productFamilyCol >= 0 ? g(productFamilyCol) : "").toUpperCase() ||
        "UNCATEGORISED",
      productClass: normaliseProductClass(productClassCol >= 0 ? g(productClassCol) : ""),
      productUsage: parseProductUsage(productUsageCol >= 0 ? g(productUsageCol) : ""),
      brand,
      mainImageUrl: imgVals.mainImageUrl ?? "",
      rawImageUrl: imgVals.rawImageUrl ?? "",
      galleryImageUrls:
        galleryCol !== undefined && Number(galleryCol) >= 0
          ? parseGalleryUrls(g(Number(galleryCol)))
          : [],
      dimensionalDrawingUrl: imgVals.dimensionalDrawingUrl ?? "",
      recommendedMountingHeightUrl: imgVals.recommendedMountingHeightUrl ?? "",
      driverCompatibilityUrl: imgVals.driverCompatibilityUrl ?? "",
      baseImageUrl: imgVals.baseImageUrl ?? "",
      illuminanceLevelUrl: imgVals.illuminanceLevelUrl ?? "",
      wiringDiagramUrl: imgVals.wiringDiagramUrl ?? "",
      installationUrl: imgVals.installationUrl ?? "",
      wiringLayoutUrl: imgVals.wiringLayoutUrl ?? "",
      terminalLayoutUrl: imgVals.terminalLayoutUrl ?? "",
      accessoriesImageUrl: imgVals.accessoriesImageUrl ?? "",
      typeOfPlugUrl: imgVals.typeOfPlugUrl ?? "",
      specs: specsByGroup,
    });
  }

  return { sheetName: ws.name, products, warnings, brandCounts };
}

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

async function uploadUrlToCloudinary(url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith(OWN_CLOUDINARY_BASE)) return url;
  const driveMatch = url.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/,
  );
  const resolved = driveMatch
    ? `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`
    : url;
  const fd = new FormData();
  fd.append("file", resolved);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd },
  );
  if (!res.ok)
    throw new Error(`Cloudinary upload failed (${res.status}) for: ${resolved}`);
  return (await res.json()).secure_url as string;
}

async function safeUploadUrl(url: string, log: (m: string) => void): Promise<string> {
  if (!url) return "";
  try {
    return await uploadUrlToCloudinary(url);
  } catch (e: any) {
    log(`    ⚠️  Image upload skipped (${url.slice(0, 60)}…): ${e.message}`);
    return "";
  }
}

async function uploadManyUrls(
  urls: string[],
  log: (m: string) => void,
  concurrency = 3,
): Promise<string[]> {
  const out: string[] = new Array(urls.length).fill("");
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((u) => safeUploadUrl(u, log)));
    settled.forEach((r, j) => {
      if (r.status === "fulfilled") out[i + j] = r.value;
    });
  }
  return out;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function findDoc(col: string, field: string, value: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, col), where(field, "==", value)));
  return snap.empty ? null : snap.docs[0].id;
}

async function upsertSpecGroup(groupName: string, labels: string[]): Promise<string> {
  const existingId = await findDoc("specs", "name", groupName);
  if (existingId) {
    const snap = await getDocs(
      query(collection(db, "specs"), where("name", "==", groupName)),
    );
    const existing = snap.docs[0];
    const items: { label: string }[] = existing.data().items ?? [];
    const set = new Set(items.map((i) => i.label));
    const merged = [
      ...items,
      ...labels.filter((l) => !set.has(l)).map((l) => ({ label: l })),
    ];
    await updateDoc(doc(db, "specs", existingId), {
      items: merged,
      updatedAt: serverTimestamp(),
    });
    return existingId;
  }
  const ref = await addDoc(collection(db, "specs"), {
    name: groupName,
    items: labels.map((l) => ({ label: l })),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

type FamilySpecItemsByGroupId = Record<string, Set<string>>;

function buildSpecItemId(specGroupId: string, label: string) {
  return `${specGroupId}:${label.toUpperCase().trim()}`;
}

async function upsertProductFamily(
  title: string,
  specGroupIds: string[],
  specItemsByGroupId: FamilySpecItemsByGroupId = {},
): Promise<string> {
  const existingId = await findDoc("productfamilies", "title", title);
  if (existingId) {
    const snap = await getDocs(
      query(collection(db, "productfamilies"), where("title", "==", title)),
    );
    const existing = snap.docs[0];
    const data = existing.data() as any;
    const existingSpecs: string[] = data.specifications ?? [];
    const mergedGroupIds = Array.from(new Set<string>([...existingSpecs, ...specGroupIds]));

    const existingSpecsArray: {
      specGroupId: string;
      specItems?: { id: string; name: string }[];
    }[] = Array.isArray(data.specs) ? data.specs : [];

    const specsMap = new Map<
      string,
      { specGroupId: string; specItems: { id: string; name: string }[] }
    >();
    for (const g of existingSpecsArray) {
      specsMap.set(g.specGroupId, {
        specGroupId: g.specGroupId,
        specItems: Array.isArray(g.specItems) ? g.specItems : [],
      });
    }

    for (const groupId of specGroupIds) {
      const labelsSet = specItemsByGroupId[groupId];
      if (!labelsSet || labelsSet.size === 0) continue;
      const existingGroup = specsMap.get(groupId) ?? { specGroupId: groupId, specItems: [] };
      const existingItemIds = new Set(existingGroup.specItems.map((it) => it.id));
      for (const rawLabel of labelsSet) {
        const label = rawLabel.toUpperCase().trim();
        if (!label) continue;
        const id = buildSpecItemId(groupId, label);
        if (existingItemIds.has(id)) continue;
        existingGroup.specItems.push({ id, name: label });
        existingItemIds.add(id);
      }
      specsMap.set(groupId, existingGroup);
    }

    await updateDoc(doc(db, "productfamilies", existingId), {
      specifications: mergedGroupIds,
      specs: Array.from(specsMap.values()),
      updatedAt: serverTimestamp(),
    });
    return existingId;
  }

  const specsArray: { specGroupId: string; specItems: { id: string; name: string }[] }[] = [];
  for (const groupId of specGroupIds) {
    const labelsSet = specItemsByGroupId[groupId];
    if (!labelsSet || labelsSet.size === 0) continue;
    const items: { id: string; name: string }[] = [];
    for (const rawLabel of labelsSet) {
      const label = rawLabel.toUpperCase().trim();
      if (!label) continue;
      items.push({ id: buildSpecItemId(groupId, label), name: label });
    }
    if (items.length > 0) specsArray.push({ specGroupId: groupId, specItems: items });
  }

  const ref = await addDoc(collection(db, "productfamilies"), {
    title,
    description: "",
    image: "",
    imageUrl: "",
    isActive: true,
    specifications: specGroupIds,
    specs: specsArray,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Duplicate check ──────────────────────────────────────────────────────────

async function checkDuplicate(itemCodes: ItemCodes): Promise<{ isDuplicate: boolean; reason: string }> {
  const filled = getFilledItemCodes(itemCodes);
  if (filled.length === 0) return { isDuplicate: false, reason: "" };

  for (const { brand, code } of filled) {
    const fieldToCheck =
      brand === "ECOSHIFT" ? "ecoItemCode" : brand === "LIT" ? "litItemCode" : null;

    const snapNew = await getDocs(
      query(collection(db, "products"), where(`itemCodes.${brand}`, "==", code)),
    );
    if (!snapNew.empty) return { isDuplicate: true, reason: `${brand} item code "${code}"` };

    if (fieldToCheck) {
      const snapLegacy = await getDocs(
        query(collection(db, "products"), where(fieldToCheck, "==", code)),
      );
      if (!snapLegacy.empty)
        return { isDuplicate: true, reason: `${brand} item code "${code}" (legacy)` };
    }
  }

  return { isDuplicate: false, reason: "" };
}

// ─── TOKEN-styled sub-components ─────────────────────────────────────────────

// Tab button
function TabBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 8,
        border: "none",
        background: active ? TOKEN.primary : "transparent",
        color: active ? "#fff" : TOKEN.textSec,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
      <span
        style={{
          marginLeft: 2,
          padding: "1px 7px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          background: active ? "rgba(255,255,255,0.22)" : TOKEN.bg,
          color: active ? "#fff" : TOKEN.textSec,
        }}
      >
        {count}
      </span>
    </button>
  );
}

// Files tab panel
function FilesPanel({
  fileSummary,
}: {
  fileSummary: {
    name: string;
    sheetName: string;
    productCount: number;
    families: Set<string>;
    warnings: string[];
    brandCounts: Record<ItemCodeBrand, number>;
  }[];
}) {
  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
      {fileSummary.map((file, idx) => (
        <div
          key={idx}
          style={{
            border: `1px solid ${TOKEN.border}`,
            borderRadius: 12,
            background: TOKEN.surface,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TOKEN.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: TOKEN.textSec, fontFamily: "monospace" }}>
                Sheet: <span style={{ color: TOKEN.textPri }}>{file.sheetName}</span>
              </p>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: TOKEN.bg,
                border: `1px solid ${TOKEN.border}`,
                color: TOKEN.textSec,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {file.productCount} products
            </span>
          </div>

          {/* Brand counts */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {(ALL_BRANDS as ItemCodeBrand[])
              .filter((b) => (file.brandCounts[b] ?? 0) > 0)
              .map((brand) => {
                const config = ITEM_CODE_BRAND_CONFIG[brand];
                return (
                  <div key={brand} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span
                      className={`${config.badgeClass} border`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      <span className={config.dotClass} style={{ width: 6, height: 6, borderRadius: "50%" }} />
                      {config.label}
                    </span>
                    <span style={{ fontSize: 10, color: TOKEN.textSec }}>{file.brandCounts[brand]}</span>
                  </div>
                );
              })}
          </div>

          {/* Families */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {Array.from(file.families).map((f) => (
              <span
                key={f}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 5,
                  border: `1px solid ${TOKEN.border}`,
                  background: TOKEN.bg,
                  color: TOKEN.textSec,
                }}
              >
                {f}
              </span>
            ))}
          </div>

          {file.warnings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {file.warnings.map((w, wi) => (
                <p
                  key={wi}
                  style={{ margin: 0, fontSize: 10, color: "#d97706", display: "flex", alignItems: "flex-start", gap: 5 }}
                >
                  <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Categories tab panel
function CategoriesPanel({
  categorySummary,
  allProducts,
}: {
  categorySummary: Record<string, number>;
  allProducts: ParsedProduct[];
}) {
  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
      {Object.entries(categorySummary).map(([family, count]) => {
        const specGroups = new Set(
          allProducts.filter((p) => p.productFamily === family).flatMap((p) => Object.keys(p.specs)),
        );
        return (
          <div
            key={family}
            style={{
              border: `1px solid ${TOKEN.border}`,
              borderRadius: 12,
              background: TOKEN.surface,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TOKEN.textPri }}>{family}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: TOKEN.bg,
                  border: `1px solid ${TOKEN.border}`,
                  color: TOKEN.textSec,
                }}
              >
                {count} products
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Array.from(specGroups).map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 5,
                    border: `1px solid ${TOKEN.border}`,
                    background: TOKEN.bg,
                    color: TOKEN.textSec,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Products table tab panel
function ProductsPanel({ uploadedFiles }: { uploadedFiles: { name: string; products: ParsedProduct[] }[] }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${TOKEN.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 140px 32px",
          padding: "8px 12px",
          background: TOKEN.bg,
          borderBottom: `1px solid ${TOKEN.border}`,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          color: TOKEN.textSec,
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        <span>Item Description</span>
        <span>Family</span>
        <span>Item Codes</span>
        <span style={{ textAlign: "center" }}>Img</span>
      </div>

      {/* Table body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {uploadedFiles.map((file, fileIdx) =>
          file.products.map((p, prodIdx) => (
            <div
              key={`${fileIdx}-${prodIdx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 140px 32px",
                alignItems: "center",
                padding: "8px 12px",
                fontSize: 12,
                borderBottom: `1px solid ${TOKEN.border}`,
              }}
            >
              <div style={{ minWidth: 0, paddingRight: 8 }}>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 500,
                    color: TOKEN.textPri,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.itemDescription}
                </p>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: TOKEN.textSec,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingRight: 8,
                }}
              >
                {p.productFamily}
              </span>
              <div style={{ paddingRight: 8 }}>
                <ItemCodesDisplay itemCodes={p.itemCodes} size="sm" maxVisible={2} />
              </div>
              <span style={{ display: "flex", justifyContent: "center" }}>
                {p.mainImageUrl ? (
                  <CheckCircle size={14} color="#16a34a" />
                ) : (
                  <AlertCircle size={14} color="#d97706" />
                )}
              </span>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BulkUploader({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats>({ total: 0, success: 0, failed: 0, skipped: 0 });
  const [logs, setLogs] = useState<{ type: LogType; msg: string }[]>([]);
  const [currentItem, setCurrentItem] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [activeTab, setActiveTab] = useState<PreviewTab>("files");
  const [uploadedFiles, setUploadedFiles] = useState<
    {
      name: string;
      sheetName: string;
      products: ParsedProduct[];
      warnings: string[];
      brandCounts: Record<ItemCodeBrand, number>;
    }[]
  >([]);

  const cancelledRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((type: LogType, msg: string) => {
    setLogs((prev) => [
      ...prev,
      { type, msg: `${new Date().toLocaleTimeString()} ${msg}` },
    ]);
  }, []);

  // ── File drop ────────────────────────────────────────────────────────────────

  const handleFileDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      addLog("info", `📂 Parsing ${files.length} file(s)...`);
      const parsed: typeof uploadedFiles = [];
      for (const file of files) {
        try {
          const { sheetName, products, warnings, brandCounts } = await parseWorkbook(file);
          parsed.push({ name: file.name, sheetName, products, warnings, brandCounts });
          const brandSummary = (ALL_BRANDS as ItemCodeBrand[])
            .filter((b) => brandCounts[b] > 0)
            .map((b) => `${ITEM_CODE_BRAND_CONFIG[b].label}: ${brandCounts[b]}`)
            .join(", ");
          addLog(
            "info",
            `  ✅ ${file.name}: ${products.length} products${brandSummary ? ` [${brandSummary}]` : ""}`,
          );
          warnings.forEach((w) => addLog("warn", `  ⚠️  ${w}`));
        } catch (err: any) {
          addLog("err", `  ❌ ${file.name}: ${err.message}`);
        }
      }
      if (!parsed.length) {
        toast.error("No files were successfully parsed");
        return;
      }
      setUploadedFiles(parsed);
      setActiveTab("files");
      setStep("preview");
      const total = parsed.reduce((s, f) => s + f.products.length, 0);
      addLog("info", `✅ Parsed ${parsed.length} file(s) — ${total} valid products`);
    },
    [addLog],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    multiple: true,
    disabled: step !== "idle" || importing,
  });

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleCancel = () => {
    cancelledRef.current = true;
    addLog("warn", "⚠️  Cancellation requested — stopping after current item...");
  };

  const runExcelImport = async () => {
    const allProducts = uploadedFiles.flatMap((f) => f.products);
    if (!allProducts.length) return;

    cancelledRef.current = false;
    setImporting(true);
    setStep("importing");
    setProgress(0);
    setStats({ total: allProducts.length, success: 0, failed: 0, skipped: 0 });
    addLog("info", `🚀 Starting JARIS import of ${allProducts.length} products from ${uploadedFiles.length} file(s)...`);

    // Phase 1: Upsert spec groups
    const allSpecGroups: Record<string, Set<string>> = {};
    const familyToGroups: Record<string, Set<string>> = {};
    const familySpecItems: Record<string, FamilySpecItemsByGroupId> = {};

    for (const p of allProducts) {
      const familyTitle = p.productFamily;
      if (!familyToGroups[familyTitle]) familyToGroups[familyTitle] = new Set();
      if (!familySpecItems[familyTitle]) familySpecItems[familyTitle] = {};
      for (const [groupName, specEntries] of Object.entries(p.specs)) {
        if (!allSpecGroups[groupName]) allSpecGroups[groupName] = new Set();
        specEntries.forEach((e) => allSpecGroups[groupName].add(e.label));
        familyToGroups[familyTitle].add(groupName);
        if (!familySpecItems[familyTitle][groupName])
          familySpecItems[familyTitle][groupName] = new Set();
        specEntries.forEach((e) => {
          const label = e.label.toUpperCase().trim();
          if (label) familySpecItems[familyTitle][groupName].add(label);
        });
      }
    }

    addLog("info", `🗂️  Upserting ${Object.keys(allSpecGroups).length} spec group(s)...`);
    const specGroupIds: Record<string, string> = {};
    for (const [groupName, labelsSet] of Object.entries(allSpecGroups)) {
      try {
        const id = await upsertSpecGroup(groupName, Array.from(labelsSet));
        specGroupIds[groupName] = id;
        addLog("info", `  ✓ Spec group "${groupName}" → ${id}`);
      } catch (err: any) {
        addLog("err", `  ✗ Spec group "${groupName}": ${err.message}`);
      }
    }

    // Phase 2: Upsert product families
    addLog("info", `📦 Upserting ${Object.keys(familyToGroups).length} product famil(ies)...`);
    for (const [familyTitle, groupNames] of Object.entries(familyToGroups)) {
      const specIds = Array.from(groupNames).map((g) => specGroupIds[g]).filter(Boolean);
      const byGroupId: FamilySpecItemsByGroupId = {};
      const perFamily = familySpecItems[familyTitle] ?? {};
      for (const groupName of groupNames) {
        const gid = specGroupIds[groupName];
        if (!gid) continue;
        const labels = perFamily[groupName] ? Array.from(perFamily[groupName]) : [];
        if (!byGroupId[gid]) byGroupId[gid] = new Set();
        labels.forEach((lbl) => byGroupId[gid].add(lbl.toUpperCase().trim()));
      }
      try {
        const id = await upsertProductFamily(familyTitle, specIds, byGroupId);
        addLog("info", `  ✓ Product family "${familyTitle}" → ${id}`);
      } catch (err: any) {
        addLog("err", `  ✗ Product family "${familyTitle}": ${err.message}`);
      }
    }

    // Phase 3: Import products
    addLog("info", `\n📝 Importing products...`);

    for (let i = 0; i < allProducts.length; i++) {
      if (cancelledRef.current) {
        const remaining = allProducts.length - i;
        addLog("warn", `🛑 Import cancelled. ${i} processed, ${remaining} remaining skipped.`);
        setStats((prev) => ({ ...prev, skipped: prev.skipped + remaining }));
        break;
      }

      const p = allProducts[i];
      const displayCode =
        getFilledItemCodes(p.itemCodes)
          .map(({ brand, code }) => `${brand}:${code}`)
          .join(" / ") || "NO CODE";
      setCurrentItem(`${displayCode} — ${p.itemDescription}`);

      try {
        const { isDuplicate, reason } = await checkDuplicate(p.itemCodes);
        if (isDuplicate) {
          addLog("skip", `⏭  SKIPPED (duplicate ${reason}): ${p.itemDescription}`);
          setStats((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
          setProgress(((i + 1) / allProducts.length) * 100);
          await new Promise((r) => setTimeout(r, 20));
          continue;
        }

        addLog("info", `  → Uploading images for "${p.itemDescription}"...`);
        const [
          mainImage,
          rawImageUploaded,
          dimensionalDrawingImage,
          recommendedMountingHeightImage,
          driverCompatibilityImage,
          baseImage,
          illuminanceLevelImage,
          wiringDiagramImage,
          installationImage,
          wiringLayoutImage,
          terminalLayoutImage,
          accessoriesImage,
          typeOfPlugImage,
          ...galleryUploaded
        ] = await uploadManyUrls(
          [
            p.mainImageUrl,
            p.rawImageUrl,
            p.dimensionalDrawingUrl,
            p.recommendedMountingHeightUrl,
            p.driverCompatibilityUrl,
            p.baseImageUrl,
            p.illuminanceLevelUrl,
            p.wiringDiagramUrl,
            p.installationUrl,
            p.wiringLayoutUrl,
            p.terminalLayoutUrl,
            p.accessoriesImageUrl,
            p.typeOfPlugUrl,
            ...p.galleryImageUrls,
          ],
          (m) => addLog("info", m),
        );

        const rawImage = rawImageUploaded || mainImage || "";

        const technicalSpecs = Object.entries(p.specs)
          .map(([specGroup, entries]) => ({
            specGroup: specGroup.toUpperCase().trim(),
            specs: entries
              .filter((e) => {
                const v = e.value.toUpperCase().trim();
                return v !== "" && v !== "N/A";
              })
              .map((e) => ({
                name: e.label.toUpperCase().trim(),
                value: e.value.toUpperCase().trim(),
              })),
          }))
          .filter((group) => group.specs.length > 0);

        const slug = (p.ecoItemCode || p.litItemCode || p.itemDescription)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");

        const docRef = await addDoc(collection(db, "products"), {
          productClass: p.productClass,
          itemDescription: p.itemDescription,
          shortDescription: "",
          slug,
          itemCodes: p.itemCodes,
          ecoItemCode: p.ecoItemCode,
          litItemCode: p.litItemCode,
          regularPrice: 0,
          salePrice: 0,
          technicalSpecs,
          mainImage: mainImage || "",
          rawImage,
          qrCodeImage: "",
          galleryImages: galleryUploaded.filter(Boolean),
          dimensionalDrawingImage: dimensionalDrawingImage || "",
          recommendedMountingHeightImage: recommendedMountingHeightImage || "",
          driverCompatibilityImage: driverCompatibilityImage || "",
          baseImage: baseImage || "",
          illuminanceLevelImage: illuminanceLevelImage || "",
          wiringDiagramImage: wiringDiagramImage || "",
          installationImage: installationImage || "",
          wiringLayoutImage: wiringLayoutImage || "",
          terminalLayoutImage: terminalLayoutImage || "",
          accessoriesImage: accessoriesImage || "",
          typeOfPlugImage: typeOfPlugImage || "",
          brand: p.brand,
          productFamily: p.productFamily,
          productUsage: p.productUsage,
          applications: [],
          website: [],
          websites: [],
          status: "draft",
          seo: {
            title: p.itemDescription,
            description: "",
            canonical: "",
            ogImage: mainImage || "",
            robots: "index, follow",
            lastUpdated: new Date().toISOString(),
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          importSource: "bulk-uploader:jaris",
        });

        addLog("info", `  → Saved product doc ${docRef.id}`);

        if (technicalSpecs.length > 0) {
          try {
            addLog("info", `  → Generating TDS PDF for "${p.itemDescription}"...`);
            const tdsBlob = await generateTdsPdf({
              itemDescription: p.itemDescription,
              itemCodes: p.itemCodes,
              litItemCode: p.litItemCode,
              technicalSpecs,
              brand: p.brand,
              includeBrandAssets: false,
              mainImageUrl: mainImage || undefined,
              rawImageUrl: rawImageUploaded || undefined,
              dimensionalDrawingUrl: dimensionalDrawingImage || undefined,
              recommendedMountingHeightUrl: recommendedMountingHeightImage || undefined,
              driverCompatibilityUrl: driverCompatibilityImage || undefined,
              baseImageUrl: baseImage || undefined,
              illuminanceLevelUrl: illuminanceLevelImage || undefined,
              wiringDiagramUrl: wiringDiagramImage || undefined,
              installationUrl: installationImage || undefined,
              wiringLayoutUrl: wiringLayoutImage || undefined,
              typeOfPlugUrl: typeOfPlugImage || undefined,
              terminalLayoutUrl: terminalLayoutImage || undefined,
              accessoriesImageUrl: accessoriesImage || undefined,
            });

            const primaryCode = getFilledItemCodes(p.itemCodes)[0]?.code || p.itemDescription;
            const tdsFileUrl = await uploadTdsPdf(
              tdsBlob,
              `${primaryCode}_TDS.pdf`,
              CLOUDINARY_CLOUD_NAME,
              CLOUDINARY_UPLOAD_PRESET,
            );

            if (tdsFileUrl.startsWith("http")) {
              await updateDoc(doc(db, "products", docRef.id), {
                tdsFileUrl,
                updatedAt: serverTimestamp(),
              });
              addLog("ok", `  ✅ TDS PDF generated for "${p.itemDescription}"`);
            }
          } catch (tdsErr: any) {
            addLog("warn", `  ⚠️  TDS generation failed for "${p.itemDescription}": ${tdsErr.message}`);
          }
        } else {
          addLog("info", `  ℹ️  No specs — TDS skipped for "${p.itemDescription}"`);
        }

        await logAuditEvent({
          action: "create",
          entityType: "product",
          entityId: docRef.id,
          entityName: p.itemDescription,
          context: {
            page: "/products/all-products",
            source: "bulk-uploader",
            collection: "products",
          },
          metadata: {
            itemCodes: p.itemCodes,
            ecoItemCode: p.ecoItemCode || null,
            litItemCode: p.litItemCode || null,
            productFamily: p.productFamily,
            brand: p.brand,
          },
        });

        addLog("ok", `✅ ${displayCode} — ${p.itemDescription}`);
        setStats((prev) => ({ ...prev, success: prev.success + 1 }));
      } catch (err: any) {
        addLog("err", `❌ FAILED "${p.itemDescription}": ${err.message}`);
        setStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }

      setProgress(((i + 1) / allProducts.length) * 100);
      await new Promise((r) => setTimeout(r, 40));
    }

    finishImport();
  };

  const finishImport = () => {
    setImporting(false);
    setCurrentItem("");
    if (cancelledRef.current) {
      setStep("cancelled");
      addLog("warn", "🛑 Import was cancelled by user.");
      toast.warning("Import cancelled.");
    } else {
      setStep("done");
      addLog("info", "🏁 Import complete.");
      toast.success("Import complete!");
      onUploadComplete?.();
    }
  };

  const reset = () => {
    setStep("idle");
    setLogs([]);
    setUploadedFiles([]);
    setStats({ total: 0, success: 0, failed: 0, skipped: 0 });
    setProgress(0);
    setCurrentItem("");
    cancelledRef.current = false;
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const excelAllProducts = uploadedFiles.flatMap((f) => f.products);
  const excelFamilySummary = excelAllProducts.reduce<Record<string, number>>(
    (acc, p) => { acc[p.productFamily] = (acc[p.productFamily] || 0) + 1; return acc; },
    {},
  );
  const fileSummary = uploadedFiles.map((file) => ({
    name: file.name,
    sheetName: file.sheetName,
    productCount: file.products.length,
    families: new Set(file.products.map((p) => p.productFamily)),
    warnings: file.warnings,
    brandCounts: file.brandCounts,
  }));
  const previewProductCount = excelAllProducts.length;
  const previewCategoryCount = Object.keys(excelFamilySummary).length;
  const totalWarnings = uploadedFiles.reduce((s, f) => s + f.warnings.length, 0);

  const STEPS = ["idle", "preview", "importing", "done"] as const;

  const logColor = (type: LogType): React.CSSProperties => {
    if (type === "ok") return { color: "#34d399" };
    if (type === "err") return { color: "#f87171" };
    if (type === "skip") return { color: "#fbbf24" };
    if (type === "warn") return { color: "#fb923c" };
    return { color: "#94a3b8" };
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 12,
          border: `1px solid ${TOKEN.border}`,
          background: TOKEN.surface,
          color: TOKEN.textPri,
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <FileSpreadsheet size={15} />
        Bulk Import
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="bulk-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={!importing ? handleClose : undefined}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.5)",
                backdropFilter: "blur(4px)",
                zIndex: 200,
              }}
            />

            {/* Dialog */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 201,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                pointerEvents: "none",
              }}
            >
              <motion.div
                key="bulk-dialog"
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={SPRING_MED}
                style={{
                  pointerEvents: "auto",
                  width: "100%",
                  maxWidth: 760,
                  height: "88vh",
                  background: TOKEN.surface,
                  borderRadius: 20,
                  border: `1px solid ${TOKEN.border}`,
                  boxShadow: "0 24px 64px -12px rgba(15,23,42,0.24)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* ── Header ── */}
                <div
                  style={{
                    padding: "20px 24px 14px",
                    borderBottom: `1px solid ${TOKEN.border}`,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: `${TOKEN.primary}12`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <PackagePlus size={18} color={TOKEN.primary} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: TOKEN.textPri }}>
                          Bulk Product Importer
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                          JARIS&nbsp;
                          <code style={{ fontFamily: "monospace", background: TOKEN.bg, padding: "1px 5px", borderRadius: 4 }}>
                            .xlsx
                          </code>
                          &nbsp;— multi-brand item codes · plain tabular TDS
                        </p>
                      </div>
                    </div>
                    {!importing && (
                      <button
                        onClick={handleClose}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: `1px solid ${TOKEN.border}`,
                          background: TOKEN.surface,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: TOKEN.textSec,
                          flexShrink: 0,
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Step breadcrumb */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 500 }}>
                    {STEPS.map((s, idx) => {
                      const displayStep = step === "cancelled" ? "importing" : step;
                      const isCancelledStep = step === "cancelled" && s === "importing";
                      const isPast = idx < STEPS.indexOf(displayStep as any);
                      const isActive = displayStep === s;
                      return (
                        <React.Fragment key={s}>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: isCancelledStep
                                ? "#f97316"
                                : isActive
                                  ? TOKEN.primary
                                  : isPast
                                    ? `${TOKEN.primary}22`
                                    : TOKEN.bg,
                              color: isCancelledStep || isActive
                                ? "#fff"
                                : isPast
                                  ? TOKEN.primary
                                  : TOKEN.textSec,
                              fontWeight: isActive ? 700 : 500,
                              transition: "all 0.15s",
                            }}
                          >
                            {idx + 1}.{" "}
                            {isCancelledStep
                              ? "Cancelled"
                              : s.charAt(0).toUpperCase() + s.slice(1)}
                          </span>
                          {idx < 3 && (
                            <ChevronRight size={12} color={TOKEN.textSec} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

                  {/* IDLE */}
                  {step === "idle" && (
                    <div style={{ height: "100%", overflowY: "auto" }}>
                      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Multi-brand info banner */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: "1px solid #bfdbfe",
                            background: "#eff6ff",
                          }}
                        >
                          <Info size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
                              Multi-brand item codes supported
                            </p>
                            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#1e40af", opacity: 0.8 }}>
                              Column headers detected automatically. Use any of:
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {(ALL_BRANDS as ItemCodeBrand[]).map((b) => (
                                <span
                                  key={b}
                                  className={`${ITEM_CODE_BRAND_CONFIG[b].badgeClass} border`}
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <span className={ITEM_CODE_BRAND_CONFIG[b].dotClass} style={{ width: 5, height: 5, borderRadius: "50%" }} />
                                  {ITEM_CODE_BRAND_CONFIG[b].label} Item Code
                                </span>
                              ))}
                            </div>
                            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#1e40af", opacity: 0.7 }}>
                              At least one item code column per row is required.
                            </p>
                          </div>
                        </div>

                        {/* Dropzone */}
                        <div
                          {...getRootProps()}
                          style={{
                            border: `2px dashed ${isDragActive ? TOKEN.primary : TOKEN.border}`,
                            borderRadius: 16,
                            padding: "48px 24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 14,
                            cursor: "pointer",
                            background: isDragActive ? `${TOKEN.primary}06` : TOKEN.bg,
                            transition: "all 0.2s",
                          }}
                        >
                          <input {...getInputProps()} />
                          <div
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 16,
                              background: isDragActive ? TOKEN.primary : TOKEN.surface,
                              border: `1px solid ${TOKEN.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                            }}
                          >
                            {isDragActive ? (
                              <FileUp size={26} color="#fff" style={{ animation: "bounce 0.6s ease infinite alternate" }} />
                            ) : (
                              <Upload size={26} color={TOKEN.textSec} />
                            )}
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}>
                              {isDragActive ? "Release to parse" : "Drop JARIS template files here"}
                            </p>
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: TOKEN.textSec }}>
                              or{" "}
                              <span style={{ color: TOKEN.primary, textDecoration: "underline", cursor: "pointer" }}>
                                browse
                              </span>
                              {" "}— accepts multiple .xlsx files
                            </p>
                          </div>
                        </div>

                        {/* Console (logs during parsing) */}
                        {logs.length > 0 && (
                          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                background: "#0f172a",
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                color: "#64748b",
                              }}
                            >
                              <Terminal size={11} /> Console
                            </div>
                            <div
                              style={{
                                background: "#020617",
                                padding: "12px 14px",
                                fontFamily: "monospace",
                                fontSize: 11,
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                                maxHeight: 120,
                                overflowY: "auto",
                              }}
                            >
                              {logs.map((log, i) => (
                                <div key={i} style={{ display: "flex", gap: 10, ...logColor(log.type) }}>
                                  <span style={{ color: "#334155", flexShrink: 0, userSelect: "none" }}>
                                    [{String(i + 1).padStart(3, "0")}]
                                  </span>
                                  <span style={{ wordBreak: "break-all" }}>{log.msg}</span>
                                </div>
                              ))}
                              <div ref={logsEndRef} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PREVIEW */}
                  {step === "preview" && (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      {/* Preview header */}
                      <div
                        style={{
                          padding: "12px 24px",
                          borderBottom: `1px solid ${TOKEN.border}`,
                          background: TOKEN.bg,
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TOKEN.textPri }}>
                              <span style={{ color: TOKEN.primary, fontWeight: 800 }}>{previewProductCount}</span>{" "}
                              product{previewProductCount !== 1 ? "s" : ""} ready across{" "}
                              {previewCategoryCount} famil{previewCategoryCount !== 1 ? "ies" : "y"}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: TOKEN.textSec }}>
                              Duplicates skipped · Saved as Draft · TDS plain tabular · N/A values excluded
                            </p>
                          </div>
                          <button
                            onClick={reset}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: `1px solid ${TOKEN.border}`,
                              background: TOKEN.surface,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              color: TOKEN.textSec,
                              flexShrink: 0,
                              marginLeft: 12,
                            }}
                          >
                            <RefreshCw size={11} /> Change
                          </button>
                        </div>
                        {totalWarnings > 0 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 5,
                              border: "1px solid #fcd34d",
                              color: "#d97706",
                              alignSelf: "flex-start",
                            }}
                          >
                            <AlertCircle size={11} />
                            {totalWarnings} row{totalWarnings !== 1 ? "s" : ""} skipped
                          </span>
                        )}
                      </div>

                      {/* Tabs */}
                      <div
                        style={{
                          padding: "8px 24px",
                          borderBottom: `1px solid ${TOKEN.border}`,
                          background: TOKEN.surface,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <TabBtn
                          active={activeTab === "files"}
                          onClick={() => setActiveTab("files")}
                          icon={<FileText size={12} />}
                          label="Files"
                          count={uploadedFiles.length}
                        />
                        <TabBtn
                          active={activeTab === "categories"}
                          onClick={() => setActiveTab("categories")}
                          icon={<Tag size={12} />}
                          label="Families"
                          count={previewCategoryCount}
                        />
                        <TabBtn
                          active={activeTab === "products"}
                          onClick={() => setActiveTab("products")}
                          icon={<Package size={12} />}
                          label="Products"
                          count={previewProductCount}
                        />
                      </div>

                      {/* Tab content */}
                      <div style={{ flex: 1, minHeight: 0, padding: "16px 24px" }}>
                        {activeTab === "files" && (
                          <FilesPanel fileSummary={fileSummary} />
                        )}
                        {activeTab === "categories" && (
                          <CategoriesPanel
                            categorySummary={excelFamilySummary}
                            allProducts={excelAllProducts}
                          />
                        )}
                        {activeTab === "products" && (
                          <ProductsPanel uploadedFiles={uploadedFiles} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* IMPORTING / DONE / CANCELLED */}
                  {(step === "importing" || step === "done" || step === "cancelled") && (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px 24px", gap: 16 }}>

                      {/* Progress bar */}
                      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              color: TOKEN.textSec,
                            }}
                          >
                            {importing ? (
                              <Loader2 size={15} color={TOKEN.primary} style={{ animation: "spin 0.8s linear infinite" }} />
                            ) : step === "cancelled" ? (
                              <XCircle size={15} color="#f97316" />
                            ) : (
                              <CheckCircle size={15} color="#22c55e" />
                            )}
                            {importing
                              ? `Processing: ${currentItem}`
                              : step === "cancelled"
                                ? "Import cancelled"
                                : "Import complete"}
                          </span>
                          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: TOKEN.primary }}>
                            {Math.round(progress)}%
                          </span>
                        </div>

                        {/* Progress bar track */}
                        <div
                          style={{
                            height: 10,
                            borderRadius: 999,
                            background: TOKEN.bg,
                            border: `1px solid ${TOKEN.border}`,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progress}%`,
                              background: step === "cancelled" ? "#f97316" : TOKEN.primary,
                              borderRadius: 999,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>
                        {[
                          { label: "Total", val: stats.total, color: "#1d4ed8", bg: "#dbeafe", border: "#bfdbfe" },
                          { label: "Success", val: stats.success, color: "#15803d", bg: "#dcfce7", border: "#bbf7d0" },
                          { label: "Failed", val: stats.failed, color: "#b91c1c", bg: "#fee2e2", border: "#fecaca" },
                          { label: "Skipped", val: stats.skipped, color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
                        ].map((s) => (
                          <div
                            key={s.label}
                            style={{
                              background: s.bg,
                              border: `1px solid ${s.border}`,
                              borderRadius: 12,
                              padding: "12px 14px",
                              textAlign: "center",
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: s.color, fontVariantNumeric: "tabular-nums" }}>
                              {s.val}
                            </p>
                            <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: s.color, opacity: 0.7 }}>
                              {s.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Terminal console */}
                      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: TOKEN.textSec,
                            flexShrink: 0,
                          }}
                        >
                          <Terminal size={12} /> Import Console
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minHeight: 0,
                            background: "#020617",
                            borderRadius: 12,
                            padding: "14px 16px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            border: "1px solid #1e293b",
                          }}
                        >
                          {logs.map((log, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, ...logColor(log.type) }}>
                              <span style={{ color: "#334155", flexShrink: 0, userSelect: "none" }}>
                                [{String(i + 1).padStart(3, "0")}]
                              </span>
                              <span style={{ wordBreak: "break-all" }}>{log.msg}</span>
                            </div>
                          ))}
                          {importing && (
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 14,
                                background: TOKEN.primary,
                                marginLeft: 2,
                                animation: "pulse 1s ease infinite",
                              }}
                            />
                          )}
                          <div ref={logsEndRef} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Footer ── */}
                <div
                  style={{
                    padding: "12px 24px",
                    borderTop: `1px solid ${TOKEN.border}`,
                    background: TOKEN.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={handleClose}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${TOKEN.border}`,
                      background: TOKEN.surface,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: TOKEN.textSec,
                    }}
                  >
                    Close
                  </button>

                  <div style={{ display: "flex", gap: 8 }}>
                    {step === "preview" && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={runExcelImport}
                        disabled={importing}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                          background: TOKEN.primary,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: importing ? 0.7 : 1,
                        }}
                      >
                        <Upload size={14} />
                        Import {previewProductCount} Products
                      </motion.button>
                    )}

                    {step === "importing" && importing && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCancel}
                        disabled={cancelledRef.current}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                          background: TOKEN.danger,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: cancelledRef.current ? "not-allowed" : "pointer",
                          opacity: cancelledRef.current ? 0.6 : 1,
                        }}
                      >
                        <XCircle size={14} />
                        {cancelledRef.current ? "Cancelling..." : "Cancel Import"}
                      </motion.button>
                    )}

                    {(step === "done" || step === "cancelled") && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={reset}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: `1px solid ${TOKEN.border}`,
                          background: TOKEN.surface,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          color: TOKEN.textPri,
                        }}
                      >
                        <RefreshCw size={13} /> Import Another
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { to { transform: translateY(-4px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      ` }} />
    </>
  );
}