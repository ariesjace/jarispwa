"use client";

import * as React from "react";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition,
} from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  Search,
  UserPlus,
  Users,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  Check,
  Shield,
  Crown,
  ShieldCheck,
  Warehouse,
  Headset,
  Megaphone,
  FileSearch,
  ShoppingCart,
  FlaskConical,
  UserCog,
  Briefcase,
  TrendingUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { db } from "@/lib/firebase";
import { secondaryAuth } from "@/lib/firebase-secondary";
import { useAuth } from "@/lib/useAuth";
import { logAuditEvent } from "@/lib/logger";
import { getScopeAccessForRole, getAccessLevelForRole } from "@/lib/rbac";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  accessLevel: string;
  scopeAccess?: string[];
  status: "active" | "inactive" | string;
  provider: "password" | "google" | string;
  website?: string;
  createdAt: string;
  lastLogin?: string;
};

// ─── Role config ──────────────────────────────────────────────────────────────

type RoleConfig = {
  value: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
};

const ROLE_CONFIG: RoleConfig[] = [
  {
    value: "superadmin",
    label: "Super Administrator",
    Icon: Crown,
    color: "#e11d48",
    bg: "#fff1f2",
  },
  {
    value: "admin",
    label: "Administrator",
    Icon: ShieldCheck,
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  {
    value: "director",
    label: "Director",
    Icon: Building2,
    color: "#4338ca",
    bg: "#eef2ff",
  },
  {
    value: "pd_manager",
    label: "PD Manager",
    Icon: UserCog,
    color: "#0284c7",
    bg: "#f0f9ff",
  },
  {
    value: "pd_engineer",
    label: "PD Engineer",
    Icon: FlaskConical,
    color: "#0891b2",
    bg: "#ecfeff",
  },
  {
    value: "project_sales",
    label: "Project Sales",
    Icon: Briefcase,
    color: "#059669",
    bg: "#ecfdf5",
  },
  {
    value: "office_sales",
    label: "Office Sales",
    Icon: TrendingUp,
    color: "#0d9488",
    bg: "#f0fdfa",
  },
  {
    value: "hr",
    label: "Human Resources",
    Icon: Users,
    color: "#db2777",
    bg: "#fdf2f8",
  },
  {
    value: "seo",
    label: "SEO Specialist",
    Icon: FileSearch,
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    value: "marketing",
    label: "Marketing",
    Icon: Megaphone,
    color: "#ea580c",
    bg: "#fff7ed",
  },
  {
    value: "csr",
    label: "Customer Support",
    Icon: Headset,
    color: "#2563eb",
    bg: "#eff6ff",
  },
  {
    value: "ecomm",
    label: "E-commerce Specialist",
    Icon: ShoppingCart,
    color: "#65a30d",
    bg: "#f7fee7",
  },
  {
    value: "warehouse",
    label: "Warehouse Staff",
    Icon: Warehouse,
    color: "#475569",
    bg: "#f8fafc",
  },
];

function getRoleConfig(role: string): RoleConfig | undefined {
  return ROLE_CONFIG.find((r) => r.value === role?.toLowerCase());
}

// ─── Scope Access definitions ─────────────────────────────────────────────────

interface ScopeSection {
  resource: string;
  label: string;
  scopes: { key: string; label: string; description: string }[];
}

const SCOPE_SECTIONS: ScopeSection[] = [
  {
    resource: "wildcard",
    label: "Wildcard Access",
    scopes: [
      {
        key: "superadmin",
        label: "Superadmin",
        description: "Bypasses all permission checks",
      },
      {
        key: "read:*",
        label: "Read All",
        description: "Read access to every resource",
      },
      {
        key: "write:*",
        label: "Write All",
        description: "Write access to every resource",
      },
      {
        key: "verify:*",
        label: "Verify All",
        description: "Approve/reject any request",
      },
    ],
  },
  {
    resource: "products",
    label: "Products",
    scopes: [
      {
        key: "read:products",
        label: "Read",
        description: "View and list products",
      },
      {
        key: "write:products",
        label: "Write",
        description: "Create/update products (may need approval)",
      },
      {
        key: "verify:products",
        label: "Verify",
        description: "Approve or reject product requests",
      },
    ],
  },
  {
    resource: "jobs",
    label: "Jobs",
    scopes: [
      {
        key: "read:jobs",
        label: "Read",
        description: "View job listings and applications",
      },
      {
        key: "write:jobs",
        label: "Write",
        description: "Create and manage job postings",
      },
      {
        key: "verify:jobs",
        label: "Verify",
        description: "Approve or reject job requests",
      },
    ],
  },
  {
    resource: "content",
    label: "Content",
    scopes: [
      {
        key: "read:content",
        label: "Read",
        description: "View blogs, FAQs, popups",
      },
      {
        key: "write:content",
        label: "Write",
        description: "Create and edit content",
      },
      {
        key: "verify:content",
        label: "Verify",
        description: "Approve or reject content requests",
      },
    ],
  },
  {
    resource: "inquiries",
    label: "Inquiries",
    scopes: [
      {
        key: "read:inquiries",
        label: "Read",
        description: "View customer inquiries",
      },
      {
        key: "write:inquiries",
        label: "Write",
        description: "Respond to and manage inquiries",
      },
    ],
  },
];

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function ScopeSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: "none",
        background: checked ? TOKEN.primary : TOKEN.border,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

// ─── Scope Access Panel ───────────────────────────────────────────────────────

function ScopeAccessPanel({
  value,
  onChange,
  isSuperAdmin,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  isSuperAdmin: boolean;
  error?: string;
}) {
  const toggle = (key: string) => {
    if (!isSuperAdmin) return;
    onChange(
      value.includes(key) ? value.filter((k) => k !== key) : [...value, key],
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            color: TOKEN.textSec,
          }}
        >
          Scope Access{" "}
          {isSuperAdmin && <span style={{ color: TOKEN.danger }}>*</span>}
        </label>
        {value.length > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 4,
              background: `${TOKEN.primary}12`,
              color: TOKEN.primary,
              border: `1px solid ${TOKEN.primary}30`,
            }}
          >
            {value.length} scope{value.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && (
        <p
          style={{
            fontSize: 10,
            color: TOKEN.danger,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      {SCOPE_SECTIONS.map((section) => (
        <div
          key={section.resource}
          style={{
            border: `1px solid ${TOKEN.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              background: TOKEN.bg,
              borderBottom: `1px solid ${TOKEN.border}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                color: TOKEN.textPri,
                letterSpacing: "0.06em",
              }}
            >
              {section.label}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {section.scopes.map((scope, i) => {
              const isOn = value.includes(scope.key);
              return (
                <div
                  key={scope.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom:
                      i < section.scopes.length - 1
                        ? `1px solid ${TOKEN.border}`
                        : "none",
                    background: isOn ? `${TOKEN.primary}04` : "transparent",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: TOKEN.textPri,
                      }}
                    >
                      {scope.label}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 10,
                        color: TOKEN.textSec,
                      }}
                    >
                      {scope.description}
                    </p>
                  </div>
                  <ScopeSwitch
                    checked={isOn}
                    onChange={() => toggle(scope.key)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Role Badge (inline styled) ───────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg = getRoleConfig(role);
  if (!cfg)
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 4,
          background: TOKEN.bg,
          border: `1px solid ${TOKEN.border}`,
          color: TOKEN.textSec,
        }}
      >
        {role}
      </span>
    );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      <cfg.Icon size={9} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 4,
        background: isActive ? "#dcfce7" : TOKEN.bg,
        color: isActive ? "#15803d" : TOKEN.textSec,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isActive ? "#22c55e" : TOKEN.border,
        }}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ["#2563eb", "#1d4ed8"],
  ["#7c3aed", "#6d28d9"],
  ["#059669", "#047857"],
  ["#d97706", "#b45309"],
  ["#dc2626", "#b91c1c"],
  ["#0891b2", "#0e7490"],
];
function getAvatarGradient(str: string): string[] {
  const hash = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const [a, b] = getAvatarGradient(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${a}, ${b})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.3,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Register / Edit Modal ────────────────────────────────────────────────────

function UserFormModal({
  open,
  onClose,
  editUser,
  isSuperAdmin,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editUser: AdminUser | null;
  isSuperAdmin: boolean;
  onSuccess: () => void;
}) {
  const isEdit = !!editUser;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [scopeAccess, setScopeAccess] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [roleDropOpen, setRoleDropOpen] = useState(false);
  const roleDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && editUser) {
      setFullName(editUser.fullName || "");
      setEmail(editUser.email || "");
      setRole(editUser.role || "");
      setStatus((editUser.status as "active" | "inactive") || "active");
      setScopeAccess(
        Array.isArray(editUser.scopeAccess) && editUser.scopeAccess.length > 0
          ? editUser.scopeAccess
          : getScopeAccessForRole(editUser.role || ""),
      );
    } else {
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("");
      setStatus("active");
      setScopeAccess([]);
    }
    setScopeError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [open, editUser, isEdit]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        roleDropRef.current &&
        !roleDropRef.current.contains(e.target as Node)
      ) {
        setRoleDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, roleDropOpen]);

  const handleRoleChange = (r: string) => {
    setRole(r);
    setScopeAccess(getScopeAccessForRole(r));
    setRoleDropOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !role)
      return toast.error("Full name and role are required.");
    if (scopeAccess.length === 0) {
      setScopeError("At least one scope is required.");
      return toast.error("Select at least one scope.");
    }

    if (isEdit && editUser) {
      setIsLoading(true);
      try {
        await updateDoc(doc(db, "adminaccount", editUser.id), {
          fullName,
          ...(isSuperAdmin && {
            role,
            scopeAccess,
            accessLevel: getAccessLevelForRole(role),
          }),
          status,
          updatedAt: new Date().toISOString(),
        });
        await logAuditEvent({
          action: "update",
          entityType: "user",
          entityId: editUser.id,
          entityName: fullName,
          context: {
            page: "/admin/users",
            source: "user-management:edit",
            collection: "adminaccount",
          },
        });
        toast.success(`${fullName} updated.`);
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err.message || "Failed to update.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Register
    if (!email || !password)
      return toast.error("Email and password are required.");
    if (password !== confirmPassword)
      return toast.error("Passwords do not match.");
    if (password.length < 8)
      return toast.error("Password must be at least 8 characters.");

    setIsLoading(true);
    const t = toast.loading("Creating account…");
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password,
      );
      const newUser = cred.user;
      await updateProfile(newUser, { displayName: fullName });

      const ref = doc(db, "adminaccount", newUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await signOut(secondaryAuth);
        toast.error("Account already exists.", { id: t });
        return;
      }

      await setDoc(ref, {
        uid: newUser.uid,
        email,
        fullName,
        role,
        scopeAccess,
        accessLevel: getAccessLevelForRole(role),
        status: "active",
        website: "disruptivesolutionsinc",
        provider: "password",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      });
      await signOut(secondaryAuth);
      await logAuditEvent({
        action: "create",
        entityType: "user",
        entityId: newUser.uid,
        entityName: fullName,
        context: {
          page: "/admin/users",
          source: "user-management:register",
          collection: "adminaccount",
        },
        metadata: { role, email, scopeAccess },
      });
      toast.success(`${fullName} created.`, { id: t });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Registration failed.", { id: t });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleCfg = getRoleConfig(role);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="form-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 200,
            }}
          />
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
              key="form-dialog"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={SPRING_MED}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 520,
                maxHeight: "90vh",
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "20px 24px 16px",
                  borderBottom: `1px solid ${TOKEN.border}`,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
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
                    }}
                  >
                    {isEdit ? (
                      <Pencil size={17} color={TOKEN.primary} />
                    ) : (
                      <UserPlus size={17} color={TOKEN.primary} />
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 800,
                        color: TOKEN.textPri,
                      }}
                    >
                      {isEdit ? "Edit User" : "New Account"}
                    </p>
                    <p
                      style={{ margin: 0, fontSize: 11, color: TOKEN.textSec }}
                    >
                      {isEdit
                        ? editUser?.email
                        : "Create a new CMS admin account"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
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
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <form
                  id="user-form"
                  onSubmit={handleSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  {/* Full Name */}
                  <div>
                    <label style={fieldLabel}>
                      Full Name <span style={{ color: TOKEN.danger }}>*</span>
                    </label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      disabled={isLoading}
                      required
                      style={fieldInput}
                    />
                  </div>

                  {/* Role picker */}
                  <div>
                    <label style={fieldLabel}>
                      Account Role{" "}
                      <span style={{ color: TOKEN.danger }}>*</span>
                    </label>
                    <div ref={roleDropRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setRoleDropOpen((v) => !v)}
                        style={{
                          ...fieldInput,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          paddingRight: 12,
                        }}
                      >
                        {selectedRoleCfg ? (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ color: selectedRoleCfg.color }}>
                              <selectedRoleCfg.Icon size={13} />
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: TOKEN.textPri,
                              }}
                            >
                              {selectedRoleCfg.label}
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: TOKEN.textSec }}>
                            Select role…
                          </span>
                        )}
                        <ChevronDown
                          size={13}
                          color={TOKEN.textSec}
                          style={{
                            transform: roleDropOpen ? "rotate(180deg)" : "none",
                            transition: "transform 0.15s",
                          }}
                        />
                      </button>
                      <AnimatePresence>
                        {roleDropOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: 0.13 }}
                            style={{
                              position: "absolute",
                              top: "calc(100% + 6px)",
                              left: 0,
                              right: 0,
                              background: TOKEN.surface,
                              border: `1px solid ${TOKEN.border}`,
                              borderRadius: 12,
                              boxShadow: "0 8px 24px -4px rgba(15,23,42,0.12)",
                              zIndex: 50,
                              maxHeight: 240,
                              overflowY: "auto",
                            }}
                          >
                            {ROLE_CONFIG.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => handleRoleChange(r.value)}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "10px 14px",
                                  border: "none",
                                  background:
                                    role === r.value
                                      ? `${TOKEN.primary}08`
                                      : "transparent",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  borderBottom: `1px solid ${TOKEN.border}`,
                                }}
                              >
                                <span style={{ color: r.color }}>
                                  <r.Icon size={13} />
                                </span>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: TOKEN.textPri,
                                    flex: 1,
                                  }}
                                >
                                  {r.label}
                                </span>
                                {role === r.value && (
                                  <Check size={12} color={TOKEN.primary} />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Scope Access Switches */}
                  {role && (
                    <ScopeAccessPanel
                      value={scopeAccess}
                      onChange={(v) => {
                        setScopeAccess(v);
                        if (v.length > 0) setScopeError("");
                      }}
                      isSuperAdmin={isSuperAdmin}
                      error={scopeError}
                    />
                  )}

                  {/* Email (register only) */}
                  {!isEdit && (
                    <div>
                      <label style={fieldLabel}>
                        Email <span style={{ color: TOKEN.danger }}>*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        disabled={isLoading}
                        required
                        style={fieldInput}
                      />
                    </div>
                  )}

                  {/* Password (register only) */}
                  {!isEdit && (
                    <>
                      <div>
                        <label style={fieldLabel}>
                          Password{" "}
                          <span style={{ color: TOKEN.danger }}>*</span>
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            disabled={isLoading}
                            required
                            style={{ ...fieldInput, paddingRight: 40 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: TOKEN.textSec,
                              display: "flex",
                            }}
                          >
                            {showPassword ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={fieldLabel}>
                          Confirm Password{" "}
                          <span style={{ color: TOKEN.danger }}>*</span>
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            disabled={isLoading}
                            required
                            style={{
                              ...fieldInput,
                              paddingRight: 40,
                              borderColor:
                                confirmPassword && confirmPassword !== password
                                  ? TOKEN.danger
                                  : TOKEN.border,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: TOKEN.textSec,
                              display: "flex",
                            }}
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </div>
                        {confirmPassword && confirmPassword !== password && (
                          <p
                            style={{
                              margin: "5px 0 0",
                              fontSize: 10,
                              color: TOKEN.danger,
                              fontWeight: 700,
                            }}
                          >
                            Passwords do not match
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Status (edit only) */}
                  {isEdit && (
                    <div>
                      <label style={fieldLabel}>Status</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["active", "inactive"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            style={{
                              flex: 1,
                              padding: "9px 0",
                              borderRadius: 10,
                              cursor: "pointer",
                              border: `1px solid ${status === s ? TOKEN.primary : TOKEN.border}`,
                              background:
                                status === s
                                  ? `${TOKEN.primary}10`
                                  : TOKEN.surface,
                              color:
                                status === s ? TOKEN.primary : TOKEN.textSec,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Role preview card */}
                  {selectedRoleCfg && (
                    <div
                      style={{
                        background: TOKEN.bg,
                        border: `1px solid ${TOKEN.border}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: selectedRoleCfg.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <selectedRoleCfg.Icon
                          size={15}
                          color={selectedRoleCfg.color}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            color: TOKEN.textPri,
                          }}
                        >
                          {selectedRoleCfg.label}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 10,
                            color: TOKEN.textSec,
                          }}
                        >
                          Access Level: {getAccessLevelForRole(role)}
                        </p>
                      </div>
                      <RoleBadge role={role} />
                    </div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: `1px solid ${TOKEN.border}`,
                  flexShrink: 0,
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: `1px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    color: TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="user-form"
                  disabled={isLoading}
                  style={{
                    flex: 2,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "none",
                    background: TOKEN.primary,
                    color: "#fff",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? (
                    <Loader2
                      size={16}
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                  ) : isEdit ? (
                    <Check size={15} />
                  ) : (
                    <UserPlus size={15} />
                  )}
                  {isLoading
                    ? isEdit
                      ? "Saving…"
                      : "Creating…"
                    : isEdit
                      ? "Save Changes"
                      : "Create Account"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteUserModal({
  open,
  onClose,
  user,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onConfirm: (u: AdminUser) => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  const expected = user?.email ?? "";
  const canDelete = confirmText.trim() === expected;

  const handleConfirm = async () => {
    if (!user || !canDelete) return;
    setIsDeleting(true);
    try {
      await onConfirm(user);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="del-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 210,
            }}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 211,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="del-dialog"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={SPRING_MED}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: 420,
                background: TOKEN.surface,
                borderRadius: 20,
                border: `1px solid ${TOKEN.border}`,
                boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                padding: 28,
              }}
            >
              {/* Close btn */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 8,
                }}
              >
                <button
                  onClick={onClose}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: `1px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: TOKEN.dangerBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={24} color={TOKEN.danger} />
                </div>
              </div>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "center",
                  color: TOKEN.textPri,
                  margin: "0 0 8px",
                }}
              >
                Remove User
              </p>
              <p
                style={{
                  fontSize: 13.5,
                  textAlign: "center",
                  color: TOKEN.textSec,
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                This will remove the Firestore record. Firebase Auth will not be
                affected.
              </p>
              <div
                style={{
                  background: TOKEN.bg,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: TOKEN.textSec,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  User to remove
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: TOKEN.textPri,
                  }}
                >
                  {user?.fullName || "—"}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: TOKEN.textSec,
                    fontFamily: "monospace",
                  }}
                >
                  {user?.email}
                </p>
              </div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: TOKEN.textSec,
                  marginBottom: 8,
                }}
              >
                Type{" "}
                <strong
                  style={{ color: TOKEN.textPri, fontFamily: "monospace" }}
                >
                  {expected}
                </strong>{" "}
                to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expected}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canDelete) handleConfirm();
                }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${confirmText.length > 0 ? (canDelete ? "#22c55e" : TOKEN.danger) : TOKEN.border}`,
                  background: TOKEN.surface,
                  fontSize: 14,
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 16,
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={onClose}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: `1px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    color: TOKEN.textSec,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canDelete || isDeleting}
                  style={{
                    flex: 2,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "none",
                    background: canDelete ? TOKEN.danger : TOKEN.border,
                    color: canDelete ? "#fff" : TOKEN.textSec,
                    opacity: canDelete ? 1 : 0.6,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: canDelete ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {isDeleting ? (
                    <Loader2
                      size={16}
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  {isDeleting ? "Removing…" : "Remove User"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: TOKEN.textSec,
  marginBottom: 7,
};
const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  fontSize: 13.5,
  color: TOKEN.textPri,
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
};

// ─── Inline table styles ───────────────────────────────────────────────────────

const tableContainerStyle: React.CSSProperties = {
  border: `1px solid ${TOKEN.border}`,
  borderRadius: 16,
  overflow: "hidden",
  background: TOKEN.surface,
};
const stickyHeadStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: TOKEN.surface,
  zIndex: 10,
  borderBottom: `1px solid ${TOKEN.border}`,
  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
};
const thStyle: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: TOKEN.textSec,
};
const tdStyle: React.CSSProperties = {
  padding: "12px 12px",
  verticalAlign: "middle",
};
const pageBtnStyle: React.CSSProperties = {
  padding: 6,
  borderRadius: 8,
  border: `1px solid ${TOKEN.border}`,
  background: TOKEN.surface,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 6,
  cursor: "pointer",
  color: TOKEN.textSec,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// ─── FAB ──────────────────────────────────────────────────────────────────────

function AddUserFAB({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 20,
        zIndex: 110,
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "none",
        background: TOKEN.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: `0 8px 24px -4px ${TOKEN.primary}60`,
      }}
    >
      <UserPlus size={22} color="#fff" />
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role?.toLowerCase() === "superadmin";

  const [data, setData] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => setGlobalFilter(value));
    }, 300);
  }, []);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "adminaccount"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as AdminUser[],
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const handleDelete = async (user: AdminUser) => {
    await deleteDoc(doc(db, "adminaccount", user.id));
    await logAuditEvent({
      action: "delete",
      entityType: "user",
      entityId: user.id,
      entityName: user.fullName || user.email,
      context: {
        page: "/admin/users",
        source: "user-management:delete",
        collection: "adminaccount",
      },
    });
    toast.success(`${user.fullName || user.email} removed.`);
  };

  const handleBulkDelete = async () => {
    const rows = table.getFilteredSelectedRowModel().rows;
    setIsBulkDeleting(true);
    const t = toast.loading(`Removing ${rows.length} users…`);
    try {
      const batch = writeBatch(db);
      rows.forEach(({ original }) =>
        batch.delete(doc(db, "adminaccount", original.id)),
      );
      await batch.commit();
      toast.success(`${rows.length} users removed.`, { id: t });
      setRowSelection({});
      setBulkDeleteOpen(false);
    } catch {
      toast.error("Bulk delete failed.", { id: t });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (u: AdminUser) => {
    setEditTarget(u);
    setFormOpen(true);
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div style={{ marginLeft: 8 }}>
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div style={{ marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "avatar",
        header: () => null,
        cell: ({ row }) => (
          <UserAvatar
            name={row.original.fullName || row.original.email}
            size={34}
          />
        ),
        enableSorting: false,
      },
      {
        id: "identity",
        header: "Name",
        accessorFn: (u) => `${u.fullName || ""} ${u.email || ""}`,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: TOKEN.textPri,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {u.fullName || "—"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: TOKEN.textSec,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "monospace",
                }}
              >
                {u.email}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
        filterFn: (row, _, filterValue) =>
          !filterValue || row.original.role === filterValue,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: (row, _, filterValue) =>
          !filterValue || row.original.status === filterValue,
      },
      {
        accessorKey: "provider",
        header: "Auth",
        cell: ({ row }) => {
          const p = row.original.provider;
          return (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 4,
                background: TOKEN.bg,
                border: `1px solid ${TOKEN.border}`,
                color: TOKEN.textSec,
              }}
            >
              {p === "google" ? "Google" : "Password"}
            </span>
          );
        },
      },
      {
        accessorFn: (u) => (u.createdAt ? new Date(u.createdAt).getTime() : 0),
        id: "createdAt",
        header: "Created",
        cell: ({ row }) => {
          const v = row.original.createdAt;
          if (!v)
            return (
              <span style={{ fontSize: 11, color: TOKEN.textSec }}>—</span>
            );
          return (
            <span style={{ fontSize: 11, color: TOKEN.textSec }}>
              {new Date(v).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div style={{ textAlign: "right", paddingRight: 8 }}>Actions</div>
        ),
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                paddingRight: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                style={iconBtnStyle}
                title="Edit"
                onClick={() => openEdit(u)}
              >
                <Pencil size={14} />
              </button>
              {isSuperAdmin && (
                <button
                  style={{ ...iconBtnStyle, color: TOKEN.danger }}
                  title="Remove"
                  onClick={() => setDeleteTarget(u)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [isSuperAdmin],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const isBulk = selectedRows.length > 0;
  const activeRoleFilter =
    (table.getColumn("role")?.getFilterValue() as string) ?? "";
  const activeStatusFilter =
    (table.getColumn("status")?.getFilterValue() as string) ?? "";
  const hasFilters = !!(globalFilter || activeRoleFilter || activeStatusFilter);

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((u) => m.set(u.role, (m.get(u.role) ?? 0) + 1));
    return m;
  }, [data]);

  if (loading)
    return (
      <div
        style={{
          padding: "100px 0",
          textAlign: "center",
          color: TOKEN.textSec,
        }}
      >
        <div className="spinner" />
        <p
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.3em",
            marginTop: 12,
          }}
        >
          LOADING DATA
        </p>
        <style
          dangerouslySetInnerHTML={{
            __html: `.spinner{width:24px;height:24px;border:2px solid ${TOKEN.border};border-top-color:${TOKEN.primary};border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;}@keyframes spin{to{transform:rotate(360deg);}}`,
          }}
        />
      </div>
    );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
      }}
    >
      {/* ── Sticky toolbar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: TOKEN.bg,
          paddingTop: 16,
          paddingBottom: 16,
          marginLeft: isMobile ? -16 : -24,
          marginRight: isMobile ? -16 : -24,
          paddingLeft: isMobile ? 16 : 24,
          paddingRight: isMobile ? 16 : 24,
          boxShadow: `0 8px 0 0 ${TOKEN.bg}, 0 9px 0 0 ${TOKEN.border}22`,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                color: TOKEN.textPri,
              }}
            >
              User Management
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: TOKEN.bg,
                border: `1px solid ${TOKEN.border}`,
                borderRadius: 6,
                padding: "2px 8px",
                color: TOKEN.textSec,
                fontFamily: "monospace",
              }}
            >
              {table.getFilteredRowModel().rows.length}
            </span>
          </div>
          {!isMobile && isSuperAdmin && (
            <button
              onClick={openAdd}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 12,
                border: "none",
                background: TOKEN.primary,
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserPlus size={15} /> Add User
            </button>
          )}
        </div>

        {/* Bulk banner — desktop */}
        {!isMobile && isBulk && (
          <div
            style={{
              background: `${TOKEN.primary}10`,
              border: `1px solid ${TOKEN.primary}30`,
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 700, color: TOKEN.textPri }}
            >
              {selectedRows.length} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...actionBtnStyle }}
                onClick={() => table.resetRowSelection()}
              >
                Cancel
              </button>
              {isSuperAdmin && (
                <button
                  style={{
                    ...actionBtnStyle,
                    background: TOKEN.dangerBg,
                    color: TOKEN.dangerText,
                    border: `1px solid ${TOKEN.danger}33`,
                  }}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 size={13} /> Remove {selectedRows.length}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile bulk banner */}
        {isMobile && isBulk && (
          <div
            style={{
              background: TOKEN.surface,
              border: `1px solid ${TOKEN.primary}`,
              borderRadius: 12,
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              style={{ fontSize: 15, fontWeight: 800, color: TOKEN.primary }}
            >
              {selectedRows.length} selected
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {isSuperAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button style={iconBtnStyle}>
                      <MoreHorizontal size={20} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setBulkDeleteOpen(true)}
                      style={{ color: TOKEN.danger, fontWeight: 700 }}
                    >
                      <Trash2 size={13} className="mr-2" /> Remove Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                style={iconBtnStyle}
                onClick={() => table.resetRowSelection()}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Search + filters */}
        {!isBulk && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                maxWidth: isMobile ? "none" : 360,
              }}
            >
              <Search
                size={15}
                color={TOKEN.textSec}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder="Search users…"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 40px",
                  fontSize: 13,
                  background: TOKEN.surface,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: 12,
                  color: TOKEN.textPri,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    startTransition(() => setGlobalFilter(""));
                  }}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                    display: "flex",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Role filter */}
            <select
              value={activeRoleFilter}
              onChange={(e) =>
                table.getColumn("role")?.setFilterValue(e.target.value)
              }
              style={{
                padding: "9px 12px",
                fontSize: 12.5,
                borderRadius: 10,
                border: activeRoleFilter
                  ? `1px solid ${TOKEN.primary}`
                  : `1px solid ${TOKEN.border}`,
                background: activeRoleFilter
                  ? `${TOKEN.primary}08`
                  : TOKEN.surface,
                color: activeRoleFilter ? TOKEN.primary : TOKEN.textPri,
                fontWeight: activeRoleFilter ? 700 : 500,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Roles</option>
              {ROLE_CONFIG.filter(
                (r) => (roleCounts.get(r.value) ?? 0) > 0,
              ).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({roleCounts.get(r.value)})
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={activeStatusFilter}
              onChange={(e) =>
                table.getColumn("status")?.setFilterValue(e.target.value)
              }
              style={{
                padding: "9px 12px",
                fontSize: 12.5,
                borderRadius: 10,
                border: activeStatusFilter
                  ? `1px solid ${TOKEN.primary}`
                  : `1px solid ${TOKEN.border}`,
                background: activeStatusFilter
                  ? `${TOKEN.primary}08`
                  : TOKEN.surface,
                color: activeStatusFilter ? TOKEN.primary : TOKEN.textPri,
                fontWeight: activeStatusFilter ? 700 : 500,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => {
                  setSearchInput("");
                  startTransition(() => setGlobalFilter(""));
                  table.getColumn("role")?.setFilterValue("");
                  table.getColumn("status")?.setFilterValue("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1px solid ${TOKEN.border}`,
                  background: TOKEN.surface,
                  fontSize: 12,
                  fontWeight: 600,
                  color: TOKEN.textSec,
                  cursor: "pointer",
                }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="desktop-view" style={tableContainerStyle}>
        <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead style={stickyHeadStyle}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={thStyle}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: "64px 0",
                      textAlign: "center",
                      color: TOKEN.textSec,
                    }}
                  >
                    <Users
                      size={32}
                      style={{ margin: "0 auto 10px", opacity: 0.2 }}
                    />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      No users found
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: `1px solid ${TOKEN.border}`,
                      background: row.getIsSelected()
                        ? `${TOKEN.primary}05`
                        : "transparent",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = TOKEN.bg)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = row.getIsSelected()
                        ? `${TOKEN.primary}05`
                        : "transparent")
                    }
                    onClick={() => openEdit(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} style={tdStyle}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: TOKEN.surface,
            borderTop: `1px solid ${TOKEN.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: TOKEN.textSec }}>
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: TOKEN.textSec }}>Rows:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: `1px solid ${TOKEN.border}`,
                  fontSize: 13,
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={pageBtnStyle}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: TOKEN.textSec }}
            >
              {table.getState().pagination.pageIndex + 1} /{" "}
              {table.getPageCount() || 1}
            </span>
            <button
              style={pageBtnStyle}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div
        className="mobile-view"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingTop: 8,
          paddingBottom: 100,
        }}
      >
        {table.getFilteredRowModel().rows.length === 0 ? (
          <div
            style={{
              padding: "80px 0",
              textAlign: "center",
              color: TOKEN.textSec,
            }}
          >
            <Users size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: TOKEN.textPri,
                marginBottom: 6,
              }}
            >
              No users found
            </p>
          </div>
        ) : (
          table.getFilteredRowModel().rows.map((row) => {
            const u = row.original;
            const isSelected = row.getIsSelected();
            return (
              <div
                key={row.id}
                style={{
                  borderRadius: 16,
                  padding: "16px 14px",
                  border: `1px solid ${isSelected ? TOKEN.primary : TOKEN.border}`,
                  background: isSelected ? `${TOKEN.primary}08` : TOKEN.surface,
                  cursor: "pointer",
                  userSelect: "none",
                  position: "relative",
                }}
                onClick={() => (isBulk ? row.toggleSelected() : openEdit(u))}
                onTouchStart={(e) => {
                  const timer = setTimeout(() => row.toggleSelected(true), 500);
                  e.currentTarget.addEventListener("touchend", () => clearTimeout(timer), { once: true });
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      background: TOKEN.primary,
                      borderRadius: "50%",
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 10,
                    }}
                  >
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div
                  style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
                >
                  <UserAvatar name={u.fullName || u.email} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: TOKEN.textPri,
                        }}
                      >
                        {u.fullName || "—"}
                      </p>
                      <StatusBadge status={u.status} />
                    </div>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 11,
                        color: TOKEN.textSec,
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.email}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <RoleBadge role={u.role} />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: TOKEN.bg,
                          border: `1px solid ${TOKEN.border}`,
                          color: TOKEN.textSec,
                        }}
                      >
                        {u.provider === "google" ? "Google" : "Password"}
                      </span>
                    </div>
                    {!isBulk && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(u);
                          }}
                          style={{
                            flex: 1,
                            padding: "7px 0",
                            borderRadius: 8,
                            border: `1px solid ${TOKEN.border}`,
                            background: TOKEN.surface,
                            color: TOKEN.textSec,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                          }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(u);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 0",
                              borderRadius: 8,
                              border: `1px solid ${TOKEN.danger}33`,
                              background: TOKEN.dangerBg,
                              color: TOKEN.dangerText,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                            }}
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Mobile FAB ── */}
      {isMobile && isSuperAdmin && !isBulk && <AddUserFAB onClick={openAdd} />}

      {/* ── Bulk delete confirm ── */}
      <AnimatePresence>
        {bulkDeleteOpen && (
          <>
            <motion.div
              key="bulk-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isBulkDeleting && setBulkDeleteOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.45)",
                backdropFilter: "blur(4px)",
                zIndex: 210,
              }}
            />
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 211,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                pointerEvents: "none",
              }}
            >
              <motion.div
                key="bulk-dialog"
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={SPRING_MED}
                style={{
                  pointerEvents: "auto",
                  width: "100%",
                  maxWidth: 400,
                  background: TOKEN.surface,
                  borderRadius: 20,
                  border: `1px solid ${TOKEN.border}`,
                  boxShadow: "0 24px 64px -12px rgba(15,23,42,0.22)",
                  padding: 28,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 8,
                  }}
                >
                  <button
                    onClick={() => setBulkDeleteOpen(false)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${TOKEN.border}`,
                      background: TOKEN.surface,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: TOKEN.textSec,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: TOKEN.dangerBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={24} color={TOKEN.danger} />
                  </div>
                </div>
                <p
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    textAlign: "center",
                    color: TOKEN.textPri,
                    margin: "0 0 8px",
                  }}
                >
                  Remove {selectedRows.length} Users
                </p>
                <p
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color: TOKEN.textSec,
                    margin: "0 0 24px",
                    lineHeight: 1.6,
                  }}
                >
                  Firestore records will be permanently removed. Firebase Auth
                  accounts will not be affected.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setBulkDeleteOpen(false)}
                    disabled={isBulkDeleting}
                    style={{
                      flex: 1,
                      padding: "11px 0",
                      borderRadius: 12,
                      border: `1px solid ${TOKEN.border}`,
                      background: TOKEN.surface,
                      color: TOKEN.textSec,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    style={{
                      flex: 2,
                      padding: "11px 0",
                      borderRadius: 12,
                      border: "none",
                      background: TOKEN.danger,
                      color: "#fff",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {isBulkDeleting ? (
                      <Loader2
                        size={16}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    {isBulkDeleting
                      ? "Removing…"
                      : `Remove ${selectedRows.length}`}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <UserFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        editUser={editTarget}
        isSuperAdmin={isSuperAdmin}
        onSuccess={() => {}}
      />
      <DeleteUserModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        user={deleteTarget}
        onConfirm={handleDelete}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .desktop-view { display: none !important; }
        .mobile-view { display: flex; }
        @media (min-width: 1024px) {
          .desktop-view { display: flex !important; flex-direction: column; gap: 16px; }
          .mobile-view { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `,
        }}
      />
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: TOKEN.surface,
  border: `1px solid ${TOKEN.border}`,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: TOKEN.textPri,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
