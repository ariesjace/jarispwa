// ─────────────────────────────────────────────────────────────────────────────
//  JARIS CMS — Global Component Barrel
//
//  Usage examples:
//
//    import CMSLayout from "@/components/cms"
//
//    import { Sidebar, AppHeader, BottomNav, FAB, FloatingMenu, LogoutModal, NavAvatar } from "@/components/cms"
//
//    import { TOKEN, NAV_SECTIONS, type NavId, type CmsUser } from "@/components/cms"
// ─────────────────────────────────────────────────────────────────────────────

// Layout shell
export { CMSLayout }           from "./CMSLayout";
export { default }             from "./CMSLayout";

// Layout sections
export { Sidebar }             from "./Sidebar";
export { AppHeader }           from "./AppHeader";
export { BottomNav }           from "./BottomNav";
export { FAB }                 from "./FAB";
export { FloatingMenu }        from "./FloatingMenu";
export { LogoutModal }         from "./LogoutModal";
export { NavAvatar }           from "./NavAvatar";

// Data & tokens
export { TOKEN, SPRING_FAST, SPRING_MED, EASE_OUT } from "./tokens";
export {
  NAV_SECTIONS,
  FAB_QUICK_ACTIONS,
  PLACEHOLDER_USER,
}                              from "./nav-data";

// Types
export type { NavId, NavSection, CmsUser }          from "./nav-data";
export type { SidebarProps }                        from "./Sidebar";
export type { AppHeaderProps }                      from "./AppHeader";
export type { BottomNavProps }                      from "./BottomNav";
export type { FABProps }                            from "./FAB";
export type { FloatingMenuProps }                   from "./FloatingMenu";
export type { LogoutModalProps }                    from "./LogoutModal";
export type { NavAvatarProps }                      from "./NavAvatar";
export type { CMSLayoutProps }                      from "./CMSLayout";

// ── Page stub exports (drop-in route placeholders) ────────────────────────────
export function ProductsPage()        { return null; }
export function AllProductsPage()     { return null; }
export function TaskflowPage()        { return null; }
export function ShopifyPage()         { return null; }
export function RequestsPage()        { return null; }
export function ApplicationsPage()    { return null; }
export function BrandsPage()          { return null; }
export function FamiliesPage()        { return null; }
export function OrdersPage()          { return null; }
export function ReviewsPage()         { return null; }
export function SolutionsPage()       { return null; }
export function SeriesPage()          { return null; }
export function SpecsPage()           { return null; }
export function JobsPage()            { return null; }
export function JobApplicationsPage() { return null; }
export function CareersPage()         { return null; }
export function ContentPage()         { return null; }
export function BlogsPage()           { return null; }
export function FAQsPage()            { return null; }
export function PopupsPage()          { return null; }
export function ProjectsPage()        { return null; }
export function AdminPage()           { return null; }
export function RecycleBinPage()      { return null; }
export function UserManagementPage()  { return null; }
