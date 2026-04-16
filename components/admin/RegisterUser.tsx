"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  ChevronDown,
  Crown,
  ShieldCheck,
  Building2,
  UserCog,
  FlaskConical,
  Briefcase,
  TrendingUp,
  Users,
  FileSearch,
  Megaphone,
  Headset,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { db } from "@/lib/firebase";
import { secondaryAuth } from "@/lib/firebase-secondary";
import { logAuditEvent } from "@/lib/logger";
import { getScopeAccessForRole, getAccessLevelForRole } from "@/lib/rbac";
import { TOKEN } from "@/components/layout/tokens";

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

export type RoleConfig = {
  value: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
};

// ─── Role config ──────────────────────────────────────────────────────────────

export const ROLE_CONFIG: RoleConfig[] = [
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

export function getRoleConfig(role: string): RoleConfig | undefined {
  return ROLE_CONFIG.find((r) => r.value === role?.toLowerCase());
}

// ─── Scope sections ───────────────────────────────────────────────────────────

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

// ─── Scope Switch ─────────────────────────────────────────────────────────────

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
            textTransform: "uppercase" as const,
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
                textTransform: "uppercase" as const,
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
                    transition: "background 0.15s",
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

// ─── Shared field styles ──────────────────────────────────────────────────────

export const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  color: TOKEN.textSec,
  marginBottom: 7,
};

export const fieldInput: React.CSSProperties = {
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RegisterUserFormProps {
  editUser?: AdminUser | null;
  isSuperAdmin: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

// ─── RegisterUserForm ─────────────────────────────────────────────────────────

export function RegisterUserForm({
  editUser,
  isSuperAdmin,
  onSuccess,
  onCancel,
}: RegisterUserFormProps) {
  const isEdit = !!editUser;

  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState(editUser?.fullName ?? "");
  const [email, setEmail] = useState(editUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [role, setRole] = useState(editUser?.role ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    (editUser?.status as "active" | "inactive") ?? "active",
  );
  const [scopeAccess, setScopeAccess] = useState<string[]>(() => {
    if (!editUser) return [];
    return Array.isArray(editUser.scopeAccess) &&
      editUser.scopeAccess.length > 0
      ? editUser.scopeAccess
      : getScopeAccessForRole(editUser.role ?? "");
  });
  const [scopeError, setScopeError] = useState("");
  const [roleDropOpen, setRoleDropOpen] = useState(false);
  const roleDropRef = useRef<HTMLDivElement>(null);

  // Close role dropdown on outside click
  useEffect(() => {
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
  }, []);

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

    // ── Edit mode ────────────────────────────────────────────────────────────
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
      } catch (err: any) {
        toast.error(err.message || "Failed to update.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ── Register mode ─────────────────────────────────────────────────────────
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
        setIsLoading(false);
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
    } catch (err: any) {
      toast.error(err.message || "Registration failed.", { id: t });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleCfg = getRoleConfig(role);

  return (
    <form
      id="register-user-form"
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {/* ── Full Name ── */}
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

      {/* ── Role picker ── */}
      <div>
        <label style={fieldLabel}>
          Account Role <span style={{ color: TOKEN.danger }}>*</span>
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
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                        role === r.value ? `${TOKEN.primary}08` : "transparent",
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

      {/* ── Scope Access ── */}
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

      {/* ── Email (register only) ── */}
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

      {/* ── Password (register only) ── */}
      {!isEdit && (
        <>
          <div>
            <label style={fieldLabel}>
              Password <span style={{ color: TOKEN.danger }}>*</span>
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
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label style={fieldLabel}>
              Confirm Password <span style={{ color: TOKEN.danger }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPw ? "text" : "password"}
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
                onClick={() => setShowConfirmPw((v) => !v)}
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
                {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
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

      {/* ── Status (edit only) ── */}
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
                    status === s ? `${TOKEN.primary}10` : TOKEN.surface,
                  color: status === s ? TOKEN.primary : TOKEN.textSec,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Role preview card ── */}
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
            <selectedRoleCfg.Icon size={15} color={selectedRoleCfg.color} />
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
              style={{ margin: "2px 0 0", fontSize: 10, color: TOKEN.textSec }}
            >
              Access Level: {getAccessLevelForRole(role)}
            </p>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
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
        )}
        <button
          type="submit"
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
            transition: "opacity 0.15s",
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

      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes spin { to { transform: rotate(360deg); } }`,
        }}
      />
    </form>
  );
}
