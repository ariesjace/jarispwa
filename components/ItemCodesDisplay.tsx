"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type ItemCodes,
  type ItemCodeBrand,
  ITEM_CODE_BRAND_CONFIG,
  getFilledItemCodes,
  migrateToItemCodes,
} from "@/types/product";
import { TOKEN } from "@/components/layout/tokens";

// ─── Single brand badge ────────────────────────────────────────────────────────

interface ItemCodeBadgeProps {
  brand: ItemCodeBrand;
  code: string;
  size?: "sm" | "default";
}

export function ItemCodeBadge({
  brand,
  code,
  size = "default",
}: ItemCodeBadgeProps) {
  const config = ITEM_CODE_BRAND_CONFIG[brand];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          className={`${config.badgeClass} border font-mono cursor-default ${
            size === "sm" ? "text-[9px] px-1.5 py-0" : "text-[10px] px-2 py-0.5"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full mr-1 shrink-0 ${config.dotClass}`}
          />
          {code}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── All item codes display ────────────────────────────────────────────────────

interface ItemCodesDisplayProps {
  /** New schema */
  itemCodes?: ItemCodes;
  /** Legacy fallback fields */
  litItemCode?: string;
  ecoItemCode?: string;
  itemCode?: string;
  size?: "sm" | "default";
  maxVisible?: number;
}

export function ItemCodesDisplay({
  itemCodes,
  litItemCode,
  ecoItemCode,
  itemCode,
  size = "default",
  maxVisible,
}: ItemCodesDisplayProps) {
  const resolved = React.useMemo(() => {
    // Try new schema first
    if (itemCodes) {
      const filled = getFilledItemCodes(itemCodes);
      if (filled.length > 0) return filled;
    }
    // Migrate from legacy
    const migrated = migrateToItemCodes({ litItemCode, ecoItemCode, itemCode });
    return getFilledItemCodes(migrated);
  }, [itemCodes, litItemCode, ecoItemCode, itemCode]);

  if (resolved.length === 0) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  const visible = maxVisible ? resolved.slice(0, maxVisible) : resolved;
  const overflow = maxVisible ? resolved.length - maxVisible : 0;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(({ brand, code }) => (
        <ItemCodeBadge key={brand} brand={brand} code={code} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground font-semibold self-center">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ─── Item code input field (for forms) ────────────────────────────────────────

import { ALL_BRANDS } from "@/types/product";

const formSheetLikeInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 13.5,
  color: TOKEN.textPri,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  flex: 1,
};

interface ItemCodesInputProps {
  value: ItemCodes;
  onChange: (codes: ItemCodes) => void;
  disabled?: boolean;
  showValidationError?: boolean;
}

export function ItemCodesInput({
  value,
  onChange,
  disabled,
  showValidationError,
}: ItemCodesInputProps) {
  const handleChange = (brand: ItemCodeBrand, code: string) => {
    onChange({ ...value, [brand]: code });
  };

  const filled = getFilledItemCodes(value);
  const hasAtLeastOne = filled.length > 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {ALL_BRANDS.map((brand) => {
          const config = ITEM_CODE_BRAND_CONFIG[brand];
          return (
            <div key={brand} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {config.label}
                </span>
              </div>
              <input
                value={value[brand] ?? ""}
                onChange={(e) => handleChange(brand, e.target.value.toUpperCase())}
                placeholder={`${brand}-000`}
                style={formSheetLikeInputStyle}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
      {showValidationError && !hasAtLeastOne && (
        <p className="text-[10px] text-destructive font-bold uppercase">
          At least one item code is required
        </p>
      )}
    </div>
  );
}