// ─────────────────────────────────────────────────────────────────────────────
//  JARIS CMS — Design Tokens & Animation Presets
//  Import from any component: import { TOKEN, SPRING_FAST } from "./tokens"
// ─────────────────────────────────────────────────────────────────────────────

export const TOKEN = {
  primary:    "#2563EB",
  secondary:  "#4F46E5",
  accent:     "#06B6D4",
  bg:         "#F8FAFC",
  surface:    "#FFFFFF",
  textPri:    "#0F172A",
  textSec:    "#64748B",
  border:     "#E2E8F0",
  borderHov:  "#CBD5E1",
  danger:     "#EF4444",
  dangerBg:   "#FEF2F2",
  dangerText: "#B91C1C",
} as const;

export const SPRING_FAST = { type: "spring" as const, stiffness: 420, damping: 32 };
export const SPRING_MED  = { type: "spring" as const, stiffness: 350, damping: 30 };
export const EASE_OUT    = { duration: 0.2, ease: "easeOut" as const };
