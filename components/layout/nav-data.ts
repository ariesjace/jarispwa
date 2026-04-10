// ─────────────────────────────────────────────────────────────────────────────
//  JARIS CMS — Nav Data & Types
// ─────────────────────────────────────────────────────────────────────────────

import {
  Package,
  Briefcase,
  FileText,
  Shield,
  Search,
  Plus,
  Bell,
} from "lucide-react";
import React from "react";

export type NavId = "products" | "jobs" | "content" | "admin";

export interface NavSection {
  id:    NavId;
  label: string;
  Icon:  React.ElementType;
  tabs:  readonly string[];
}

export interface CmsUser {
  name:     string;
  role:     string;
  initials: string;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id:    "products",
    label: "Products",
    Icon:  Package,
    tabs: [
      "All Products", "Taskflow",     "Shopify",    "Requests",
      "Applications", "Brands",       "Families",   "Orders",
      "Reviews",      "Solutions",    "Series",     "Specs",
    ],
  },
  {
    id:    "jobs",
    label: "Jobs",
    Icon:  Briefcase,
    tabs:  ["Applications", "Careers"],
  },
  {
    id:    "content",
    label: "Content",
    Icon:  FileText,
    tabs:  ["Blogs", "FAQs", "Popups", "Projects"],
  },
  {
    id:    "admin",
    label: "Admin",
    Icon:  Shield,
    tabs:  ["Recycle Bin", "User Management"],
  },
] as const;

export const FAB_QUICK_ACTIONS = [
  { id: "search",  label: "Search",  Icon: Search, color: "#2563EB" },
  { id: "add",     label: "Add New", Icon: Plus,   color: "#4F46E5" },
  { id: "alerts",  label: "Alerts",  Icon: Bell,   color: "#06B6D4" },
] as const;

export const PLACEHOLDER_USER: CmsUser = {
  name:     "Alex Rivera",
  role:     "Director / Sales",
  initials: "AR",
};
